import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  ThrottlerModuleOptions,
  ThrottlerRequest,
  ThrottlerStorage,
} from '@nestjs/throttler';
import { OAuthService } from '@gitroom/nestjs-libraries/database/prisma/oauth/oauth.service';
import { extractBasicCredentials } from '@gitroom/nestjs-libraries/chat/oauth-types';
import {
  getClientIp,
  RATE_LIMITS,
} from '@gitroom/nestjs-libraries/throttler/throttler.provider';

// route-level guard for /oauth/token and /oauth/revoke: a registered client
// gets its own allowance per address, so the users of one partner server do
// not share one budget. A missing or unknown client_id is counted per address
// only, with the lower limit (see RATE_LIMITS)
@Injectable()
export class ThrottlerOAuthClientGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
    private _oauthService: OAuthService
  ) {
    super(options, storageService, reflector);
  }

  // the client the request says it is, from the Authorization header
  // (client_secret_basic) or the body, as the controller reads it
  private async registeredClient(req: Record<string, any>) {
    const clientId =
      extractBasicCredentials(req.headers?.authorization)?.clientId ||
      req.body?.client_id;
    if (typeof clientId !== 'string' || !clientId || clientId.length > 200) {
      return undefined;
    }
    try {
      return (await this._oauthService.isRegisteredClient(clientId))
        ? clientId
        : undefined;
    } catch (err) {
      // counted with the stricter per address limit
      return undefined;
    }
  }

  protected override async handleRequest(
    requestProps: ThrottlerRequest
  ): Promise<boolean> {
    const { req } = this.getRequestResponse(requestProps.context);
    const ip = getClientIp(req);
    const clientId = await this.registeredClient(req);

    return super.handleRequest({
      ...requestProps,
      limit: clientId ? RATE_LIMITS.oauthClient : RATE_LIMITS.oauthUnknownClient,
      getTracker: () =>
        clientId ? `client_${clientId}_${ip}` : `ip_${ip}`,
    });
  }
}
