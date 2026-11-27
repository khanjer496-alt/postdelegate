import { MeasurementEvent } from '@prisma/client';
const DAY = 86400000;
const date = (at: Date) =>
  new Date(at.getTime() + 240 * 60000).toISOString().slice(0, 10);
const week = (at: Date) => {
  const d = new Date(at.getTime() + 240 * 60000);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};
const metrics = [
  'signup_attempts',
  'confirmed_new_owner_workspaces',
  'eligible_trial_workspaces',
  'confirmed_trial_starts',
  'channel_connected_workspaces',
  'first_draft_workspaces',
  'approved_accepted_future_schedule_workspaces',
  'provider_confirmed_publications',
  'paid_subscription_workspaces',
  'nonzero_subscription_payments',
  'entitlement_applied_workspaces',
  'revenue_minor',
] as const;
const field: Record<string, (typeof metrics)[number]> = {
  signup_request: 'signup_attempts',
  registration: 'confirmed_new_owner_workspaces',
  trial_eligible: 'eligible_trial_workspaces',
  trial_started: 'confirmed_trial_starts',
  channel_connected: 'channel_connected_workspaces',
  first_draft: 'first_draft_workspaces',
  qualifying_schedule: 'approved_accepted_future_schedule_workspaces',
  publication: 'provider_confirmed_publications',
  nonzero_payment: 'nonzero_subscription_payments',
  entitlement_applied: 'entitlement_applied_workspaces',
};

