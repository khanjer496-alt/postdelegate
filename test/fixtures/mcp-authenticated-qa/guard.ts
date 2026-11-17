// Test-only composition. No production file imports this directory.
import { readProtected } from './protected-store';
export {
  readProtected,
  writeProtected,
  writeProtectedText,
  replaceProtected,
} from './protected-store';

export type Tenant = {
  label: 'A' | 'B';
  orgId: string;
  channelId: string;
  adminId: string;
  memberId: string;
};
export type QaManifest = {
  purpose: 'postdelegate-authenticated-qa';
  admissionState: 'CLOSED' | 'OPEN';
  runId: string;
  sourceSha: string;
  refName: string;
  origin: string;
  databaseUrl: string;
  redisUrl: string;
  temporalAddress: string;
  namespace: string;
  sinkOrigin: string;
  protectedRoot: string;
  containmentRef: string;
  tenants: [Tenant, Tenant];
};
export function validateManifest(c: QaManifest) {
  if (
    c.purpose !== 'postdelegate-authenticated-qa' ||
    !['CLOSED', 'OPEN'].includes(c.admissionState) ||
    !/^[a-f0-9]{12}$/.test(c.runId) ||
    !/^[a-f0-9]{40}$/.test(c.sourceSha) ||
    c.refName !== `qa/mcp-${c.runId}`
  )
    throw new Error('Explicit QA run/source/ref identity required.');
  const origin = new URL(c.origin);
  if (
    origin.origin !== c.origin ||
    origin.protocol !== 'https:' ||
    !origin.hostname.startsWith(`pd-mcp-qa-${c.runId}.`) ||
    /(?:localhost|\.invalid)$/.test(origin.hostname) ||
    origin.username ||
    origin.password
  )
    throw new Error('Dedicated trusted HTTPS origin required.');
  const db = new URL(c.databaseUrl),
    redis = new URL(c.redisUrl);
  if (
    db.protocol !== 'postgresql:' ||
    db.hostname !== 'qa-postgres' ||
    db.pathname !== `/pd_mcp_qa_${c.runId}` ||
    (db.port && db.port !== '5432') ||
    [...db.searchParams.keys()].some((k) => k !== 'schema') ||
    (db.searchParams.get('schema') || 'public') !== 'public'
  )
    throw new Error('Dedicated QA database required.');
  if (
    redis.protocol !== 'redis:' ||
    redis.hostname !== 'qa-redis' ||
    redis.pathname !== '/15' ||
    (redis.port && redis.port !== '6379') ||
    redis.search
  )
    throw new Error('Dedicated QA Redis required.');
  if (
    c.temporalAddress !== 'qa-temporal:7233' ||
    c.namespace !== `mcp-http-qa-${c.runId}` ||
    c.sinkOrigin !== 'http://qa-sink:7081' ||
    c.protectedRoot !== `/run/postdelegate-qa/${c.runId}` ||
    c.containmentRef !== `${c.protectedRoot}/containment.json`
  )
    throw new Error('Dedicated QA infrastructure/reference contract required.');
  if (
    c.tenants?.length !== 2 ||
    c.tenants[0].label !== 'A' ||
    c.tenants[1].label !== 'B'
  )
    throw new Error('Exactly A/B tenants required.');
  const ids = c.tenants.flatMap((t) => [
    t.orgId,
    t.channelId,
    t.adminId,
    t.memberId,
  ]);
  if (
    ids.some(
      (id) =>
        !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
          id
        )
    ) ||
    new Set(ids).size !== 8
  )
    throw new Error('Distinct predeclared fixture UUIDs required.');
  return c;
}
// Pure environment/proof boundary: no app imports, files, sockets or public toggle.
export function applyQaAdmission(
  c: QaManifest,
  proof: any,
  env: NodeJS.ProcessEnv
) {
  if ('MCP_V114_ADMISSION_ENABLED' in env)
    throw new Error(
      'Inherited MCP admission flag forbidden in QA composition.'
    );
  if (!['CLOSED', 'OPEN'].includes(c.admissionState))
    throw new Error('Explicit protected CLOSED/OPEN admission state required.');
  if (
    proof.runId !== c.runId ||
    proof.admissionState !== c.admissionState ||
    proof.sourceSha !== c.sourceSha ||
    proof.origin !== c.origin ||
    proof.owner !== 'Release Engineer' ||
    proof.providerEgress !== 'DENIED' ||
    proof.trustedReferenceParents !==
      'RE_IMMUTABLE_NO_CONCURRENT_UNTRUSTED_WRITERS' ||
    proof.trustedHttps !== true ||
    proof.frontendBakedApi !== `${c.origin}/api` ||
    proof.sourceReviewedSha !== c.sourceSha ||
    proof.reviewedRuntimeGo !== true ||
    !proof.runtimeGoRef ||
    !proof.evidenceRef
  )
    throw new Error(
      'Reviewed RE containment/TLS/image evidence reference required.'
    );
  if (
    c.admissionState === 'OPEN' &&
    (proof.admissionOpenPermitted !== true ||
      typeof proof.admissionOpenGoRef !== 'string' ||
      !proof.admissionOpenGoRef.trim())
  )
    throw new Error('Reviewed same-run OPEN admission permission required.');
  // Derive only after the same-run/source containment and runtime-go checks.
  env.MCP_V114_ADMISSION_ENABLED =
    c.admissionState === 'OPEN' ? 'true' : 'false';
}

