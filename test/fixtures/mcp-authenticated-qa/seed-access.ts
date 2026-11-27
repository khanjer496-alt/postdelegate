// Operator/QA CLI only. Normal HTTP login and credential controllers; never server secret interception.
import { randomBytes, randomUUID } from 'crypto';
import {
  loadRun,
  access,
  readProtected,
  writeProtected,
  writeProtectedText,
  replaceProtected,
  AccessRef,
  QaManifest,
} from './guard';

async function seed(c: QaManifest) {
  const { PrismaClient } = require('@prisma/client');
  const { AuthService } = require('@gitroom/helpers/auth/auth.service');
  const db = new PrismaClient({ datasources: { db: { url: c.databaseUrl } } });
  const a: AccessRef = {
    runId: c.runId,
    jwtSecret: randomBytes(32).toString('hex'),
    sinkToken: randomBytes(32).toString('hex'),
    accounts: c.tenants.flatMap((t) =>
      (['admin', 'member'] as const).map((role) => ({
        tenant: t.label,
        role,
        userId: role === 'admin' ? t.adminId : t.memberId,
        email: `qa-${c.runId}-${t.label.toLowerCase()}-${role}@qa.invalid`,
        password: randomBytes(24).toString('hex'),
      }))
    ),
  };
  try {
    if (
      (await db.organization.count()) ||
      (await db.user.count()) ||
      (await db.integration.count())
    )
      throw new Error('Seed refuses any preexisting tenant/user/channel.');
    // Exclusive protected ref before writes: no overwritten credentials or blind reseed.
    writeProtected(`${c.protectedRoot}/access.json`, a);
    // RE injects only this fresh service secret/URLs into the NEW frontend.
    // Never mount access.json or protocol-keys.json into that service.
    writeProtectedText(
      `${c.protectedRoot}/frontend.env`,
      `JWT_SECRET=${a.jwtSecret}\nFRONTEND_URL=${c.origin}\nMAIN_URL=${c.origin}\nNEXT_PUBLIC_BACKEND_URL=${c.origin}/api\nNEXT_PUBLIC_OVERRIDE_BACKEND_URL=${c.origin}/api\n`
    );
    await db.$transaction(async (tx: any) => {
      for (const t of c.tenants) {
        await tx.organization.create({
          data: { id: t.orgId, name: `QA ${t.label} ${c.runId}` },
        });
        for (const account of a.accounts.filter(
          (account) => account.tenant === t.label
        )) {
          await tx.user.create({
            data: {
              id: account.userId,
              email: account.email,
              password: AuthService.hashPassword(account.password),
              providerName: 'LOCAL',
              timezone: 0,
              activated: true,
              isSuperAdmin: false,
              name: `QA ${t.label} ${account.role}`,
              sendSuccessEmails: false,
              sendFailureEmails: false,
              sendOnboardingEmails: false,
              sendStreakEmails: false,
            },
          });
          await tx.userOrganization.create({
            data: {
              userId: account.userId,
              organizationId: t.orgId,
              role: account.role === 'admin' ? 'ADMIN' : 'USER',
            },
          });
        }
        await tx.integration.create({
          data: {
            id: t.channelId,
            organizationId: t.orgId,
            internalId: t.channelId,
            name: `QA channel ${t.label}`,
            providerIdentifier: 'fixture',
            type: 'social',
            token: `qa:${c.runId}:${t.channelId}`,
            picture: '/no-picture.jpg',
          },
        });
        await tx.approvalSettings.create({
          data: {
            organizationId: t.orgId,
            requireAgentApproval: true,
            requireApproval: true,
            approverIds: [t.adminId],
            agentIntegrationIds: [t.channelId],
            agentMaxPostsPerDay: 20,
          },
        });
      }
    });
  } finally {
    await db.$disconnect();
  }
  process.stdout.write(
    JSON.stringify({
      seeded: true,
      runId: c.runId,
      tenants: 2,
      users: 4,
      channels: 2,
      protectedAccessRef: `${c.protectedRoot}/access.json`,
    }) + '\n'
  );
}
async function login(
  c: QaManifest,
  a: AccessRef,
  tenant: 'A' | 'B',
  role: 'admin' | 'member'
) {
  const account = a.accounts.find(
    (account) => account.tenant === tenant && account.role === role
  );
  if (!account) throw new Error('Unknown login actor.');
  // Default TLS trust, no custom CA/certificate option, no redirects/external sign-in.
  const response = await fetch(`${c.origin}/api/auth/login`, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(30000),
    headers: { Origin: c.origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: 'LOCAL',
      email: account.email,
      password: account.password,
    }),
  });
  if (!response.ok || response.headers.has('auth'))
    throw new Error('Normal secure login failed.');
  const cookies = response.headers.getSetCookie();
  const auth = cookies.find((value) => value.startsWith('auth='));
  const domain =
    require('@gitroom/helpers/subdomain/subdomain.management').getCookieUrlFromDomain(
      c.origin
    );
  if (
    !auth ||
    !/;\s*Secure(?:;|$)/i.test(auth) ||
    !/;\s*HttpOnly(?:;|$)/i.test(auth) ||
    !/;\s*SameSite=Lax(?:;|$)/i.test(auth) ||
    !auth.toLowerCase().includes(`domain=${domain.toLowerCase()}`)
  )
    throw new Error('Unexpected auth cookie security/domain.');
  const cookie = cookies.map((value) => value.split(';')[0]).join('; ');
  return (path: string, init: RequestInit = {}) => {
    if (!path.startsWith('/api/') || path.startsWith('//'))
      throw new Error('Unknown API path.');
    return fetch(c.origin + path, {
      ...init,
      redirect: 'error',
      headers: {
        ...init.headers,
        Origin: c.origin,
        Cookie: cookie,
        'Content-Type': 'application/json',
      },
    });
  };
}
type HttpClient = (
  path: string,
  init?: RequestInit
) => Promise<{ ok: boolean; status: number; json(): Promise<any> }>;
export type IssuanceEntry = {
  key: string;
  tenant: 'A' | 'B';
  role?: string;
  name: string;
  state: 'NOT_SENT' | 'PENDING' | 'DENIED' | 'CAPTURED' | 'AMBIGUOUS';
  httpStatus?: number;
  response?: any;
};
export type IssuanceJournal = {
  version: 2;
  runId: string;
  owner: string;
  revision: number;
  phase: 'ISSUING' | 'COMPLETE' | 'RECONCILE_REQUIRED';
  entries: IssuanceEntry[];
};
export type IssuancePorts = {
  reserve(file: string, journal: IssuanceJournal): void;
  checkpoint(
    file: string,
    journal: IssuanceJournal,
    expected: { runId: string; owner: string; revision: number }
  ): void;
  login(tenant: 'A' | 'B', role: 'admin' | 'member'): Promise<HttpClient>;
};
// Injectable ports are ONLY a Node CLI unit-test seam, never an HTTP/server observer.
export async function issueProtocolKeys(c: QaManifest, ports: IssuancePorts) {
  const file = `${c.protectedRoot}/protocol-keys.json`,
    owner = randomUUID();
  let journal: IssuanceJournal = {
    version: 2,
    runId: c.runId,
    owner,
    revision: 0,
    phase: 'ISSUING',
    entries: c.tenants.flatMap((t) =>
      ['member-denial', 'ANALYST', 'DRAFT_ONLY', 'PUBLISHER'].map((role) => ({
        key: `${t.label}:${role}`,
        tenant: t.label,
        ...(role === 'member-denial' ? {} : { role }),
        name: `Protocol ${c.runId} ${t.label}:${role} ${owner}`,
        state: 'NOT_SENT' as const,
      }))
    ),
  };
  // Exclusive file + directory fsync BEFORE login or ANY credential POST.
  // Existing, partial and concurrent operations fail here with zero new POSTs.
  ports.reserve(file, journal);
  const checkpoint = () => {
    const expected = {
      runId: journal.runId,
      owner,
      revision: journal.revision,
    };
    const next = { ...journal, revision: journal.revision + 1 };
    ports.checkpoint(file, next, expected);
    journal = next;
  };
  try {
    for (const t of c.tenants) {
      const admin = await ports.login(t.label, 'admin');
      const self = await admin('/api/user/self');
      if (!self.ok) throw new Error('Authenticated bootstrap failed.');
      const identity = await self.json();
      if (
        identity.orgId !== t.orgId ||
        identity.id !== t.adminId ||
        identity.role !== 'ADMIN'
      )
        throw new Error('Login resolved the wrong tenant/role.');
      const member = await ports.login(t.label, 'member');
      for (const entry of journal.entries.filter((e) => e.tenant === t.label)) {
        entry.state = 'PENDING';
        checkpoint(); // durable unique-name correlation before request
        try {
          const response = await (entry.role ? admin : member)(
            '/api/settings/agent-credentials',
            {
              method: 'POST',
              body: JSON.stringify({
                name: entry.name,
                ...(entry.role
                  ? { role: entry.role, channelIds: [t.channelId] }
                  : {}),
              }),
            }
          );
          entry.httpStatus = response.status;
          if (!entry.role && response.status === 403) {
            entry.state = 'DENIED';
            checkpoint();
            continue;
          }
          if (!response.ok) {
            entry.state = 'AMBIGUOUS';
            checkpoint();
            throw new Error('Credential request requires reconciliation.');
          }
          // Persist EVERY successful normal response before validation/next POST,
          // including an unexpected member success. No raw values reach stdout.
          entry.response = await response.json();
          entry.state = 'CAPTURED';
          checkpoint();
          if (!entry.role)
            throw new Error(
              'Member credential administration unexpectedly succeeded.'
            );
          const value = entry.response;
          if (
            !/^mca_[a-f0-9]{64}$/.test(value.secret) ||
            !value.credential?.id ||
            value.credential.role !== entry.role ||
            JSON.stringify(value.credential.channelIds) !==
              JSON.stringify([t.channelId])
          )
            throw new Error(
              'Unexpected credential response; retained for reconciliation.'
            );
        } catch (error) {
          if (entry.state === 'PENDING') entry.state = 'AMBIGUOUS';
          throw error;
        }
      }
    }
    journal.phase = 'COMPLETE';
    checkpoint();
    return {
      issued: journal.entries.filter((e) => e.role && e.state === 'CAPTURED')
        .length,
      runId: c.runId,
      protectedProtocolRef: file,
    };
  } catch {
    journal.phase = 'RECONCILE_REQUIRED';
    try {
      checkpoint();
    } catch {
      /* original PENDING/previous capture and private temp remain evidence */
    }
    throw new Error(
      'Issuance stopped. Protected journal reconciliation is required; never rerun or automatically revoke/reissue.'
    );
  }
}
async function issue(c: QaManifest, a: AccessRef) {
  const result = await issueProtocolKeys(c, {
    reserve: writeProtected,
    checkpoint: (file, value, expected) =>
      replaceProtected<IssuanceJournal>(
        file,
        value,
        (old) =>
          old.version === 2 &&
          old.runId === expected.runId &&
          old.owner === expected.owner &&
          old.revision === expected.revision
      ),
    login: (tenant, role) => login(c, a, tenant, role),
  });
  process.stdout.write(JSON.stringify(result) + '\n');
}
export function reconcileIssuance(
  journal: IssuanceJournal,
  metadata: Record<'A' | 'B', any[]>
) {
  if (journal.version !== 2)
    throw new Error('Unsupported issuance reference; no automatic migration.');
  return journal.entries.map((entry) => {
    const found = metadata[entry.tenant].filter(
      (row) => row.name === entry.name
    );
    return {
      key: entry.key,
      name: entry.name,
      requestState: entry.state,
      credentialIds: found.map((row) => row.id),
      retainedSecret: !!entry.response?.secret,
      outcome:
        found.length > 1
          ? 'DUPLICATE_ROWS_UNKNOWN'
          : found.length === 1
          ? entry.response?.credential?.id === found[0].id &&
            entry.response?.secret
            ? 'OBSERVED_WITH_CAPTURE'
            : 'OBSERVED_SECRET_UNRECOVERABLE'
          : entry.state === 'NOT_SENT'
          ? 'NOT_SENT'
          : entry.state === 'DENIED'
          ? 'DENIED_CONTROL'
          : 'NO_MATCH_STILL_UNKNOWN',
    };
  });
}
async function reconcile(c: QaManifest, a: AccessRef) {
  const journal = readProtected<IssuanceJournal>(
    `${c.protectedRoot}/protocol-keys.json`
  );
  if (journal.runId !== c.runId) throw new Error('Wrong issuance run.');
  const metadata = {} as Record<'A' | 'B', any[]>;
  for (const tenant of c.tenants) {
    const admin = await login(c, a, tenant.label, 'admin');
    const response = await admin('/api/settings/agent-credentials');
    if (!response.ok) throw new Error('Metadata reconciliation unavailable.');
    metadata[tenant.label] = await response.json();
    if (!Array.isArray(metadata[tenant.label]))
      throw new Error('Unexpected metadata response.');
  }
  const report = {
    runId: c.runId,
    issuanceOwner: journal.owner,
    observedRevision: journal.revision,
    phase: journal.phase,
    rows: reconcileIssuance(journal, metadata),
    action:
      'READ_ONLY_REPORT; no absence proves quiescence; no resume/reissue/revoke',
  };
  const file = `${
    c.protectedRoot
  }/protocol-reconciliation-${randomUUID()}.json`;
  writeProtected(file, report);
  process.stdout.write(
    JSON.stringify({
      reconciled: 'metadata-only',
      runId: c.runId,
      protectedReportRef: file,
    }) + '\n'
  );
}