// Only aggregate values are returned. Ledger keys, org ids, references and touch hashes never leave here.
export const aggregateMeasurement = (
  events: MeasurementEvent[],
  lifetime: Set<string>,
  from: Date,
  to: Date,
  instrumentationStart: Date | null,
  asOf = new Date()
) => {
  const eligible = (row: MeasurementEvent) =>
    !!row.organizationId &&
    !row.internalOrTest &&
    !lifetime.has(row.organizationId);
  const entitlements = new Set(
    events
      .filter((row) => row.kind === 'entitlement_applied' && eligible(row))
      .map((row) => row.organizationId + '|' + row.reference)
  );
  const paid = (row: MeasurementEvent) =>
    row.kind === 'nonzero_payment' &&
    row.amountMinor > 0 &&
    eligible(row) &&
    entitlements.has(row.organizationId + '|' + row.reference);
  type Group = {
    date: string;
    source: string;
    medium: string;
    campaign: string;
    entry_page: string;
    device: string;
    internal_or_test: boolean;
    lifetime: boolean;
    currency: string;
    eligible_visitor_ids: null;
  } & Record<(typeof metrics)[number], number>;
  const groups = new Map<string, Group>();
  const seen = new Set<string>();
  for (const row of events) {
    if (row.occurredAt < from || row.occurredAt >= to || !field[row.kind])
      continue;
    // An unmatched or zero invoice adds nothing, so it must not open an all-zero group.
    if (row.kind === 'nonzero_payment' && !paid(row)) continue;
    const dims = {
      date: date(row.occurredAt),
      source: row.source,
      medium: row.medium,
      campaign: row.campaign,
      entry_page: row.entryPage,
      device: row.device,
      internal_or_test: row.internalOrTest,
      lifetime: lifetime.has(row.organizationId),
      currency: row.currency,
    };
    const key = JSON.stringify(dims);
    if (!groups.has(key))
      groups.set(key, {
        ...dims,
        eligible_visitor_ids: null,
        ...Object.fromEntries(metrics.map((name) => [name, 0])),
      } as Group);
    const group = groups.get(key)!;
    const name = field[row.kind];
    // Diagnostic segments stay visible; never add them to the eligible commercial denominator.
    if (name.endsWith('_workspaces')) {
      const identity = key + '|' + name + '|' + row.organizationId;
      if (!seen.has(identity)) {
        group[name]++;
        seen.add(identity);
      }
    } else group[name]++;
    if (row.kind === 'nonzero_payment') {
      group.revenue_minor += row.amountMinor;
      const identity = key + '|paid|' + row.organizationId;
      if (!seen.has(identity)) {
        group.paid_subscription_workspaces++;
        seen.add(identity);
      }
    }
  }
  const cohorts = new Map<
    string,
    {
      trial_start_week: string;
      eligibility_class: string;
      eligible_trials: number;
      fully_observed_48h_trials: number;
      first_qualifying_schedules_within_48h: number;
      fully_observed_trial_end_plus_7d_trials: number;
      qualified_paid_conversions: number;
      later_conversions: number;
    }
  >();
  // A workspace enters its first observed trial cohort once, even after provider replays/replacements.
  const firstTrials = new Map<string, MeasurementEvent>();
  for (const row of events.filter(row => row.kind === 'trial_started').sort((a,b) => a.occurredAt.getTime()-b.occurredAt.getTime())) {
    if (!firstTrials.has(row.organizationId)) firstTrials.set(row.organizationId,row);
  }
  const trials = [...firstTrials.values()].filter(row => row.occurredAt >= from && row.occurredAt < to);
  for (const trial of trials) {
    const eligibility = trial.internalOrTest
      ? 'internal_or_test'
      : lifetime.has(trial.organizationId)
      ? 'lifetime'
      : 'eligible';
    const key = week(trial.occurredAt) + '|' + eligibility;
    if (!cohorts.has(key))
      cohorts.set(key, {
        trial_start_week: week(trial.occurredAt),
        eligibility_class: eligibility,
        eligible_trials: 0,
        fully_observed_48h_trials: 0,
        first_qualifying_schedules_within_48h: 0,
        fully_observed_trial_end_plus_7d_trials: 0,
        qualified_paid_conversions: 0,
        later_conversions: 0,
      });
    const cohort = cohorts.get(key)!;
    if (!eligible(trial)) continue;
    cohort.eligible_trials++;
    const observed =
      !!instrumentationStart && trial.occurredAt >= instrumentationStart;
    const after48 = trial.occurredAt.getTime() + 2 * DAY;
    if (observed && asOf.getTime() >= after48) {
      cohort.fully_observed_48h_trials++;
      if (
        events.some(
          (row) =>
            row.organizationId === trial.organizationId &&
            row.kind === 'qualifying_schedule' &&
            eligible(row) &&
            row.occurredAt >= trial.occurredAt &&
            row.occurredAt.getTime() < after48
        )
      )
        cohort.first_qualifying_schedules_within_48h++;
    }
    const mature = trial.trialEndsAt
      ? trial.trialEndsAt.getTime() + 7 * DAY
      : null;
    if (observed && mature && asOf.getTime() >= mature) {
      cohort.fully_observed_trial_end_plus_7d_trials++;
      const payments = events.filter(
        (row) =>
          row.organizationId === trial.organizationId &&
          row.reference === trial.reference &&
          paid(row) &&
          row.occurredAt >= trial.occurredAt
      );
      if (payments.some((row) => row.occurredAt.getTime() <= mature))
        cohort.qualified_paid_conversions++;
      else if (payments.some((row) => row.occurredAt.getTime() > mature))
        cohort.later_conversions++;
    }
  }
  const window = events.filter(
    (row) =>
      row.occurredAt >= from &&
      row.occurredAt < to &&
      row.kind !== 'acquisition'
  );
  const matched = window.filter(
    (row) => row.matchedTouch && eligible(row)
  ).length;
  const days = [];
  for (
    let t = Math.floor((from.getTime() + 14400000) / DAY) * DAY - 14400000;
    t < to.getTime();
    t += DAY
  )
    days.push({
      date: date(new Date(t)),
      availability:
        !instrumentationStart || t + DAY <= instrumentationStart.getTime()
          ? 'unavailable'
          : t < instrumentationStart.getTime()
          ? 'partial'
          : 'observed',
    });
  return {
    timezone: 'Asia/Dubai',
    boundaries: '[from,to)',
    from: from.toISOString(),
    to: to.toISOString(),
    as_of: asOf.toISOString(),
    unit: 'workspaces; payments/publications are event counts, never sum workspace dimensions',
    rows: [...groups.values()],
    cohorts: [...cohorts.values()],
    days,
    reconciliation: {
      total_server_milestones: window.length,
      unmatched_subscription_payments: window.filter(
        (row) => row.kind === 'nonzero_payment' && !paid(row)
      ).length,
      milestones_with_valid_event_identity: window.length,
      matched_eligible_workspace: window.filter(
        (row) => !!row.organizationId && eligible(row)
      ).length,
      matched_permitted_acquisition_touch: matched,
      unmatched: window.filter((row) => !row.matchedTouch).length,
      duplicated: window.reduce((n, row) => n + row.duplicates, 0),
      delayed: window.filter(
        (row) => row.receivedAt.getTime() - row.occurredAt.getTime() > 300000
      ).length,
      internal_excluded: window.filter((row) => row.internalOrTest).length,
      lifetime_excluded: window.filter((row) =>
        lifetime.has(row.organizationId)
      ).length,
      eligible_server_milestones: window.filter(eligible).length,
      join_completeness: window.filter(eligible).length
        ? matched / window.filter(eligible).length
        : null,
    },
    coverage: {
      instrumentation_start: instrumentationStart?.toISOString() || null,
      source_release:
        process.env.MEASUREMENT_RELEASE || process.env.GIT_SHA || 'unknown',
      retention: 'ledger retained; no historical source rows deleted',
      historical_backfill: 'unavailable; no inferred approval/payment evidence',
      attribution:
        'signed first touch in last 24h, URL→server only; one touch per workspace',
      consent:
        'no browser storage added; blocked/missing/expired handoff stays unmatched',
      ingestion_lag:
        'synchronous server milestone after accepted action; delayed >5 minutes counted',
      continuous_completeness_verified: false,
      total_milestones_basis:
        'observed durable rows; reconcile source outcomes before using a funnel',
      write_failure_coverage:
        'errors logged as measurement_write_failed; continuous completeness requires staging qualification',
      visitor_table:
        'separate Pulse /api/measurement; visitor metrics unavailable in this table',
      signup_attempt_scope:
        'server-observed register submissions; authentication attempts are not confirmed registrations',
    },
  };
};
