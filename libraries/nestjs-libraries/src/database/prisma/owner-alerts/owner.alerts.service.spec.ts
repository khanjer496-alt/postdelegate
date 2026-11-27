jest.mock('@gitroom/nestjs-libraries/redis/redis.service', () => {
  const data = new Map<string, string>();
  return {
    ioRedis: {
      data,
      // SET key value EX seconds NX: only the first writer gets OK
      set: jest.fn(async (key: string, value: string) => {
        if (data.has(key)) return null;
        data.set(key, value);
        return 'OK';
      }),
    },
  };
});

import { Logger } from '@nestjs/common';
import { ioRedis } from '@gitroom/nestjs-libraries/redis/redis.service';
import {
  OwnerAlertsService,
  TrialFacts,
  buildTrialRow,
  ownerAlertEmail,
  ownerAlertRecipients,
  ownerDigestEmail,
} from '@gitroom/nestjs-libraries/database/prisma/owner-alerts/owner.alerts.service';

const HOUR = 60 * 60 * 1000;
const now = new Date('2026-11-27T12:00:00.000Z');
const redis = ioRedis as any;

const workspace = (overrides: object = {}) => ({
  name: 'Acme',
  deletedAt: null,
  subscription: { subscriptionTier: 'TEAM', period: 'MONTHLY' },
  users: [
    { role: 'SUPERADMIN', user: { providerName: 'GOOGLE', isSuperAdmin: false } },
  ],
  ...overrides,
});

const make = (repository: object = {}, hasProvider = true) => {
  const repo = {
    getWorkspace: jest.fn(async () => workspace()),
    getAcquisition: jest.fn(async (): Promise<{ internalOrTest: boolean } | null> => null),
    countEvents: jest.fn(async () => 1),
    ...repository,
  };
  const email = {
    hasProvider: () => hasProvider,
    sendEmail: jest.fn(async () => undefined),
  };
  return {
    service: new OwnerAlertsService(repo as any, email as any),
    repo,
    email,
  };
};

describe('ownerAlertRecipients', () => {
  it('reads a comma separated list, drops blanks and duplicates', () => {
    expect(ownerAlertRecipients(' A@x.com, b@y.com,,a@x.com, nope ')).toEqual([
      'a@x.com',
      'b@y.com',
    ]);
    expect(ownerAlertRecipients(undefined)).toEqual([]);
  });
});

describe('ownerAlertEmail', () => {
  it('names the event, the workspace and links to the admin page', () => {
    const email = ownerAlertEmail(
      {
        organizationId: 'org-1',
        kind: 'registration',
        internalOrTest: false,
        source: 'google',
      },
      { name: 'Acme <Team>', method: 'Google' }
    )!;
    expect(email.subject).toBe('New sign-up: Acme <Team>');
    expect(email.html).toContain('Google');
    expect(email.html).toContain('google');
    expect(email.html).not.toContain('<Team>');
    expect(email.html).toContain('/admin/stats?workspace=org-1#trials');
  });

  it('leaves out an unknown source and tells a trial that expired from a cancel', () => {
    const signUp = ownerAlertEmail(
      { organizationId: 'o', kind: 'registration', internalOrTest: false, source: 'unknown' },
      { name: 'Acme', method: 'Email' }
    )!;
    expect(signUp.html).not.toContain('Source');
    expect(
      ownerAlertEmail(
        { organizationId: 'o', kind: 'subscription_ended', internalOrTest: false, reason: 'trial_expired', detail: 'STANDARD' },
        { name: 'Acme' }
      )!.subject
    ).toBe('Trial expired without paying: Acme');
    expect(
      ownerAlertEmail(
        { organizationId: 'o', kind: 'subscription_ended', internalOrTest: false, reason: 'cancelled' },
        { name: 'Acme' }
      )!.subject
    ).toBe('Plan cancelled: Acme');
  });

  it('says what failed and the amount paid', () => {
    const failed = ownerAlertEmail(
      { organizationId: 'o', kind: 'channel_connect_failed', internalOrTest: false, provider: 'linkedin', reason: 'missing_permissions' },
      { name: 'Acme' }
    )!;
    expect(failed.html).toContain('linkedin');
    expect(failed.html).toContain('Some permissions were not granted');
    const paid = ownerAlertEmail(
      { organizationId: 'o', kind: 'nonzero_payment', internalOrTest: false, amountMinor: 2900, currency: 'usd' },
      { name: 'Acme', plan: 'Team' }
    )!;
    expect(paid.subject).toBe('Became paying: Acme');
    expect(paid.html).toContain('29.00 USD');
  });
});

