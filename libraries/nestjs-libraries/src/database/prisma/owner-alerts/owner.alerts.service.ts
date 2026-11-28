import { Injectable, Logger } from '@nestjs/common';
import { capitalize, escape } from 'lodash';
import {
  OwnerAlertsRepository,
  QUIET_PUBLISH_FAILURES,
} from '@gitroom/nestjs-libraries/database/prisma/owner-alerts/owner.alerts.repository';
import {
  EmailService,
  emailButton,
} from '@gitroom/nestjs-libraries/services/email.service';
import { ioRedis } from '@gitroom/nestjs-libraries/redis/redis.service';
import { pricing } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/pricing';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
// a channel that keeps failing, or a connect retried again and again, sends
// one email per workspace and network in this many hours
export const FAILURE_ALERT_HOURS = 6;
// how long a sent event is remembered against a simultaneous second receipt
const SENT_ALERT_HOURS = 24;
const REPEATED_FAILURES = ['publish_failed', 'channel_connect_failed'];
// Alert emails share the email provider and its quota with the customers'
// verification and reset emails: over this many in a clock hour the rest wait
// for the digest and the admin page, and one notice says so
export const OWNER_ALERTS_PER_HOUR = 30;
// the digest lists this many workspaces, the admin page has them all (Gmail
// clips a long email)
export const DIGEST_ROWS = 50;
// the trials table and the digest: signed up in the last 14 days, failures of
// the last 7
export const TRIALS_SIGNED_UP_DAYS = 14;
export const TRIALS_FAILURE_DAYS = 7;

// The funnel events the owner hears about, by MeasurementEvent kind
export const OWNER_ALERT_KINDS = [
  'registration',
  'trial_started',
  'channel_connected',
  'channel_connect_failed',
  'qualifying_schedule',
  'publish_failed',
  'nonzero_payment',
  'subscription_ended',
];

// OWNER_ALERT_EMAILS: comma separated, unset sends nothing
export const ownerAlertRecipients = (value = process.env.OWNER_ALERT_EMAILS) => [
  ...new Set(
    (value || '')
      .split(',')
      .map((address) => address.trim().toLowerCase())
      .filter((address) => address.includes('@'))
  ),
];

export interface FunnelAlert {
  // the MeasurementEvent key: two receipts of one event at the same moment
  // send one email
  key?: string;
  organizationId: string;
  kind: string;
  internalOrTest: boolean;
  source?: string;
  provider?: string;
  reason?: string;
  amountMinor?: number;
  currency?: string;
  detail?: string;
}

export interface AlertWorkspace {
  name: string;
  method?: string;
  plan?: string;
}

const PUBLISH_FAILURES: Record<string, string> = {
  refresh_needed: 'The channel needs a reconnect',
};

const PLAN_ENDINGS: Record<string, string> = {
  trial_expired: 'Trial expired without paying',
  trial_cancelled: 'Trial cancelled',
  payment_failed: 'Payment failed, plan ended',
  cancelled: 'Plan cancelled',
};

const CONNECT_FAILURES: Record<string, string> = {
  cancelled: "Cancelled on the network's page",
  missing_permissions: 'Some permissions were not granted',
  provider_error: 'The network refused the connection',
  token_exchange: 'The token exchange failed',
  no_account: 'No account came back',
};

const SIGN_UP_METHODS: Record<string, string> = { LOCAL: 'Email' };

export const signUpMethod = (provider?: string | null) =>
  provider ? SIGN_UP_METHODS[provider] || capitalize(provider) : 'unknown';

export const planName = (tier?: string | null) =>
  tier
    ? pricing[tier as keyof typeof pricing]?.label || capitalize(tier)
    : 'unknown';

const money = (minor = 0, currency = 'unknown') =>
  `${(minor / 100).toFixed(2)} ${currency.toUpperCase()}`;

// the admin page lists the workspace (Trials & blockers on Admin Stats)
export const adminWorkspaceUrl = (
  orgId: string,
  app = process.env.FRONTEND_URL || ''
) => `${app}/admin/stats?workspace=${encodeURIComponent(orgId)}#trials`;

