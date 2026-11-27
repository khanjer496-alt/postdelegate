import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { MeasurementEvent, Prisma } from '@prisma/client';
import { chunk, uniq } from 'lodash';

export const MEASUREMENT_EXPORT_CAP = 100000;

@Injectable()
export class MeasurementRepository {
  constructor(private prisma: PrismaService) {}
  // replay: the same event delivered again (a webhook retry); a later occurrence of a
  // first-time milestone, like another draft save, is not one
  save(data: Prisma.MeasurementEventCreateInput, replay = true) {
    return this.prisma.measurementEvent.upsert({
      where: { key: data.key },
      create: data,
      update: replay ? { duplicates: { increment: 1 } } : {},
      select: { key: true },
    });
  }
  acquisition(org: string) {
    return this.prisma.measurementEvent.findFirst({
      where: { organizationId: org, kind: 'acquisition' },
    });
  }
  subscription(org: string) {
    return this.prisma.subscription.findUnique({
      where: { organizationId: org },
      select: {
        identifier: true,
        isLifetime: true,
        status: true,
        trialEndsAt: true,
        deletedAt: true,
      },
    });
  }
  organizationForCustomer(customer: string) {
    return this.prisma.organization.findFirst({
      where: { paymentId: customer, deletedAt: null },
      select: { id: true },
    });
  }
  owners(user: string) {
    return this.prisma.userOrganization.findMany({
      where: { userId: user, role: 'SUPERADMIN' },
      select: { organizationId: true },
    });
  }
  channel(org: string, id: string) {
    return this.prisma.integration.findFirst({
      where: { id, organizationId: org },
      select: {
        id: true,
        providerIdentifier: true,
        deletedAt: true,
        disabled: true,
        inBetweenSteps: true,
        refreshNeeded: true,
      },
    });
  }
  post(org: string, id: string) {
    return this.prisma.post.findFirst({
      where: { id, organizationId: org, parentPostId: null, deletedAt: null },
      select: {
        id: true,
        state: true,
        approvalStatus: true,
        publishDate: true,
        releaseId: true,
        integrationId: true,
      },
    });
  }
  rootPost(id: string) {
    return this.prisma.post.findFirst({
      where: { id, parentPostId: null },
      select: { id: true, organizationId: true, releaseId: true, state: true },
    });
  }
  // The export reads the window, then only the rows of the window's workspaces the
  // cohorts and payment checks join on. Explicit cap: overflow fails closed, never
  // returns a deceptively complete export.
  async rows(from: Date, to: Date, asOf: Date) {
    const window = await this.prisma.measurementEvent.findMany({
      where: { occurredAt: { gte: from, lt: to } },
      orderBy: [{ occurredAt: 'asc' }, { key: 'asc' }],
      take: MEASUREMENT_EXPORT_CAP + 1,
    });
    if (window.length > MEASUREMENT_EXPORT_CAP) return window;
    const organizations = uniq(
      window.map((row) => row.organizationId).filter(Boolean)
    );
    const related: MeasurementEvent[] = [];
    for (const ids of chunk(organizations, 1000)) {
      related.push(
        ...(await this.prisma.measurementEvent.findMany({
          where: {
            organizationId: { in: ids },
            OR: [
              // earlier trials decide the first cohort, entitlements qualify payments
              {
                occurredAt: { lt: from },
                kind: { in: ['trial_started', 'entitlement_applied'] },
              },
              // a window trial converts after the window
              {
                occurredAt: { gte: to, lt: asOf },
                kind: { in: ['entitlement_applied', 'nonzero_payment'] },
              },
              // a schedule counts only within 48 hours of a window trial
              {
                occurredAt: {
                  gte: to,
                  lt: new Date(
                    Math.min(to.getTime() + 2 * 86400000, asOf.getTime())
                  ),
                },
                kind: 'qualifying_schedule',
              },
            ],
          },
          take: MEASUREMENT_EXPORT_CAP + 1,
        }))
      );
      if (window.length + related.length > MEASUREMENT_EXPORT_CAP) break;
    }
    return [...window, ...related];
  }
  lifetimeOrgs() {
    return this.prisma.subscription.findMany({
      where: { isLifetime: true },
      select: { organizationId: true },
    });
  }
  async saveHandoff(nonceHash: string, token: string) {
    await this.prisma.measurementHandoff.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return this.prisma.measurementHandoff.create({
      data: { nonceHash, token, expiresAt: new Date(Date.now() + 600000) },
      select: { nonceHash: true },
    });
  }
  async handoff(nonceHash: string) {
    await this.prisma.measurementHandoff.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return this.prisma.measurementHandoff.findFirst({
      where: { nonceHash, expiresAt: { gt: new Date() } },
      select: { token: true },
    });
  }
  firstEvent() {
    return this.prisma.measurementEvent.findFirst({
      orderBy: { receivedAt: 'asc' },
      select: { receivedAt: true },
    });
  }
}
