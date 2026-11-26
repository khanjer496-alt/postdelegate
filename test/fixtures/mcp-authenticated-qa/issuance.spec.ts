// Node CLI logic with in-memory atomic persistence and synthetic HTTP replies;
// no application imports, credentials, DB or network. Filesystem durability is a separate gate.
import {
  issueProtocolKeys,
  reconcileIssuance,
  IssuanceJournal,
  IssuancePorts,
} from './seed-access';
import type { QaManifest } from './guard';
const c = {
  runId: '123456abcdef',
  protectedRoot: '/run/postdelegate-qa/123456abcdef',
  tenants: [
    { label: 'A', orgId: 'orgA', adminId: 'adminA', channelId: 'channelA' },
    { label: 'B', orgId: 'orgB', adminId: 'adminB', channelId: 'channelB' },
  ],
} as QaManifest;
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
function harness(
  options: {
    failCheckpoint?: number;
    permanent?: boolean;
    ambiguousPost?: number;
    reserveFails?: boolean;
    afterPersist?: boolean;
    memberSucceeds?: boolean;
  } = {}
) {
  let journal: IssuanceJournal | undefined,
    checkpoints = 0,
    posts = 0,
    logins = 0;
  const rows: Record<'A' | 'B', any[]> = { A: [], B: [] };
  const ports: IssuancePorts = {
    reserve: (_file, value) => {
      if (journal || options.reserveFails)
        throw new Error('exclusive collision');
      journal = copy(value);
    },
    checkpoint: (_file, value, expected) => {
      checkpoints++;
      if (
        !options.afterPersist &&
        options.failCheckpoint &&
        (checkpoints === options.failCheckpoint ||
          (options.permanent && checkpoints >= options.failCheckpoint))
      )
        throw new Error('synthetic persistence failure');
      if (
        !journal ||
        journal.owner !== expected.owner ||
        journal.revision !== expected.revision
      )
        throw new Error('changed owner/revision');
      journal = copy(value);
      if (options.afterPersist && options.failCheckpoint === checkpoints)
        throw new Error('synthetic failure after durable checkpoint');
    },
    login: async (tenant, role) => {
      logins++;
      return async (path, init) => {
        if (path === '/api/user/self')
          return {
            ok: true,
            status: 200,
            json: async () => ({
              orgId: `org${tenant}`,
              id: `admin${tenant}`,
              role: 'ADMIN',
            }),
          };
        if (init?.method !== 'POST')
          throw new Error('Unexpected synthetic request');
        posts++;
        const body = JSON.parse(String(init.body));
        const pending = journal!.entries.find(
          (entry) => entry.name === body.name
        );
        expect(pending?.state).toBe('PENDING'); // intent was durable before POST
        if (role === 'member' && !options.memberSucceeds)
          return { ok: false, status: 403, json: async () => ({}) };
        const value = {
          credential: {
            id: `id-${posts}`,
            name: body.name,
            role: body.role,
            channelIds: [`channel${tenant}`],
          },
          secret: 'mca_' + 'e'.repeat(64),
        }; // example only
        rows[tenant].push(value.credential);
        if (posts === options.ambiguousPost)
          throw new Error('Synthetic response lost after server commit');
        return { ok: true, status: 201, json: async () => copy(value) };
      };
    },
  };
  return {
    ports,
    rows,
    get journal() {
      return journal!;
    },
    get posts() {
      return posts;
    },
    get logins() {
      return logins;
    },
  };
}
describe('exclusive, incremental protected issuance', () => {
  it('reserves before any POST and checkpoints all six normal API responses', async () => {
    const h = harness();
    expect((await issueProtocolKeys(c, h.ports)).issued).toBe(6);
    expect(h.journal.phase).toBe('COMPLETE');
    expect(
      h.journal.entries
        .filter((e) => e.role)
        .every((e) => e.state === 'CAPTURED' && e.response?.secret)
    ).toBe(true);
    const before = h.posts,
      logins = h.logins;
    await expect(issueProtocolKeys(c, h.ports)).rejects.toThrow('exclusive');
    expect(h.posts).toBe(before);
    expect(h.logins).toBe(logins);
  });
  it('preexisting or concurrent reservation creates no extra requests', async () => {
    const denied = harness({ reserveFails: true });
    await expect(issueProtocolKeys(c, denied.ports)).rejects.toThrow();
    expect(denied.posts).toBe(0);
    expect(denied.logins).toBe(0);
    const h = harness();
    const results = await Promise.allSettled([
      issueProtocolKeys(c, h.ports),
      issueProtocolKeys(c, h.ports),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(h.posts).toBe(8); // six issues, two denied member controls
  });
  it('retains prior captures and correlates a lost response without reissuing/revoking', async () => {
    const h = harness({ ambiguousPost: 3 });
    await expect(issueProtocolKeys(c, h.ports)).rejects.toThrow(
      'reconciliation'
    );
    expect(
      h.journal.entries.find((e) => e.role === 'ANALYST')?.response?.credential
        .id
    ).toBe('id-2');
    const report = reconcileIssuance(h.journal, h.rows);
    expect(
      report.some((row) => row.outcome === 'OBSERVED_SECRET_UNRECOVERABLE')
    ).toBe(true);
    expect(JSON.stringify(report)).not.toContain('mca_');
    const before = h.posts;
    await expect(issueProtocolKeys(c, h.ports)).rejects.toThrow();
    expect(h.posts).toBe(before);
  });
  it.each(Array.from({ length: 17 }, (_, n) => n + 1))(
    'stops safely on checkpoint boundary %s without blind retries',
    async (failCheckpoint) => {
      const h = harness({ failCheckpoint, permanent: true });
      await expect(issueProtocolKeys(c, h.ports)).rejects.toThrow();
      for (const row of [...h.rows.A, ...h.rows.B]) {
        const entry = h.journal.entries.find((e) => e.name === row.name);
        expect(entry).toBeDefined();
        expect(['PENDING', 'CAPTURED', 'AMBIGUOUS']).toContain(entry!.state);
      }
      const before = h.posts;
      await expect(issueProtocolKeys(c, h.ports)).rejects.toThrow();
      expect(h.posts).toBe(before);
    }
  );
});

describe('post-checkpoint interruption controls', () => {
  it.each(Array.from({ length: 17 }, (_, n) => n + 1))(
    'retains durable evidence after checkpoint %s then refuses a rerun',
    async (failCheckpoint) => {
      const h = harness({ failCheckpoint, afterPersist: true });
      await expect(issueProtocolKeys(c, h.ports)).rejects.toThrow();
      for (const row of [...h.rows.A, ...h.rows.B])
        expect(
          h.journal.entries.some(
            (e) =>
              e.name === row.name &&
              (e.state === 'PENDING' ||
                e.state === 'CAPTURED' ||
                e.state === 'AMBIGUOUS')
          )
        ).toBe(true);
      const before = h.posts,
        logins = h.logins;
      await expect(issueProtocolKeys(c, h.ports)).rejects.toThrow();
      expect(h.posts).toBe(before);
      expect(h.logins).toBe(logins);
    }
  );
});

describe('every post-issue response loss', () => {
  it.each([2, 3, 4, 6, 7, 8])(
    'journals unknown server-accepted response at request %s without another POST',
    async (ambiguousPost) => {
      const h = harness({ ambiguousPost });
      await expect(issueProtocolKeys(c, h.ports)).rejects.toThrow();
      expect(
        reconcileIssuance(h.journal, h.rows).some(
          (row) => row.outcome === 'OBSERVED_SECRET_UNRECOVERABLE'
        )
      ).toBe(true);
      const before = h.posts;
      await expect(issueProtocolKeys(c, h.ports)).rejects.toThrow();
      expect(h.posts).toBe(before);
    }
  );
  it('retains an unexpected successful member response before stopping', async () => {
    const h = harness({ memberSucceeds: true });
    await expect(issueProtocolKeys(c, h.ports)).rejects.toThrow();
    expect(h.posts).toBe(1);
    expect(h.journal.entries[0].response?.secret).toMatch(/^mca_/);
    expect(h.journal.phase).toBe('RECONCILE_REQUIRED');
  });
});