describe('OwnerAlertsService.funnelEvent', () => {
  const previous = process.env.OWNER_ALERT_EMAILS;
  beforeEach(() => {
    process.env.OWNER_ALERT_EMAILS = 'owner@postdelegate.test, second@postdelegate.test';
    redis.data.clear();
  });
  afterAll(() => {
    process.env.OWNER_ALERT_EMAILS = previous;
  });

  const alert = (kind: string, extra: object = {}) => ({
    organizationId: 'org-1',
    kind,
    internalOrTest: false,
    ...extra,
  });

  it('emails every recipient once', async () => {
    const { service, email } = make();
    await service.funnelEvent(alert('trial_started'));
    expect(email.sendEmail).toHaveBeenCalledTimes(2);
    expect(email.sendEmail).toHaveBeenCalledWith(
      'owner@postdelegate.test',
      'Trial started: Acme',
      expect.stringContaining('Team'),
      'bottom'
    );
  });

  it('sends nothing without recipients or an email provider', async () => {
    process.env.OWNER_ALERT_EMAILS = '';
    const unset = make();
    expect(unset.service.watches('registration')).toBe(false);
    await unset.service.funnelEvent(alert('registration'));
    expect(unset.email.sendEmail).not.toHaveBeenCalled();

    process.env.OWNER_ALERT_EMAILS = 'owner@postdelegate.test';
    const noProvider = make({}, false);
    expect(noProvider.service.watches('registration')).toBe(false);
    await noProvider.service.funnelEvent(alert('registration'));
    expect(noProvider.email.sendEmail).not.toHaveBeenCalled();
  });

  it('watches the funnel kinds only', () => {
    const { service } = make();
    expect(service.watches('registration')).toBe(true);
    expect(service.watches('publish_failed')).toBe(true);
    expect(service.watches('first_draft')).toBe(false);
    expect(service.watches('signup_request')).toBe(false);
  });

  it('never alerts about an internal, test, super admin or deleted workspace', async () => {
    const internal = make();
    await internal.service.funnelEvent(alert('registration', { internalOrTest: true }));
    expect(internal.repo.getWorkspace).not.toHaveBeenCalled();

    const superAdmin = make({
      getWorkspace: jest.fn(async () =>
        workspace({
          users: [
            { role: 'SUPERADMIN', user: { providerName: 'LOCAL', isSuperAdmin: false } },
            { role: 'USER', user: { providerName: 'LOCAL', isSuperAdmin: true } },
          ],
        })
      ),
    });
    await superAdmin.service.funnelEvent(alert('registration'));

    const deleted = make({
      getWorkspace: jest.fn(async () => workspace({ deletedAt: new Date() })),
    });
    await deleted.service.funnelEvent(alert('registration'));

    const unmapped = make();
    await unmapped.service.funnelEvent(alert('nonzero_payment', { organizationId: '' }));

    for (const { email } of [internal, superAdmin, deleted, unmapped]) {
      expect(email.sendEmail).not.toHaveBeenCalled();
    }
  });

  it('tells about the first paid invoice only', async () => {
    const first = make({ countEvents: jest.fn(async () => 1) });
    await first.service.funnelEvent(alert('nonzero_payment', { amountMinor: 1900, currency: 'usd' }));
    expect(first.email.sendEmail).toHaveBeenCalled();

    const renewal = make({ countEvents: jest.fn(async () => 2) });
    await renewal.service.funnelEvent(alert('nonzero_payment', { amountMinor: 1900, currency: 'usd' }));
    expect(renewal.email.sendEmail).not.toHaveBeenCalled();
  });

  it('sends one publish failure per workspace and network in six hours', async () => {
    const { service, email } = make();
    await service.funnelEvent(alert('publish_failed', { provider: 'x', detail: 'Rate limited' }));
    await service.funnelEvent(alert('publish_failed', { provider: 'x', detail: 'Rate limited again' }));
    await service.funnelEvent(alert('publish_failed', { provider: 'linkedin', detail: 'Expired' }));
    await service.funnelEvent(
      alert('publish_failed', { organizationId: 'org-2', provider: 'x', detail: 'Rate limited' })
    );
    const subjects = email.sendEmail.mock.calls
      .filter((call: unknown[]) => call[0] === 'owner@postdelegate.test')
      .map((call: unknown[]) => call[2] as string);
    expect(subjects).toHaveLength(3);
    expect(redis.set).toHaveBeenCalledWith(
      'owner-alert:publish_failed:org-1:x',
      '1',
      'EX',
      6 * 60 * 60,
      'NX'
    );
  });

  it('sends one connect failure per workspace and network in six hours', async () => {
    const { service, email } = make();
    await service.funnelEvent(alert('channel_connect_failed', { provider: 'linkedin', reason: 'cancelled' }));
    await service.funnelEvent(alert('channel_connect_failed', { provider: 'linkedin', reason: 'token_exchange' }));
    await service.funnelEvent(alert('channel_connect_failed', { provider: 'instagram', reason: 'cancelled' }));
    expect(
      email.sendEmail.mock.calls.filter((call: unknown[]) => call[0] === 'owner@postdelegate.test')
    ).toHaveLength(2);
  });

  it('sends one email for two receipts of the same event at the same moment', async () => {
    const { service, email } = make();
    await Promise.all([
      service.funnelEvent(alert('trial_started', { key: 'event-1' })),
      service.funnelEvent(alert('trial_started', { key: 'event-1' })),
    ]);
    await service.funnelEvent(alert('trial_started', { key: 'event-2' }));
    expect(
      email.sendEmail.mock.calls.filter((call: unknown[]) => call[0] === 'owner@postdelegate.test')
    ).toHaveLength(2);
  });

  it('never throws when the database or the email fails', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const broken = make({
      getWorkspace: jest.fn(async () => {
        throw Object.assign(new Error('down'), { code: 'P1001' });
      }),
    });
    await expect(broken.service.funnelEvent(alert('registration'))).resolves.toBeUndefined();
    const failingEmail = make();
    failingEmail.email.sendEmail.mockRejectedValue(new Error('temporal down'));
    await expect(failingEmail.service.funnelEvent(alert('registration'))).resolves.toBeUndefined();
    warn.mockRestore();
  });

  it('alerts a survey answer, but not for an internal workspace', async () => {
    const { service, email } = make();
    await service.feedbackAnswered('org-1', 'stopped', 'too_expensive', 'Needed a cheaper plan');
    expect(email.sendEmail).toHaveBeenCalledWith(
      'owner@postdelegate.test',
      'Survey answer: Acme',
      expect.stringContaining('Needed a cheaper plan'),
      'bottom'
    );

    const internal = make({
      getAcquisition: jest.fn(async () => ({ internalOrTest: true })),
    });
    await internal.service.feedbackAnswered('org-1', 'stopped', 'too_expensive', '');
    expect(internal.email.sendEmail).not.toHaveBeenCalled();
  });
});

