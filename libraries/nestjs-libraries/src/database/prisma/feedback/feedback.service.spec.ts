import { FeedbackService } from '@gitroom/nestjs-libraries/database/prisma/feedback/feedback.service';

const DAY = 24 * 60 * 60 * 1000;
const now = new Date('2026-11-27T12:00:00.000Z');

const make = (repository: object = {}) => {
  const repo = {
    getRole: jest.fn(async (): Promise<{ role: string } | null> => ({ role: 'SUPERADMIN' })),
    getAnswerKinds: jest.fn(async (): Promise<{ kind: string }[]> => []),
    getEnded: jest.fn(async (): Promise<{ key: string } | null> => null),
    getPlan: jest.fn(async (): Promise<{ id: string } | null> => null),
    saveAnswer: jest.fn(async () => true),
    ...repository,
  };
  const alerts = { feedbackAnswered: jest.fn(async () => undefined) };
  return {
    service: new FeedbackService(repo as any, alerts as any),
    repo,
    alerts,
  };
};

const newUser = { id: 'u1', createdAt: new Date(now.getTime() - DAY) };
const oldUser = { id: 'u1', createdAt: new Date(now.getTime() - 30 * DAY) };

describe('FeedbackService.pending', () => {
  it('asks a new owner what they want to use it for, once', async () => {
    const { service, repo } = make();
    expect(await service.pending(newUser, 'org', now)).toEqual({ question: 'use_case' });
    expect(await service.pending(oldUser, 'org', now)).toEqual({ question: null });

    repo.getAnswerKinds.mockResolvedValue([{ kind: 'use_case' }]);
    expect(await service.pending(newUser, 'org', now)).toEqual({ question: null });
  });

  it('never asks an invited member the sign-up question, nor a plain user anything', async () => {
    const admin = make({ getRole: jest.fn(async () => ({ role: 'ADMIN' })) });
    expect(await admin.service.pending(newUser, 'org', now)).toEqual({ question: null });

    const member = make({
      getRole: jest.fn(async (): Promise<null> => null),
      getEnded: jest.fn(async () => ({ key: 'k' })),
    });
    expect(await member.service.pending(newUser, 'org', now)).toEqual({ question: null });
  });

  it('asks what stopped them once the trial or plan ended, before anything else', async () => {
    const { service, repo } = make({ getEnded: jest.fn(async () => ({ key: 'k' })) });
    expect(await service.pending(newUser, 'org', now)).toEqual({ question: 'stopped' });
    expect(await service.pending(oldUser, 'org', now)).toEqual({ question: 'stopped' });

    // a plan again: nothing stopped them
    repo.getPlan.mockResolvedValue({ id: 'sub' });
    expect(await service.pending(oldUser, 'org', now)).toEqual({ question: null });

    repo.getPlan.mockResolvedValue(null);
    repo.getAnswerKinds.mockResolvedValue([{ kind: 'stopped' }]);
    expect(await service.pending(oldUser, 'org', now)).toEqual({ question: null });
  });
});

describe('FeedbackService.answer', () => {
  it('stores the answer and tells the owner', async () => {
    const { service, repo, alerts } = make({ getEnded: jest.fn(async () => ({ key: 'k' })) });
    expect(
      await service.answer(newUser, 'org', { kind: 'stopped', choice: 'too_expensive', text: ' Need a cheaper plan ' })
    ).toEqual({ ok: true });
    expect(repo.saveAnswer).toHaveBeenCalledWith({
      organizationId: 'org',
      userId: 'u1',
      kind: 'stopped',
      choice: 'too_expensive',
      text: 'Need a cheaper plan',
    });
    expect(alerts.feedbackAnswered).toHaveBeenCalledWith('org', 'stopped', 'too_expensive', 'Need a cheaper plan');
  });

  it('closes the question on a skip without a note or an alert', async () => {
    const { service, repo, alerts } = make();
    await service.answer(newUser, 'org', { kind: 'use_case', choice: 'skipped', text: 'ignored' });
    expect(repo.saveAnswer).toHaveBeenCalledWith(expect.objectContaining({ choice: 'skipped', text: '' }));
    expect(alerts.feedbackAnswered).not.toHaveBeenCalled();
  });

  it('refuses a question this person is not being asked', async () => {
    const { service, repo, alerts } = make();
    await expect(
      service.answer(newUser, 'org', { kind: 'stopped', choice: 'too_expensive' })
    ).rejects.toThrow('This question is not open');
    await expect(
      service.answer(oldUser, 'org', { kind: 'use_case', choice: 'clients' })
    ).rejects.toThrow('This question is not open');
    expect(repo.saveAnswer).not.toHaveBeenCalled();
    expect(alerts.feedbackAnswered).not.toHaveBeenCalled();
  });

  it('refuses a choice of the other question', async () => {
    const { service, repo } = make();
    await expect(
      service.answer(newUser, 'org', { kind: 'use_case', choice: 'too_expensive' })
    ).rejects.toThrow('Unknown answer');
    expect(repo.saveAnswer).not.toHaveBeenCalled();
  });

  it('keeps the first answer: a second one changes nothing and sends no alert', async () => {
    const { service, alerts } = make({ saveAnswer: jest.fn(async () => false) });
    await service.answer(newUser, 'org', { kind: 'use_case', choice: 'clients' });
    expect(alerts.feedbackAnswered).not.toHaveBeenCalled();
  });
});
