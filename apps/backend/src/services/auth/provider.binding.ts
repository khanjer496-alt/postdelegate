import { createHash } from 'crypto';
import { getCookieSameSite } from '@gitroom/helpers/subdomain/subdomain.management';
import { AuthProviderContext } from './providers.interface';

export const PROVIDER_STATE = /^[a-f0-9]{64}$/;
export const providerNonceCookie = (state: string) => {
  if (!PROVIDER_STATE.test(state || ''))
    throw new Error('Invalid sign-in state');
  return `${process.env.NOT_SECURED ? '' : '__Host-'}auth_provider_${createHash(
    'sha256'
  )
    .update(state)
    .digest('hex')
    .slice(0, 16)}`;
};
export const providerNonceCookieOptions = (seconds: number) => ({
  path: '/',
  httpOnly: true,
  secure: !process.env.NOT_SECURED,
  sameSite: process.env.NOT_SECURED ? ('lax' as const) : getCookieSameSite(),
  maxAge: seconds * 1000,
});
export const providerRequestContext = (
  cookies: Record<string, any> | undefined,
  state?: string
): AuthProviderContext | undefined => {
  if (typeof state !== 'string' || !PROVIDER_STATE.test(state)) return undefined;
  const browserNonce = cookies?.[providerNonceCookie(state!)];
  return typeof browserNonce === 'string' && /^[a-f0-9]{64}$/.test(browserNonce)
    ? { state, browserNonce }
    : undefined;
};
