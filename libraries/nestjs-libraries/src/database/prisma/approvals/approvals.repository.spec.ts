import { agentAdmissionContext, AgentSaveRecovered } from '../posts/agent-admission.context';
import { ApprovalsRepository } from './approvals.repository';

const makeRepo = (claimed = 1) => {
  const post = {
    updateMany: jest
      .fn()
      .mockResolvedValueOnce({ count: claimed })
      .mockResolvedValue({ count: 2 }),
  };
  const transaction = {
    model: { $transaction: jest.fn((run: any) => run({ post })) },
  };
  const repo = new ApprovalsRepository(
    {} as any,
    {} as any,
    { model: { post } } as any,
    {} as any,
    {} as any,
    {} as any,
    transaction as any
  );
  return { repo, post, transaction };
};

describe('ApprovalsRepository.transitionGroup', () => {
  const root = { id: 'p-1', group: 'g-1' };

  it('moves the main post and its comments in one transaction', async () => {
    const { repo, post, transaction } = makeRepo();
    const moved = await repo.transitionGroup(
      'org-1',
      root,
      { approvalStatus: 'IN_REVIEW' },
      { state: 'DRAFT', approvalStatus: 'CHANGES_REQUESTED' }
    );
    expect(moved).toBe(true);
    expect(transaction.model.$transaction).toHaveBeenCalledTimes(1);
    expect(post.updateMany).toHaveBeenCalledTimes(2);
    expect(post.updateMany.mock.calls[0][0]).toEqual({
      where: {
        AND: [
          { approvalStatus: 'IN_REVIEW' },
          { id: 'p-1', organizationId: 'org-1', deletedAt: null },
        ],
      },
      data: { state: 'DRAFT', approvalStatus: 'CHANGES_REQUESTED' },
    });
    expect(post.updateMany.mock.calls[1][0].where).toEqual({
      organizationId: 'org-1',
      group: 'g-1',
      deletedAt: null,
      id: { not: 'p-1' },
    });
  });

  it('leaves the comments alone when the main post was not claimed', async () => {
    const { repo, post } = makeRepo(0);
    expect(
      await repo.transitionGroup('org-1', root, {}, {
        state: 'QUEUE',
        approvalStatus: 'APPROVED',
      })
    ).toBe(false);
    expect(post.updateMany).toHaveBeenCalledTimes(1);
  });

  it('a post queued again loses the error and release of its last attempt', async () => {
    const { repo, post } = makeRepo();
    await repo.transitionGroup('org-1', root, {}, {
      state: 'QUEUE',
      approvalStatus: 'APPROVED',
    });
    for (const [{ data }] of post.updateMany.mock.calls) {
      expect(data).toEqual({
        state: 'QUEUE',
        approvalStatus: 'APPROVED',
        error: null,
        releaseId: null,
        releaseURL: null,
      });
    }
  });
});


describe('save admission before review transition', () => {
  const build = (owned: number) => {
    const post = { updateMany: jest.fn().mockResolvedValue({ count: 1 }), findMany: jest.fn().mockResolvedValue([{ id: 'post' }]) };
    const fence = { findFirst: jest.fn(), update: jest.fn() };
    const admission = { updateMany: jest.fn().mockResolvedValue({ count: owned }), findUniqueOrThrow: jest.fn().mockResolvedValue({ writtenPostIds: ['post'] }), update: jest.fn() };
    const repo = new ApprovalsRepository({} as any, {} as any, {} as any, {} as any, {} as any, {} as any, { model: { $transaction: (fn: any) => fn({ post, mcpPublishFence: fence, mcpAgentAdmission: admission }) } } as any);
    return { repo, post, fence, admission };
  };
  it.each([{ orgId: 'org', owner: 'recovered' }, { orgId: 'foreign', owner: 'old' }, { orgId: 'org', owner: undefined }])('throws before fence/post writes for a recovered or mismatched context: %j', async scope => {
    const { repo, post, fence } = build(0);
    await expect(agentAdmissionContext.run({ ...scope, persistedIds: [] } as any, () => repo.transitionGroup('org', { id: 'post', group: 'group', mcpWorkflowVersion: 114 }, {}, { state: 'DRAFT', approvalStatus: 'IN_REVIEW' }))).rejects.toBeInstanceOf(AgentSaveRecovered);
    expect(post.updateMany).not.toHaveBeenCalled(); expect(fence.findFirst).not.toHaveBeenCalled(); expect(fence.update).not.toHaveBeenCalled();
  });
  it('keeps a valid new owner and standalone authorized human transition on the normal path', async () => {
    const { repo, post, admission } = build(1);
    expect(await agentAdmissionContext.run({ orgId: 'org', owner: 'new', persistedIds: [] }, () => repo.transitionGroup('org', { id: 'post', group: 'group' }, {}, { state: 'DRAFT', approvalStatus: 'IN_REVIEW' }))).toBe(true);
    expect(admission.updateMany).toHaveBeenCalledWith({ where: { organizationId: 'org', owner: 'new' }, data: { owner: 'new' } });
    admission.updateMany.mockClear();
    expect(await repo.transitionGroup('org', { id: 'post', group: 'group' }, {}, { state: 'QUEUE', approvalStatus: 'APPROVED' })).toBe(true);
    expect(admission.updateMany).not.toHaveBeenCalled(); expect(post.updateMany).toHaveBeenCalledTimes(4);
  });
});
