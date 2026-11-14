import { createHmac, timingSafeEqual, createHash } from 'node:crypto';
export interface Acquisition {
  source: string;
  campaign: string;
  medium: string;
  term: string;
  content: string;
  entry_page: string;
  device: string;
  internal_or_test: boolean;
  nonce: string;
}
// This verification never controls authentication, entitlements or redirects.
export const acquisitionFromToken = (
  token: unknown,
  secret = process.env.PULSE_HANDOFF_SECRET,
  now = Date.now()
): Acquisition | null => {
  try {
    if (
      typeof token !== 'string' ||
      token.length > 2500 ||
      !secret ||
      secret.length < 32
    )
      return null;
    const [payload, signature, extra] = token.split('.');
    if (extra || !/^[a-f0-9]{64}$/.test(signature || '')) return null;
    const mac = createHmac('sha256', secret).update(payload).digest();
    if (!timingSafeEqual(mac, Buffer.from(signature, 'hex'))) return null;
    const value = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8')
    );
    if (
      value.v !== 1 ||
      value.site !== 'postdelegate' ||
      !Number.isFinite(value.issued) ||
      !Number.isFinite(value.expires) ||
      value.issued > now + 60000 ||
      value.expires <= now ||
      value.expires - value.issued !== 86400000 ||
      !/^[a-f0-9-]{36}$/.test(value.nonce) ||
      typeof value.internal_or_test !== 'boolean'
    )
      return null;
    for (const name of [
      'source',
      'campaign',
      'medium',
      'term',
      'content',
      'entry_page',
      'device',
    ]) {
      if (
        typeof value[name] !== 'string' ||
        value[name].length > 300 ||
        /[\r\n\u0000]/.test(value[name])
      )
        return null;
    }
    return value;
  } catch {
    return null;
  }
};
export const measurementHash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
