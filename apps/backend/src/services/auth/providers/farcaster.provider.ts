import { BadRequestException } from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import {
  AuthProvider,
  AuthProviderAbstract,
  AuthProviderContext,
  AuthProviderUser,
} from '../providers.interface';
import { NeynarAPIClient } from '@neynar/nodejs-sdk';
import { ioRedis } from '@gitroom/nestjs-libraries/redis/redis.service';
import { FarcasterProvider as ChannelFarcasterProvider } from '@gitroom/nestjs-libraries/integrations/social/farcaster.provider';
import { PROVIDER_STATE } from '../provider.binding';

const client = new NeynarAPIClient({
  apiKey:
    process.env.NEYNAR_SECRET_KEY || '00000000-000-0000-0000-000000000000',
});
const FLOW_TTL = 600;
const PROOF_TTL = 60;
const REGISTRATION_TTL = 600;
export const FARCASTER_AUTH_COOKIE_TTL =
  FLOW_TTL + PROOF_TTL * 2 + REGISTRATION_TTL;
const MESSAGE =
  'This sign-in expired or belongs to another browser. Start Farcaster sign-in again.';
const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const random = () => randomBytes(32).toString('hex');
type Stage = 'flow' | 'proof' | 'login' | 'register';
interface LoginRecord {
  state: string;
  nonceHash: string;
  purpose: Stage;
  expiresAt: number;
  signerUuid?: string;
  fid?: number;
}
const prefix = { proof: 'fcp_', login: 'fcl_', register: 'fcr_' };
const recordKey = (kind: Stage, value: string) =>
  `farcaster-auth:${kind}:${hash(value)}`;
const invalid = (): never => {
  throw new BadRequestException(MESSAGE);
};

// One fixed parameterized script. Binding, purpose and expiry are checked BEFORE
// deletion so a wrong-browser request cannot burn the legitimate flow/proof.
export const CONSUME_FARCASTER_RECORD = `
local raw = redis.call('GET', KEYS[1])
if not raw then return nil end
local ok, value = pcall(cjson.decode, raw)
if not ok then return nil end
local clock = redis.call('TIME')
local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
if value.nonceHash ~= ARGV[1] or value.state ~= ARGV[2] or value.purpose ~= ARGV[3] or tonumber(value.expiresAt or 0) <= now then return nil end
redis.call('DEL', KEYS[1])
return raw
`;

@AuthProvider({ provider: 'FARCASTER' })
export class FarcasterProvider extends AuthProviderAbstract {
  override readonly requiresBrowserContext = true;
  generateLink() {
    return invalid();
  } // Old UUID callbacks cannot start a login.

