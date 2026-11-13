// the real services pull in prisma and the MCP client, the spec only needs
// the routes, their limits and their validation
jest.mock('@gitroom/nestjs-libraries/database/prisma/oauth/oauth.service', () => ({
  OAuthService: class {},
}));
jest.mock('@gitroom/nestjs-libraries/chat/mcp.relay.service', () => ({
  McpRelayService: class {},
}));

import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { OAuthService } from '@gitroom/nestjs-libraries/database/prisma/oauth/oauth.service';
import { McpRelayService } from '@gitroom/nestjs-libraries/chat/mcp.relay.service';
import {
  RATE_LIMITS,
  ThrottlerRealIpGuard,
} from '@gitroom/nestjs-libraries/throttler/throttler.provider';
import { ThrottlerOAuthClientGuard } from '@gitroom/nestjs-libraries/throttler/oauth.client.throttler.guard';
import { OAuthController } from './oauth.controller';

const proto: any = OAuthController.prototype;

const limitOf = (name: string) => ({
  guards: Reflect.getMetadata('__guards__', proto[name]) || [],
  limit: Reflect.getMetadata('THROTTLER:LIMITdefault', proto[name]),
  ttl: Reflect.getMetadata('THROTTLER:TTLdefault', proto[name]),
});

const HOUR = 60 * 60 * 1000;

describe('OAuthController rate limits', () => {
  it('keeps the agreed numbers', () => {
    expect(RATE_LIMITS).toMatchObject({
      ttl: HOUR,
      oauthClient: 600,
      oauthUnknownClient: 60,
      oauthRegister: 300,
      channelAnalytics: 60,
    });
  });

  it.each([
    ['register', ThrottlerRealIpGuard, 300],
    ['token', ThrottlerOAuthClientGuard, 600],
    ['revoke', ThrottlerOAuthClientGuard, 600],
    ['authorizeSelfHosted', ThrottlerRealIpGuard, 30],
    ['hubspotCallback', ThrottlerRealIpGuard, 30],
  ])('%s is limited per hour', (name, guard, limit) => {
    const found = limitOf(name);
    expect(found.guards).toContain(guard);
    expect(found.limit).toBe(limit);
    expect(found.ttl).toBe(HOUR);
  });
});

