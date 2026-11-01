import { OAuthService } from '@gitroom/nestjs-libraries/database/prisma/oauth/oauth.service';

const setup = () => {
  const repository = {
    createDynamicApp: jest.fn(async (data: any) => ({
      ...data,
      name: data.name,
      createdAt: new Date(),
    })),
    deleteStaleDynamicApps: jest.fn().mockResolvedValue(undefined),
  };
  return { service: new OAuthService(repository as any), repository };
};

const register = (redirect_uris: string[]) =>
  setup().service.registerDynamicClient({ redirect_uris } as any);

describe('OAuthService.registerDynamicClient redirect_uris', () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env.JWT_SECRET = 'unit-test-secret';
    process.env.DCR_VERIFIED_DOMAINS = 'claude.ai,chatgpt.com';
  });
  afterAll(() => {
    process.env = env;
  });

  it.each([
    'http://localhost:8080/callback',
    'http://127.0.0.1:33418/cb',
    'http://[::1]:5000/cb',
    'https://claude.ai/api/mcp/auth_callback',
    'https://sub.chatgpt.com/cb',
    'cursor://anysphere.cursor-mcp/oauth/callback',
    'vscode://ms-vscode.mcp/callback',
    'vscode-insiders://ms-vscode.mcp/callback',
    'windsurf://codeium.windsurf/callback',
    'claude://callback',
    'com.example.app:/oauth2redirect',
    'io.github.my-app.client://cb',
  ])('accepts %s', async (uri) => {
    await expect(register([uri])).resolves.toMatchObject({
      redirect_uris: [uri],
    });
  });

  it.each([
    'myapp://callback',
    'evil://steal',
    'zoom://join',
    'ms-word:open',
  ])('rejects the unknown private-use scheme %s', async (uri) => {
    await expect(register([uri])).rejects.toMatchObject({
      response: { error: 'invalid_redirect_uri' },
    });
  });

  it('rejects an unknown scheme even when it is not the first uri', async () => {
    await expect(
      register(['http://localhost:1/cb', 'custom-scheme://cb'])
    ).rejects.toMatchObject({ response: { error: 'invalid_redirect_uri' } });
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,hi',
    'file:///etc/passwd',
    'http://example.com/cb',
    'https://evil.example.org/cb',
    'not a url',
  ])('keeps rejecting %s', async (uri) => {
    await expect(register([uri])).rejects.toMatchObject({
      response: { error: 'invalid_redirect_uri' },
    });
  });

  it('matches the known schemes case-insensitively and exactly', async () => {
    await expect(register(['Cursor://x/cb'])).resolves.toBeTruthy();
    // a known name as a prefix of another scheme is not enough
    await expect(register(['cursorx://x/cb'])).rejects.toMatchObject({
      response: { error: 'invalid_redirect_uri' },
    });
    await expect(register(['claude-evil://cb'])).rejects.toMatchObject({
      response: { error: 'invalid_redirect_uri' },
    });
  });
});

describe('OAuthService.registerDynamicClient MCP directory callbacks', () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env.JWT_SECRET = 'unit-test-secret';
    process.env.DCR_VERIFIED_DOMAINS = 'claude.ai,chatgpt.com';
    delete process.env.MCP_EXTRA_REDIRECT_URIS;
  });
  afterAll(() => {
    process.env = env;
  });

  it.each([
    'https://smithery.ai/oauth/callback',
    'https://smithery.run/oauth/callback',
    'https://glama.ai/mcp/oauth/callback',
    'https://GLAMA.ai/mcp/oauth/callback',
    'https://connect.vercel.com/callback',
  ])('accepts the directory callback %s', async (uri) => {
    await expect(register([uri])).resolves.toMatchObject({
      redirect_uris: [uri],
    });
  });

  it.each([
    // http, even on an allowed host
    'http://smithery.ai/oauth/callback',
    'http://connect.vercel.com/callback',
    // subdomains host servers other people deploy
    'https://my-server.smithery.run/cb',
    'https://server.smithery.ai/cb',
    'https://x.glama.ai/cb',
    // look-alike hosts
    'https://evilsmithery.ai/cb',
    'https://smithery.ai.evil.com/cb',
    'https://glama.ai.example.org/cb',
    // Vercel Connect is an exact callback, not a domain
    'https://connect.vercel.com/callback/other',
    'https://connect.vercel.com/callback?next=https://evil.example',
    'https://evil.vercel.com/callback',
    'https://vercel.com/callback',
    // Zapier is only allowed once its exact URL is configured
    'https://zapier.com/dashboard/auth/oauth/return/App123456CLIAPI/',
  ])('rejects %s', async (uri) => {
    await expect(register([uri])).rejects.toMatchObject({
      response: { error: 'invalid_redirect_uri' },
    });
  });

  it('accepts the exact callbacks of MCP_EXTRA_REDIRECT_URIS only', async () => {
    process.env.MCP_EXTRA_REDIRECT_URIS =
      ' https://zapier.com/dashboard/auth/oauth/return/App123456CLIAPI/ ,http://insecure.example/cb';
    const zapier =
      'https://zapier.com/dashboard/auth/oauth/return/App123456CLIAPI/';

    await expect(register([zapier])).resolves.toMatchObject({
      redirect_uris: [zapier],
    });
    // another app id, a missing trailing slash or another host stay out
    for (const uri of [
      'https://zapier.com/dashboard/auth/oauth/return/App999999CLIAPI/',
      'https://zapier.com/dashboard/auth/oauth/return/App123456CLIAPI',
      'https://evil.zapier.com/dashboard/auth/oauth/return/App123456CLIAPI/',
    ]) {
      await expect(register([uri])).rejects.toMatchObject({
        response: { error: 'invalid_redirect_uri' },
      });
    }
    // only https entries of the env count
    await expect(register(['http://insecure.example/cb'])).rejects.toMatchObject({
      response: { error: 'invalid_redirect_uri' },
    });
  });

  it('never gives a directory client the email claims', async () => {
    process.env.OPENAI_OAUTH_CLIENT_ID = 'chatgpt-static-client';

    await expect(
      register(['https://smithery.ai/oauth/callback'])
    ).resolves.toMatchObject({ scope: 'mcp:read mcp:write' });
    expect(
      (setup().service as any).allowsEmailClaims({
        clientId: 'pcd_x',
        dynamic: true,
        redirectUris: JSON.stringify(['https://smithery.ai/oauth/callback']),
      })
    ).toBe(false);
  });
});
