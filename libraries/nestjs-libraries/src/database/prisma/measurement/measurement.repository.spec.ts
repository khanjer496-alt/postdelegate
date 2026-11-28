import { MeasurementRepository } from './measurement.repository';

const from = new Date('2026-11-01T00:00:00Z');
const to = new Date('2026-11-08T00:00:00Z');
const asOf = new Date('2026-11-20T00:00:00Z');

const makeRepo = (window: unknown[], related: unknown[] = []) => {
  const measurementEvent = {
    findMany: jest
      .fn()
      .mockResolvedValueOnce(window)
      .mockResolvedValue(related),
    upsert: jest.fn().mockResolvedValue({ key: 'k' }),
  };
  const repo = new MeasurementRepository({ measurementEvent } as never);
  return { repo, measurementEvent };
};

describe('MeasurementRepository.rows', () => {
  it('reads the window up to `to`, then only the joins of the workspaces in it', async () => {
    const { repo, measurementEvent } = makeRepo(
      [
        { organizationId: 'org-1', kind: 'trial_started' },
        { organizationId: 'org-1', kind: 'registration' },
        { organizationId: '', kind: 'signup_request' },
        { organizationId: 'org-2', kind: 'registration' },
      ],
      [{ organizationId: 'org-1', kind: 'nonzero_payment' }]
    );

    const rows = await repo.rows(from, to, asOf);

    expect(rows).toHaveLength(5);
    expect(measurementEvent.findMany).toHaveBeenCalledTimes(2);
    // the owner's operational events (connect and publish failures, ended
    // plans) never reach the funnel export
    expect(measurementEvent.findMany.mock.calls[0][0].where).toEqual({
      occurredAt: { gte: from, lt: to },
      kind: {
        notIn: ['channel_connect_failed', 'publish_failed', 'subscription_ended'],
      },
    });
    const joins = measurementEvent.findMany.mock.calls[1][0].where;
    expect(joins.organizationId).toEqual({ in: ['org-1', 'org-2'] });
    expect(joins.OR).toEqual([
      {
        occurredAt: { lt: from },
        kind: { in: ['trial_started', 'entitlement_applied'] },
      },
      {
        occurredAt: { gte: to, lt: asOf },
        kind: { in: ['entitlement_applied', 'nonzero_payment'] },
      },
      {
        occurredAt: { gte: to, lt: new Date('2026-11-10T00:00:00Z') },
        kind: 'qualifying_schedule',
      },
    ]);
  });

  it('asks for the joins of at most 1000 workspaces at a time', async () => {
    const window = Array.from({ length: 2500 }, (_, i) => ({
      organizationId: 'org-' + i,
      kind: 'registration',
    }));
    const { repo, measurementEvent } = makeRepo(window);

    await repo.rows(from, to, asOf);

    expect(measurementEvent.findMany).toHaveBeenCalledTimes(4);
    expect(
      measurementEvent.findMany.mock.calls
        .slice(1)
        .map((call) => call[0].where.organizationId.in.length)
    ).toEqual([1000, 1000, 500]);
  });

  it('stops without the joins when the window is over the cap', async () => {
    const { repo, measurementEvent } = makeRepo(
      Array.from({ length: 100001 }, () => ({ organizationId: 'org-1' }))
    );

    expect(await repo.rows(from, to, asOf)).toHaveLength(100001);
    expect(measurementEvent.findMany).toHaveBeenCalledTimes(1);
  });

  it('counts a duplicate only for a replay of the same event', async () => {
    const { repo, measurementEvent } = makeRepo([]);

    await repo.save({ key: 'a' } as never);
    await repo.save({ key: 'b' } as never, false);

    expect(measurementEvent.upsert.mock.calls[0][0].update).toEqual({
      duplicates: { increment: 1 },
    });
    expect(measurementEvent.upsert.mock.calls[1][0].update).toEqual({});
  });
});