const facts = (overrides: Partial<TrialFacts> = {}): TrialFacts => ({
  id: 'org-1',
  name: 'Acme',
  internal: false,
  createdAt: new Date(now.getTime() - 50 * HOUR),
  ownerEmail: 'jane@acme.test',
  method: 'LOCAL',
  subscription: {
    subscriptionTier: 'STANDARD',
    status: 'trialing',
    trialEndsAt: new Date(now.getTime() + 5 * 24 * HOUR),
    createdAt: new Date(now.getTime() - 49 * HOUR),
    cancelAt: null,
  },
  channels: 0,
  firstChannelAt: null,
  posts: [],
  failures: [],
  answers: [],
  ...overrides,
});

describe('buildTrialRow', () => {
  it('stops at the furthest step reached and counts the hours since', () => {
    const row = buildTrialRow(facts(), now);
    expect(row.lastStep).toBe('trial_started');
    expect(row.hoursStuck).toBe(49);
    expect(row.signUpMethod).toBe('Email');
    expect(row.plan).toBe('Starter');
  });

  it('reads the steps from channels and posts, and sums the failures per kind', () => {
    const row = buildTrialRow(
      facts({
        channels: 2,
        firstChannelAt: new Date(now.getTime() - 40 * HOUR),
        posts: [
          { state: 'DRAFT', count: 3, firstCreatedAt: new Date(now.getTime() - 30 * HOUR), firstPublishAt: null },
          { state: 'QUEUE', count: 1, firstCreatedAt: new Date(now.getTime() - 20 * HOUR), firstPublishAt: null },
        ],
        failures: [
          { kind: 'channel_connect_failed', provider: 'linkedin', count: 2 },
          { kind: 'channel_connect_failed', provider: 'instagram', count: 1 },
          { kind: 'publish_failed', provider: 'x', count: 4 },
        ],
        answers: [{ kind: 'use_case', choice: 'own_brand', text: '' }],
      }),
      now
    );
    expect(row.lastStep).toBe('post_scheduled');
    expect(row.hoursStuck).toBe(20);
    expect(row.postsScheduled).toBe(1);
    expect(row.postsPublished).toBe(0);
    expect(row.connectFailures).toBe(3);
    expect(row.connectFailureProviders).toEqual(['linkedin', 'instagram']);
    expect(row.publishErrors).toBe(4);
    expect(row.useCase).toBe('own brand');
    expect(row.stoppedReason).toBeNull();
  });

  it('shows a published post as the last step and a sign-up without a plan', () => {
    const published = buildTrialRow(
      facts({
        posts: [
          { state: 'PUBLISHED', count: 1, firstCreatedAt: new Date(now.getTime() - 10 * HOUR), firstPublishAt: new Date(now.getTime() - 2 * HOUR) },
        ],
      }),
      now
    );
    expect(published.lastStep).toBe('published');
    expect(published.hoursStuck).toBe(2);

    const noPlan = buildTrialRow(
      facts({
        subscription: null,
        answers: [{ kind: 'stopped', choice: 'too_expensive', text: 'Need cheaper' }],
      }),
      now
    );
    expect(noPlan.lastStep).toBe('signed_up');
    expect(noPlan.plan).toBeNull();
    expect(noPlan.stoppedReason).toBe('too expensive: Need cheaper');
  });
});

