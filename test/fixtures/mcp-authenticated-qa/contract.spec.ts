// Hosted CI unit gate. Never executes bootstrap, seed, DB, Redis, Temporal or HTTP.
import {
  validateManifest,
  QaManifest,
  fixtureAllowsRequest,
  applyQaAdmission,
} from './guard';
const example = (): QaManifest => ({
  purpose: 'postdelegate-authenticated-qa',
  admissionState: 'CLOSED',
  runId: '123456abcdef',
  sourceSha: '1'.repeat(40),
  refName: 'qa/mcp-123456abcdef',
  origin: 'https://pd-mcp-qa-123456abcdef.example.org', // example data; no network
  databaseUrl:
    'postgresql://qa:example@qa-postgres:5432/pd_mcp_qa_123456abcdef',
  redisUrl: 'redis://qa-redis:6379/15',
  temporalAddress: 'qa-temporal:7233',
  namespace: 'mcp-http-qa-123456abcdef',
  sinkOrigin: 'http://qa-sink:7081',
  protectedRoot: '/run/postdelegate-qa/123456abcdef',
  containmentRef: '/run/postdelegate-qa/123456abcdef/containment.json',
  tenants: ['A', 'B'].map((label, index) => ({
    label,
    orgId: `${index}0000000-0000-4000-8000-000000000001`,
    channelId: `${index}0000000-0000-4000-8000-000000000002`,
    adminId: `${index}0000000-0000-4000-8000-000000000003`,
    memberId: `${index}0000000-0000-4000-8000-000000000004`,
  })) as QaManifest['tenants'],
});
describe('authenticated fixture identity boundary', () => {
  it('accepts distinct declarative A/B fixture identities without opening any transport', () =>
    expect(validateManifest(example())).toEqual(example()));
  it.each([
    { origin: 'https://app.postdelegate.com' },
    { origin: 'http://pd-mcp-qa-123456abcdef.example.org' },
    { databaseUrl: 'postgresql://qa:example@qa-postgres:5432/postiz' },
    { redisUrl: 'redis://qa-redis:6379/0' },
    { temporalAddress: 'localhost:7233' },
    { namespace: 'default' },
    { sinkOrigin: 'https://www.youtube.com' },
    { refName: 'main' },
    { protectedRoot: '/tmp' },
  ])('rejects unsafe infrastructure/source choice %j', (change) =>
    expect(() => validateManifest({ ...example(), ...change })).toThrow()
  );
  it('rejects duplicate/cross-bound identities', () => {
    const value = example();
    value.tenants[1].channelId = value.tenants[0].channelId;
    expect(() => validateManifest(value)).toThrow();
  });
});

import { reconcileHistory } from './receipt-history';
describe('real Settings admission route contract', () => {
  const owner = '12345678-1234-4123-8123-123456789abc';
  it('admits only the UI GET and exact recovery POST for downstream real auth', () => {
    expect(fixtureAllowsRequest('GET', '/settings/agent-admission')).toBe(true);
    expect(
      fixtureAllowsRequest('POST', `/settings/agent-admission/${owner}/recover`)
    ).toBe(true);
  });
  it.each([
    ['POST', '/settings/agent-admission'],
    ['DELETE', '/settings/agent-admission'],
    ['GET', `/settings/agent-admission/${owner}/recover`],
    ['PATCH', `/settings/agent-admission/${owner}/recover`],
    ['POST', '/settings/agent-admission/not-owner/recover'],
    ['POST', `/settings/agent-admission/${owner}/recover/extra`],
  ])('denies unrelated method/path %s %s', (method, path) =>
    expect(fixtureAllowsRequest(method, path)).toBe(false)
  );
});
describe('authoritative fixture receipt history', () => {
  const c = { runId: '123456abcdef', origin: 'https://qa.example.org' };
  const input = {
    orgId: 'A',
    channelId: 'channel-A',
    attemptId: 'attempt',
    segmentId: 'segment',
    payloadHash: 'digest',
  };
  const event = (kind: string, changes: any = {}) => ({
    runId: c.runId,
    ...input,
    kind,
    ...(kind === 'ACCEPT'
      ? {
          receipt: {
            id: 'segment',
            postId: `qa-${c.runId}-attempt`,
            releaseURL: `${c.origin}/qa-receipt/attempt`,
            status: 'published',
          },
        }
      : {}),
    ...changes,
  });
  it('accepts one confirmed rejection or one valid receipt and no invented absence', () => {
    expect(reconcileHistory(c, input, [event('DENY')])).toEqual({
      terminal: true,
      outcome: 'UNPUBLISHED',
    });
    expect(reconcileHistory(c, input, [event('ACCEPT')]).outcome).toBe(
      'PUBLISHED'
    );
    expect(reconcileHistory(c, input, []).outcome).toBe('UNKNOWN');
  });
  it.each([
    [event('DENY'), event('ACCEPT')],
    [event('ACCEPT'), event('DENY')],
    [event('ACCEPT'), event('ACCEPT')],
    [event('DENY'), event('ACCEPT', { payloadHash: 'other' })],
    [event('ACCEPT', { receipt: { postId: 'inconsistent' } })],
    [event('DENY', { receipt: { postId: 'known-acceptance' } })],
    [event('ACCEPT'), event('RECONCILE', { channelId: 'other' })],
  ])(
    'never grants retry from contradictory/duplicate/corrupt history',
    (...rows) => {
      const before = JSON.stringify(rows);
      expect(reconcileHistory(c, input, rows)).toEqual({
        terminal: false,
        outcome: 'UNKNOWN',
      });
      expect(JSON.stringify(rows)).toBe(before);
    }
  );
});

