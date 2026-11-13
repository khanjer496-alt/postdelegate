import { OAuthService } from '@gitroom/nestjs-libraries/database/prisma/oauth/oauth.service';

// Refresh tokens for dynamically registered MCP clients (Claude, Cursor,
// Grok...) and RFC 7009 revocation. Secrets are compared through stubs: the
// hashing itself is covered by oauth.service.secrets.spec
const setup = (app: Record<string, unknown> | null) => {
  const repository = {
    getAppByClientId: jest.fn().mockResolvedValue(app),
    findByAccessToken: jest.fn().mockResolvedValue(
      app ? { oauthAppId: app.id, organizationId: 'org-1' } : null
    ),
    findSelfHostedByAccessToken: jest.fn(),
    revokeByAccessTokenForApp: jest.fn().mockResolvedValue({ count: 1 }),
    revokeSelfHostedByAccessTokenForApp: jest
      .fn()
      .mockResolvedValue({ count: 1 }),
    createDynamicApp: jest.fn(async (data: any) => ({
      ...data,
      createdAt: new Date(),
    })),
    deleteStaleDynamicApps: jest.fn().mockResolvedValue(undefined),
  };
  const service = new OAuthService(repository as any);
  // the stored form of a token or secret is its lookup value
  (service as any).lookupSecrets = (value?: string) =>
    value ? [`stored:${value}`] : [];
  (service as any).secretMatches = (presented?: string, stored?: string) =>
    !!presented && stored === `stored:${presented}`;
  return { service, repository };
};

const publicDynamic = {
  id: 'app-public',
  clientId: 'pcd_public',
  dynamic: true,
  tokenEndpointAuthMethod: 'none',
  clientSecret: null,
};
const confidentialDynamic = {
  id: 'app-secret',
  clientId: 'pcd_secret',
  dynamic: true,
  tokenEndpointAuthMethod: 'client_secret_post',
  clientSecret: 'stored:pcs_right',
};
const staticApp = {
  id: 'app-static',
  clientId: 'pca_static',
  dynamic: false,
  tokenEndpointAuthMethod: null,
  clientSecret: 'stored:static_secret',
};

describe('OAuth refresh tokens for dynamically registered MCP clients', () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env.JWT_SECRET = 'unit-test-secret';
    delete process.env.HUBSPOT_OAUTH_CLIENT_ID;
  });
  afterAll(() => {
    process.env = env;
  });

  it('a registration says it can use the refresh_token grant', async () => {
    const { service } = setup(null);
    await expect(
      service.registerDynamicClient({
        redirect_uris: ['http://localhost:9999/cb'],
        token_endpoint_auth_method: 'none',
      } as any)
    ).resolves.toMatchObject({
      grant_types: ['authorization_code', 'refresh_token'],
    });
  });

  it('a public dynamic client refreshes with its refresh token', async () => {
    const { service, repository } = setup(publicDynamic);
    await expect(
      service.refreshAccessToken('pcd_public', 'pos_token')
    ).resolves.toMatchObject({
      access_token: 'pos_token',
      refresh_token: 'pos_token',
      token_type: 'bearer',
    });
    expect(repository.findByAccessToken).toHaveBeenCalledWith([
      'stored:pos_token',
    ]);
  });

  it('a confidential dynamic client must send its secret to refresh', async () => {
    const { service } = setup(confidentialDynamic);
    await expect(
      service.refreshAccessToken('pcd_secret', 'pos_token')
    ).rejects.toMatchObject({ response: { error: 'invalid_client' } });
    await expect(
      service.refreshAccessToken('pcd_secret', 'pos_token', 'pcs_wrong')
    ).rejects.toMatchObject({ response: { error: 'invalid_client' } });
    await expect(
      service.refreshAccessToken('pcd_secret', 'pos_token', 'pcs_right')
    ).resolves.toMatchObject({ refresh_token: 'pos_token' });
  });

  it('a revoked or unknown refresh token is invalid_grant', async () => {
    const { service, repository } = setup(publicDynamic);
    repository.findByAccessToken.mockResolvedValue(null);
    await expect(
      service.refreshAccessToken('pcd_public', 'pos_gone')
    ).rejects.toMatchObject({ response: { error: 'invalid_grant' } });
  });

  it("another client's token can't be refreshed", async () => {
    const { service, repository } = setup(publicDynamic);
    repository.findByAccessToken.mockResolvedValue({ oauthAppId: 'other' });
    await expect(
      service.refreshAccessToken('pcd_public', 'pos_token')
    ).rejects.toMatchObject({ response: { error: 'invalid_grant' } });
  });

  it('static public API apps still get no refresh grant', async () => {
    const { service } = setup(staticApp);
    await expect(
      service.refreshAccessToken('pca_static', 'pos_token', 'static_secret')
    ).rejects.toMatchObject({ response: { error: 'unsupported_grant_type' } });
  });

  it('a request without a client id is unsupported', async () => {
    const { service } = setup(null);
    await expect(
      service.refreshAccessToken(undefined, 'pos_token')
    ).rejects.toMatchObject({ response: { error: 'unsupported_grant_type' } });
  });
});

describe('OAuth token revocation (RFC 7009)', () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env.JWT_SECRET = 'unit-test-secret';
  });
  afterAll(() => {
    process.env = env;
  });

  it('revokes the token for the client that holds it', async () => {
    const { service, repository } = setup(publicDynamic);
    await expect(
      service.revokeToken('pcd_public', 'pos_token')
    ).resolves.toEqual({});
    expect(repository.revokeByAccessTokenForApp).toHaveBeenCalledWith(
      ['stored:pos_token'],
      'app-public'
    );
  });

  it('revokes a self-hosted connection token', async () => {
    const { service, repository } = setup(publicDynamic);
    await service.revokeToken('pcd_public', 'psh_token');
    expect(
      repository.revokeSelfHostedByAccessTokenForApp
    ).toHaveBeenCalledWith(['stored:psh_token'], 'app-public');
    expect(repository.revokeByAccessTokenForApp).not.toHaveBeenCalled();
  });

  it('needs the client secret of a confidential client', async () => {
    const { service, repository } = setup(confidentialDynamic);
    await expect(
      service.revokeToken('pcd_secret', 'pos_token', 'pcs_wrong')
    ).rejects.toMatchObject({ response: { error: 'invalid_client' } });
    expect(repository.revokeByAccessTokenForApp).not.toHaveBeenCalled();
  });

  it('rejects an unknown client and a missing token', async () => {
    await expect(
      setup(null).service.revokeToken('nope', 'pos_token')
    ).rejects.toMatchObject({ response: { error: 'invalid_client' } });
    await expect(
      setup(publicDynamic).service.revokeToken('pcd_public', undefined)
    ).rejects.toMatchObject({ response: { error: 'invalid_request' } });
  });
});