describe('ownerDigestEmail', () => {
  it('sends nothing when there is nothing to report, internal rows included', () => {
    expect(ownerDigestEmail([], 'https://app.test')).toBeUndefined();
    expect(
      ownerDigestEmail([buildTrialRow(facts({ internal: true }), now)], 'https://app.test')
    ).toBeUndefined();
  });

  it('lists each workspace with its step, counts and failures', () => {
    const email = ownerDigestEmail(
      [
        buildTrialRow(
          facts({
            name: 'Acme <Co>',
            failures: [{ kind: 'channel_connect_failed', provider: 'linkedin', count: 2 }],
          }),
          now
        ),
        buildTrialRow(facts({ id: 'org-2', name: 'Fresh', createdAt: new Date(now.getTime() - HOUR), subscription: null }), now),
        buildTrialRow(facts({ id: 'org-3', name: 'Ours', internal: true }), now),
      ],
      'https://app.test'
    )!;
    expect(email.subject).toBe('Trials: 2 workspaces, 1 stuck for a day or more');
    expect(email.html).toContain('Acme &lt;Co&gt;');
    expect(email.html).toContain('Trial started, 2d');
    expect(email.html).toContain('2 (linkedin)');
    expect(email.html).toContain('https://app.test/admin/stats?workspace=org-2#trials');
    expect(email.html).not.toContain('Ours');
  });
});

describe('OwnerAlertsService.trials', () => {
  it('joins the counts of every listed workspace and skips the digest when empty', async () => {
    process.env.OWNER_ALERT_EMAILS = 'owner@postdelegate.test';
    const repo = {
      getTrials: jest.fn(async () => [
        {
          id: 'org-1',
          name: 'Acme',
          createdAt: new Date(now.getTime() - 30 * HOUR),
          subscription: null,
          users: [{ user: { email: 'jane@acme.test', providerName: 'GOOGLE' } }],
        },
      ]),
      countChannels: jest.fn(async () => [
        { organizationId: 'org-1', _count: { _all: 1 }, _min: { createdAt: new Date(now.getTime() - 26 * HOUR) } },
      ]),
      countPosts: jest.fn(async () => []),
      countFailures: jest.fn(async () => [
        { organizationId: 'org-1', kind: 'publish_failed', provider: 'x', _count: { _all: 2 } },
      ]),
      getAnswers: jest.fn(async () => []),
      getInternal: jest.fn(async () => []),
    };
    const email = { hasProvider: () => true, sendEmail: jest.fn(async () => undefined) };
    const service = new OwnerAlertsService(repo as any, email as any);

    const [row] = await service.trials(now);
    expect(row).toMatchObject({
      organizationId: 'org-1',
      ownerEmail: 'jane@acme.test',
      signUpMethod: 'Google',
      lastStep: 'channel_connected',
      hoursStuck: 26,
      channels: 1,
      publishErrors: 2,
      internal: false,
    });
    expect(repo.countFailures).toHaveBeenCalledWith(
      ['org-1'],
      new Date(now.getTime() - 7 * 24 * HOUR)
    );
    expect(repo.getTrials).toHaveBeenCalledWith(
      new Date(now.getTime() - 14 * 24 * HOUR)
    );

    expect(await service.sendDailyDigest(now)).toEqual({ workspaces: 1, sent: true });
    expect(email.sendEmail).toHaveBeenCalledTimes(1);

    repo.getTrials.mockResolvedValue([]);
    email.sendEmail.mockClear();
    expect(await service.sendDailyDigest(now)).toEqual({ workspaces: 0, sent: false });
    expect(email.sendEmail).not.toHaveBeenCalled();
  });
});
