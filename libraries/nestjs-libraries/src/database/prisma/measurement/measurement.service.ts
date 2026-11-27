import { Injectable, Logger } from '@nestjs/common';
import {
  MEASUREMENT_EXPORT_CAP,
  MeasurementRepository,
} from './measurement.repository';
import { acquisitionFromToken, measurementHash } from './acquisition';
import { aggregateMeasurement } from './measurement.aggregate';
import {
  isChannelConnected,
  isPubliclyAvailableProvider,
} from '../integrations/integration.state';

@Injectable()
export class MeasurementService {
  private logger = new Logger(MeasurementService.name);
  constructor(private repository: MeasurementRepository) {}
  // Deployment-owned staging quarantine; never inferred from consent or identity.
  private diagnosticOnly() {
    return process.env.MEASUREMENT_INTERNAL_ONLY === 'true';
  }
  private async safe(work: () => Promise<unknown>) {
    try {
      await work();
    } catch {
      this.logger.error('measurement_write_failed; coverage may be incomplete');
    }
  }
  async record(
    org: string,
    kind: string,
    identity: string,
    extra: {
      occurredAt?: Date;
      reference?: string;
      amountMinor?: number;
      currency?: string;
      trialEndsAt?: Date | null;
      acceptedPublishAt?: Date;
      humanApproval?: boolean;
      evidenceType?: string;
    } = {}
  ) {
    await this.safe(async () => {
      const touch = await this.repository.acquisition(org);
      await this.repository.save(
        {
          // Invoice identity survives workspace mapping changes on webhook replay.
          // Attribution/classification remains on the first receipt via repository upsert.
          key: measurementHash(
            (kind === 'nonzero_payment' ? '' : org) +
              '|' +
              kind +
              '|' +
              identity
          ),
          organizationId: org,
          kind,
          occurredAt: extra.occurredAt || new Date(),
          reference: extra.reference ? measurementHash(extra.reference) : '',
          amountMinor: extra.amountMinor || 0,
          currency: extra.currency || 'unknown',
          trialEndsAt: extra.trialEndsAt,
          acceptedPublishAt: extra.acceptedPublishAt,
          humanApproval: extra.humanApproval,
          evidenceType: extra.evidenceType,
          source: touch?.source || 'unknown',
          campaign: touch?.campaign || 'unknown',
          medium: touch?.medium || 'unknown',
          term: touch?.term || 'unknown',
          content: touch?.content || 'unknown',
          entryPage: touch?.entryPage || 'unknown',
          device: touch?.device || 'unknown',
          internalOrTest:
            this.diagnosticOnly() || touch?.internalOrTest || false,
          matchedTouch: touch?.matchedTouch || false,
        },
        // 'first' milestones are recorded on every qualifying action, only one is kept
        identity !== 'first'
      );
    });
  }
  async rememberHandoff(state: string, token: unknown) {
    await this.safe(async () => {
      if (acquisitionFromToken(token))
        await this.repository.saveHandoff(
          measurementHash(state),
          token as string
        );
    });
  }
  async handoff(state: string) {
    try {
      return (await this.repository.handoff(measurementHash(state)))?.token;
    } catch {
      this.logger.error('measurement_handoff_read_failed');
      return undefined;
    }
  }
  async signupAttempt(token: unknown, identity: string) {
    await this.safe(async () => {
      const touch = acquisitionFromToken(token);
      await this.repository.save({
        key: measurementHash('signup_request|' + identity),
        organizationId: '',
        kind: 'signup_request',
        occurredAt: new Date(),
        source: touch?.source || 'unknown',
        campaign: touch?.campaign || 'unknown',
        medium: touch?.medium || 'unknown',
        term: touch?.term || 'unknown',
        content: touch?.content || 'unknown',
        entryPage: touch?.entry_page || 'unknown',
        device: touch?.device || 'unknown',
        internalOrTest:
          this.diagnosticOnly() || touch?.internal_or_test || false,
        matchedTouch: !!touch,
      });
    });
  }
  async registration(org: string, token: unknown, activated: boolean) {
    await this.safe(async () => {
      const touch = acquisitionFromToken(token);
      const data = {
        key: measurementHash(org + '|acquisition'),
        organizationId: org,
        kind: 'acquisition',
        occurredAt: new Date(),
        source: touch?.source || 'unknown',
        campaign: touch?.campaign || 'unknown',
        medium: touch?.medium || 'unknown',
        term: touch?.term || 'unknown',
        content: touch?.content || 'unknown',
        entryPage: touch?.entry_page || 'unknown',
        device: touch?.device || 'unknown',
        internalOrTest:
          this.diagnosticOnly() || touch?.internal_or_test || false,
        matchedTouch: !!touch,
        touchHash: touch ? measurementHash(touch.nonce) : null,
      };
      try {
        await this.repository.save(data);
      } catch (err) {
        // A touch already used by another workspace cannot inflate matched joins.
        if ((err as { code?: string }).code !== 'P2002') throw err;
        await this.repository.save({
          ...data,
          matchedTouch: false,
          touchHash: null,
          source: 'unknown',
          campaign: 'unknown',
          medium: 'unknown',
          term: 'unknown',
          content: 'unknown',
          entryPage: 'unknown',
          device: 'unknown',
        });
      }
    });
    if (activated) {
      await this.record(org, 'registration', 'first');
      await this.record(org, 'trial_eligible', 'first');
    }
  }
  async activated(user: string) {
    await this.safe(async () => {
      for (const row of await this.repository.owners(user)) {
        if (await this.repository.acquisition(row.organizationId)) {
          await this.record(row.organizationId, 'registration', 'first');
          await this.record(row.organizationId, 'trial_eligible', 'first');
        }
      }
    });
  }
  async channelConnected(org: string, id: string) {
    await this.safe(async () => {
      const channel = await this.repository.channel(org, id);
      if (
        channel &&
        isChannelConnected(channel) &&
        isPubliclyAvailableProvider(channel.providerIdentifier)
      )
        await this.record(org, 'channel_connected', 'first');
    });
  }
  async postAccepted(org: string, id: string, human: boolean) {
    await this.safe(async () => {
      const post = await this.repository.post(org, id);
      if (!post) return;
      if (post.state === 'DRAFT')
        await this.record(org, 'first_draft', 'first');
      if (
        !human ||
        post.state !== 'QUEUE' ||
        post.publishDate.getTime() <= Date.now() ||
        post.approvalStatus === 'IN_REVIEW'
      )
        return;
      const channel = await this.repository.channel(org, post.integrationId);
      if (
        !channel ||
        !isChannelConnected(channel) ||
        !isPubliclyAvailableProvider(channel.providerIdentifier)
      )
        return;
      // Identity points to accepted post, with human evidence supplied only by authenticated UI/approval paths.
      await this.record(org, 'qualifying_schedule', 'first', {
        reference: id,
        acceptedPublishAt: post.publishDate,
        humanApproval: true,
        evidenceType:
          'human-approved server-accepted future schedule to connected available channel',
      });
    });
  }
  async published(id: string) {
    await this.safe(async () => {
      const post = await this.repository.rootPost(id);
      if (post?.state === 'PUBLISHED' && post.releaseId)
        await this.record(
          post.organizationId,
          'publication',
          id + '|' + post.releaseId,
          { reference: id }
        );
    });
  }
  async entitlement(
    org: string,
    trialStart?: Date,
    subscriptionId?: string,
    expectedIdentifier?: string
  ) {
    await this.safe(async () => {
      const plan = await this.repository.subscription(org);
      if (
        !plan ||
        plan.isLifetime ||
        plan.deletedAt ||
        !plan.identifier ||
        (expectedIdentifier && plan.identifier !== expectedIdentifier)
      )
        return;
      const reference = subscriptionId || plan.identifier;
      if (plan.status === 'trialing')
        await this.record(org, 'trial_started', reference, {
          reference,
          occurredAt: trialStart,
          trialEndsAt: plan.trialEndsAt,
        });
      if (['active', 'past_due'].includes(plan.status || ''))
        await this.record(org, 'entitlement_applied', reference, { reference });
    });
  }
  async payment(
    customer: string,
    subscription: string,
    invoice: string,
    amountMinor: number,
    currency: string,
    occurredAt: Date
  ) {
    await this.safe(async () => {
      if (
        !subscription ||
        !Number.isSafeInteger(amountMinor) ||
        amountMinor <= 0
      )
        return;
      const org = await this.repository.organizationForCustomer(customer);
      // Keep unmapped/deleted-workspace invoices in reconciliation; an empty
      // workspace is ineligible for commercial revenue and conversions.
      await this.record(org?.id || '', 'nonzero_payment', invoice, {
        reference: subscription,
        amountMinor,
        currency,
        occurredAt,
      });
    });
  }
  async export(from: Date, to: Date) {
    const asOf = new Date();
    const [rows, lifetime, first] = await Promise.all([
      this.repository.rows(from, to, asOf),
      this.repository.lifetimeOrgs(),
      this.repository.firstEvent(),
    ]);
    if (rows.length > MEASUREMENT_EXPORT_CAP)
      return {
        status: 'unavailable',
        reason: `Export exceeds ${MEASUREMENT_EXPORT_CAP} rows; request a smaller date window`,
      };
    const report = aggregateMeasurement(
      rows,
      new Set(lifetime.map((row) => row.organizationId)),
      from,
      to,
      first?.receivedAt || null,
      asOf
    );
    return {
      ...report,
      coverage: {
        ...report.coverage,
        diagnostic_only_current_configuration: this.diagnosticOnly(),
        diagnostic_scope:
          'current writes only; historical classifications are unchanged',
      },
    };
  }
}