it('does not infer unpublished after a rejected duplicate dispatch', () => {
  const c = { runId: 'r', origin: 'https://qa.example.org' },
    input = {
      orgId: 'A',
      channelId: 'A',
      attemptId: 'id',
      segmentId: 's',
      payloadHash: 'h',
    };
  expect(
    reconcileHistory(c, input, [
      { ...input, runId: 'r', kind: 'DENY' },
      { ...input, runId: 'r', kind: 'DUPLICATE_CALL' },
    ])
  ).toEqual({ terminal: false, outcome: 'UNKNOWN' });
});

// Synthetic contract only: no loadRun/AppModule, filesystem or transport invocation.
describe('protected fixture admission state', () => {
  const proofFor = (c: QaManifest) => ({
    runId: c.runId,
    sourceSha: c.sourceSha,
    origin: c.origin,
    admissionState: c.admissionState,
    owner: 'Release Engineer',
    providerEgress: 'DENIED',
    trustedReferenceParents: 'RE_IMMUTABLE_NO_CONCURRENT_UNTRUSTED_WRITERS',
    trustedHttps: true,
    frontendBakedApi: `${c.origin}/api`,
    sourceReviewedSha: c.sourceSha,
    reviewedRuntimeGo: true,
    runtimeGoRef: 'example-reviewed-runtime-go',
    evidenceRef: 'example-containment-evidence',
  });
  it.each(['CLOSED', 'OPEN'] as const)(
    'derives %s only from the reviewed contract',
    (state) => {
      const c = { ...example(), admissionState: state };
      const env = {};
      applyQaAdmission(
        c,
        {
          ...proofFor(c),
          admissionOpenPermitted: true,
          admissionOpenGoRef: 'example-open-go',
        },
        env
      );
      expect(env).toEqual({
        MCP_V114_ADMISSION_ENABLED: state === 'OPEN' ? 'true' : 'false',
      });
    }
  );
  it.each([undefined, null, '', 'open', 'true'])(
    'rejects missing/invalid protected state %s',
    (state) => {
      const c = { ...example(), admissionState: state } as QaManifest;
      expect(() => validateManifest(c)).toThrow();
      const env = {};
      expect(() => applyQaAdmission(c, proofFor(c), env)).toThrow();
      expect(env).toEqual({});
    }
  );
  it.each(['true', 'false', '', undefined])(
    'rejects inherited global flag %s without replacing it',
    (value) => {
      const c = example(),
        env = { MCP_V114_ADMISSION_ENABLED: value };
      expect(() => applyQaAdmission(c, proofFor(c), env)).toThrow('Inherited');
      expect(env.MCP_V114_ADMISSION_ENABLED).toBe(value);
    }
  );
  it.each([
    { admissionOpenPermitted: false },
    { admissionOpenGoRef: undefined },
    { admissionOpenGoRef: ' ' },
    { reviewedRuntimeGo: false },
    { runtimeGoRef: '' },
    { runId: 'other' },
    { sourceSha: '2'.repeat(40) },
    { sourceReviewedSha: '2'.repeat(40) },
    { admissionState: 'CLOSED' },
    { providerEgress: 'ALLOWED' },
  ])(
    'refuses OPEN before any environment effect when proof is invalid %j',
    (delta) => {
      const c = { ...example(), admissionState: 'OPEN' as const },
        env = {};
      expect(() =>
        applyQaAdmission(
          c,
          {
            ...proofFor(c),
            admissionOpenPermitted: true,
            admissionOpenGoRef: 'example-open-go',
            ...delta,
          },
          env
        )
      ).toThrow();
      expect(env).toEqual({});
    }
  );
  it('refuses OPEN without an explicit opening go even when general runtime go exists', () => {
    const c = { ...example(), admissionState: 'OPEN' as const };
    const env = {};
    expect(() => applyQaAdmission(c, proofFor(c), env)).toThrow(
      'OPEN admission permission'
    );
    expect(env).toEqual({});
  });
});
