import { getAuth } from '@gitroom/nestjs-libraries/chat/async.storage';

export const checkAuth = (
  inputData: any,
  context: any
) => {
  const auth = getAuth();
  const authInfo = context?.mcp?.extra?.authInfo || auth;
  if (authInfo && context?.requestContext) {
    (context.requestContext as any).set(
      'organization',
      JSON.stringify(authInfo)
    );
    (context.requestContext as any).set('ui', 'false');
  }
};

export const SUBSCRIPTION_ENDED_MESSAGE =
  'Your PostDelegate subscription has ended. Renew it from Billing in PostDelegate to keep using this connection.';

// The same rule as the public API (PublicAuthMiddleware): with billing on, an
// organization without a subscription can't use MCP. Billing off (self-hosted)
// never blocks
export const subscriptionEnded = (
  org?: { subscription?: unknown } | null
) => !!process.env.STRIPE_SECRET_KEY && !!org && !org.subscription;
