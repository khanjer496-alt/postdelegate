import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class MeasurementRepository {
  constructor(private prisma: PrismaService) {}
  save(data: Prisma.MeasurementEventCreateInput) {
    return this.prisma.measurementEvent.upsert({
      where: { key: data.key },
      create: data,
      update: { duplicates: { increment: 1 } },
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
  rows(from: Date, to: Date) {
    // Explicit cap: overflow fails closed, never returns a deceptively complete export.
    return this.prisma.measurementEvent.findMany({
      where: {
        occurredAt: { lt: to },
        OR: [
          { occurredAt: { gte: from } },
          {
            kind: {
              in: [
                'acquisition',
                'trial_started',
                'entitlement_applied',
                'qualifying_schedule',
              ],
            },
          },
        ],
      },
      orderBy: [{ occurredAt: 'asc' }, { key: 'asc' }],
      take: 100001,
    });
  }
  lifetimeOrgs() {
    return this.prisma.subscription.findMany({
      where: { isLifetime: true },
      select: { organizationId: true },
    });
  }
  async saveHandoff(nonceHash: string, token: string) {
    await this.prisma.measurementHandoff.deleteMany({where:{expiresAt:{lt:new Date()}}});
    return this.prisma.measurementHandoff.create({
      data: { nonceHash, token, expiresAt: new Date(Date.now() + 600000) },
      select: { nonceHash: true },
    });
  }
  async handoff(nonceHash: string) {
    await this.prisma.measurementHandoff.deleteMany({where:{expiresAt:{lt:new Date()}}});
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