const line = (label: string, value?: string) =>
  value
    ? `<p style="margin:0 0 8px"><strong>${escape(label)}:</strong> ${escape(
        value
      )}</p>`
    : '';

// One short email per event. Pure, so it is easy to test.
export const ownerAlertEmail = (
  alert: FunnelAlert,
  workspace: AlertWorkspace
) => {
  const name = workspace.name || 'A workspace';
  const known = (value?: string) =>
    value && value !== 'unknown' ? value : undefined;
  const body = (subject: string, lines: string[]) => ({
    subject,
    html: [
      ...lines,
      emailButton(adminWorkspaceUrl(alert.organizationId), 'Open in admin'),
    ].join(''),
  });

  switch (alert.kind) {
    case 'registration':
      return body(`New sign-up: ${name}`, [
        line('Method', workspace.method),
        line('Source', known(alert.source)),
      ]);
    case 'trial_started':
      return body(`Trial started: ${name}`, [line('Plan', workspace.plan)]);
    case 'channel_connected':
      return body(`First channel connected: ${name}`, [
        line('Network', alert.provider),
      ]);
    case 'channel_connect_failed':
      return body(`Channel connect failed: ${name}`, [
        line('Network', alert.provider),
        line('Reason', CONNECT_FAILURES[alert.reason || ''] || alert.reason),
      ]);
    case 'qualifying_schedule':
      return body(`First post scheduled: ${name}`, []);
    case 'publish_failed':
      return body(`Post failed to publish: ${name}`, [
        line('Network', alert.provider),
        line('Error', PUBLISH_FAILURES[alert.reason || ''] || alert.detail),
      ]);
    case 'nonzero_payment':
      return body(`Became paying: ${name}`, [
        line('Plan', workspace.plan),
        line('Amount', money(alert.amountMinor, alert.currency)),
      ]);
    case 'subscription_ended':
      // an account deletion is recorded, never alerted
      if (!PLAN_ENDINGS[alert.reason || '']) {
        return undefined;
      }
      return body(`${PLAN_ENDINGS[alert.reason || '']}: ${name}`, [
        line('Plan', known(alert.detail) && planName(alert.detail)),
      ]);
    default:
      return undefined;
  }
};

export const ownerAlertsPausedEmail = (
  app = process.env.FRONTEND_URL || ''
) => ({
  subject: 'Owner alerts paused for this hour',
  html: [
    `<p style="margin:0 0 8px">More than ${OWNER_ALERTS_PER_HOUR} alerts this hour. The rest are not emailed: they are in the daily digest and on Admin Stats, Trials &amp; blockers. Alerts start again next hour.</p>`,
    emailButton(`${app}/admin/stats#trials`, 'Open Trials & blockers'),
  ].join(''),
});

export const FEEDBACK_QUESTIONS: Record<string, string> = {
  use_case: 'What do you want to use PostDelegate for?',
  stopped: 'What stopped you?',
};

export const feedbackAlertEmail = (
  orgId: string,
  workspace: string,
  kind: string,
  choice: string,
  text: string
) => ({
  subject: `Survey answer: ${workspace || 'A workspace'}`,
  html: [
    line('Question', FEEDBACK_QUESTIONS[kind] || kind),
    line('Answer', choice.replace(/_/g, ' ')),
    line('Note', text),
    emailButton(adminWorkspaceUrl(orgId), 'Open in admin'),
  ].join(''),
});

// The furthest step of the getting started path a workspace reached, in order
export const TRIAL_STEPS = [
  'signed_up',
  'trial_started',
  'channel_connected',
  'post_created',
  'post_scheduled',
  'published',
] as const;

export type TrialStep = (typeof TRIAL_STEPS)[number];

export interface TrialFacts {
  id: string;
  name: string;
  internal: boolean;
  createdAt: Date;
  ownerEmail: string | null;
  method: string | null;
  subscription: {
    subscriptionTier: string;
    status: string | null;
    trialEndsAt: Date | null;
    createdAt: Date;
    cancelAt: Date | null;
  } | null;
  channels: number;
  firstChannelAt: Date | null;
  posts: { state: string; count: number; firstCreatedAt: Date | null; firstPublishAt: Date | null }[];
  failures: { kind: string; provider: string; count: number }[];
  answers: { kind: string; choice: string; text: string }[];
}

