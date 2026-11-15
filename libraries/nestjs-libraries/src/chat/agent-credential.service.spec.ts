jest.mock('../database/prisma/approvals/approval.policy.service', () => ({
  ApprovalPolicyService: class {},
}));
import { AgentCredentialService } from './agent-credential.service';
import { runWithContext, getContext } from './async.storage';
import { checkAuth } from './auth.context';
import { assertAgentPostWrite } from './agent-credential.policy';

describe('MCP per-agent credentials', () => {
  let row: any;
  let repo: any;
  let service: AgentCredentialService;
  const scoped = (fn: () => any) =>
    runWithContext(
      { requestId: 'request', auth: { id: 'org' }, agentCredentialId: 'key' },
      fn
    );
  beforeEach(() => {
    row = {
      id: 'key',
      organizationId: 'org',
      role: 'DRAFT_ONLY',
      channelIds: null,
      expiresAt: new Date(Date.now() + 86400000),
      revokedAt: null,
    };
    repo = {
      byId: jest.fn(async () => row),
      byHash: jest.fn(async () => ({ ...row, organization: { id: 'org' } })),
      channels: jest.fn(async (_org, ids) =>
        ids.filter((id) => id === 'allowed').map((id) => ({ id }))
      ),
      post: jest.fn(async (_org, id) =>
        id === 'foreign'
          ? null
          : { state: 'DRAFT', integrationId: 'allowed', releaseId: null }
      ),
      create: jest.fn(async (data) => ({
        id: 'key',
        role: data.role,
        expiresAt: data.expiresAt,
        channelIds: data.channelIds || null,
      })),
      list: jest.fn(),
      revoke: jest.fn(),
    };
    service = new AgentCredentialService(repo, {
      assertAgentGuardrails: jest.fn(async () => undefined),
    } as any);
  });
  it('enforces server defaults and stores a digest, never the secret', async () => {
    const result = await service.create('org', { name: 'Assistant' });
    expect(result.secret).toMatch(/^mca_[a-f0-9]{64}$/);
    expect(repo.create.mock.calls[0][0].secretHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(repo.create.mock.calls)).not.toContain(result.secret);
    expect(result.credential.role).toBe('DRAFT_ONLY');
    expect(+result.credential.expiresAt! - Date.now()).toBeGreaterThan(
      29.99 * 86400000
    );
    expect(JSON.stringify(result.credential)).not.toContain('secret');
  });
  it.each([
    { role: 'ADMIN' },
    { expiry: 'BAD' },
    { expiry: 'CUSTOM', expiresAt: 'bad' },
    { expiry: 'CUSTOM', expiresAt: '2000-01-01' },
    { channelIds: ['foreign'] },
  ])('rejects invalid create settings %j', async (options) => {
    await expect(
      service.create('org', { name: 'Agent', ...options } as any)
    ).rejects.toThrow();
    expect(repo.create).not.toHaveBeenCalled();
  });
  it('keeps explicit empty restrictions distinct from unrestricted', async () => {
    await service.create('org', {
      name: 'Agent',
      expiry: 'NEVER',
      channelIds: [],
    });
    expect(repo.create.mock.calls[0][0]).toMatchObject({
      expiresAt: null,
      channelIds: [],
    });
  });
  it.each(['ANALYST', 'DRAFT_ONLY', 'PUBLISHER'])(
    'allows explicit %s preset',
    async (role) => {
      await service.create('org', { name: 'Agent', role } as any);
      expect(repo.create.mock.calls[0][0].role).toBe(role);
    }
  );
  it.each([
    'integrationSchedulePostTool',
    'postUpdateTool',
    'sendPostForReviewTool',
    'deletePostTool',
    'postResumeTool',
    'postUnscheduleTool',
    'approvePostTool',
    'inventedReadTool',
  ])('analyst denies %s before execution', async (name) => {
    row.role = 'ANALYST';
    const execute = jest.fn();
    const tool = service.wrapTool(name, { execute });
    await expect(
      scoped(() => tool.execute({}, { annotations: { readOnlyHint: true } }))
    ).rejects.toThrow();
    expect(execute).not.toHaveBeenCalled();
  });
  it.each(['now', 'schedule'])(
    'draft-only denies %s and mixed batches without effects',
    async (type) => {
      const execute = jest.fn();
      const tool = service.wrapTool('integrationSchedulePostTool', { execute });
      await expect(
        scoped(() =>
          tool.execute(
            {
              socialPost: [
                { integrationId: 'allowed', type: 'draft' },
                { integrationId: 'allowed', type },
              ],
            },
            {}
          )
        )
      ).rejects.toThrow();
      expect(execute).not.toHaveBeenCalled();
    }
  );
  it.each(['postUpdateTool', 'postSettingsTool', 'sendPostForReviewTool'])(
    'draft-only denies %s on stored QUEUE',
    async (name) => {
      repo.post.mockResolvedValue({ state: 'QUEUE', integrationId: 'allowed' });
      await expect(
        scoped(() => service.authorizeTool(name, { id: 'post' }))
      ).rejects.toThrow();
    }
  );
  it('allows draft creation and review without granting approval', async () => {
    await scoped(async () => {
      await service.authorizeTool('integrationSchedulePostTool', {
        socialPost: [{ integrationId: 'allowed', type: 'draft' }],
      });
      await service.authorizeTool('createPostForReviewTool', {
        socialPost: [{ integrationId: 'allowed', type: 'schedule' }],
      });
      await service.authorizeTool('sendPostForReviewTool', { id: 'draft' });
      await expect(
        service.authorizeTool('approvePostTool', { id: 'draft' })
      ).rejects.toThrow();
    });
  });
  it('checks tenant ownership even for Publisher and ignores client org annotations', async () => {
    row.role = 'PUBLISHER';
    await expect(
      scoped(() =>
        service.authorizeTool('postUpdateTool', {
          id: 'foreign',
          organizationId: 'other',
        })
      )
    ).rejects.toThrow();
    expect(repo.post).toHaveBeenCalledWith('org', 'foreign');
    row.organizationId = 'other';
    await expect(
      scoped(() => service.authorizeTool('integrationList', {}))
    ).rejects.toThrow();
  });
  it.each(['revoked', 'expired'])(
    'rechecks %s between nested calls and open-session operations',
    async (state) => {
      const write = jest.fn();
      const nested = service.wrapTool('postUpdateTool', { execute: write });
      const ask = service.wrapTool('ask_postdelegate', {
        execute: async () => {
          if (state === 'revoked') row.revokedAt = new Date();
          else row.expiresAt = new Date(0);
          return nested.execute({ id: 'draft' }, {});
        },
      });
      await expect(scoped(() => ask.execute({}, {}))).rejects.toThrow();
      expect(write).not.toHaveBeenCalled();
    }
  );
  it('allows Publisher lifecycle but never approver authority', async () => {
    row.role = 'PUBLISHER';
    await scoped(async () => {
      await service.authorizeTool('postResumeTool', { postId: 'post' });
      await expect(
        service.authorizeTool('approvePostTool', { postId: 'post' })
      ).rejects.toThrow();
    });
  });
  it('filters omitted-channel lists, including empty restrictions', async () => {
    row.channelIds = ['allowed'];
    await scoped(async () => {
      const tool = service.wrapTool('postsListTool', {
        execute: async () => ({
          output: {
            posts: [{ integrationId: 'allowed' }, { integrationId: 'foreign' }],
          },
        }),
      });
      expect((await tool.execute({}, {})).output.posts).toEqual([
        { integrationId: 'allowed' },
      ]);
      row.channelIds = [];
      const list = service.wrapTool('integrationList', {
        execute: async () => ({ output: [{ id: 'allowed' }] }),
      });
      expect((await list.execute({}, {})).output).toEqual([]);
    });
  });
  it('injects permitted analytics subset, refuses unfilterable totals and denied channels', async () => {
    row.channelIds = ['allowed'];
    await scoped(async () => {
      expect(await service.authorizeTool('analyticsTopPostsTool', {})).toEqual({
        integrationIds: ['allowed'],
      });
      await expect(
        service.authorizeTool('analyticsMetricsTool', {})
      ).rejects.toThrow();
      await expect(
        service.authorizeTool('channelAnalyticsTool', {
          integrationId: 'foreign',
        })
      ).rejects.toThrow();
    });
  });
  it('pins auth context to server organization over supplied authInfo', async () => {
    const set = jest.fn();
    await scoped(() =>
      checkAuth(
        {},
        {
          mcp: { extra: { authInfo: { id: 'foreign' } } },
          requestContext: { set },
        }
      )
    );
    expect(set).toHaveBeenCalledWith(
      'organization',
      JSON.stringify({ id: 'org' })
    );
  });
  it('preserves legacy tool arguments, responses and errors', async () => {
    const input = { old: 'shape' };
    const result = { output: ['legacy'] };
    const fn = jest.fn(async () => result);
    const tool = service.wrapTool('unknownLegacyTool', { execute: fn });
    expect(
      await runWithContext({ requestId: 'legacy', auth: { id: 'org' } }, () =>
        tool.execute(input, {})
      )
    ).toBe(result);
    expect(fn.mock.calls[0][0]).toBe(input);
  });
  it('enforces tenant, role and channel again at post write boundary', async () => {
    await scoped(async () => {
      await service.principal();
      expect(() => assertAgentPostWrite('other', 'allowed', 'draft')).toThrow();
      expect(() =>
        assertAgentPostWrite('org', 'allowed', 'schedule')
      ).toThrow();
      expect(() =>
        assertAgentPostWrite('org', 'allowed', 'draft')
      ).not.toThrow();
    });
  });
  it('resolves only active secrets in its audience', async () => {
    expect(await service.resolve('legacy')).toBeNull();
    expect(repo.byHash).not.toHaveBeenCalled();
    expect(await service.resolve('mca_' + 'a'.repeat(64))).toMatchObject({
      credentialId: 'key',
    });
    row.revokedAt = new Date();
    expect(await service.resolve('mca_' + 'a'.repeat(64))).toBeNull();
  });
});

