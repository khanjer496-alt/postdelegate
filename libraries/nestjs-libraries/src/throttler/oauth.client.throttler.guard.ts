import { ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  ThrottlerLimitDetail,
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
  private readonly _logger = new Logger(ThrottlerOAuthClientGuard.name);

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

  // one line per refused request, so a production watch can tell a partner
  // client from an unknown caller: only the tracker type, never the
  // client_id, the address or the hashed key
  protected override async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail
  ): Promise<void> {
    const { req } = this.getRequestResponse(context);
    const tracker = throttlerLimitDetail.tracker.startsWith('client_')
      ? 'client'
      : 'ip';
    this._logger.warn(
      `OAuth rate limit hit: path=${req.route?.path || req.path} tracker=${tracker} limit=${throttlerLimitDetail.limit} ttl=${throttlerLimitDetail.ttl}`
    );
    return super.throwThrottlingException(context, throttlerLimitDetail);
  }
}