export interface TrialRow {
  organizationId: string;
  name: string;
  // marked internal or test by Measurement: listed on the admin page, never
  // in the digest
  internal: boolean;
  ownerEmail: string | null;
  signUpMethod: string;
  signedUpAt: string;
  plan: string | null;
  trialEndsAt: string | null;
  cancelling: boolean;
  lastStep: TrialStep;
  stuckSince: string;
  hoursStuck: number;
  channels: number;
  postsScheduled: number;
  postsPublished: number;
  connectFailures: number;
  connectFailureProviders: string[];
  publishErrors: number;
  publishErrorProviders: string[];
  useCase: string | null;
  stoppedReason: string | null;
}

const earliest = (dates: (Date | null | undefined)[]) =>
  dates
    .filter((date): date is Date => !!date)
    .reduce<Date | null>(
      (first, date) => (!first || date < first ? date : first),
      null
    );

const answerOf = (facts: TrialFacts, kind: string) => {
  const answer = facts.answers.find((a) => a.kind === kind);
  if (!answer) {
    return null;
  }
  const choice = answer.choice.replace(/_/g, ' ');
  return answer.text ? `${choice}: ${answer.text}` : choice;
};

// One row of the trials table from what the workspace has. Every step is read
// from the stored channels, posts and plan, so a workspace created before the
// measurement events existed still shows where it is. Pure, so it is easy to
// test.
export const buildTrialRow = (facts: TrialFacts, now: Date): TrialRow => {
  const count = (state: string) =>
    facts.posts.find((p) => p.state === state)?.count || 0;
  const reached: Partial<Record<TrialStep, Date | null>> = {
    signed_up: facts.createdAt,
    trial_started: facts.subscription?.createdAt || null,
    channel_connected: facts.firstChannelAt,
    post_created: earliest(facts.posts.map((p) => p.firstCreatedAt)),
    post_scheduled: earliest(
      facts.posts
        .filter((p) => p.state !== 'DRAFT')
        .map((p) => p.firstCreatedAt)
    ),
    published: earliest(
      facts.posts
        .filter((p) => p.state === 'PUBLISHED')
        .map((p) => p.firstPublishAt)
    ),
  };
  const lastStep =
    [...TRIAL_STEPS].reverse().find((step) => !!reached[step]) || 'signed_up';
  const stuckSince = reached[lastStep] || facts.createdAt;
  const failures = (kind: string) =>
    facts.failures.filter((f) => f.kind === kind);

  return {
    organizationId: facts.id,
    name: facts.name,
    internal: facts.internal,
    ownerEmail: facts.ownerEmail,
    signUpMethod: signUpMethod(facts.method),
    signedUpAt: facts.createdAt.toISOString(),
    plan: facts.subscription ? planName(facts.subscription.subscriptionTier) : null,
    trialEndsAt: facts.subscription?.trialEndsAt?.toISOString() || null,
    cancelling: !!facts.subscription?.cancelAt,
    lastStep,
    stuckSince: stuckSince.toISOString(),
    hoursStuck: Math.max(
      0,
      Math.floor((now.getTime() - stuckSince.getTime()) / HOUR)
    ),
    channels: facts.channels,
    postsScheduled: count('QUEUE'),
    postsPublished: count('PUBLISHED'),
    connectFailures: failures('channel_connect_failed').reduce(
      (n, f) => n + f.count,
      0
    ),
    connectFailureProviders: failures('channel_connect_failed').map(
      (f) => f.provider || 'unknown'
    ),
    publishErrors: failures('publish_failed').reduce((n, f) => n + f.count, 0),
    publishErrorProviders: failures('publish_failed').map(
      (f) => f.provider || 'unknown'
    ),
    useCase: answerOf(facts, 'use_case'),
    stoppedReason: answerOf(facts, 'stopped'),
  };
};

