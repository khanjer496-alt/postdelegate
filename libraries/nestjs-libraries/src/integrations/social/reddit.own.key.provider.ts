import {
  AuthTokenDetails,
  ClientInformation,
  ProviderAuthorizationCredentials,
  ProviderAuthorizationRevocation,
} from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import {
  basicAuthHeader,
  RedditProvider,
} from '@gitroom/nestjs-libraries/integrations/social/reddit.provider';
import { makeSecureId } from '@gitroom/nestjs-libraries/services/make.secure.id';

// Reddit app ids and secrets are url-safe base64; nothing else is accepted, so
// the colon that joins them in the stored refresh token never appears inside.
const appValue = /^[A-Za-z0-9_-]{8,100}$/;
const appValidation = `/^[A-Za-z0-9_-]{8,100}$/`;

// Reddit through the customer's own Reddit app: they create a "web app" at
// reddit.com/prefs/apps, paste its client id and secret, and authorize it with
// their account. Posting, media and the subreddit tools are RedditProvider's;
// only the app differs. Reddit access tokens expire after an hour and the
// refresh needs the same app, so the channel's refresh token carries it:
// clientId:clientSecret:refreshToken (the column is stored encrypted).
export class RedditOwnKeyProvider extends RedditProvider {
  override identifier = 'reddit-own-key';
  override name = 'Reddit\n(Own app)';
  override toolTip =
    'Posts through your own Reddit app, for your personal, non-commercial use under Reddit’s Data API terms. Create a "web app" at reddit.com/prefs/apps and paste its keys.';

  // Field values arrive at the backend by POST, never in a url
  ownAppCredentials(fields: Record<string, string>): ClientInformation | string {
    const clientId = String(fields?.clientId || '').trim();
    const clientSecret = String(fields?.clientSecret || '').trim();
    if (!appValue.test(clientId) || !appValue.test(clientSecret)) {
      return 'Paste the client id (under "web app") and the secret of your Reddit app';
    }
    return { client_id: clientId, client_secret: clientSecret, instanceUrl: '' };
  }

  async customFields() {
    return [
      {
        key: 'clientId',
        label: 'Client ID',
        validation: appValidation,
        type: 'text' as const,
        hint: 'At reddit.com/prefs/apps choose "create another app", pick "web app" and set the redirect uri shown above. The client id is the string under "web app".',
      },
      {
        key: 'clientSecret',
        label: 'Secret',
        validation: appValidation,
        type: 'password' as const,
        hint: 'The "secret" of the same Reddit app. Reddit allows your own app for personal, non-commercial use.',
      },
    ];
  }

  private storedApp(stored = '') {
    const [clientId, clientSecret, ...rest] = String(stored).split(':');
    const refreshToken = rest.join(':');
    if (!clientId || !clientSecret || !refreshToken) {
      return undefined;
    }
    return { clientId, clientSecret, refreshToken };
  }

  protected override basicAuth(storedRefreshToken = '') {
    const app = this.storedApp(storedRefreshToken);
    if (!app) {
      // never fall back to the shared app for a customer's own-app channel
      throw new Error('This Reddit channel has no app credentials, reconnect it');
    }
    return basicAuthHeader(app.clientId, app.clientSecret);
  }

  protected override bareRefreshToken(storedRefreshToken: string) {
    return this.storedApp(storedRefreshToken)?.refreshToken || '';
  }

  // the connect route passes the app from ownAppCredentials
  override async generateAuthUrl(info?: ClientInformation) {
    if (!info?.client_id) {
      throw new Error('Missing Reddit app credentials');
    }
    const state = makeSecureId(6);
    const url = `https://www.reddit.com/api/v1/authorize?client_id=${encodeURIComponent(
      info.client_id
    )}&response_type=code&state=${state}&redirect_uri=${encodeURIComponent(
      this.redirectUri()
    )}&duration=permanent&scope=${encodeURIComponent(this.scopes.join(' '))}`;
    return { url, codeVerifier: makeSecureId(30), state };
  }

  override async authenticate(
    params: { code: string; codeVerifier: string },
    clientInformation?: ClientInformation
  ): Promise<AuthTokenDetails | string> {
    if (!clientInformation?.client_id || !clientInformation?.client_secret) {
      return 'The Reddit app details expired, please connect again';
    }
    const auth = await super.authenticate(params, clientInformation);
    if (typeof auth === 'string' || !auth?.refreshToken) {
      return typeof auth === 'string'
        ? auth
        : 'Reddit did not return a refresh token, please connect again';
    }
    return {
      ...auth,
      refreshToken: `${clientInformation.client_id}:${clientInformation.client_secret}:${auth.refreshToken}`,
    };
  }

  override async revokeAuthorization(
    credentials: ProviderAuthorizationCredentials
  ): Promise<ProviderAuthorizationRevocation> {
    if (!this.storedApp(credentials.refreshToken || '')) {
      return { status: 'unknown' };
    }
    return super.revokeAuthorization(credentials);
  }
}