describe('OAuthController over HTTP', () => {
  const oauth = {
    revokeToken: jest.fn().mockResolvedValue({}),
    refreshAccessToken: jest.fn().mockResolvedValue({ access_token: 'pos_x' }),
    registerDynamicClient: jest.fn().mockResolvedValue({ client_id: 'new' }),
    // the apps that exist
    isRegisteredClient: jest.fn(async (id: string) => id.startsWith('client-')),
  };

  const start = async () => {
    const module = await Test.createTestingModule({
      // the app default (90 an hour) is above the small route limits below
      imports: [ThrottlerModule.forRoot([{ ttl: HOUR, limit: 90 }])],
      controllers: [OAuthController],
      providers: [
        { provide: OAuthService, useValue: oauth },
        { provide: McpRelayService, useValue: {} },
      ],
    }).compile();
    const app = module.createNestApplication();
    // as in main.ts
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.listen(0, '127.0.0.1');
    const base = (await app.getUrl()).replace('[::1]', '127.0.0.1');
    const post = (
      path: string,
      body: Record<string, unknown>,
      ip = '203.0.113.7',
      headers: Record<string, string> = {}
    ) =>
      fetch(base + path, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': ip,
          ...headers,
        },
        body: JSON.stringify(body),
      });
    return { app, post };
  };

  const saved = { ...RATE_LIMITS };
  beforeEach(() => {
    jest.clearAllMocks();
    // the guard reads the limits on every request: small ones keep this fast
    RATE_LIMITS.oauthClient = 3;
    RATE_LIMITS.oauthUnknownClient = 2;
  });
  afterEach(() => {
    Object.assign(RATE_LIMITS, saved);
  });

  const refresh = (clientId?: string) => ({
    grant_type: 'refresh_token',
    refresh_token: 'pos_abc',
    ...(clientId ? { client_id: clientId } : {}),
  });
  const revoke = (clientId?: string) => ({
    token: 'pos_abc',
    ...(clientId ? { client_id: clientId } : {}),
  });

  it('/revoke ignores a token_type_hint it does not know (RFC 7009 §2.1)', async () => {
    RATE_LIMITS.oauthClient = 600;
    const { app, post } = await start();
    try {
      for (const hint of ['id_token', 'urn:example:other', 'access_token']) {
        const res = await post('/oauth/revoke', {
          ...revoke('client-1'),
          token_type_hint: hint,
        });
        expect(res.status).toBe(200);
      }
      expect(oauth.revokeToken).toHaveBeenCalledTimes(3);
      expect(oauth.revokeToken).toHaveBeenCalledWith('client-1', 'pos_abc', undefined);
      // still a string, like the other fields
      expect(
        (await post('/oauth/revoke', { ...revoke('client-1'), token_type_hint: 5 }))
          .status
      ).toBe(400);
    } finally {
      await app.close();
    }
  });

  it.each([
    ['/oauth/token', refresh],
    ['/oauth/revoke', revoke],
  ])(
    '%s: two registered clients from one address do not share a bucket',
    async (path, body) => {
      const { app, post } = await start();
      try {
        for (let i = 0; i < 3; i++) {
          expect((await post(path, body('client-a'))).status).toBe(200);
        }
        const refused = await post(path, body('client-a'));
        expect(refused.status).toBe(429);
        expect(Number(refused.headers.get('retry-after'))).toBeGreaterThan(0);

        // another client from the same address, also through Basic auth
        expect((await post(path, body('client-b'))).status).toBe(200);
        const basic = 'Basic ' + Buffer.from('client-b:secret').toString('base64');
        for (let i = 0; i < 2; i++) {
          expect(
            (await post(path, body(), '203.0.113.7', { authorization: basic })).status
          ).toBe(200);
        }
        // client-b has used its 3 now, from either source
        expect((await post(path, body('client-b'))).status).toBe(429);

        // the same client from another address has its own allowance
        expect((await post(path, body('client-a'), '198.51.100.9')).status).toBe(200);
      } finally {
        await app.close();
      }
    }
  );

  it.each([
    ['/oauth/token', refresh],
    ['/oauth/revoke', revoke],
  ])(
    '%s: a missing or unknown client_id shares the per-address bucket',
    async (path, body) => {
      const { app, post } = await start();
      try {
        // made-up ids do not buy a fresh allowance
        expect((await post(path, body('nobody-1'))).status).toBe(200);
        expect((await post(path, body('nobody-2'))).status).toBe(200);
        const refused = await post(path, body());
        expect(refused.status).toBe(429);
        expect(Number(refused.headers.get('retry-after'))).toBeGreaterThan(0);
        expect((await post(path, body('nobody-3'))).status).toBe(429);

        // a registered client from that address is counted on its own
        expect((await post(path, body('client-a'))).status).toBe(200);
        // and the address bucket is per address
        expect((await post(path, body('nobody-1'), '198.51.100.9')).status).toBe(200);
      } finally {
        await app.close();
      }
    }
  );

  it('/oauth/token counts a client per address only when its lookup fails', async () => {
    oauth.isRegisteredClient.mockRejectedValue(new Error('db down'));
    const { app, post } = await start();
    try {
      expect((await post('/oauth/token', refresh('client-a'))).status).toBe(200);
      expect((await post('/oauth/token', refresh('client-b'))).status).toBe(200);
      expect((await post('/oauth/token', refresh('client-a'))).status).toBe(429);
    } finally {
      oauth.isRegisteredClient.mockImplementation(async (id: string) =>
        id.startsWith('client-')
      );
      await app.close();
    }
  });

  it('/oauth/register is limited per address, 300 an hour', async () => {
    const { app, post } = await start();
    const body = { client_name: 'Claude', redirect_uris: ['https://claude.ai/cb'] };
    try {
      for (let i = 0; i < 300; i++) {
        expect((await post('/oauth/register', body)).status).toBe(201);
      }
      const refused = await post('/oauth/register', body);
      expect(refused.status).toBe(429);
      expect(Number(refused.headers.get('retry-after'))).toBeGreaterThan(0);
      // another address has its own allowance
      expect((await post('/oauth/register', body, '198.51.100.9')).status).toBe(201);
    } finally {
      await app.close();
    }
  });
});