const STEP_LABELS: Record<TrialStep, string> = {
  signed_up: 'Signed up',
  trial_started: 'Trial started',
  channel_connected: 'Channel connected',
  post_created: 'First post created',
  post_scheduled: 'First post scheduled',
  published: 'Published',
};

export const stepLabel = (step: TrialStep) => STEP_LABELS[step];

export const durationLabel = (hours: number) =>
  hours < 48 ? `${hours}h` : `${Math.floor(hours / 24)}d`;

// The daily digest, undefined when there is nothing to report. Pure, so it is
// easy to test.
export const ownerDigestEmail = (
  all: TrialRow[],
  app = process.env.FRONTEND_URL || ''
) => {
  const listed = all.filter((row) => !row.internal);
  if (!listed.length) {
    return undefined;
  }
  // the most stuck first, the rest are on the admin page
  const rows = [...listed]
    .sort((a, b) => b.hoursStuck - a.hoursStuck)
    .slice(0, DIGEST_ROWS);
  const more = listed.length - rows.length;
  const cell = (html: string) =>
    `<td style="padding:6px 8px;border-bottom:1px solid #e7e5ef;vertical-align:top">${html}</td>`;
  const failures = (count: number, providers: string[]) =>
    count ? `${count} (${escape(providers.join(', '))})` : '0';
  return {
    subject: `Trials: ${listed.length} workspace${
      listed.length === 1 ? '' : 's'
    }, ${
      listed.filter((row) => row.hoursStuck >= 24).length
    } stuck for a day or more`,
    html: [
      `<p style="margin:0 0 16px">Workspaces in a trial or signed up in the last ${TRIALS_SIGNED_UP_DAYS} days without a plan. Failures are of the last ${TRIALS_FAILURE_DAYS} days.</p>`,
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;font-size:13px;line-height:1.4">',
      `<tr>${[
        'Workspace',
        'Signed up',
        'Last step',
        'Channels',
        'Scheduled / published',
        'Connect failures',
        'Publish errors',
      ]
        .map((title) => cell(`<strong>${title}</strong>`))
        .join('')}</tr>`,
      ...rows.map(
        (row) =>
          `<tr>${[
            `<a href="${escape(
              adminWorkspaceUrl(row.organizationId, app)
            )}" target="_blank">${escape(row.name)}</a>`,
            escape(new Date(row.signedUpAt).toISOString().slice(0, 10)),
            `${escape(stepLabel(row.lastStep))}, ${durationLabel(
              row.hoursStuck
            )}`,
            String(row.channels),
            `${row.postsScheduled} / ${row.postsPublished}`,
            failures(row.connectFailures, row.connectFailureProviders),
            failures(row.publishErrors, row.publishErrorProviders),
          ]
            .map(cell)
            .join('')}</tr>`
      ),
      '</table>',
      ...(more
        ? [
            `<p style="margin:16px 0 0">+${more} more, <a href="${escape(
              `${app}/admin/stats#trials`
            )}" target="_blank">open the admin page</a> for all of them.</p>`,
          ]
        : []),
      emailButton(`${app}/admin/stats#trials`, 'Open Trials & blockers'),
    ].join(''),
  };
};

@Injectable()
export class OwnerAlertsService {
  private readonly _logger = new Logger(OwnerAlertsService.name);
  constructor(
    private _ownerAlertsRepository: OwnerAlertsRepository,
    private _emailService: EmailService
  ) {}

  enabled() {
    return (
      ownerAlertRecipients().length > 0 && this._emailService.hasProvider()
    );
  }

  // cheap, MeasurementService asks it before every record
  watches(kind: string) {
    return OWNER_ALERT_KINDS.includes(kind) && this.enabled();
  }

  private async send(subject: string, html: string) {
    for (const address of ownerAlertRecipients()) {
      await this._emailService.sendEmail(address, subject, html, 'bottom');
    }
  }