function rpcClient(c: QaManifest, secret: string) {
  let sessionId: string | undefined;
  return async (method: string, params: any, id?: number, denial = false) => {
    const response = await fetch(`${c.origin}/api/mcp`, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(30000),
      headers: {
        Origin: c.origin,
        Authorization: `Bearer ${secret}`,
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
        'MCP-Protocol-Version': '2026-07-28',
        ...(sessionId ? { 'Mcp-Session-Id': sessionId } : {}),
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        ...(id === undefined ? {} : { id }),
        method,
        params,
      }),
    });
    if (!response.ok) throw new Error('MCP request failed.');
    sessionId = response.headers.get('mcp-session-id') || sessionId;
    if (response.status === 202 || response.status === 204) return undefined;
    const text = await response.text();
    if (!text.trim() && id === undefined) return undefined;
    const data = response.headers
      .get('content-type')
      ?.includes('text/event-stream')
      ? text
          .split(/\r?\n\r?\n/)
          .map((block) =>
            block
              .split(/\r?\n/)
              .filter((line) => line.startsWith('data:'))
              .map((line) => line.slice(5))
              .join('\n')
          )
          .filter(Boolean)
          .map((line) => JSON.parse(line))
          .find((value) => value.id === id)
      : JSON.parse(text);
    if (denial) {
      if (
        (data?.error || data?.result?.isError) &&
        JSON.stringify(data).includes('credential cannot perform this action')
      )
        return { denied: true };
      throw new Error('Expected a credential authorization denial.');
    }
    if (!data || data.error || data.result?.isError)
      throw new Error('MCP protocol error.');
    return data.result;
  };
}

