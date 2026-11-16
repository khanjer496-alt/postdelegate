jest.mock('nestjs-temporal-core', () => ({ TemporalModule: { register: (options: any) => options } }));
jest.mock('@gitroom/nestjs-libraries/integrations/integration.manager', () => ({ socialIntegrationList: [
  { identifier: 'reddit', maxConcurrentJob: 1 }, { identifier: 'fixture', maxConcurrentJob: 4 }, { identifier: 'unlimited' },
] }));
jest.mock('./email.queues', () => ({ emailQueues: {} }));
import { getTemporalModule } from './temporal.module';

const context = (queue: string) => ({ slotType: 'activity' as const, taskQueue: queue, workerIdentity: 'owned-test', workerBuildId: 'test', isSticky: false });
describe('provider-wide activity capacity registration', () => {
  const previous = { ...process.env };
  afterEach(() => { process.env = { ...previous }; });
  const pair = (provider = 'reddit') => {
    const config: any = getTemporalModule(true, 'owned-workflow', []);
    return { legacy: config.workers.find((w: any) => w.taskQueue === provider), tracked: config.workers.find((w: any) => w.taskQueue === `mcp-v114-${provider}`) };
  };
  it('reserves a single budget across legacy and V114 instead of granting both a full cap', () => {
    delete process.env.EXCLUDE_QUEUE; process.env.WORKER_CONCURRENCY_DIVIDER = '1';
    const { legacy, tracked } = pair();
    const left = legacy.workerOptions.tuner?.activityTaskSlotSupplier;
    const right = tracked.workerOptions.tuner?.activityTaskSlotSupplier;
    expect(left).toBeDefined(); expect(right).toBe(left);
    const permit = left.tryReserveSlot(context('reddit'));
    expect(permit).toBeTruthy(); expect(right.tryReserveSlot(context('mcp-v114-reddit'))).toBeNull();
    left.releaseSlot({ permit });
    expect(right.tryReserveSlot(context('mcp-v114-reddit'))).toBeTruthy();
    expect(legacy.workerOptions).not.toHaveProperty('maxConcurrentActivityTaskExecutions');
    expect(tracked.workerOptions).not.toHaveProperty('maxConcurrentActivityTaskExecutions');
    expect(legacy.workerOptions.maxHeartbeatThrottleInterval).toBe('15s');
    expect(legacy.workerOptions.activityTaskPollerBehavior).toEqual({ type: 'simple-maximum', maximum: 1 });
  });
  it('splits the fleet share once then shares it across both queues', () => {
    process.env.EXCLUDE_QUEUE = 'reddit'; process.env.WORKER_CONCURRENCY_DIVIDER = '2';
    const { legacy, tracked } = pair('fixture'); const pool = legacy.workerOptions.tuner.activityTaskSlotSupplier;
    expect(tracked.workerOptions.tuner.activityTaskSlotSupplier).toBe(pool);
    expect(pool.tryReserveSlot(context('fixture'))).toBeTruthy();
    expect(pool.tryReserveSlot(context('mcp-v114-fixture'))).toBeTruthy();
    expect(pool.tryReserveSlot(context('fixture'))).toBeNull();
  });
  it('fails closed rather than rounding a zero share up to one', () => {
    delete process.env.EXCLUDE_QUEUE; process.env.WORKER_CONCURRENCY_DIVIDER = '2';
    expect(() => pair()).toThrow('pin');
  });
  it('does not apply worker-allocation validation to an API-only module', () => {
    process.env.WORKER_CONCURRENCY_DIVIDER = 'invalid';
    const config: any = getTemporalModule(false); expect(config.workers).toBeUndefined();
  });
  it('base exclusion suppresses both queues while prefixed exclusion leaves only legacy', () => {
    process.env.WORKER_CONCURRENCY_DIVIDER = '1'; process.env.EXCLUDE_QUEUE = 'reddit';
    expect(pair()).toEqual({ legacy: undefined, tracked: undefined });
    process.env.EXCLUDE_QUEUE = 'mcp-v114-reddit'; const result = pair();
    expect(result.legacy).toBeDefined(); expect(result.tracked).toBeUndefined();
  });
});
