import { createHmac } from 'node:crypto';
import { acquisitionFromToken } from './acquisition';
import { aggregateMeasurement } from './measurement.aggregate';
import { MeasurementService } from './measurement.service';
import type { MeasurementEvent } from '@prisma/client';
jest.mock('./measurement.repository', () => ({
  MEASUREMENT_EXPORT_CAP: 100000,
  MeasurementRepository: class {},
}));
jest.mock('@gitroom/nestjs-libraries/integrations/integration.manager', () => ({
  IntegrationManager: class {},
}));
const now = Date.parse('2026-11-09T12:00:00Z'),
  secret = 'test-only-not-a-secret-'.repeat(3);
const payload = {
  v: 1,
  site: 'postdelegate',
  nonce: '11111111-2222-4333-8444-555555555555',
  issued: now - 1000,
  expires: now - 1000 + 86400000,
  source: 'google',
  campaign: 'launch',
  medium: 'organic',
  term: '',
  content: '',
  entry_page: '/',
  device: 'Mobile',
  internal_or_test: false,
};
const token = (body = payload) => {
  const p = Buffer.from(JSON.stringify(body)).toString('base64url');
  return p + '.' + createHmac('sha256', secret).update(p).digest('hex');
};
const row = (
  kind: string,
  extra: Partial<MeasurementEvent> = {}
): MeasurementEvent => ({
  key: kind,
  organizationId: 'org',
  kind,
  occurredAt: new Date(now - 86400000),
  receivedAt: new Date(now - 86400000),
  duplicates: 0,
  reference: 'sub-hash',
  source: 'google',
  campaign: 'launch',
  medium: 'organic',
  term: 'unknown',
  content: 'unknown',
  entryPage: '/',
  device: 'Mobile',
  internalOrTest: false,
  touchHash: null,
  matchedTouch: true,
  amountMinor: 0,
  currency: 'unknown',
  trialEndsAt: null,
  acceptedPublishAt: null,
  humanApproval: false,
  evidenceType: '',
  ...extra,
});
afterEach(() => {
  jest.restoreAllMocks();
  delete process.env.PULSE_HANDOFF_SECRET;
  delete process.env.MEASUREMENT_INTERNAL_ONLY;
});
it('rejects tampered, expired, oversize and malformed handoffs, without trusting unsigned query labels', () => {
  expect(acquisitionFromToken(token(), secret, now)).toMatchObject({
    source: 'google',
    internal_or_test: false,
  });
  expect(acquisitionFromToken(token() + 'x', secret, now)).toBeNull();
  expect(
    acquisitionFromToken(token({ ...payload, expires: now - 1 }), secret, now)
  ).toBeNull();
  expect(acquisitionFromToken('x'.repeat(2501), secret, now)).toBeNull();
  expect(acquisitionFromToken(token(), undefined, now)).toBeNull();
});
it('keeps only the path of the entry page and drops one that looks personal', () => {
  const entry = (entry_page: string) =>
    acquisitionFromToken(token({ ...payload, entry_page }), secret, now)
      ?.entry_page;
  expect(entry('/pricing?email=a@b.co#x')).toBe('/pricing');
  expect(entry('/blog/post#section')).toBe('/blog/post');
  expect(entry('/u/a@b.co')).toBe('unknown');
  expect(entry('pricing')).toBe('unknown');
  expect(entry('')).toBe('unknown');
  expect(entry('/' + 'a'.repeat(299))).toHaveLength(200);
});
it('does not count another save of a first-time milestone as a duplicate', async () => {
  const repository = {
    acquisition: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockResolvedValue({ key: 'k' }),
  };
  const service = new MeasurementService(repository as never);
  await service.record('org', 'first_draft', 'first');
  await service.record('org', 'publication', 'post|release');
  expect(repository.save.mock.calls[0][1]).toBe(false);
  expect(repository.save.mock.calls[1][1]).toBe(true);
});
it('scans only its own workspace rows for a trial cohort', () => {
  const trialAt = new Date(now - 4 * 86400000);
  const report = aggregateMeasurement(
    [
      row('trial_started', { occurredAt: trialAt }),
      row('qualifying_schedule', {
        organizationId: 'other',
        occurredAt: new Date(now - 3 * 86400000),
        humanApproval: true,
      }),
      row('trial_started', {
        occurredAt: new Date(now - 20 * 86400000),
        organizationId: 'earlier',
      }),
      row('trial_started', {
        occurredAt: new Date(now - 3 * 86400000),
        organizationId: 'earlier',
      }),
    ],
    new Set(),
    new Date(now - 10 * 86400000),
    new Date(now + 1),
    new Date(now - 30 * 86400000),
    new Date(now)
  );
  // 'earlier' had its first trial before the window, so only 'org' is a window cohort
  expect(report.cohorts).toHaveLength(1);
  expect(report.cohorts[0]).toMatchObject({
    eligible_trials: 1,
    fully_observed_48h_trials: 1,
    first_qualifying_schedules_within_48h: 0,
  });
});
it('qualifies paid only for the same subscription with applied entitlement; $0, test and lifetime grants do not qualify', () => {
  const events = [
    row('entitlement_applied'),
    row('nonzero_payment', {
      key: 'invoice',
      amountMinor: 1000,
      currency: 'usd',
    }),
    row('nonzero_payment', { key: 'zero', amountMinor: 0, currency: 'usd' }),
    row('nonzero_payment', {
      key: 'wrong',
      reference: 'other-sub',
      amountMinor: 2000,
      currency: 'usd',
    }),
    row('nonzero_payment', {
      key: 'internal',
      organizationId: 'test',
      amountMinor: 1000,
      currency: 'usd',
      internalOrTest: true,
    }),
    row('nonzero_payment', {
      key: 'grant',
      organizationId: 'grant',
      amountMinor: 1000,
      currency: 'usd',
    }),
  ];
  const report = aggregateMeasurement(
    events,
    new Set(['grant']),
    new Date(now - 2 * 86400000),
    new Date(now + 1),
    new Date(now - 2 * 86400000),
    new Date(now)
  );
  expect(
    report.rows.reduce((n, r) => n + r.paid_subscription_workspaces, 0)
  ).toBe(1);
  expect(report.rows.reduce((n, r) => n + r.revenue_minor, 0)).toBe(1000);
  expect(report.reconciliation.unmatched_subscription_payments).toBe(4);
  expect(JSON.stringify(report)).not.toMatch(
    /\borg\b|sub-hash|invoice|11111111/
  );
});
it('exports medium as a day dimension and opens no all-zero group for an unpaid invoice', () => {
  const report = aggregateMeasurement(
    [
      row('registration'),
      row('nonzero_payment', {
        key: 'unmatched',
        medium: 'cpc',
        reference: 'other-sub',
        amountMinor: 2000,
        currency: 'usd',
      }),
    ],
    new Set(),
    new Date(now - 2 * 86400000),
    new Date(now + 1),
    new Date(now - 2 * 86400000),
    new Date(now)
  );
  expect(report.rows).toHaveLength(1);
  expect(report.rows[0]).toMatchObject({
    medium: 'organic',
    confirmed_new_owner_workspaces: 1,
  });
  expect(report.reconciliation.unmatched_subscription_payments).toBe(1);
});
it('uses Dubai dates, cohort maturity and null visitor metrics with unavailable historical coverage', () => {
  const start = new Date(now - 10 * 86400000);
  const events = [
    row('trial_started', {
      occurredAt: new Date(now - 9 * 86400000),
      trialEndsAt: new Date(now - 2 * 86400000),
    }),
    row('qualifying_schedule', {
      occurredAt: new Date(now - 8 * 86400000),
      humanApproval: true,
      acceptedPublishAt: new Date(now - 7 * 86400000),
    }),
    row('registration', {
      occurredAt: new Date('2026-11-08T21:00:00Z'),
      duplicates: 2,
    }),
  ];
  const report = aggregateMeasurement(
    events,
    new Set(),
    new Date(now - 30 * 86400000),
    new Date(now + 1),
    start,
    new Date(now)
  );
  expect(
    report.rows.find((r) => r.confirmed_new_owner_workspaces)
  ).toMatchObject({ date: '2026-11-09', eligible_visitor_ids: null });
  expect(report.cohorts[0]).toMatchObject({
    eligible_trials: 1,
    fully_observed_48h_trials: 1,
    first_qualifying_schedules_within_48h: 1,
    fully_observed_trial_end_plus_7d_trials: 0,
  });
  expect(report.days[0].availability).toBe('unavailable');
  expect(report.reconciliation.duplicated).toBe(2);
});
it('only records a human future accepted schedule on a connected available channel and never fails the action when storage fails', async () => {
  const repository = {
    post: jest.fn().mockResolvedValue({
      state: 'QUEUE',
      approvalStatus: 'APPROVED',
      publishDate: new Date(Date.now() + 86400000),
      integrationId: 'channel',
    }),
    channel: jest.fn().mockResolvedValue({
      providerIdentifier: 'youtube',
      disabled: false,
      inBetweenSteps: false,
      deletedAt: null,
    }),
    acquisition: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockResolvedValue({ key: 'k' }),
  };
  const service = new MeasurementService(repository as never);
  await service.postAccepted('org', 'post', false);
  expect(repository.save).not.toHaveBeenCalled();
  await service.postAccepted('org', 'post', true);
  expect(repository.save).toHaveBeenCalledWith(
    expect.objectContaining({
      kind: 'qualifying_schedule',
      humanApproval: true,
      acceptedPublishAt: expect.any(Date),
    }),
    false
  );
  repository.save.mockRejectedValue(new Error('db unavailable'));
  jest.spyOn(console, 'error').mockImplementation(() => {});
  await expect(
    service.postAccepted('org', 'post', true)
  ).resolves.toBeUndefined();
});
it('keeps an unverified registration out of confirmed registrations and trials', async () => {
  const repository = {
    acquisition: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockResolvedValue({ key: 'k' }),
  };
  const service = new MeasurementService(repository as never);
  await service.registration('org', undefined, false);
  expect(repository.save).toHaveBeenCalledTimes(1);
  expect(repository.save).toHaveBeenCalledWith(
    expect.objectContaining({ kind: 'acquisition', matchedTouch: false })
  );
});

