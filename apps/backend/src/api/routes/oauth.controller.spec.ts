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
import { ThrottlerRealIpGuard } from '@gitroom/nestjs-libraries/throttler/throttler.provider';
import { OAuthController } from './oauth.controller';

const proto: any = OAuthController.prototype;

const limitOf = (name: string) => ({
  guards: Reflect.getMetadata('__guards__', proto[name]) || [],
  limit: Reflect.getMetadata('THROTTLER:LIMITdefault', proto[name]),
  ttl: Reflect.getMetadata('THROTTLER:TTLdefault', proto[name]),
});

const HOUR = 60 * 60 * 1000;

describe('OAuthController rate limits', () => {
  it.each([
    ['register', 60, HOUR],
    ['token', 60, HOUR],
    ['revoke', 60, HOUR],
    ['authorizeSelfHosted', 30, HOUR],
    ['hubspotCallback', 30, HOUR],
  ])('%s is limited per client address', (name, limit, ttl) => {
    const found = limitOf(name);
    expect(found.guards).toContain(ThrottlerRealIpGuard);
    expect(found.limit).toBe(limit);
    expect(found.ttl).toBe(ttl);
  });
});

describe('OAuthController over HTTP', () => {
  const oauth = {
    revokeToken: jest.fn().mockResolvedValue({}),
    refreshAccessToken: jest.fn().mockResolvedValue({ access_token: 'pos_x' }),
  };

  const start = async () => {
    const module = await Test.createTestingModule({
      // the app default (90 an hour) is above the route limits, so a 429
      // below it comes from the route
      imports: [ThrottlerModule.forRoot([{ ttl: HOUR, limit: 90 }])],
      controllers: [OAuthController],
      providers: [
        ThrottlerRealIpGuard,
        { provide: OAuthService, useValue: oauth },
        { provide: McpRelayService, useValue: {} },
      ],
    }).compile();
    const app = module.createNestApplication();
    // as in main.ts
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.listen(0, '127.0.0.1');
    const base = (await app.getUrl()).replace('[::1]', '127.0.0.1');
    const post = (path: string, body: unknown, ip = '203.0.113.7') =>
      fetch(base + path, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
        body: JSON.stringify(body),
      });
    return { app, post };
  };

  beforeEach(() => jest.clearAllMocks());

  it('/revoke ignores a token_type_hint it does not know (RFC 7009 §2.1)', async () => {
    const { app, post } = await start();
    try {
      for (const hint of ['id_token', 'urn:example:other', 'access_token']) {
        const res = await post('/oauth/revoke', {
          token: 'pos_abc',
          token_type_hint: hint,
          client_id: 'client-1',
        });
        expect(res.status).toBe(200);
      }
      expect(oauth.revokeToken).toHaveBeenCalledTimes(3);
      expect(oauth.revokeToken).toHaveBeenCalledWith('client-1', 'pos_abc', undefined);
      // still a string, like the other fields
      expect(
        (await post('/oauth/revoke', { token: 'pos_abc', token_type_hint: 5 })).status
      ).toBe(400);
    } finally {
      await app.close();
    }
  });

  it.each([
    ['/oauth/revoke', { token: 'pos_abc', client_id: 'client-1' }],
    [
      '/oauth/token',
      { grant_type: 'refresh_token', refresh_token: 'pos_abc', client_id: 'client-1' },
    ],
  ])('%s refuses the 61st call of an hour from one address', async (path, body) => {
    const { app, post } = await start();
    try {
      for (let i = 0; i < 60; i++) {
        expect((await post(path, body)).status).toBe(200);
      }
      expect((await post(path, body)).status).toBe(429);
      // another client has its own allowance
      expect((await post(path, body, '198.51.100.9')).status).toBe(200);
    } finally {
      await app.close();
    }
  });
});
