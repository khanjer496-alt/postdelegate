import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';

@Injectable()
export class FeedbackRepository {
  constructor(
    private _feedbackAnswer: PrismaRepository<'feedbackAnswer'>,
    private _measurementEvent: PrismaRepository<'measurementEvent'>,
    private _subscription: PrismaRepository<'subscription'>,
    private _userOrganization: PrismaRepository<'userOrganization'>
  ) {}

  getAnswerKinds(organizationId: string, userId: string) {
    return this._feedbackAnswer.model.feedbackAnswer.findMany({
      where: {
        organizationId,
        userId,
      },
      select: {
        kind: true,
      },
    });
  }

  // the trial or the plan of the workspace ended (MeasurementService)
  getEnded(organizationId: string) {
    return this._measurementEvent.model.measurementEvent.findFirst({
      where: {
        organizationId,
        kind: 'subscription_ended',
      },
      select: {
        key: true,
      },
    });
  }

  // a plan again since: nothing stopped them
  getPlan(organizationId: string) {
    return this._subscription.model.subscription.findFirst({
      where: {
        organizationId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });
  }

  // the members who can buy a plan: the person who signed up and the admins
  getRole(organizationId: string, userId: string) {
    return this._userOrganization.model.userOrganization.findFirst({
      where: {
        organizationId,
        userId,
        disabled: false,
        role: {
          in: [Role.SUPERADMIN, Role.ADMIN],
        },
      },
      select: {
        role: true,
      },
    });
  }

  // The first answer is kept: a second submit of the same question (another
  // tab) changes nothing. Returns whether this one was stored.
  async saveAnswer(data: {
    organizationId: string;
    userId: string;
    kind: string;
    choice: string;
    text: string;
  }) {
    const saved = await this._feedbackAnswer.model.feedbackAnswer.createMany({
      data: [data],
      skipDuplicates: true,
    });
    return saved.count > 0;
  }
}