it('quarantines identifier-free staging outcomes without inventing acquisition', async () => {
  process.env.MEASUREMENT_INTERNAL_ONLY = 'true';
  const saved: MeasurementEvent[] = [];
  const repository = {
    acquisition: jest.fn().mockResolvedValue(null),
    save: jest.fn(async (data) => {
      saved.push(row(data.kind, { ...data, receivedAt: data.occurredAt }));
    }),
    rows: jest.fn(async () => saved),
    lifetimeOrgs: jest.fn().mockResolvedValue([]),
    firstEvent: jest.fn(async () => ({ receivedAt: saved[0].receivedAt })),
  };
  const service = new MeasurementService(repository as never);
  await service.signupAttempt(undefined, 'test-request');
  await service.registration('test-org', undefined, true);
  await service.record('test-org', 'channel_connected', 'first');
  await service.record('test-org', 'trial_started', 'test-sub');
  await service.record('test-org', 'qualifying_schedule', 'first', {
    humanApproval: true,
    acceptedPublishAt: new Date(Date.now() + 86400000),
  });
  expect(saved.length).toBe(7);
  expect(
    saved.every(
      (event) =>
        event.internalOrTest &&
        !event.matchedTouch &&
        event.source === 'unknown'
    )
  ).toBe(true);
  const report = await service.export(
    new Date(Date.now() - 60000),
    new Date(Date.now() + 60000)
  );
  expect(report).toMatchObject({
    coverage: { diagnostic_only_current_configuration: true },
    reconciliation: {
      internal_excluded: 6,
      unmatched: 6,
      eligible_server_milestones: 0,
      matched_permitted_acquisition_touch: 0,
    },
  });
});

