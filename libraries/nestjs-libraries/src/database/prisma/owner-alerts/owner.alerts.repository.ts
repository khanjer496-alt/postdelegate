import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { CHANNEL_CONNECTED } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.state';

// Publish failures the workflows record for a lapsed trial or a channel
// turned off (MeasurementService.publishFailed): they fail every queued post
// the same way, so they are neither an email per post nor a blocker count
export const QUIET_PUBLISH_FAILURES = ['channel_disabled', 'no_subscription'];

// a launch-stage list, the digest and the admin table never page
export const TRIALS_LIMIT = 500;
export const ANSWERS_LIMIT = 50;

@Injectable()
export class OwnerAlertsRepository {
  constructor(
    private _organization: PrismaRepository<'organization'>,
    private _integration: PrismaRepository<'integration'>,
    private _post: PrismaRepository<'post'>,
    private _measurementEvent: PrismaRepository<'measurementEvent'>,
    private _feedbackAnswer: PrismaRepository<'feedbackAnswer'>
  ) {}

  // What an alert says about the workspace, and whether it is one of ours: a
  // workspace a super admin belongs to is internal, like the staging ones
  getWorkspace(orgId: string) {
    return this._organization.model.organization.findUnique({
      where: {
        id: orgId,
      },
      select: {
        name: true,
        deletedAt: true,
        subscription: {
          select: {
            subscriptionTier: true,
            period: true,
          },
        },
        users: {
          select: {
            role: true,
            user: {
              select: {
                providerName: true,
                isSuperAdmin: true,
              },
            },
          },
        },
      },
    });
  }

  // the acquisition row carries the internal/test class of the workspace
  getAcquisition(orgId: string) {
    return this._measurementEvent.model.measurementEvent.findFirst({
      where: {
        organizationId: orgId,
        kind: 'acquisition',
      },
      select: {
        internalOrTest: true,
        source: true,
      },
    });
  }

  // the workspaces Measurement marked internal or test
  getInternal(orgIds: string[]) {
    return this._measurementEvent.model.measurementEvent.findMany({
      where: {
        organizationId: {
          in: orgIds,
        },
        kind: 'acquisition',
        internalOrTest: true,
      },
      select: {
        organizationId: true,
      },
    });
  }

  countEvents(orgId: string, kind: string) {
    return this._measurementEvent.model.measurementEvent.count({
      where: {
        organizationId: orgId,
        kind,
      },
    });
  }

  // In a trial now (any age), or signed up since `since` without a plan: a
  // workspace that pays, or got a lifetime or admin plan, is not in here.
  // Workspaces a super admin belongs to are ours, never in the list.
  getTrials(since: Date) {
    return this._organization.model.organization.findMany({
      where: {
        deletedAt: null,
        users: {
          none: {
            user: {
              isSuperAdmin: true,
            },
          },
        },
        OR: [
          {
            subscription: {
              is: {
                status: 'trialing',
                deletedAt: null,
              },
            },
          },
          {
            createdAt: {
              gte: since,
            },
            // an ended plan's row is deleted, not marked
            subscription: { is: null },
          },
        ],
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        subscription: {
          select: {
            subscriptionTier: true,
            status: true,
            trialEndsAt: true,
            createdAt: true,
            cancelAt: true,
          },
        },
        users: {
          where: {
            role: 'SUPERADMIN',
          },
          select: {
            user: {
              select: {
                email: true,
                providerName: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
          take: 1,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: TRIALS_LIMIT,
    });
  }

  // the connected channels, and when the first of them was connected
  countChannels(orgIds: string[]) {
    return this._integration.model.integration.groupBy({
      by: ['organizationId'],
      where: {
        organizationId: {
          in: orgIds,
        },
        ...CHANNEL_CONNECTED,
      },
      _count: {
        _all: true,
      },
      _min: {
        createdAt: true,
      },
    });
  }

  // the main posts per state (not the comments of a thread)
  countPosts(orgIds: string[]) {
    return this._post.model.post.groupBy({
      by: ['organizationId', 'state'],
      where: {
        organizationId: {
          in: orgIds,
        },
        deletedAt: null,
        parentPostId: null,
      },
      _count: {
        _all: true,
      },
      _min: {
        createdAt: true,
        publishDate: true,
      },
    });
  }

  // connect failures and publish errors since `since`, per network
  countFailures(orgIds: string[], since: Date) {
    return this._measurementEvent.model.measurementEvent.groupBy({
      by: ['organizationId', 'kind', 'provider'],
      where: {
        organizationId: {
          in: orgIds,
        },
        kind: {
          in: ['channel_connect_failed', 'publish_failed'],
        },
        // a lapsed trial or a channel turned off is not a blocker to act on
        reason: {
          notIn: QUIET_PUBLISH_FAILURES,
        },
        occurredAt: {
          gte: since,
        },
      },
      _count: {
        _all: true,
      },
    });
  }

  getAnswers(orgIds: string[]) {
    return this._feedbackAnswer.model.feedbackAnswer.findMany({
      where: {
        organizationId: {
          in: orgIds,
        },
      },
      select: {
        organizationId: true,
        kind: true,
        choice: true,
        text: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  // the latest answers, skipped questions left out
  getLatestAnswers() {
    return this._feedbackAnswer.model.feedbackAnswer.findMany({
      where: {
        choice: {
          not: 'skipped',
        },
      },
      select: {
        id: true,
        organizationId: true,
        kind: true,
        choice: true,
        text: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: ANSWERS_LIMIT,
    });
  }

  getOrganizationNames(orgIds: string[]) {
    return this._organization.model.organization.findMany({
      where: {
        id: {
          in: orgIds,
        },
      },
      select: {
        id: true,
        name: true,
      },
    });
  }
}
