const mockClient = {
  createSigner: jest.fn(async () => ({
    signer_uuid: 'example-signer',
    public_key: '0x00',
  })),
  registerSignedKey: jest.fn(async () => ({
    signer_uuid: 'example-signer',
    signer_approval_url: 'https://example.test/approve',
  })),
  lookupSigner: jest.fn(async () => ({ status: 'approved', fid: 1234 })),
  fetchBulkUsers: jest.fn(async () => ({
    users: [
      {
        username: 'example',
        display_name: 'Example',
        pfp_url: 'https://example.test/picture',
      },
    ],
  })),
  publishCast: jest.fn(async () => ({
    cast: { author: { username: 'example' }, hash: '0xabc' },
  })),
};
const mockConstructor = jest.fn();
jest.mock('@neynar/nodejs-sdk', () => ({
  NeynarAPIClient: class {
    constructor(options: any) {
      mockConstructor(options);
      return mockClient;
    }
  },
}));
jest.mock('@gitroom/nestjs-libraries/integrations/social.abstract', () => ({
  SocialAbstract: class {},
}));
jest.mock('@gitroom/nestjs-libraries/integrations/tool.decorator', () => ({
  Tool: () => () => {},
}));
jest.mock('@gitroom/nestjs-libraries/chat/rules.description.decorator', () => ({
  Rules: () => () => {},
}));
jest.mock('viem/accounts', () => ({
  mnemonicToAccount: () => ({
    signTypedData: async () => '0xexample-signature',
  }),
}));
jest.mock('qrcode', () => ({
  toDataURL: async () => 'data:image/png;base64,ZXhhbXBsZQ==',
}));

const originalEnv = process.env;
afterEach(() => {
  process.env = originalEnv;
  jest.clearAllMocks();
});
it('keeps the real Farcaster channel connect and publish paths available with login disabled and a channel key configured', async () => {
  process.env = {
    ...originalEnv,
    NEYNAR_SECRET_KEY: 'example-channel-key',
    NEYNAR_CLIENT_ID: 'example-channel-client',
    NEYNAR_APP_FID: '1234',
    NEYNAR_APP_MNEMONIC: 'example-mocked-mnemonic',
  };
  delete process.env.FARCASTER_LOGIN_ENABLED;
  delete process.env.AUTH_WALLET_LOGIN_ENABLED;
  let provider: any;
  jest.isolateModules(() => {
    const { FarcasterProvider } = require('./farcaster.provider');
    provider = new FarcasterProvider();
  });
  expect(mockConstructor).toHaveBeenCalledWith({
    apiKey: 'example-channel-key',
  });
  await expect(provider.createSigner()).resolves.toMatchObject({
    signerUuid: 'example-signer',
    approvalUrl: 'https://example.test/approve',
  });
  const approved = await provider.signerStatus('example-signer');
  expect(approved.status).toBe('approved');
  const channel = await provider.authenticate({
    code: approved.code,
    codeVerifier: 'example',
  });
  expect(channel).toMatchObject({ id: '1234', accessToken: 'example-signer' });
  const result = await provider.post('channel-1', channel.accessToken, [
    {
      id: 'example-post',
      message: 'Offline fixture only',
      media: [],
      settings: {},
    },
  ]);
  expect(result).toEqual([
    {
      id: 'example-post',
      postId: '0xabc',
      releaseURL: 'https://warpcast.com/example/0xabc',
      status: 'published',
    },
  ]);
  expect(mockClient.publishCast).toHaveBeenCalledWith({
    signerUuid: 'example-signer',
    text: 'Offline fixture only',
    embeds: [],
  });
});
