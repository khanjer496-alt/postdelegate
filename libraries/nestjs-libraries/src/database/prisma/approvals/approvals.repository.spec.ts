import { agentAdmissionContext, AgentSaveRecovered } from '../posts/agent-admission.context';
import { mcpPayloadRevision } from '../posts/posts.repository';
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


describe('atomic tracked approval revision and dispatch', () => {
  const build = (changed = false) => {
    const rows: any[] = [
      { id: 'root', mcpWorkflowVersion: 114, parentPostId: null, organizationId: 'org', integrationId: 'channel', group: 'thread', content: 'root', image: '[]', settings: '{}', delay: 0, publishDate: new Date('2020-01-01'), state: 'DRAFT' },
      { id: 'child', parentPostId: 'root', organizationId: 'org', integrationId: 'channel', group: 'thread', content: 'child', image: '[]', settings: '{}', delay: 0, publishDate: new Date('2020-01-01'), state: 'DRAFT' },
    ];
    const stored = { state: 'ACTIVE', integrationId: 'channel', revisionHash: mcpPayloadRevision(rows), generation: 2 };
    if (changed) rows[1].content = 'unbound replacement';
    const post = {
      findMany: jest.fn(async () => structuredClone([...rows].reverse())),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const matches = where.AND ? rows.filter(row => row.id === 'root') : rows.filter(row => row.id !== 'root');
        for (const row of matches) Object.assign(row, data);
        return { count: matches.length };
      }),
    };
    const fence = { findFirst: jest.fn(async () => ({ ...stored })), update: jest.fn(async ({ data }: any) => {
      const { generation, ...rest } = data; Object.assign(stored, rest);
      if (generation?.increment) stored.generation += generation.increment;
      return { ...stored };
    }) };
    const attempts = { count: jest.fn().mockResolvedValue(0) };
    const tx = { post, mcpPublishFence: fence, mcpPublishAttempt: attempts };
    const transaction = { model: { $transaction: jest.fn((run: any) => run(tx)) } };
    const repo = new ApprovalsRepository({} as any, {} as any, {} as any, {} as any, {} as any, {} as any, transaction as any);
    return { repo, rows, stored, post, fence, attempts, transaction };
  };
  it('commits the final ordered date/hash/generation with QUEUE before any dispatch registration', async () => {
    const { repo, rows, stored, fence, transaction } = build();
    const previous = stored.revisionHash;
    const publishDate = new Date('2026-11-17T00:00:00Z');
    expect(await repo.transitionGroup('org', { id: 'root', group: 'thread', mcpWorkflowVersion: 114 }, {}, { state: 'QUEUE', approvalStatus: 'APPROVED', publishDate })).toBe(true);
    expect(rows.every(row => row.state === 'QUEUE' && row.publishDate === publishDate)).toBe(true);
    expect(stored).toMatchObject({ revisionHash: mcpPayloadRevision(rows), generation: 3, dispatchState: 'PENDING' });
    expect(stored.revisionHash).not.toBe(previous);
    expect(fence.update.mock.calls.at(-1)![0].data.revisionHash).toBe(mcpPayloadRevision(rows));
    expect(transaction.model.$transaction).toHaveBeenCalledTimes(1);
    // Simulated producer death here: no later registerMcpFence is needed to make the record recoverable.
  });
  it('keeps the hash/generation for an unchanged-date approval under the same active fence', async () => {
    const { repo, rows, stored } = build();
    const previous = stored.revisionHash;
    await repo.transitionGroup('org', { id: 'root', group: 'thread', mcpWorkflowVersion: 114 }, {}, { state: 'QUEUE', approvalStatus: 'APPROVED' });
    expect(stored).toMatchObject({ revisionHash: previous, generation: 2, dispatchState: 'PENDING' });
    expect(stored.revisionHash).toBe(mcpPayloadRevision(rows));
  });
  it('increments a cancelled fence only once when approval also changes its date', async () => {
    const { repo, stored } = build(); stored.state = 'CANCELLED';
    await repo.transitionGroup('org', { id: 'root', group: 'thread', mcpWorkflowVersion: 114 }, {}, { state: 'QUEUE', approvalStatus: 'APPROVED', publishDate: new Date('2030-01-01') });
    expect(stored).toMatchObject({ generation: 3, state: 'ACTIVE', dispatchState: 'PENDING' });
  });
  it('uses the locked fence state if cancellation completed after the initial read', async () => {
    const { repo, stored, fence } = build(); stored.state = 'CANCELLED';
    fence.findFirst.mockImplementation(async () => ({ ...stored, state: 'ACTIVE' }));
    await repo.transitionGroup('org', { id: 'root', group: 'thread', mcpWorkflowVersion: 114 }, {}, { state: 'QUEUE', approvalStatus: 'APPROVED' });
    expect(stored).toMatchObject({ generation: 3, state: 'ACTIVE' });
  });
  it('refuses malformed thread membership before changing stored posts', async () => {
    const { repo, rows, post } = build(); rows[1].parentPostId = 'foreign-parent';
    await expect(repo.transitionGroup('org', { id: 'root', group: 'thread', mcpWorkflowVersion: 114 }, {}, { state: 'QUEUE', approvalStatus: 'APPROVED' })).rejects.toThrow('revision');
    expect(post.updateMany).not.toHaveBeenCalled();
  });
  it('preserves immutable attempt identity even for terminal-unpublished history', async () => {
    const { repo, stored, attempts, fence } = build();
    const previous = stored.revisionHash;
    attempts.count.mockImplementation(async (args: any) => args.where.status ? 0 : 1);
    await expect(repo.transitionGroup('org', { id: 'root', group: 'thread', mcpWorkflowVersion: 114 }, {}, { state: 'QUEUE', approvalStatus: 'APPROVED', publishDate: new Date('2030-01-01') })).rejects.toThrow('attempts exist');
    expect(stored.revisionHash).toBe(previous);
    expect(fence.update.mock.calls.every(([args]) => !args.data.revisionHash)).toBe(true);
    // Actual rollback of post changes is covered by the SQL transaction fixture.
  });
  it('does not repair an arbitrary stored-content/fence mismatch during approval', async () => {
    const { repo, post, stored } = build(true);
    const previous = stored.revisionHash;
    await expect(repo.transitionGroup('org', { id: 'root', group: 'thread', mcpWorkflowVersion: 114 }, {}, { state: 'QUEUE', approvalStatus: 'APPROVED', publishDate: new Date() })).rejects.toThrow('revision');
    expect(post.updateMany).not.toHaveBeenCalled();
    expect(stored.revisionHash).toBe(previous);
  });
});
