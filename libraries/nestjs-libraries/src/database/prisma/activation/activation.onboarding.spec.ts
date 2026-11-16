import { ActivationService } from './activation.service';

const makeRepository = () => ({
  hasChannel: jest.fn().mockResolvedValue(false),
  hasAiConnection: jest.fn().mockResolvedValue(false),
  hasScheduledPost: jest.fn().mockResolvedValue(false),
  hasApprover: jest.fn().mockResolvedValue(false),
  hasTeammate: jest.fn().mockResolvedValue(false),
  getChecklistDismissedAt: jest.fn().mockResolvedValue(null),
});

describe('ActivationService v2 onboarding', () => {
  it('reads the four steps of the workspace', async () => {
    const repository = makeRepository();
    repository.hasChannel.mockResolvedValue(true);
    repository.hasAiConnection.mockResolvedValue(true);
    const service = new ActivationService(repository as any);
    expect(await service.getOnboarding('u1', 'org1')).toEqual({
      dismissed: false,
      steps: { channel: true, ai: true, scheduled: false, approver: false },
    });
    for (const fact of ['hasChannel', 'hasAiConnection', 'hasScheduledPost', 'hasApprover', 'hasTeammate'] as const) {
      expect(repository[fact]).toHaveBeenCalledWith('org1');
    }
  });

  it('counts an invited teammate as an approver', async () => {
    const repository = makeRepository();
    repository.hasTeammate.mockResolvedValue(true);
    const service = new ActivationService(repository as any);
    expect((await service.getOnboarding('u1', 'org1')).steps.approver).toBe(true);
  });

  it('stays hidden once dismissed, without reading the steps', async () => {
    const repository = makeRepository();
    repository.getChecklistDismissedAt.mockResolvedValue(new Date());
    const service = new ActivationService(repository as any);
    const state = await service.getOnboarding('u1', 'org1');
    expect(state.dismissed).toBe(true);
    expect(repository.hasChannel).not.toHaveBeenCalled();
  });
});

import { ActivationRepository } from './activation.repository';

describe('ActivationRepository v2 onboarding facts', () => {
  const makeRepo = () => {
    const oAuthAuthorization = { findFirst: jest.fn().mockResolvedValue(null) };
    const approvalSettings = { findUnique: jest.fn().mockResolvedValue(null) };
    const approvalLink = { findFirst: jest.fn().mockResolvedValue(null) };
    const repo = new ActivationRepository(
      { model: {} } as any,
      { model: {} } as any,
      { model: {} } as any,
      { model: { oAuthAuthorization } } as any,
      { model: { approvalSettings } } as any,
      { model: { approvalLink } } as any
    );
    return { repo, oAuthAuthorization, approvalSettings, approvalLink };
  };

  it('needs a live OAuth grant of the organization for the AI step', async () => {
    const { repo, oAuthAuthorization } = makeRepo();
    expect(await repo.hasAiConnection('org-A')).toBe(false);
    oAuthAuthorization.findFirst.mockResolvedValue({ id: 'g1' });
    expect(await repo.hasAiConnection('org-A')).toBe(true);
    expect(oAuthAuthorization.findFirst.mock.calls[0][0].where).toEqual({
      organizationId: 'org-A',
      revokedAt: null,
      accessToken: { not: null },
    });
  });

  it('counts named approvers or a shared approval link', async () => {
    const { repo, approvalSettings, approvalLink } = makeRepo();
    expect(await repo.hasApprover('org-A')).toBe(false);
    approvalSettings.findUnique.mockResolvedValue({ approverIds: [] });
    expect(await repo.hasApprover('org-A')).toBe(false);
    approvalSettings.findUnique.mockResolvedValue({ approverIds: ['u2'] });
    expect(await repo.hasApprover('org-A')).toBe(true);
    approvalSettings.findUnique.mockResolvedValue(null);
    approvalLink.findFirst.mockResolvedValue({ id: 'l1' });
    expect(await repo.hasApprover('org-A')).toBe(true);
    expect(approvalLink.findFirst.mock.calls[0][0].where).toEqual({ organizationId: 'org-A' });
  });
});