describe('Draft-only published analytics read', () => {
  it('permits a published post read without permitting its mutation', async () => {
    const repo = {
      byId: async () => ({
        id: 'key',
        organizationId: 'org',
        role: 'DRAFT_ONLY',
        channelIds: ['allowed'],
      }),
      post: async () => ({
        state: 'PUBLISHED',
        integrationId: 'allowed',
        releaseId: 'receipt',
      }),
      channels: async () => [{ id: 'allowed' }],
    };
    const service = new AgentCredentialService(
      repo as any,
      { assertAgentGuardrails: jest.fn(async () => undefined) } as any
    );
    await runWithContext(
      { requestId: 'key', auth: { id: 'org' }, agentCredentialId: 'key' },
      async () => {
        await expect(
          service.authorizeTool('channelAnalyticsTool', { postId: 'post' })
        ).resolves.toEqual({ postId: 'post' });
        await expect(
          service.authorizeTool('postUpdateTool', { id: 'post' })
        ).rejects.toThrow();
      }
    );
  });
});

describe('workspace mutation-channel policy', () => {
  it.each(['deletePostTool', 'postUnscheduleTool', 'postResumeTool'])(
    'denies %s when key allows a channel the workspace disallows',
    async (name) => {
      const policy = {
        assertAgentGuardrails: jest.fn(async () => {
          throw new Error('workspace denied');
        }),
      };
      const repo = {
        byId: async () => ({
          id: 'key',
          organizationId: 'org',
          role: 'PUBLISHER',
          channelIds: ['B'],
        }),
        post: async () => ({
          state: 'DRAFT',
          integrationId: 'B',
          parentPostId: null,
        }),
        channels: async () => [{ id: 'B' }],
      };
      const execute = jest.fn();
      const tool = new AgentCredentialService(
        repo as any,
        policy as any
      ).wrapTool(name, { execute });
      await expect(
        runWithContext(
          { requestId: 'key', auth: { id: 'org' }, agentCredentialId: 'key' },
          () => tool.execute({ id: 'post' }, {})
        )
      ).rejects.toThrow('workspace denied');
      expect(execute).not.toHaveBeenCalled();
      expect(policy.assertAgentGuardrails).toHaveBeenCalledWith(
        'org',
        { type: 'agent', source: 'MCP agent' },
        ['B'],
        { countsTowardLimit: false }
      );
    }
  );
});

describe('restricted principal lost-context rejection', () => {
  it('does not downgrade an agent-kind request missing its credential id to legacy', async () => {
    const service = new AgentCredentialService({} as any, {} as any);
    await expect(
      runWithContext(
        { requestId: 'missing-id', auth: { id: 'org' }, authKind: 'agent' },
        () => service.authorizeTool('postUpdateTool', {})
      )
    ).rejects.toThrow();
  });
  it('rejects a nested call carrying the server deny marker after ALS loss', async () => {
    const execute = jest.fn();
    const tool = new AgentCredentialService({} as any, {} as any).wrapTool(
      'postUpdateTool',
      { execute }
    );
    await expect(
      tool.execute({}, { requestContext: { get: () => true } })
    ).rejects.toThrow();
    expect(execute).not.toHaveBeenCalled();
  });
});