it.each(['missing customer', 'deleted workspace'])(
  'retains %s payments once for reconciliation without qualifying revenue',
  async () => {
    const saved = new Map<string, MeasurementEvent>();
    const repository = {
      organizationForCustomer: jest.fn().mockResolvedValue(null),
      acquisition: jest.fn().mockResolvedValue(null),
      save: jest.fn(async (data) => {
        const prior = saved.get(data.key);
        if (prior) prior.duplicates++;
        else
          saved.set(
            data.key,
            row(data.kind, { ...data, receivedAt: data.occurredAt })
          );
      }),
      rows: jest.fn(async () => [...saved.values()]),
      lifetimeOrgs: jest.fn().mockResolvedValue([]),
      firstEvent: jest.fn(async () => ({ receivedAt: new Date(now) })),
    };
    const service = new MeasurementService(repository as never);
    for (let replay = 0; replay < 2; replay++)
      await service.payment(
        'cus_synthetic',
        'sub_synthetic',
        'in_synthetic',
        1500,
        'usd',
        new Date(now)
      );
    expect(saved.size).toBe(1);
    expect([...saved.values()][0]).toMatchObject({
      organizationId: '',
      matchedTouch: false,
      source: 'unknown',
      duplicates: 1,
      reference: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(JSON.stringify([...saved.values()])).not.toMatch(
      /cus_synthetic|sub_synthetic|in_synthetic/
    );
    const report = await service.export(
      new Date(now - 60000),
      new Date(now + 60000)
    );
    expect(report).toMatchObject({
      reconciliation: {
        total_server_milestones: 1,
        unmatched_subscription_payments: 1,
        eligible_server_milestones: 0,
        duplicated: 1,
      },
    });
    expect(
      report.rows.reduce(
        (n, r) => n + r.revenue_minor + r.paid_subscription_workspaces,
        0
      )
    ).toBe(0);
  }
);

it.each([
  { name: 'missing to mapped', first: null, replay: { id: 'org_synthetic' } },
  { name: 'mapped to deleted', first: { id: 'org_synthetic' }, replay: null },
])(
  'keeps invoice identity stable when workspace mapping changes $name',
  async ({ first, replay }) => {
    const saved = new Map<string, MeasurementEvent>();
    const repository = {
      organizationForCustomer: jest
        .fn()
        .mockResolvedValueOnce(first)
        .mockResolvedValue(replay),
      acquisition: jest.fn().mockResolvedValue(null),
      save: jest.fn(async (data) => {
        const prior = saved.get(data.key);
        if (prior) prior.duplicates++;
        else
          saved.set(
            data.key,
            row(data.kind, { ...data, receivedAt: data.occurredAt })
          );
      }),
      rows: jest.fn(async () => [...saved.values()]),
      lifetimeOrgs: jest.fn().mockResolvedValue([]),
      firstEvent: jest.fn(async () => ({ receivedAt: new Date(now) })),
    };
    const service = new MeasurementService(repository as never);
    await service.payment(
      'cus_synthetic',
      'sub_synthetic',
      'in_synthetic',
      1500,
      'usd',
      new Date(now)
    );
    const originalKey = [...saved.keys()][0];
    await service.payment(
      'cus_synthetic',
      'sub_synthetic',
      'in_synthetic',
      1500,
      'usd',
      new Date(now)
    );
    expect(saved.size).toBe(1);
    expect([...saved.values()][0]).toMatchObject({
      key: originalKey,
      organizationId: first?.id || '',
      duplicates: 1,
    });
    const report = await service.export(
      new Date(now - 60000),
      new Date(now + 60000)
    );
    expect(report).toMatchObject({
      reconciliation: {
        total_server_milestones: 1,
        duplicated: 1,
        eligible_server_milestones: first ? 1 : 0,
      },
    });
    // A different invoice remains a separate receipt, even for the same customer/subscription.
    await service.payment(
      'cus_synthetic',
      'sub_synthetic',
      'in_other',
      1500,
      'usd',
      new Date(now)
    );
    expect(saved.size).toBe(2);
  }
);

it.each([false, true])(
  'counts a cohort schedule only when the schedule itself is eligible (diagnostic=%s)',
  (internalOrTest) => {
    const trialAt = new Date(now - 4 * 86400000);
    const report = aggregateMeasurement(
      [
        row('trial_started', { occurredAt: trialAt }),
        row('qualifying_schedule', {
          occurredAt: new Date(now - 3 * 86400000),
          internalOrTest,
          humanApproval: true,
          acceptedPublishAt: new Date(now + 86400000),
        }),
      ],
      new Set(),
      new Date(now - 10 * 86400000),
      new Date(now + 1),
      new Date(now - 5 * 86400000),
      new Date(now)
    );
    expect(report.cohorts[0]).toMatchObject({
      eligible_trials: 1,
      fully_observed_48h_trials: 1,
      first_qualifying_schedules_within_48h: internalOrTest ? 0 : 1,
    });
    expect(report.reconciliation.internal_excluded).toBe(
      internalOrTest ? 1 : 0
    );
  }
);
