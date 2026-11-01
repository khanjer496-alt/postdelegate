// the activity module pulls in temporal, storage and the database
jest.mock('nestjs-temporal-core', () => ({
  Activity: () => () => undefined,
  ActivityMethod: () => () => undefined,
  TemporalService: class {},
}));
jest.mock('@gitroom/nestjs-libraries/database/prisma/studio/studio.service', () => ({
  StudioService: class {},
}));
jest.mock('@gitroom/nestjs-libraries/temporal/temporal.heartbeat', () => ({
  setHeartbeatDetails: jest.fn(),
  withHeartbeat: (fn: () => Promise<unknown>) => fn(),
}));
const heartbeat = jest.fn();
jest.mock('@temporalio/activity', () => ({
  Context: { current: () => ({ heartbeat }) },
}));

import { StudioActivity } from './studio.activity';

describe('StudioActivity cleanup', () => {
  const make = () => {
    const service = {
      cleanup: jest.fn(async (beat: (details: string) => void) => {
        beat('page');
        return { assets: 2, renders: 3 };
      }),
    };
    return { activity: new StudioActivity(service as any), service };
  };

  afterEach(() => {
    delete process.env.STUDIO_CLEANUP_DISABLED;
  });

  it('cleans up and says it is on', async () => {
    const { activity, service } = make();
    expect(await activity.cleanupStudioV1({})).toEqual({
      enabled: true,
      assets: 2,
      renders: 3,
    });
    expect(service.cleanup).toHaveBeenCalled();
    expect(heartbeat).toHaveBeenCalledWith('page');
  });

  it('does nothing when switched off, so the workflow ends', async () => {
    process.env.STUDIO_CLEANUP_DISABLED = 'true';
    const { activity, service } = make();
    expect(await activity.cleanupStudioV1({})).toEqual({
      enabled: false,
      assets: 0,
      renders: 0,
    });
    expect(service.cleanup).not.toHaveBeenCalled();
  });
});
