import { PostsRepository } from '../database/prisma/posts/posts.repository';
import { runWithContext } from './async.storage';

describe('Draft-only conditional storage guard', () => {
  it('cannot update a draft raced into QUEUE at the write boundary', async () => {
    const upsert = jest.fn(async ({ where }: any) => {
      expect(where).toMatchObject({
        id: 'post',
        organizationId: 'org',
        integrationId: 'channel',
        state: 'DRAFT',
        releaseId: null,
      });
      // PostgreSQL's unique id prevents the upsert create branch when the
      // predicate stopped matching because another writer scheduled the row.
      throw new Error('unique constraint');
    });
    const repo = new PostsRepository(
      {
        model: { post: { findFirst: jest.fn(async () => null), upsert } },
      } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
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
          repo.createOrUpdatePost(
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
    ).rejects.toThrow('unique constraint');
    expect(upsert).toHaveBeenCalledTimes(1);
  });
});