  private enabled() {
    if (process.env.FARCASTER_LOGIN_ENABLED !== 'true') return invalid();
  }
  private binding(context?: AuthProviderContext) {
    if (
      !context ||
      !PROVIDER_STATE.test(context.state || '') ||
      !/^[a-f0-9]{64}$/.test(context.browserNonce || '')
    )
      return invalid();
    return { state: context.state!, nonceHash: hash(context.browserNonce!) };
  }
  private tokenKey(kind: 'proof' | 'login' | 'register', code: string) {
    if (
      typeof code !== 'string' ||
      !new RegExp(`^${prefix[kind]}[a-f0-9]{64}$`).test(code)
    )
      return invalid();
    return recordKey(kind, code);
  }
  private async put(
    kind: Stage,
    value: string,
    record: Omit<LoginRecord, 'purpose' | 'expiresAt'>,
    ttl: number
  ) {
    // Never use the non-expiring/non-atomic development MockRedis for auth.
    if (typeof ioRedis.eval !== 'function') return invalid();
    const data: LoginRecord = {
      ...record,
      purpose: kind,
      expiresAt: Date.now() + ttl * 1000,
    };
    if (
      (await ioRedis.set(
        recordKey(kind, value),
        JSON.stringify(data),
        'EX',
        ttl,
        'NX'
      )) !== 'OK'
    )
      return invalid();
  }
  private async read(
    key: string,
    kind: Stage,
    context?: AuthProviderContext
  ): Promise<LoginRecord> {
    const binding = this.binding(context);
    const raw = await ioRedis.get(key);
    if (!raw) return invalid();
    let value: LoginRecord;
    try {
      value = JSON.parse(raw);
    } catch {
      return invalid();
    }
    if (
      value.state !== binding.state ||
      value.purpose !== kind ||
      value.expiresAt <= Date.now() ||
      typeof value.nonceHash !== 'string' ||
      value.nonceHash.length !== 64
    )
      return invalid();
    if (
      !timingSafeEqual(
        Buffer.from(value.nonceHash),
        Buffer.from(binding.nonceHash)
      )
    )
      return invalid();
    if (
      (kind === 'flow' || kind === 'proof') &&
      (typeof value.signerUuid !== 'string' || !value.signerUuid)
    )
      return invalid();
    return value;
  }
  private async take(
    key: string,
    kind: Stage,
    context?: AuthProviderContext
  ): Promise<LoginRecord> {
    const binding = this.binding(context);
    const raw = await ioRedis.eval(
      CONSUME_FARCASTER_RECORD,
      1,
      key,
      binding.nonceHash,
      binding.state,
      kind
    );
    if (typeof raw !== 'string') return invalid();
    return JSON.parse(raw);
  }
  private async ticket(
    kind: 'proof' | 'login' | 'register',
    record: LoginRecord,
    ttl: number
  ) {
    const code = prefix[kind] + random();
    // Publishing credential is needed only until proof redemption. Continuation
    // tickets carry identity/binding, never the signer UUID.
    await this.put(
      kind,
      code,
      {
        state: record.state,
        nonceHash: record.nonceHash,
        fid: record.fid,
        ...(kind === 'proof' ? { signerUuid: record.signerUuid } : {}),
      },
      ttl
    );
    return code;
  }
  async startLogin(browserNonce: string) {
    try {
      this.enabled();
      const state = random();
      const binding = this.binding({ state, browserNonce });
      if (!process.env.NEYNAR_SECRET_KEY || typeof ioRedis.eval !== 'function')
        return invalid();
      const signer = await new ChannelFarcasterProvider().createSigner();
      await this.put(
        'flow',
        state,
        { ...binding, signerUuid: signer.signerUuid },
        FLOW_TTL
      );
      return { state, approvalUrl: signer.approvalUrl, qrCode: signer.qrCode };
    } catch {
      return invalid();
    }
  }
  async loginStatus(state: string, browserNonce: string) {
    try {
      this.enabled();
      const context = { state, browserNonce };
      const flow = await this.read(recordKey('flow', state), 'flow', context);
      const signer = await client.lookupSigner({
        signerUuid: flow.signerUuid!,
      });
      if (signer.status !== 'approved') return { status: signer.status };
      if (!Number.isSafeInteger(signer.fid) || signer.fid! <= 0)
        return invalid();
      const claimed = await this.take(
        recordKey('flow', state),
        'flow',
        context
      );
      const code = await this.ticket(
        'proof',
        { ...claimed, fid: signer.fid },
        PROOF_TTL
      );
      return { status: 'approved', code, state };
    } catch {
      return invalid();
    }
  }
  async getToken(
    code: string,
    _redirectUri?: string,
    context?: AuthProviderContext
  ) {
    try {
      this.enabled();
      const key = this.tokenKey('proof', code); // Reject ALL bare/encoded UUIDs.
      const proof = await this.read(key, 'proof', context);
      const signer = await client.lookupSigner({
        signerUuid: proof.signerUuid!,
      });
      if (signer.status !== 'approved' || signer.fid !== proof.fid)
        return invalid();
      const claimed = await this.take(key, 'proof', context);
      return await this.ticket('login', claimed, PROOF_TTL);
    } catch {
      return invalid();
    }
  }
  async getUser(
    providerToken: string,
    context?: AuthProviderContext
  ): Promise<AuthProviderUser> {
    try {
      this.enabled();
      const kind =
        context?.purpose === 'register'
          ? 'register'
          : context?.purpose === 'login'
          ? 'login'
          : undefined;
      if (!kind) return invalid();
      const claimed = await this.take(
        this.tokenKey(kind, providerToken),
        kind,
        context
      );
      if (!Number.isSafeInteger(claimed.fid) || claimed.fid! <= 0)
        return invalid();
      const identity = {
        id: `farcaster_${claimed.fid}`,
        email: `farcaster_${claimed.fid}`,
      };
      return kind === 'login'
        ? {
            ...identity,
            registrationToken: await this.ticket(
              'register',
              claimed,
              REGISTRATION_TTL
            ),
          }
        : identity;
    } catch {
      return invalid();
    }
  }
}