  // One window per clock hour, counted like the other limits on Redis. The
  // email over the cap is skipped (the event stays in the digest and the
  // admin page); the first one over it sends the only notice of the hour
  private async withinHourlyCap(now = Date.now()) {
    const key = `owner-alert:hour:${Math.floor(now / HOUR)}`;
    const count = await ioRedis.incr(key);
    // also when an earlier expire was lost, or the key would never reset
    if (count === 1 || (await ioRedis.ttl(key)) < 0) {
      await ioRedis.expire(key, 2 * 60 * 60);
    }
    if (count <= OWNER_ALERTS_PER_HOUR) {
      return true;
    }
    if (count === OWNER_ALERTS_PER_HOUR + 1) {
      const notice = ownerAlertsPausedEmail();
      await this.send(notice.subject, notice.html);
    }
    return false;
  }

  // ours or a test: a super admin is a member, or Measurement marked it
  private isInternal(workspace: {
    users: { user: { isSuperAdmin: boolean } }[];
  }) {
    return workspace.users.some((member) => member.user.isSuperAdmin);
  }

  // Never throws and never waits on the person's action: the caller does not
  // await it, and anything that fails is logged here
  async funnelEvent(alert: FunnelAlert) {
    try {
      if (!this.enabled() || alert.internalOrTest || !alert.organizationId) {
        return;
      }
      const workspace = await this._ownerAlertsRepository.getWorkspace(
        alert.organizationId
      );
      if (!workspace || workspace.deletedAt || this.isInternal(workspace)) {
        return;
      }
      // a lapsed trial or a channel turned off fails every queued post: in
      // the digest and the admin page, never an email per post
      if (
        alert.kind === 'publish_failed' &&
        QUIET_PUBLISH_FAILURES.includes(alert.reason || '')
      ) {
        return;
      }
      // every paid invoice is an event, the owner hears about the first
      if (
        alert.kind === 'nonzero_payment' &&
        (await this._ownerAlertsRepository.countEvents(
          alert.organizationId,
          'nonzero_payment'
        )) > 1
      ) {
        return;
      }
      // first to claim it sends: a failure of the same workspace and network
      // in the window, or another receipt of the same event, does not
      const claim = REPEATED_FAILURES.includes(alert.kind)
        ? {
            key: `owner-alert:${alert.kind}:${alert.organizationId}:${
              alert.provider || 'unknown'
            }`,
            hours: FAILURE_ALERT_HOURS,
          }
        : alert.key
        ? { key: `owner-alert:event:${alert.key}`, hours: SENT_ALERT_HOURS }
        : undefined;
      if (
        claim &&
        (await ioRedis.set(claim.key, '1', 'EX', claim.hours * 60 * 60, 'NX')) !==
          'OK'
      ) {
        return;
      }
      const owner = workspace.users.find((member) => member.role === 'SUPERADMIN');
      const email = ownerAlertEmail(alert, {
        name: workspace.name,
        method: signUpMethod(owner?.user.providerName),
        plan: workspace.subscription
          ? planName(workspace.subscription.subscriptionTier)
          : undefined,
      });
      if (!email || !(await this.withinHourlyCap())) {
        return;
      }
      await this.send(email.subject, email.html);
    } catch (err) {
      this._logger.warn(
        `Could not send an owner alert. kind=${alert.kind} code=${
          (err as { code?: string })?.code || (err as Error)?.name || 'unknown'
        }`
      );
    }
  }

  // a survey answer, like funnelEvent it never throws
  async feedbackAnswered(
    orgId: string,
    kind: string,
    choice: string,
    text: string
  ) {
    try {
      if (!this.enabled()) {
        return;
      }
      const [workspace, acquisition] = await Promise.all([
        this._ownerAlertsRepository.getWorkspace(orgId),
        this._ownerAlertsRepository.getAcquisition(orgId),
      ]);
      if (
        !workspace ||
        this.isInternal(workspace) ||
        acquisition?.internalOrTest ||
        process.env.MEASUREMENT_INTERNAL_ONLY === 'true'
      ) {
        return;
      }
      const email = feedbackAlertEmail(orgId, workspace.name, kind, choice, text);
      if (!(await this.withinHourlyCap())) {
        return;
      }
      await this.send(email.subject, email.html);
    } catch (err) {
      this._logger.warn(
        `Could not send a survey alert. code=${
          (err as { code?: string })?.code || (err as Error)?.name || 'unknown'
        }`
      );
    }
  }

