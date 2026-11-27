import {
  ForbiddenException,
  Injectable,
  Logger,
  NestMiddleware,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AuthService } from '@gitroom/helpers/auth/auth.service';
import { User } from '@prisma/client';
import { OrganizationService } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service';
import { UsersService } from '@gitroom/nestjs-libraries/database/prisma/users/users.service';
import { getAuthCookieOptions } from '@gitroom/helpers/subdomain/subdomain.management';
import { HttpForbiddenException } from '@gitroom/nestjs-libraries/services/exception.filter';
import { MastraService } from '@gitroom/nestjs-libraries/chat/mastra.service';
import { isCrossSiteCookieRequest } from '@gitroom/backend/services/auth/csrf';
import { setSentryUserContext } from '@gitroom/nestjs-libraries/sentry/initialize.sentry';

export const removeAuth = (res: Response) => {
  res.cookie('auth', '', {
    ...getAuthCookieOptions(),
    expires: new Date(0),
    maxAge: -1,
  });
  res.header('logout', 'true');
};

// The user behind a session token, with every check an authenticated request
// gets. Only a session token is a login: reset, activation and invite links
// are signed with the same secret and rejected here. The claims are never
// trusted for authorization (isSuperAdmin, activated, ...), the user is
// always re-resolved from the database using the id.
// null means the token is not a live session. It THROWS when the lookup itself
// fails (the database is down), which says nothing about the session: the
// caller must not treat that as a sign-out.
const lookupSessionUser = async (
  usersService: UsersService,
  auth: string
): Promise<User | null> => {
  let payload: { id: string; pv: string; sv?: number } | null | undefined;
  try {
    payload = AuthService.verifyTypedJWT<{
      id: string;
      pv: string;
      sv?: number;
    }>(auth, 'session');
  } catch (err) {
    return null;
  }

  if (!payload?.id || typeof payload.id !== 'string') {
    return null;
  }

  const user = (await usersService.getUserById(payload.id)) as User | null;

  if (!user) {
    return null;
  }

  try {
    // a password change signs out every session issued before it
    if (payload.pv !== AuthService.passwordFingerprint(user.password)) {
      return null;
    }

    // and so does "sign out of all devices". A session issued before this
    // claim existed carries no sv and is read as 0, which is where every
    // user starts, so the deploy signs nobody out.
    if ((payload.sv ?? 0) !== (user.sessionVersion ?? 0)) {
      return null;
    }

    if (!user.activated) {
      return null;
    }
  } catch (err) {
    return null;
  }

  return user;
};

// The same answer for callers that only ask who is signed in: null for
// anything that is not a live session, it never throws
export const getSessionUser = async (
  usersService: UsersService,
  auth: string
): Promise<User | null> => {
  try {
    return await lookupSessionUser(usersService, auth);
  } catch (err) {
    return null;
  }
};

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(
    private _organizationService: OrganizationService,
    private _userService: UsersService
  ) {}
  async use(req: Request, res: Response, next: NextFunction) {
    const auth = req.headers.auth || req.cookies.auth;
    // Only HttpForbiddenException signs the browser out (401 and the auth
    // cookie cleared). It is reserved for a session that is truly not valid.
    // No credentials at all is a plain 401: there is no session to end, and a
    // cross-site request must not be able to clear the user's cookie.
    if (!auth) {
      throw new UnauthorizedException();
    }

    // the cookie authenticates whatever site the browser sends it from. A
    // rejected request says nothing about the session: plain 403, cookie kept
    if (isCrossSiteCookieRequest(req)) {
      throw new ForbiddenException();
    }

    try {
      const orgHeader = req.cookies.showorg || req.headers.showorg;

      let user = await lookupSessionUser(this._userService, auth as string);

      if (!user) {
        throw new HttpForbiddenException();
      }

      const impersonate = req.cookies.impersonate || req.headers.impersonate;
      if (user?.isSuperAdmin && impersonate) {
        const loadImpersonate = await this._organizationService.getUserOrg(
          impersonate
        );

        if (loadImpersonate) {
          user = loadImpersonate.user;
          user.isSuperAdmin = true;
          delete user.password;

          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-expect-error
          req.user = user;

          // @ts-ignore
          loadImpersonate.organization.users =
            loadImpersonate.organization.users.filter(
              (f) => f.userId === user.id
            );
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-expect-error
          req.org = loadImpersonate.organization;

          setSentryUserContext({
            userId: user.id,
            email: user.email,
            orgId: loadImpersonate.organization.id,
            paymentId: loadImpersonate.organization.paymentId,
          });
          next();
          return;
        }
      }

      delete user.password;
      const organization = (
        await this._organizationService.getOrgsByUserId(user.id)
      ).filter((f) => !f.users[0].disabled);
      const setOrg =
        organization.find((org) => org.id === orgHeader) ||
        organization.find((org) => org.subscription) ||
        organization[0];

      if (!setOrg) {
        throw new HttpForbiddenException();
      }

      if (!setOrg.apiKey) {
        await this._organizationService.updateApiKey(setOrg.id);
      }

      // the user's own session (never while an admin views as them)
      this._userService.updateLastOnline(user);

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      req.user = user;

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      req.org = setOrg;

      setSentryUserContext({
        userId: user.id,
        email: user.email,
        orgId: setOrg.id,
        paymentId: setOrg.paymentId,
      });
    } catch (err) {
      if (err instanceof HttpForbiddenException) {
        throw err;
      }
      // the database or another dependency failed while checking the session:
      // report the outage, keep the session and the cookie
      new Logger('AuthMiddleware').error(
        `Session check failed: ${(err as Error)?.name || 'Error'}`
      );
      throw new ServiceUnavailableException();
    }
    next();
  }
}
