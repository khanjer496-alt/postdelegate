import { PostsRepository } from '../database/prisma/posts/posts.repository';
import { runWithContext } from './async.storage';

describe('Draft-only conditional storage guard', () => {
  it('rejects a lost root claim without any upsert/create or cleanup fallback', async () => {
    const tx = {
      post: {
        findFirst: jest.fn(async () => null),
        upsert: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    const repository = new PostsRepository(
      { model: { post: {} } } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { model: { $transaction: (fn: any) => fn(tx) } } as any,
      {} as any
    );
    await expect(
      runWithContext(
        {
          requestId: 'key',
          auth: { id: 'org' },
          agentCredentialId: 'key',
          agentPrincipal: {
            id: 'key',
            organizationId: 'org',
            role: 'DRAFT_ONLY',
            channelIds: ['channel'],
          },
        },
        () =>
          repository.createOrUpdatePost(
            'update',
            'org',
            '2026-12-01',
            {
              integration: { id: 'channel' },
              value: [{ id: 'post', content: 'edit', image: [] }],
            } as any,
            [],
            'MCP'
          )
      )
    ).rejects.toThrow('draft changed');
    expect(tx.post.upsert).not.toHaveBeenCalled();
    expect(tx.post.create).not.toHaveBeenCalled();
    expect(tx.post.updateMany).not.toHaveBeenCalled();
    expect(tx.post.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'post',
        organizationId: 'org',
        integrationId: 'channel',
        parentPostId: null,
        state: 'DRAFT',
        releaseId: null,
        deletedAt: null,
      }),
    });
  });
});