export function loadRun() {
  const c = validateManifest(
    readProtected<QaManifest>(process.env.PD_QA_MANIFEST_REF || '')
  );
  if (
    process.env.PD_QA_EXECUTE !== c.runId ||
    process.env.PD_QA_SOURCE_SHA !== c.sourceSha
  )
    throw new Error('Reviewed run go and exact image source stamp required.');
  if (
    'NOT_SECURED' in process.env ||
    process.env.NODE_TLS_REJECT_UNAUTHORIZED ||
    process.env.NODE_EXTRA_CA_CERTS ||
    process.env.MCP_ONLY ||
    process.env.ENABLE_SUPER_ADMIN_API
  )
    throw new Error(
      'Secure normal auth and default certificate verification required.'
    );
  const forbidden =
    /^(?:STRIPE|OPENAI|RESEND|AWS|CLOUDFLARE|FACEBOOK|INSTAGRAM|LINKEDIN|TIKTOK|YOUTUBE|GOOGLE|RUNPOD|DEEPGRAM|SENTRY|NEXT_PUBLIC_SENTRY|REVENUECAT|SENDGRID|ANTHROPIC|HUBSPOT|GITHUB|DISCORD|SLACK|PINTEREST|REDDIT|TWITCH|TOKEN_ENCRYPTION|TEMPORAL_API_KEY|TEMPORAL_TLS|JWT_SECRET|EMAIL_PROVIDER|SMTP|NOVU|CANVA|R2)/;
  if (
    Object.entries(process.env).some(
      ([k, v]) =>
        !!v &&
        (forbidden.test(k) ||
          (!k.startsWith('PD_QA_') &&
            /(?:SECRET|PASSWORD|PRIVATE_KEY|API_KEY|AUTH_TOKEN)/.test(k)))
    )
  )
    throw new Error(
      'External credentials/configuration forbidden in QA composition.'
    );
  const proof = readProtected<any>(c.containmentRef);
  applyQaAdmission(c, proof, process.env);
  // The reference is a prerequisite, NOT independent proof of network containment.
  process.env.DATABASE_URL = c.databaseUrl;
  process.env.REDIS_URL = c.redisUrl;
  process.env.TEMPORAL_ADDRESS = c.temporalAddress;
  process.env.TEMPORAL_NAMESPACE = c.namespace;
  process.env.FRONTEND_URL = c.origin;
  process.env.MAIN_URL = c.origin;
  process.env.NEXT_PUBLIC_BACKEND_URL = `${c.origin}/api`;
  process.env.NEXT_PUBLIC_OVERRIDE_BACKEND_URL = `${c.origin}/api`;
  process.env.CSRF_TRUSTED_ORIGINS = c.origin;
  process.env.STORAGE_PROVIDER = 'local';
  process.env.UPLOAD_DIRECTORY = `${c.protectedRoot}/uploads`;
  for (const name of [
    'RUN_CRON',
    'INTEGRATION_AUTHORIZATION_LIFECYCLE_ENABLED',
  ])
    delete process.env[name];
  for (const name of [
    'ANALYTICS_HISTORY_DISABLED',
    'ANALYTICS_REPORTS_DISABLED',
    'STUDIO_CLEANUP_DISABLED',
    'WEEKLY_SUMMARY_DISABLED',
    'TRIAL_ONBOARDING_EMAILS_DISABLED',
    'MCP_V114_DISPATCH_RECOVERY_DISABLED',
  ])
    process.env[name] = 'true';
  process.env.DISABLE_REGISTRATION = 'true';
  process.env.TZ = 'UTC';
  return c;
}
export type AccessRef = {
  runId: string;
  jwtSecret: string;
  sinkToken: string;
  accounts: {
    tenant: 'A' | 'B';
    role: 'admin' | 'member';
    userId: string;
    email: string;
    password: string;
  }[];
};
export function access(c: QaManifest): AccessRef {
  const a = readProtected<AccessRef>(`${c.protectedRoot}/access.json`);
  if (
    a.runId !== c.runId ||
    !/^[a-f0-9]{64}$/.test(a.jwtSecret) ||
    !/^[a-f0-9]{64}$/.test(a.sinkToken) ||
    a.accounts.length !== 4
  )
    throw new Error('Protected same-run access reference required.');
  return a;
}
export function assertChannel(c: QaManifest, orgId: string, channelId: string) {
  const t = c.tenants.find(
    (t) => t.orgId === orgId && t.channelId === channelId
  );
  if (!t) throw new Error('Unknown QA tenant/channel denied.');
  return t;
}
export function installHttpBoundary(c: QaManifest) {
  const allowed = new Set([c.origin, c.sinkOrigin]);
  const check = (value: string | URL) => {
    const u = new URL(String(value));
    if (!allowed.has(u.origin))
      throw new Error('Non-fixture outbound HTTP denied.');
  };
  const fetch = globalThis.fetch;
  globalThis.fetch = ((input: any, options: any = {}) => {
    check(
      typeof input === 'string' || input instanceof URL ? input : input.url
    );
    return fetch(input, { ...options, redirect: 'error' });
  }) as any;
  for (const module of ['http', 'https']) {
    const transport = require(module);
    for (const method of ['request', 'get']) {
      const original = transport[method];
      transport[method] = (...args: any[]) => {
        const first = args[0];
        check(
          typeof first === 'string' || first instanceof URL
            ? first
            : `${first.protocol || module + ':'}//${
                first.hostname || first.host
              }${first.port ? ':' + first.port : ''}${first.path || '/'}`
        );
        return original.apply(transport, args);
      };
    }
  }
  // Native gRPC/database sockets require RE's independent container-network deny proof.
}

// Method-bound admission routes reach REAL auth/policy/controller, not a fixture control.
export function fixtureAllowsRequest(method: string, path: string): boolean {
  if (path === '/settings/agent-admission') return method === 'GET';
  if (path.startsWith('/settings/agent-admission/'))
    return (
      method === 'POST' &&
      /^\/settings\/agent-admission\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\/recover$/.test(
        path
      )
    );
  return (
    (method === 'POST' && path === '/auth/login') ||
    (method === 'GET' &&
      [
        '/',
        '/auth/can-register',
        '/user/self',
        '/user/email-notifications',
        '/weekly-summary',
        '/settings/shortlink',
        '/integrations',
        '/integrations/list',
      ].includes(path)) ||
    /^\/(?:mcp(?:-oauth[^/]*)?|sse|message)(?:\/|$)/.test(path) ||
    path.startsWith('/.well-known/') ||
    /^\/settings\/agent-credentials(?:\/|$)/.test(path) ||
    /^\/(?:posts|approvals|public\/v1)(?:\/|$)/.test(path)
  );
}