async function admissionRouteProbe(c: QaManifest, a: AccessRef) {
  // UUID zero cannot be a randomUUID v4 admission owner; this exercises the
  // REAL controller's stale-owner refusal without recovering an active save.
  const absentOwner = '00000000-0000-0000-0000-000000000000';
  for (const tenant of c.tenants) {
    const admin = await login(c, a, tenant.label, 'admin');
    if ((await admin('/api/settings/agent-admission')).status !== 200)
      throw new Error('Admission GET did not reach real admin controller.');
    const recovery = await admin(
      `/api/settings/agent-admission/${absentOwner}/recover`,
      { method: 'POST', body: '{}' }
    );
    if (
      recovery.status !== 400 ||
      !JSON.stringify(await recovery.json()).includes('active save changed')
    )
      throw new Error(
        'Admission recovery did not reach real exact-owner refusal.'
      );
    const member = await login(c, a, tenant.label, 'member');
    if (
      (await member('/api/settings/agent-admission')).status !== 403 ||
      (
        await member(`/api/settings/agent-admission/${absentOwner}/recover`, {
          method: 'POST',
          body: '{}',
        })
      ).status !== 403
    )
      throw new Error('Admission controller member policy failed.');
  }
}
async function probe(c: QaManifest, a: AccessRef) {
  await admissionRouteProbe(c, a);
  const saved = readProtected<IssuanceJournal>(
    `${c.protectedRoot}/protocol-keys.json`
  );
  if (
    saved.version !== 2 ||
    saved.runId !== c.runId ||
    saved.phase !== 'COMPLETE'
  )
    throw new Error('Only a complete captured issuance may be probed.');
  const keys = saved.entries
    .filter((e) => e.role && e.state === 'CAPTURED')
    .map((e) => ({ tenant: e.tenant, role: e.role, ...e.response }));
  if (keys.length !== 6)
    throw new Error('Incomplete protected protocol reference.');
  for (const key of keys) {
    const rpc = rpcClient(c, key.secret);
    await rpc(
      'initialize',
      {
        protocolVersion: '2026-07-28',
        capabilities: {},
        clientInfo: { name: 'postdelegate-contained-qa', version: '1' },
      },
      1
    );
    await rpc('notifications/initialized', {});
    const tools = await rpc('tools/list', {}, 2);
    if (!tools.tools?.some((tool: any) => tool.name === 'postPreflightTool'))
      throw new Error('Real MCP registry missing preflight.');
    const tenant = c.tenants.find((t) => t.label === key.tenant)!;
    const other = c.tenants.find((t) => t.label !== key.tenant)!;
    if (!tenant || !other) throw new Error('Unknown credential actor.');
    const listed = await rpc(
      'tools/call',
      { name: 'integrationList', arguments: {} },
      3
    );
    const listing = JSON.stringify(listed);
    if (
      !listing.includes(tenant.channelId) ||
      listing.includes(other.channelId)
    )
      throw new Error('Tenant/channel listing isolation failed.');
    const schema = await rpc(
      'tools/call',
      {
        name: 'integrationSchema',
        arguments: { platform: 'fixture', isPremium: false },
      },
      4
    );
    if (!JSON.stringify(schema).includes('fixture'))
      throw new Error('Fixture schema/catalog missing in real MCP.');
    const proposed = {
      socialPost: [
        {
          integrationId: other.channelId,
          type: 'draft',
          date: new Date(Date.now() + 86400000).toISOString(),
          settings: [{ key: '__type', value: 'fixture' }],
          postsAndComments: [
            { content: '<p>Denied cross-tenant proposal</p>', attachments: [] },
          ],
          shortLink: false,
        },
      ],
    };
    await rpc(
      'tools/call',
      { name: 'postPreflightTool', arguments: proposed },
      5,
      true
    );
    const denied = await fetch(`${c.origin}/api/public/v1/posts`, {
      redirect: 'error',
      headers: { Authorization: `Bearer ${key.secret}`, Origin: c.origin },
    });
    if (denied.status !== 401)
      throw new Error('MCP credential escaped its REST audience.');
  }
  process.stdout.write(
    JSON.stringify({ protocolProbe: 'passed', runId: c.runId, roles: 6 }) + '\n'
  );
}
async function main() {
  const c = loadRun();
  const mode = process.argv[2];
  if (mode === 'seed') return seed(c);
  const a = access(c);
  if (mode === 'issue-protocol-keys') return issue(c, a);
  if (mode === 'probe') return probe(c, a);
  if (mode === 'reconcile-protocol-keys') return reconcile(c, a);
  throw new Error(
    'Expected seed, issue-protocol-keys, reconcile-protocol-keys or probe.'
  );
}
if (require.main === module)
  void main().catch(() => {
    process.stderr.write(
      'QA seed/access operation failed; no secret output is permitted.\n'
    );
    process.exitCode = 1;
  });
