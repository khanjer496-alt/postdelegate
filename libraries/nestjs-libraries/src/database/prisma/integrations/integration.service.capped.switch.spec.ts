// the service pulls in heavy modules that are not under test
jest.mock('@gitroom/nestjs-libraries/integrations/integration.manager', () => ({
  IntegrationManager: class {},
}));
jest.mock(
  '@gitroom/nestjs-libraries/integrations/refresh.integration.service',
  () => ({ RefreshIntegrationService: class {} })
);
jest.mock(
  '@gitroom/nestjs-libraries/integrations/integration.authorization.lifecycle.service',
  () => ({ IntegrationAuthorizationLifecycleService: class {} })
);
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/integrations/integration.repository',
  () => ({ IntegrationRepository: class {}, isOwnedIntegrationPicture: () => false })
);
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/autopost/autopost.repository',
  () => ({ AutopostRepository: class {} })
);
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/notifications/notification.service',
  () => ({ NotificationService: class {} })
);
jest.mock('@gitroom/nestjs-libraries/upload/upload.factory', () => ({
  UploadFactory: { createStorage: () => ({}) },
}));
jest.mock('nestjs-temporal-core', () => ({ TemporalService: class {} }));
jest.mock('@gitroom/nestjs-libraries/redis/redis.service', () => ({
  ioRedis: { get: jest.fn(), set: jest.fn() },
}));


import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';

const makeService = (
  existing: { providerIdentifier: string; deletedAt?: Date } | null
) => {
  const repository = {
    getIntegrationByInternalIdWithDeleted: jest
      .fn()
      .mockResolvedValue(
        existing && { name: 'Brand', deletedAt: null, ...existing }
      ),
  };
  return new IntegrationService(
    repository as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any
  );
};

describe('IntegrationService.checkCappedProviderSwitch', () => {
  it('stops an account moving onto a capped network over its own key channel', async () => {
    await expect(
      makeService({ providerIdentifier: 'x-own-key' }).checkCappedProviderSwitch(
        'org-1',
        '42',
        'x'
      )
    ).rejects.toMatchObject({
      status: 400,
      message:
        'This account is already connected as the channel "Brand". Delete that channel first, then connect the account again.',
    });
  });

  it('stops a capped channel moving to another provider', async () => {
    await expect(
      makeService({ providerIdentifier: 'x' }).checkCappedProviderSwitch(
        'org-1',
        '42',
        'x-own-key'
      )
    ).rejects.toMatchObject({ status: 400 });
  });

  it('stops a deleted channel coming back under the other provider', async () => {
    for (const [before, after] of [
      ['x', 'x-own-key'],
      ['x-own-key', 'x'],
    ]) {
      await expect(
        makeService({
          providerIdentifier: before,
          deletedAt: new Date(),
        }).checkCappedProviderSwitch('org-1', '42', after)
      ).rejects.toMatchObject({
        status: 400,
        message:
          'This account was connected before through a different connection type. Connect it the same way as before.',
      });
    }
  });

  it('lets a reconnect on the same provider and uncapped providers through', async () => {
    await makeService({ providerIdentifier: 'x' }).checkCappedProviderSwitch(
      'org-1',
      '42',
      'x'
    );
    await makeService({
      providerIdentifier: 'instagram',
    }).checkCappedProviderSwitch('org-1', '42', 'instagram-standalone');
    await makeService(null).checkCappedProviderSwitch('org-1', '42', 'x');
  });
});
