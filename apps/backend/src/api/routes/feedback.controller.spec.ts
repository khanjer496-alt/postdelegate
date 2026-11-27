// the real services pull in every social provider, the spec only needs the shape
jest.mock('@gitroom/nestjs-libraries/database/prisma/errors/errors.service', () => ({ ErrorsService: class {} }));
jest.mock('@gitroom/nestjs-libraries/database/prisma/admin-stats/admin-stats.service', () => ({ AdminStatsService: class {} }));
jest.mock('@gitroom/nestjs-libraries/database/prisma/affiliates/affiliate.service', () => ({ AffiliateService: class {} }));
jest.mock('@gitroom/nestjs-libraries/database/prisma/reviews/review.service', () => ({ ReviewService: class {} }));
jest.mock('@gitroom/nestjs-libraries/database/prisma/measurement/measurement.service', () => ({ MeasurementService: class {} }));
jest.mock('@gitroom/nestjs-libraries/database/prisma/owner-alerts/owner.alerts.service', () => ({ OwnerAlertsService: class {} }));
jest.mock('@gitroom/nestjs-libraries/database/prisma/feedback/feedback.service', () => ({ FeedbackService: class {} }));

import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { AdminController } from './admin.controller';
import { FeedbackController } from './feedback.controller';
import { FeedbackAnswerDto } from '@gitroom/nestjs-libraries/dtos/feedback/feedback.answer.dto';
import { AdminTrialsDto } from '@gitroom/nestjs-libraries/dtos/owner-alerts/admin.trials.dto';

describe('FeedbackController', () => {
  const feedback = {
    pending: jest.fn(async () => ({ question: 'use_case' })),
    answer: jest.fn(async () => ({ ok: true })),
  };
  const controller = new FeedbackController(feedback as any);
  const user: any = { id: 'u1', createdAt: new Date() };
  const org: any = { id: 'o1' };

  it('only ever acts on the signed in user and their organization', async () => {
    expect(await controller.getPending(user, org)).toEqual({ question: 'use_case' });
    expect(feedback.pending).toHaveBeenCalledWith(user, 'o1');
    await controller.answer(user, org, { kind: 'stopped', choice: 'no_time' });
    expect(feedback.answer).toHaveBeenCalledWith(user, 'o1', { kind: 'stopped', choice: 'no_time' });
  });

  it('validates the kind, the choice and the length of the note', async () => {
    const errors = async (body: object) =>
      (await validate(plainToInstance(FeedbackAnswerDto, body))).map((e) => e.property);
    expect(await errors({ kind: 'stopped', choice: 'too_expensive', text: 'ok' })).toEqual([]);
    expect(await errors({ kind: 'use_case', choice: 'skipped' })).toEqual([]);
    expect(await errors({ kind: 'nps', choice: 'too_expensive' })).toEqual(['kind']);
    expect(await errors({ kind: 'stopped', choice: 'anything' })).toEqual(['choice']);
    expect(await errors({ kind: 'stopped', choice: 'other', text: 'x'.repeat(501) })).toEqual(['text']);
  });
});

describe('AdminController trials authorization', () => {
  const ownerAlerts = {
    trialsReport: jest.fn(async () => ({ rows: [], answers: [] })),
  };
  const controller = new AdminController(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    ownerAlerts as any
  );

  beforeEach(() => jest.clearAllMocks());

  it('returns the trials report to a super admin, narrowed to a workspace', async () => {
    const admin: any = { id: 'a1', isSuperAdmin: true };
    expect(await controller.getTrials(admin, {})).toEqual({ rows: [], answers: [] });
    expect(ownerAlerts.trialsReport).toHaveBeenCalledWith(undefined);
    await controller.getTrials(admin, { workspace: '5f2b8f0e-7c4d-4a3b-9f1e-2a6c8d9e0f11' });
    expect(ownerAlerts.trialsReport).toHaveBeenCalledWith('5f2b8f0e-7c4d-4a3b-9f1e-2a6c8d9e0f11');
  });

  it('refuses a regular user before reading anything', async () => {
    await expect(
      controller.getTrials({ id: 'u1', isSuperAdmin: false } as any, {})
    ).rejects.toThrow('Unauthorized');
    expect(ownerAlerts.trialsReport).not.toHaveBeenCalled();
  });

  it('accepts only a workspace id in the query', async () => {
    const errors = async (query: object) =>
      (await validate(plainToInstance(AdminTrialsDto, query))).map((e) => e.property);
    expect(await errors({})).toEqual([]);
    expect(await errors({ workspace: "x' OR 1=1" })).toEqual(['workspace']);
  });
});
