// the real services pull in storage, Temporal and every social provider, the
// spec only needs their shape
jest.mock('@gitroom/nestjs-libraries/database/prisma/studio/studio.service', () => ({
  StudioService: class {},
}));
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/studio/studio.schedule.service',
  () => ({ StudioScheduleService: class {} })
);
jest.mock('@gitroom/backend/services/auth/permissions/permissions.service', () => ({
  PermissionsService: class {},
}));
jest.mock('@gitroom/nestjs-libraries/database/prisma/approvals/approval.policy.service', () => ({
  userActor: (user: any) => ({ type: 'user', userId: user.id }),
}));
jest.mock('@gitroom/nestjs-libraries/upload/multer.stream.engine', () => ({
  streamUploadOptions: () => ({}),
}));

import { BadRequestException } from '@nestjs/common';
import { SubscriptionException } from '@gitroom/backend/services/auth/permissions/permission.exception.class';
import { StudioController } from './studio.controller';

describe('StudioController', () => {
  const org: any = { id: 'org-1', createdAt: new Date(), users: [{ role: 'ADMIN' }] };
  const user: any = { id: 'u-1' };
  const body: any = {
    renderIds: ['3f1c2a9e-8b4d-4f6a-9c2e-1a2b3c4d5e6f'],
    integrations: [{ id: 'channel-1' }],
    content: 'New video',
  };

  const make = (
    allowed: boolean,
    remaining: number | null = 4,
    status: 'none' | 'running' | 'done' = 'none'
  ) => {
    const studio = {
      saveAsset: jest.fn().mockResolvedValue({ id: 'asset-1' }),
    };
    const schedule = {
      status: jest.fn().mockResolvedValue({ key: 'k', status }),
      scheduleRenders: jest.fn().mockResolvedValue({ created: 1 }),
    };
    const permissions = {
      check: jest.fn().mockResolvedValue({ can: () => allowed }),
      remainingPostsThisMonth: jest.fn().mockResolvedValue(remaining),
    };
    return {
      controller: new StudioController(
        studio as any,
        schedule as any,
        permissions as any
      ),
      studio,
      schedule,
      permissions,
    };
  };

  it('checks the monthly posts of the plan before scheduling renders', async () => {
    const { controller, schedule } = make(false);
    await expect(
      controller.scheduleRenders(org, user, body)
    ).rejects.toBeInstanceOf(SubscriptionException);
    expect(schedule.scheduleRenders).not.toHaveBeenCalled();
  });

  it('schedules for the request workspace with the posts left this month', async () => {
    const { controller, schedule, permissions } = make(true, 3);
    expect(await controller.scheduleRenders(org, user, body)).toEqual({
      created: 1,
    });
    expect(permissions.check.mock.calls[0][3]).toEqual([
      ['create', 'posts_per_month'],
    ]);
    expect(schedule.scheduleRenders).toHaveBeenCalledWith('org-1', body, 3, {
      type: 'user',
      userId: 'u-1',
    });
  });

  it('lets a request sent before through without the plan check, for its result', async () => {
    const { controller, schedule, permissions } = make(false, 0, 'done');
    expect(await controller.scheduleRenders(org, user, body)).toEqual({
      created: 1,
    });
    expect(permissions.check).not.toHaveBeenCalled();
    expect(schedule.scheduleRenders).toHaveBeenCalled();
  });

  it('saves an uploaded music file for the request workspace', async () => {
    const { controller, studio } = make(true);
    const file: any = { filename: 'a.mp3', path: 'https://cdn/a.mp3' };
    await controller.uploadAsset(org, file);
    expect(studio.saveAsset).toHaveBeenCalledWith('org-1', file);
    expect(() => controller.uploadAsset(org, undefined as any)).toThrow(
      BadRequestException
    );
  });
});