  // The trials table of the admin page and the daily digest
  async trials(now = new Date()) {
    const workspaces = await this._ownerAlertsRepository.getTrials(
      new Date(now.getTime() - TRIALS_SIGNED_UP_DAYS * DAY)
    );
    const ids = workspaces.map((workspace) => workspace.id);
    if (!ids.length) {
      return [];
    }
    const [channels, posts, failures, answers, internal] = await Promise.all([
      this._ownerAlertsRepository.countChannels(ids),
      this._ownerAlertsRepository.countPosts(ids),
      this._ownerAlertsRepository.countFailures(
        ids,
        new Date(now.getTime() - TRIALS_FAILURE_DAYS * DAY)
      ),
      this._ownerAlertsRepository.getAnswers(ids),
      this._ownerAlertsRepository.getInternal(ids),
    ]);

    return workspaces.map((workspace) => {
      const channel = channels.find((c) => c.organizationId === workspace.id);
      return buildTrialRow(
        {
          id: workspace.id,
          name: workspace.name,
          internal:
            process.env.MEASUREMENT_INTERNAL_ONLY === 'true' ||
            internal.some((row) => row.organizationId === workspace.id),
          createdAt: workspace.createdAt,
          ownerEmail: workspace.users[0]?.user.email || null,
          method: workspace.users[0]?.user.providerName || null,
          subscription: workspace.subscription,
          channels: channel?._count._all || 0,
          firstChannelAt: channel?._min.createdAt || null,
          posts: posts
            .filter((p) => p.organizationId === workspace.id)
            .map((p) => ({
              state: p.state,
              count: p._count._all,
              firstCreatedAt: p._min.createdAt,
              firstPublishAt: p._min.publishDate,
            })),
          failures: failures
            .filter((f) => f.organizationId === workspace.id)
            .map((f) => ({
              kind: f.kind,
              provider: f.provider,
              count: f._count._all,
            })),
          answers: answers.filter((a) => a.organizationId === workspace.id),
        },
        now
      );
    });
  }

  // GET /admin/stats/trials; a workspace (the link of an alert) narrows the
  // rows to it
  async trialsReport(workspace?: string, now = new Date()) {
    const [all, latest] = await Promise.all([
      this.trials(now),
      this._ownerAlertsRepository.getLatestAnswers(),
    ]);
    const names = await this._ownerAlertsRepository.getOrganizationNames([
      ...new Set(latest.map((answer) => answer.organizationId)),
    ]);
    return {
      generatedAt: now.toISOString(),
      signedUpDays: TRIALS_SIGNED_UP_DAYS,
      failureDays: TRIALS_FAILURE_DAYS,
      rows: workspace
        ? all.filter((row) => row.organizationId === workspace)
        : all,
      answers: latest.map((answer) => ({
        id: answer.id,
        organizationId: answer.organizationId,
        workspace:
          names.find((org) => org.id === answer.organizationId)?.name || null,
        kind: answer.kind,
        choice: answer.choice,
        text: answer.text,
        createdAt: answer.createdAt.toISOString(),
      })),
    };
  }

  // Run once a day by ownerDigestWorkflowV1
  async sendDailyDigest(now = new Date()) {
    if (!this.enabled()) {
      return { workspaces: 0, sent: false };
    }
    const rows = await this.trials(now);
    const email = ownerDigestEmail(rows);
    if (!email) {
      return { workspaces: 0, sent: false };
    }
    // once per recipient and day: a retried activity skips who got it
    const day = now.toISOString().slice(0, 10);
    for (const address of ownerAlertRecipients()) {
      const key = `owner-digest:${day}:${address}`;
      if ((await ioRedis.set(key, '1', 'EX', 36 * 60 * 60, 'NX')) !== 'OK') {
        continue;
      }
      try {
        await this._emailService.sendEmail(
          address,
          email.subject,
          email.html,
          'bottom'
        );
      } catch (err) {
        // not sent: the retry may try this one again
        await ioRedis.del(key).catch(() => undefined);
        throw err;
      }
    }
    return { workspaces: rows.filter((row) => !row.internal).length, sent: true };
  }
}
