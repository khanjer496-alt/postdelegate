// Separately invoked CI/staging fixture composition; never imported by production.
import { PrismaClient } from '@prisma/client';
import { Client, Connection } from '@temporalio/client';
import { Worker, NativeConnection } from '@temporalio/worker';
import { temporal } from '@temporalio/proto';
import { randomUUID, createHash } from 'crypto';
import {
  mkdtempSync,
  readFileSync,
  appendFileSync,
  openSync,
  fsyncSync,
  closeSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { describe, it as nodeIt, before, after, afterEach } from 'node:test';
import { expect } from 'expect';
const caseResults: Array<{
  name: string;
  status: string;
  code?: string | number;
  type?: string;
}> = [];
let setupStage = 'NOT_STARTED';
const hookResults: Array<{
  phase: string;
  stage?: string;
  code?: string | number;
  type?: string;
}> = [];
const safeFailure = (error: any) => ({
  code:
    typeof error?.code === 'number' ||
    (typeof error?.code === 'string' && /^[A-Z0-9_-]{1,40}$/.test(error.code))
      ? error.code
      : undefined,
  type:
    typeof error?.name === 'string' && /^[A-Za-z0-9_]{1,60}$/.test(error.name)
      ? error.name
      : 'Error',
});
const it = (name: string, fn: () => Promise<void>, timeout = 60000) => {
  const record = { name, status: 'NOT_RUN' } as (typeof caseResults)[number];
  caseResults.push(record);
  return nodeIt(name, { timeout }, async (context) => {
    try {
      await fn();
      record.status = context.signal.aborted ? 'ABORTED' : 'BODY_COMPLETED';
    } catch (error) {
      Object.assign(record, { status: 'FAILED', ...safeFailure(error) });
      throw error;
    }
  });
};
const beforeAll = (fn: () => Promise<void>, timeout = 90000) =>
  before(
    async () => {
      try {
        await fn();
      } catch (error) {
        hookResults.push({ phase: 'SETUP', stage: setupStage, ...safeFailure(error) });
        throw error;
      }
    },
    { timeout }
  );
const afterAll = (fn: () => Promise<void>, timeout = 30000) =>
  after(
    async () => {
      try {
        await fn();
      } catch (error) {
        hookResults.push({ phase: 'TEARDOWN', ...safeFailure(error) });
        throw error;
      }
    },
    { timeout }
  );
process.on('exit', (exitCode) => {
  if (
    process.env.MCP_WORKER_TEST_RESULT_FILE ===
      '/tmp/mcp-native-summary.json' &&
    !process.argv.includes('--check-imports')
  )
    writeFileSync(
      '/tmp/mcp-native-summary.json',
      JSON.stringify(
        { frameworkExitCode: exitCode, cases: caseResults, hooks: hookResults },
        null,
        2
      )
    );
});
let mockStorage: any;
// Process-local external transport substitutions; no production module is patched on disk.
const substitute = (name: string, exports: any) => {
  const filename = require.resolve(name);
  require.cache[filename] = {
    id: filename,
    filename,
    loaded: true,
    exports,
  } as any;
};
substitute('@gitroom/nestjs-libraries/integrations/integration.manager', {
  IntegrationManager: class {},
  socialIntegrationList: [],
});
substitute('@gitroom/nestjs-libraries/upload/upload.factory', {
  UploadFactory: {
    createStorage: () => mockStorage,
    createProcessor: () => null,
  },
});
substitute('@gitroom/nestjs-libraries/videos/video.manager', {
  VideoManager: class {},
});
substitute('@gitroom/nestjs-libraries/redis/redis.service', { ioRedis: {} });
const { PostsRepository } = require('./posts.repository');
const { PostsService } = require('./posts.service');
const {
  PostActivity,
} = require('@gitroom/orchestrator/activities/post.activity');
const {
  IntegrationRepository,
} = require('../integrations/integration.repository');
const { IntegrationService } = require('../integrations/integration.service');
const { ApprovalsRepository } = require('../approvals/approvals.repository');
const {
  ApprovalPolicyService,
} = require('../approvals/approval.policy.service');
const {
  ActivityLogRepository,
} = require('../activity-log/activity.log.repository');
const { ActivityLogService } = require('../activity-log/activity.log.service');
const { MediaRepository } = require('../media/media.repository');
const { MediaService } = require('../media/media.service');
const {
  SubscriptionRepository,
} = require('../subscriptions/subscription.repository');
const {
  SubscriptionService,
} = require('../subscriptions/subscription.service');
const {
  ShortLinkService,
} = require('../../../short-linking/short.link.service');
if (process.argv.includes('--check-imports')) {
  process.stdout.write(
    'Fixture imports validated; no database, worker or provider executed.\n'
  );
  process.exit(0);
}
const url = process.env.MCP_WORKER_TEST_DATABASE_URL;
const namespace = process.env.MCP_WORKER_TEST_NAMESPACE || '';
const address = process.env.MCP_WORKER_TEST_TEMPORAL_ADDRESS || '';
if (
  url &&
  (new URL(url).pathname !== '/pd_security_ledger_test' ||
    new URL(url).searchParams.get('schema') !== 'mcp_worker' ||
    !['localhost', '127.0.0.1', 'postgres', 'fixture-db'].includes(
      new URL(url).hostname
    ) ||
    !namespace.startsWith('mcp-fixture-') ||
    ![
      'localhost:7233',
      '127.0.0.1:7233',
      'fixture-temporal:7233',
      'temporal:7233',
    ].includes(address))
)
  throw new Error('Explicit disposable worker database/namespace required.');
if (!url)
  throw new Error('Explicit disposable worker test environment required.');
const pg = describe;

type Event = {
  kind: 'ACCEPT' | 'DENY' | 'RECONCILE';
  attemptId: string;
  segmentId: string;
  receipt?: any;
  digest: string;
  parent?: string;
  previous?: string;
};
class FixtureAdapter {
  identifier = 'fixture';
  editor = 'normal';
  convertToJPEG = true;
  denyNextComment = false;
  failFollowupNext = false;
  private acceptBarrier?: { reached: () => void; wait: Promise<void> };
  holdNextAccept() {
    let reached!: () => void;
    let release!: () => void;
    const observed = new Promise<void>((resolve) => {
      reached = resolve;
    });
    this.acceptBarrier = {
      reached,
      wait: new Promise<void>((resolve) => {
        release = resolve;
      }),
    };
    return { observed, release };
  }
  constructor(
    readonly file: string,
    readonly orgId: string,
    readonly channelId: string
  ) {}
  maxLength() {
    return 1000;
  }
  async checkValidity() {
    return true as const;
  }
  events(): Event[] {
    return readFileSync(this.file, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  }
  private persist(event: Event) {
    appendFileSync(this.file, JSON.stringify(event) + '\n');
    const fd = openSync(this.file, 'r');
    try {
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
  }
  private async publish(
    posts: any[],
    integration: any,
    comment: boolean,
    parent?: string,
    previous?: string
  ) {
    if (
      integration.organizationId !== this.orgId ||
      integration.id !== this.channelId ||
      posts.length !== 1 ||
      !posts[0].clientReference?.attemptId
    )
      throw new Error('Unknown fixture dispatch denied.');
    if (this.acceptBarrier) {
      const barrier = this.acceptBarrier;
      this.acceptBarrier = undefined;
      barrier.reached();
      await barrier.wait;
    }
    const post = posts[0];
    const attemptId = post.clientReference.attemptId;
    const digest = createHash('sha256')
      .update(JSON.stringify(posts))
      .digest('hex');
    if (comment && this.denyNextComment) {
      this.denyNextComment = false;
      this.persist({ kind: 'DENY', attemptId, segmentId: post.id, digest });
      throw new Error('Fixture terminal unpublished rejection.');
    }
    const receipt = {
      id: post.id,
      postId: `fixture-${attemptId}`,
      releaseURL: `https://fixture.invalid/${attemptId}`,
      status: 'published',
    };
    // Never silently deduplicate here: an erroneous second call is a second ACCEPT.
    this.persist({
      kind: 'ACCEPT',
      parent,
      previous,
      attemptId,
      segmentId: post.id,
      digest,
      receipt,
    });
    if (this.failFollowupNext) {
      this.failFollowupNext = false;
      const {
        PublishedWithError,
      } = require('../../../integrations/social.abstract');
      throw new PublishedWithError(
        'fixture',
        post.id,
        receipt.postId,
        receipt.releaseURL,
        'Owned fixture thumbnail failure after live acceptance.'
      );
    }
    return [receipt];
  }
  async post(_id: string, _token: string, posts: any[], integration: any) {
    return this.publish(posts, integration, false);
  }
  async comment(
    _id: string,
    parent: string,
    previous: string,
    _token: string,
    posts: any[],
    integration: any
  ) {
    if (
      !this.events().some(
        (event) => event.kind === 'ACCEPT' && event.receipt?.postId === parent
      )
    )
      throw new Error('Unknown predecessor receipt denied.');
    return this.publish(posts, integration, true, parent, previous);
  }
  async reconcileMcpAttempt(integration: any, attempt: any) {
    if (
      integration.organizationId !== this.orgId ||
      integration.id !== this.channelId
    )
      throw new Error('Unknown fixture reconciliation denied.');
    const history = this.events().filter(
      (event) =>
        ['ACCEPT', 'DENY'].includes(event.kind) &&
        event.attemptId === attempt.attemptId &&
        event.segmentId === attempt.segmentId
    );
    this.persist({
      kind: 'RECONCILE',
      attemptId: attempt.attemptId,
      segmentId: attempt.segmentId,
      digest: attempt.payloadHash,
    });
    if (
      !history.length ||
      history.some((event) => event.digest !== attempt.payloadHash)
    )
      return { terminal: false, outcome: 'UNKNOWN' };
    const accepted = history.filter((event) => event.kind === 'ACCEPT');
    const denied = history.filter((event) => event.kind === 'DENY');
    // Keep all evidence. Contradictory or duplicate dispatch cannot be used as
    // a terminal oracle, and a prior DENY never masks a later acceptance.
    if (accepted.length > 1 || (accepted.length && denied.length))
      return { terminal: false, outcome: 'UNKNOWN' };
    if (accepted.length === 1) {
      const receipt = accepted[0].receipt;
      if (
        receipt?.id !== attempt.segmentId ||
        receipt?.postId !== `fixture-${attempt.attemptId}` ||
        receipt?.status !== 'published'
      )
        return { terminal: false, outcome: 'UNKNOWN' };
      return { terminal: true, outcome: 'PUBLISHED', receipt };
    }
    return denied.length
      ? { terminal: true, outcome: 'UNPUBLISHED' }
      : { terminal: false, outcome: 'UNKNOWN' };
  }
}

pg(
  'actual MCP service and native worker with deterministic provider transport',
  () => {
    let db: PrismaClient;
    let repo: any;
    let posts: any;
    let activity: any;
    let clientConnection: Connection;
    let native: NativeConnection;
    let client: Client;
    let worker: Worker | undefined;
    let workerRun: Promise<void> | undefined;
    let org: string;
    let channel: string;
    let adapter: FixtureAdapter;
    let fixtureRoot: string;
    let failNextReceipt = false;
    let failInitialFence = false;
    let failEnqueue = false;
    let loseStartReply = false;
    let legacyDispatches = 0;
    let projectionGate:
      | {
          held?: boolean;
          root?: string;
          projected: () => void;
          cancellation: () => void;
          wait: Promise<void>;
        }
      | undefined;
    let planGate: Promise<void> | undefined;
    let childGate:
      | { generation?: number; observed: () => void; wait: Promise<void> }
      | undefined;
    const publishActivity = async (...args: any[]) => {
      if (
        childGate &&
        args[2] !== args[1] &&
        (childGate.generation === undefined || childGate.generation === args[3])
      ) {
        const gate = childGate;
        gate.generation = args[3];
        gate.observed();
        await gate.wait;
      }
      return activity.mcpPublishSegment(...args);
    };
    const fixtureNotifications: any[] = [];
    const notifications = new Proxy(
      {},
      {
        get: (_target, name) =>
          name === 'then'
            ? undefined
            : (...args: any[]) => {
                fixtureNotifications.push({ name: String(name), args });
                return Promise.resolve();
              },
      }
    );
    const deniedTransport = new Proxy(
      {},
      {
        get: (_target, key) => {
          if (key === 'then') return undefined;
          return () => {
            throw new Error(
              `Unconfigured external fixture transport: ${String(key)}`
            );
          };
        },
      }
    );
    const factory = (model: any) => ({ model });
    const modelProxy = (tx: any) =>
      new Proxy(tx, {
        get: (target, key) => {
          if (
            !['mcpPublishAttempt', 'post', 'mcpPublishFence'].includes(
              String(key)
            )
          )
            return typeof target[key] === 'function'
              ? target[key].bind(target)
              : target[key];
          const model = target[key];
          return new Proxy(model, {
            get: (delegate, method) => {
              if (key === 'mcpPublishAttempt' && method === 'update')
                return async (args: any) => {
                  if (failNextReceipt && args.data?.status === 'CONFIRMED') {
                    failNextReceipt = false;
                    throw new Error(
                      'Owned deterministic receipt commit fault.'
                    );
                  }
                  return delegate.update(args);
                };
              if (key === 'mcpPublishFence' && method === 'upsert')
                return async (args: any) => {
                  if (failInitialFence) {
                    failInitialFence = false;
                    throw new Error('Owned initial fence commit fault.');
                  }
                  return delegate.upsert(args);
                };
              if (key === 'post' && method === 'update')
                return async (args: any) => {
                  const result = await delegate.update(args);
                  const gate = projectionGate;
                  if (gate && !gate.held && args.data?.state === 'PUBLISHED') {
                    gate.held = true;
                    gate.root = args.where.id;
                    gate.projected();
                    await gate.wait;
                  }
                  return result;
                };
              if (key === 'mcpPublishFence' && method === 'update')
                return async (args: any) => {
                  const gate = projectionGate;
                  if (gate?.held && args.where.postId === gate.root)
                    gate.cancellation();
                  return delegate.update(args);
                };
              return typeof delegate[method] === 'function'
                ? delegate[method].bind(delegate)
                : delegate[method];
            },
          });
        },
      });
    const activeWorkers = new Map<Worker, Promise<void>>();
    const startWorker = async () => {
      setupStage = 'WORKFLOW_WORKER_CREATE';
      worker = await Worker.create({
        connection: native,
        namespace,
        taskQueue: 'mcp-publish-v114',
        maxConcurrentActivityTaskExecutions: 2,
        workflowsPath: require.resolve(
          '../../../../../../apps/orchestrator/src/workflows/post-workflows/post.workflow.v1.1.4'
        ),
        activities: {
          mcpThreadPlan: async (...args: any[]) => {
            if (planGate) await planGate;
            return activity.mcpThreadPlan(...args);
          },
          mcpFailSegment: activity.mcpFailSegment.bind(activity),
          mcpPublishSegment: publishActivity,
        },
      });
      setupStage = 'WORKFLOW_WORKER_RUN';
      workerRun = worker.run();
      const workflowWorker = worker;
      const workflowRun = workerRun;
      activeWorkers.set(workflowWorker, workflowRun);
      setupStage = 'PUBLISHER_WORKER_CREATE';
      const publisher = await Worker.create({
        connection: native,
        namespace,
        taskQueue: 'mcp-v114-fixture',
        maxConcurrentActivityTaskExecutions: 2,
        activities: {
          mcpPublishSegment: publishActivity,
        },
      });
      setupStage = 'PUBLISHER_WORKER_RUN';
      const publisherRun = publisher.run();
      activeWorkers.set(publisher, publisherRun);
      return async () => {
        if (workflowWorker.getState() === 'RUNNING') workflowWorker.shutdown();
        if (publisher.getState() === 'RUNNING') publisher.shutdown();
        await Promise.all([workflowRun, publisherRun]);
        activeWorkers.delete(workflowWorker);
        activeWorkers.delete(publisher);
        if (worker === workflowWorker) worker = undefined;
      };
    };
    let stop: (() => Promise<void>) | undefined;
    beforeAll(async () => {
      setupStage = 'ENVIRONMENT';
      if (process.env.STRIPE_SECRET_KEY || process.env.STRIPE_PUBLISHABLE_KEY)
        throw new Error(
          'No billing/provider credentials permitted in fixture composition.'
        );
      process.env.MCP_V114_ADMISSION_ENABLED = 'true';
      setupStage = 'PRIVATE_FILES';
      fixtureRoot = mkdtempSync(join(tmpdir(), 'postdelegate-mcp-worker-'));
      mockStorage = {
        uploadFile: async ({ buffer }: any) => {
          const name = `${randomUUID()}.jpg`;
          writeFileSync(join(fixtureRoot, name), buffer);
          return { path: '/' + name, originalname: name };
        },
      };
      process.env.UPLOAD_DIRECTORY = fixtureRoot;
      process.env.FRONTEND_URL = 'https://fixture.invalid';
      process.env.NEXT_PUBLIC_UPLOAD_STATIC_DIRECTORY = 'media';
      setupStage = 'DATABASE_FIXTURE';
      db = new PrismaClient({ datasources: { db: { url } } });
      org = (
        await db.organization.create({
          data: { name: 'Owned native-worker fixture' },
        })
      ).id;
      channel = (
        await db.integration.create({
          data: {
            organizationId: org,
            internalId: randomUUID(),
            name: 'No-egress fixture',
            providerIdentifier: 'fixture',
            type: 'social',
            token: 'fixture-not-a-real-token',
          },
        })
      ).id;
      const file = join(fixtureRoot, 'provider.jsonl');
      writeFileSync(file, '');
      adapter = new FixtureAdapter(file, org, channel);
      const manager = {
        getSocialIntegration: (identifier: string) => {
          if (identifier !== 'fixture')
            throw new Error('Unknown provider denied.');
          return adapter;
        },
      };
      setupStage = 'TEMPORAL_CONNECT';
      clientConnection = await Connection.connect({ address });
      setupStage = 'TEMPORAL_NAMESPACE';
      try {
        await clientConnection.workflowService.registerNamespace({
          namespace,
          workflowExecutionRetentionPeriod: { seconds: 3600 },
        });
      } catch (error) {
        if ((error as any).code !== 6) throw error;
      }
      setupStage = 'TEMPORAL_SEARCH_ATTRIBUTES';
      await clientConnection.operatorService.addSearchAttributes({
        namespace,
        searchAttributes: {
          postId:
            temporal.api.enums.v1.IndexedValueType.INDEXED_VALUE_TYPE_TEXT,
          organizationId:
            temporal.api.enums.v1.IndexedValueType.INDEXED_VALUE_TYPE_TEXT,
        },
      });
      client = new Client({ connection: clientConnection, namespace });
      setupStage = 'NATIVE_CONNECT';
      native = await NativeConnection.connect({ address });
      const temporalService = {
        client: {
          getRawClient: () => ({
            connection: clientConnection,
            workflow: {
              getHandle: client.workflow.getHandle.bind(client.workflow),
              signalWithStart: async () => {
                legacyDispatches++;
                throw new Error('Legacy dispatch denied in fixture.');
              },
              start: async (name: string, options: any) => {
                if (name === 'postWorkflowV113') legacyDispatches++;
                if (name !== 'postWorkflowV114')
                  throw new Error('Ancillary fixture workflow denied.');
                if (failEnqueue) {
                  failEnqueue = false;
                  throw new Error('Owned pre-RPC enqueue fault.');
                }
                const started = await client.workflow.start(name, {
                  ...options,
                  workflowExecutionTimeout: '2 minutes',
                });
                if (loseStartReply) { loseStartReply = false; throw new Error('Owned accepted-start response-loss fault.'); }
                return started;
              },
            },
          }),
        },
      };
      setupStage = 'DOMAIN_COMPOSITION';
      const transaction = factory({
        $transaction: (fn: any, options: any) =>
          db.$transaction((tx) => fn(modelProxy(tx)), options),
      });
      repo = new PostsRepository(
        factory(db) as any,
        factory(db) as any,
        factory(db) as any,
        factory(db) as any,
        factory(db) as any,
        factory(db) as any,
        transaction as any,
        factory(db) as any
      );
      const log = new ActivityLogService(
        new ActivityLogRepository(factory(db) as any, factory(db) as any)
      );
      const approvalRepo = new ApprovalsRepository(
        factory(db) as any,
        factory(db) as any,
        factory(db) as any,
        factory(db) as any,
        factory(db) as any,
        factory(db) as any,
        transaction as any
      );
      const policy = new ApprovalPolicyService(
        approvalRepo,
        log,
        notifications as any
      );
      const integrationRepo = new IntegrationRepository(
        factory(db) as any,
        factory(db) as any,
        factory(db) as any,
        factory(db) as any,
        factory(db) as any,
        factory(db) as any,
        transaction as any,
        deniedTransport as any
      );
      const integrations = new IntegrationService(
        integrationRepo,
        deniedTransport as any,
        manager as any,
        deniedTransport as any,
        deniedTransport as any,
        temporalService as any,
        deniedTransport as any
      );
      const subscriptions = new SubscriptionService(
        new SubscriptionRepository(
          factory(db) as any,
          factory(db) as any,
          factory(db) as any,
          factory(db) as any,
          factory(db) as any,
          transaction as any
        ),
        integrations,
        deniedTransport as any
      );
      const media = new MediaService(
        new MediaRepository(factory(db) as any),
        deniedTransport as any,
        subscriptions,
        deniedTransport as any,
        temporalService as any
      );
      posts = new PostsService(
        repo,
        manager as any,
        integrations,
        media,
        new ShortLinkService(),
        deniedTransport as any,
        temporalService as any,
        deniedTransport as any,
        policy,
        log,
        subscriptions,
        deniedTransport as any
      );
      activity = new PostActivity(
        posts,
        deniedTransport as any,
        manager as any,
        integrations,
        deniedTransport as any,
        deniedTransport as any,
        temporalService as any,
        subscriptions
      );
      expect((posts as any)._integrationManager).toBe(manager);
      expect((activity as any)._integrationManager).toBe(manager);
      stop = await startWorker();
      setupStage = 'READY';
    }, 90000);
    afterEach(async () => {
      if (db && org)
        await db.approvalSettings.updateMany({
          where: { organizationId: org },
          data: {
            requireAgentApproval: false,
            agentMaxPostsPerDay: null,
            agentIntegrationIds: [],
          },
        });
    });
    afterAll(async () => {
      if (stop) await stop();
      for (const [remaining] of activeWorkers)
        if (remaining.getState() === 'RUNNING') remaining.shutdown();
      await Promise.all([...activeWorkers.values()]);
      activeWorkers.clear();
      if (native) await native.close();
      if (clientConnection) await clientConnection.close();
      if (db && org) {
        await db.mcpPublishAttempt.deleteMany({
          where: { organizationId: org },
        });
        await db.mcpPublishFence.deleteMany({ where: { organizationId: org } });
        await db.mcpAgentAdmission.deleteMany({
          where: { organizationId: org },
        });
        await db.activityLog.deleteMany({ where: { organizationId: org } });
        await db.post.deleteMany({ where: { organizationId: org } });
        await db.integration.deleteMany({ where: { organizationId: org } });
        await db.media.deleteMany({ where: { organizationId: org } });
        await db.organization.delete({ where: { id: org } });
      }
      if (db) await db.$disconnect();
      // Owned files remain as sanitized independent adapter evidence; no broad cleanup.
    }, 30000);
    const create = async (
      count: number,
      image: any[] = [],
      date = new Date(Date.now() - 1000).toISOString()
    ) => {
      const [saved] = await posts.createPost(
        org,
        {
          type: 'schedule',
          date,
          shortLink: false,
          tags: [],
          posts: [
            {
              integration: { id: channel },
              settings: { __type: 'fixture' },
              value: Array.from({ length: count }, (_, index) => ({
                content: `fixture segment ${index}`,
                image: index === 0 ? image : [],
              })),
            },
          ],
        } as any,
        'MCP',
        false,
        { type: 'agent', source: 'deterministic fixture' }
      );
      return saved.postId as string;
    };
    const waitForRun = async (id: string, generation: number) =>
      client.workflow.getHandle(`post_${id}_mcp_${generation}`).result();
    it('shares one actual provider slot between legacy and V114 queues without cross-polling', async () => {
      if (stop) { await stop(); stop = undefined; }
      const { providerActivityOptions } = require('../../../temporal/provider.activity.slots');
      const capacity = providerActivityOptions('fixture', 1, 1);
      const pool = capacity.tuner.activityTaskSlotSupplier;
      const running: Array<[Worker, Promise<void>]> = [];
      const launch = async (options: any) => {
        const current = await Worker.create({ connection: native, namespace, ...options });
        const promise = current.run(); running.push([current, promise]); activeWorkers.set(current, promise);
        return current;
      };
      const until = async (check: () => boolean | Promise<boolean>, label: string) => {
        const limit = Date.now() + 20000;
        while (!await check()) {
          if (Date.now() >= limit) throw new Error(`Provider-cap fixture boundary not reached: ${label}`);
          await new Promise(resolve => setTimeout(resolve, 25));
        }
      };
      let release!: () => void;
      const held = new Promise<void>(resolve => { release = resolve; });
      let legacyEntered = false, trackedEntered = false, active = 0, maximum = 0;
      const originalPost = adapter.post;
      let legacyId: string | undefined;
      adapter.post = async (id: string, token: string, values: any[], integration: any) => {
        const legacy = values[0]?.id === legacyId;
        active++; maximum = Math.max(maximum, active);
        try {
          if (legacy) { legacyEntered = true; await held; }
          else trackedEntered = true;
          // Legacy has no MCP attempt. Bind an explicitly owned fixture-only
          // transport identity, never grant this fallback to another segment.
          const payload = legacy ? values.map(value => ({ ...value, clientReference: { attemptId: `legacy_${legacyId}` } })) : values;
          return await originalPost.call(adapter, id, token, payload, integration);
        } finally { active--; }
      };
      try {
        await launch({ taskQueue: 'mcp-publish-v114', maxConcurrentActivityTaskExecutions: 2,
          workflowsPath: require.resolve('../../../../../../test/fixtures/mcp-provider-cap.workflows'),
          activities: { mcpThreadPlan: activity.mcpThreadPlan.bind(activity), mcpFailSegment: activity.mcpFailSegment.bind(activity) },
        });
        const legacy = await repo.createOrUpdatePost('schedule', org, new Date(Date.now() - 1000).toISOString(), {
          integration: { id: channel }, settings: { __type: 'fixture' }, value: [{ content: 'Owned legacy cap fixture', image: [] }],
        }, [], 'API');
        const legacyPost = legacy.posts[0]; legacyId = legacyPost.id;
        const integration = (await posts.mcpThread(org, legacyId))[0].integration;
        const legacyHandle = await client.workflow.start('legacyProviderCapFixture', {
          taskQueue: 'mcp-publish-v114', workflowId: `legacy_cap_${legacyId}`,
          args: [{ queue: 'fixture', integration, post: legacyPost }], workflowExecutionTimeout: '2 minutes',
        });
        const trackedId = await create(1);
        const trackedHandle = client.workflow.getHandle(`post_${trackedId}_mcp_0`);
        await until(async () => [await legacyHandle.fetchHistory(), await trackedHandle.fetchHistory()].every(history =>
          history.events?.some(event => event.activityTaskScheduledEventAttributes &&
            ['fixture', 'mcp-v114-fixture'].includes(event.activityTaskScheduledEventAttributes.taskQueue?.name || ''))), 'both provider queues scheduled');
        await launch({ taskQueue: 'fixture', ...capacity,
          activities: { postSocial: activity.postSocial.bind(activity), updatePost: activity.updatePost.bind(activity) },
        });
        await until(() => legacyEntered, 'legacy provider held');
        await launch({ taskQueue: 'mcp-v114-fixture', ...capacity, activities: { mcpPublishSegment: publishActivity } });
        await until(() => pool.pendingFor('mcp-v114-fixture') > 0, 'V114 SDK reservation waiting on shared budget');
        expect(trackedEntered).toBe(false); expect(active).toBe(1); expect(maximum).toBe(1);
        release();
        await Promise.all([legacyHandle.result(), trackedHandle.result()]);
        expect(trackedEntered).toBe(true); expect(maximum).toBe(1);
        expect(await db.post.findUniqueOrThrow({ where: { id: legacyId } })).toMatchObject({ state: 'PUBLISHED', mcpWorkflowVersion: null });
        expect(adapter.events().filter(event => event.kind === 'ACCEPT' && [legacyId, trackedId].includes(event.segmentId))).toHaveLength(2);
      } finally {
        release();
        for (const [current] of running) if (current.getState() === 'RUNNING') current.shutdown();
        await Promise.all(running.map(([, promise]) => promise));
        for (const [current] of running) activeWorkers.delete(current);
        adapter.post = originalPost;
        expect(pool.reserved).toBe(0);
        stop = await startWorker();
      }
    }, 90000);
    it('native shutdown abandons an unconsumed grant without leaking the surviving queue budget', async () => {
      if (stop) { await stop(); stop = undefined; }
      const { providerActivityOptions } = require('../../../temporal/provider.activity.slots');
      const capacity = providerActivityOptions('fixture', 1, 1), pool = capacity.tuner.activityTaskSlotSupplier;
      const originalReserve = pool.reserveSlot.bind(pool);
      let handoff = false, legacyCancelled = false;
      let releaseHandoff = () => {};
      pool.reserveSlot = async (context: any, signal: AbortSignal) => {
        const permit = await originalReserve(context, signal);
        if (context.taskQueue === 'fixture' && !handoff) {
          handoff = true;
          // Hold the JS callback result before Core can construct its permit.
          // Only the real SDK shutdown/drop may abort this reservation.
          if (!signal.aborted) await new Promise<void>(resolve => {
            const cancelled = () => { legacyCancelled = true; signal.removeEventListener('abort', cancelled); resolve(); };
            releaseHandoff = () => { signal.removeEventListener('abort', cancelled); resolve(); };
            signal.addEventListener('abort', cancelled, { once: true });
            if (signal.aborted) cancelled();
          });
          else legacyCancelled = true;
        }
        return permit;
      };
      const running: Array<[Worker, Promise<void>]> = [];
      const launch = async (options: any) => {
        const current = await Worker.create({ connection: native, namespace, ...options });
        const promise = current.run(); running.push([current, promise]); activeWorkers.set(current, promise); return current;
      };
      const until = async (check: () => boolean, label: string) => {
        const limit = Date.now() + 20000;
        while (!check()) { if (Date.now() >= limit) throw new Error(`Native handoff boundary not reached: ${label}`); await new Promise(resolve => setTimeout(resolve, 25)); }
      };
      let active = 0, maximum = 0;
      const originalPost = adapter.post;
      adapter.post = async (...args: Parameters<FixtureAdapter['post']>) => {
        active++; maximum = Math.max(maximum, active);
        try { return await originalPost.apply(adapter, args); } finally { active--; }
      };
      try {
        await launch({ taskQueue: 'mcp-publish-v114', maxConcurrentActivityTaskExecutions: 2,
          workflowsPath: require.resolve('../../../../../../apps/orchestrator/src/workflows/post-workflows/post.workflow.v1.1.4'),
          activities: { mcpThreadPlan: activity.mcpThreadPlan.bind(activity), mcpFailSegment: activity.mcpFailSegment.bind(activity) },
        });
        const legacy = await launch({ taskQueue: 'fixture', ...capacity, activities: { postSocial: activity.postSocial.bind(activity) } });
        await until(() => handoff, 'JS grant held before native consumption');
        await launch({ taskQueue: 'mcp-v114-fixture', ...capacity, activities: { mcpPublishSegment: publishActivity } });
        const id = await create(1);
        await until(() => pool.pendingFor('mcp-v114-fixture') > 0, 'surviving queue waits');
        expect(active).toBe(0); expect(pool.reserved).toBe(1);
        legacy.shutdown();
        await until(() => legacyCancelled, 'SDK cancellation delivered');
        await waitForRun(id, 0);
        expect(maximum).toBe(1);
        expect(adapter.events().filter(event => event.kind === 'ACCEPT' && event.segmentId === id)).toHaveLength(1);
      } finally {
        releaseHandoff(); // Test-latch cleanup only; never releases a supplier permit.
        for (const [current] of running) if (current.getState() === 'RUNNING') current.shutdown();
        await Promise.all(running.map(([, promise]) => promise));
        for (const [current] of running) activeWorkers.delete(current);
        adapter.post = originalPost; expect(pool.reserved).toBe(0);
        stop = await startWorker();
      }
    }, 90000);
    it('runs two real segments, reconciles a terminal-unpublished child through resumeMcp and never replays the parent', async () => {
      adapter.denyNextComment = true;
      const id = await create(2);
      await waitForRun(id, 0);
      const before = await repo.mcpAttempts(org, id);
      expect(before.map((a) => a.status).sort()).toEqual([
        'CONFIRMED',
        'UNKNOWN',
      ]);
      const rootReceipt = (await db.post.findUniqueOrThrow({ where: { id } }))
        .releaseId;
      expect(await posts.resumeMcp(org, id)).toMatchObject({
        status: 'RESUMED',
      });
      await waitForRun(id, 1);
      const thread = await posts.mcpThread(org, id);
      expect(thread.map((p) => p.state)).toEqual(['PUBLISHED', 'PUBLISHED']);
      expect(thread[0].releaseId).toBe(rootReceipt);
      expect(
        adapter
          .events()
          .find(
            (event) =>
              event.kind === 'ACCEPT' && event.segmentId === thread[1].id
          )?.parent
      ).toBe(rootReceipt);
      expect(
        adapter
          .events()
          .filter(
            (e) =>
              e.kind === 'ACCEPT' && thread.some((p) => p.id === e.segmentId)
          )
      ).toHaveLength(2);
      expect(await posts.resumeMcp(org, id)).toMatchObject({
        status: 'ALREADY_PUBLISHED',
      });
    }, 60000);
    it('survives accepted-then-receipt-commit failure and worker restart with an independent durable receipt and zero replay', async () => {
      failNextReceipt = true;
      const id = await create(1);
      await waitForRun(id, 0);
      expect((await repo.mcpAttempts(org, id))[0].status).toBe('UNKNOWN');
      expect(
        adapter
          .events()
          .filter((e) => e.kind === 'ACCEPT' && e.segmentId === id)
      ).toHaveLength(1);
      await stop!();
      adapter = new FixtureAdapter(adapter.file, org, channel);
      stop = await startWorker();
      expect(await posts.resumeMcp(org, id)).toMatchObject({
        status: 'ALREADY_PUBLISHED',
      });
      expect((await db.post.findUniqueOrThrow({ where: { id } })).state).toBe(
        'PUBLISHED'
      );
      expect(
        adapter
          .events()
          .filter((e) => e.kind === 'ACCEPT' && e.segmentId === id)
      ).toHaveLength(1);
    }, 60000);
    it('publishing races with two lifecycle requests without false cancellation or replay', async () => {
      const barrier = adapter.holdNextAccept();
      const id = await create(1);
      try {
        await barrier.observed;
        const [cancel, resume] = await Promise.all([
          posts.unscheduleMcp(org, id),
          posts.resumeMcp(org, id),
        ]);
        expect(cancel).toMatchObject({ status: 'OUTCOME_UNKNOWN' });
        expect(resume).toMatchObject({ status: 'OUTCOME_UNKNOWN' });
      } finally {
        barrier.release();
      }
      await waitForRun(id, 0);
      expect((await db.post.findUniqueOrThrow({ where: { id } })).state).toBe(
        'PUBLISHED'
      );
      expect(
        adapter
          .events()
          .filter((event) => event.kind === 'ACCEPT' && event.segmentId === id)
      ).toHaveLength(1);
    }, 60000);

    it('the real worker preserves an approved published parent while cancellation and human approval control the remainder', async () => {
      const { ApprovalsService } = require('../approvals/approvals.service');
      const log = (posts as any)._activityLogService;
      const policy = (posts as any)._approvalPolicyService;
      const approvals = new ApprovalsService(
        (policy as any)._approvalsRepository,
        policy,
        log,
        posts
      );
      await db.approvalSettings.upsert({
        where: { organizationId: org },
        create: { organizationId: org, requireAgentApproval: true },
        update: { requireAgentApproval: true },
      });
      let observed!: () => void;
      let release!: () => void;
      const reached = new Promise<void>((resolve) => {
        observed = resolve;
      });
      childGate = {
        observed,
        wait: new Promise<void>((resolve) => {
          release = resolve;
        }),
      };
      const actor: any = {
        type: 'user',
        userId: 'fixture-admin',
        role: 'ADMIN',
      };
      let id: string;
      let oldGeneration = 0;
      try {
        id = await create(2);
        await approvals.approve(org, id, actor);
        oldGeneration = (await repo.mcpFence(org, id))!.generation;
        await reached;
        const receipt = (await db.post.findUniqueOrThrow({ where: { id } }))
          .releaseId;
        expect(await posts.unscheduleMcp(org, id)).toMatchObject({
          status: 'PARTIALLY_UNSCHEDULED',
        });
        expect(await posts.resumeMcp(org, id)).toMatchObject({
          status: 'BLOCKED',
        });
        failEnqueue = true;
        await expect(approvals.approve(org, id, actor)).rejects.toMatchObject({ code: 'DISPATCH_UNCONFIRMED', savedPostIds: [id] });
        const generation = (await repo.mcpFence(org, id))!.generation;
        await db.mcpPublishFence.update({ where: { postId: id }, data: { dispatchNotBefore: new Date(0) } });
        expect(await posts.recoverPendingMcpDispatches()).toMatchObject({ confirmed: 1 });
        await waitForRun(id, generation);
        expect(
          (await db.post.findUniqueOrThrow({ where: { id } })).releaseId
        ).toBe(receipt);
      } finally {
        release();
        childGate = undefined;
      }
      await waitForRun(id!, oldGeneration);
      const thread = await posts.mcpThread(org, id!);
      expect(thread.map((post) => post.state)).toEqual([
        'PUBLISHED',
        'PUBLISHED',
      ]);
      expect(
        adapter
          .events()
          .filter(
            (event) =>
              event.kind === 'ACCEPT' &&
              thread.some((post) => post.id === event.segmentId)
          )
      ).toHaveLength(2);
      await db.approvalSettings.update({
        where: { organizationId: org },
        data: { requireAgentApproval: false },
      });
    }, 60000);
    it('serializes the final daily slot and rejects a two-channel request before any partial save', async () => {
      const since = new Date();
      since.setUTCHours(0, 0, 0, 0);
      const day = new Date().toISOString().slice(0, 10);
      const existing = await db.post.count({
        where: {
          organizationId: org,
          parentPostId: null,
          agentSource: { not: null },
          createdAt: { gte: since },
        },
      });
      await db.approvalSettings.upsert({
        where: { organizationId: org },
        create: { organizationId: org, agentMaxPostsPerDay: existing + 1 },
        update: {
          requireAgentApproval: false,
          agentMaxPostsPerDay: existing + 1,
        },
      });
      const second = (
        await db.integration.create({
          data: {
            organizationId: org,
            internalId: randomUUID(),
            name: 'Second no-egress fixture',
            providerIdentifier: 'fixture',
            type: 'social',
            token: 'fixture-not-a-real-token',
          },
        })
      ).id;
      const entry = (integrationId: string) => ({
        integration: { id: integrationId },
        settings: { __type: 'fixture' },
        value: [{ content: 'quota fixture draft', image: [] }],
      });
      const body = (channels: string[]) => ({
        type: 'draft',
        date: new Date(Date.now() + 86400000).toISOString(),
        shortLink: false,
        tags: [],
        posts: channels.map(entry),
      });
      const before = await db.post.count({ where: { organizationId: org } });
      await expect(
        posts.createPost(org, body([channel, second]) as any, 'MCP', false, {
          type: 'agent',
          source: 'fixture',
        })
      ).rejects.toThrow();
      expect(await db.post.count({ where: { organizationId: org } })).toBe(
        before
      );
      const results = await Promise.allSettled([
        posts.createPost(org, body([channel]) as any, 'MCP', false, {
          type: 'agent',
          source: 'fixture',
        }),
        posts.createPost(org, body([second]) as any, 'MCP', false, {
          type: 'agent',
          source: 'fixture',
        }),
      ]);
      expect(new Date().toISOString().slice(0, 10)).toBe(day);
      expect(
        results.filter((result) => result.status === 'fulfilled')
      ).toHaveLength(1);
      expect(await db.post.count({ where: { organizationId: org } })).toBe(
        before + 1
      );
    }, 60000);

    it('cancel waits through receipt projection and cannot return whole-thread cancellation after provider acceptance', async () => {
      let projected!: () => void;
      let cancellation!: () => void;
      let release!: () => void;
      const projection = new Promise<void>((resolve) => {
        projected = resolve;
      });
      const cancelAtFence = new Promise<void>((resolve) => {
        cancellation = resolve;
      });
      projectionGate = {
        projected,
        cancellation,
        wait: new Promise<void>((resolve) => {
          release = resolve;
        }),
      };
      let id: string;
      let cancel: Promise<any> | undefined;
      try {
        id = await create(1);
        await projection;
        expect(
          adapter
            .events()
            .filter(
              (event) => event.kind === 'ACCEPT' && event.segmentId === id
            )
        ).toHaveLength(1);
        cancel = posts.unscheduleMcp(org, id);
        await cancelAtFence;
        // Both application projections are still uncommitted while this exact
        // real PostgreSQL receipt transaction is held at its deterministic barrier.
        expect((await db.post.findUniqueOrThrow({ where: { id } })).state).toBe(
          'QUEUE'
        );
        expect((await repo.mcpAttempts(org, id))[0].status).toBe('STARTED');
      } finally {
        release();
        projectionGate = undefined;
      }
      await waitForRun(id!, 0);
      const result = await cancel!;
      expect(['BLOCKED', 'ALREADY_PUBLISHED']).toContain(result.status);
      expect(await posts.unscheduleMcp(org, id!)).toMatchObject({
        status: 'ALREADY_PUBLISHED',
      });
      expect(
        (await db.post.findUniqueOrThrow({ where: { id: id! } })).state
      ).toBe('PUBLISHED');
      expect((await repo.mcpAttempts(org, id!))[0].status).toBe('CONFIRMED');
    }, 60000);

    it('ready-path refresh and PNG conversion keep the approved intent stable while the real child resumes', async () => {
      const sharp = require('sharp');
      const bytes = await sharp({
        create: { width: 1, height: 1, channels: 3, background: 'white' },
      })
        .png()
        .toBuffer();
      writeFileSync(join(fixtureRoot, 'original.png'), bytes);
      writeFileSync(join(fixtureRoot, 'normalized.png'), bytes);
      const media = await db.media.create({
        data: {
          organizationId: org,
          name: 'owned fixture image',
          path: '/original.png',
          status: 'ready',
        },
      });
      let release!: () => void;
      planGate = new Promise<void>((resolve) => {
        release = resolve;
      });
      adapter.denyNextComment = true;
      let id: string;
      try {
        id = await create(2, [{ path: '/original.png' }]);
        await db.media.update({
          where: { id: media.id },
          data: { path: '/normalized.png' },
        });
      } finally {
        release();
        planGate = undefined;
      }
      await waitForRun(id!, 0);
      const intentBefore = (
        await db.post.findUniqueOrThrow({ where: { id: id! } })
      ).image;
      expect(intentBefore).toContain('/original.png');
      const parentAttempt = (await repo.mcpAttempts(org, id!)).find(
        (attempt) => attempt.segmentPostId === id!
      )!;
      expect(parentAttempt.status).toBe('CONFIRMED');
      expect((parentAttempt.providerPayload as any)[0].media[0].url).toMatch(
        /\.jpg$/
      );
      expect(parentAttempt.providerPayloadHash).toMatch(/^[a-f0-9]{64}$/);
      expect(await posts.resumeMcp(org, id!)).toMatchObject({
        status: 'RESUMED',
      });
      await waitForRun(id!, 1);
      expect(
        (await db.post.findUniqueOrThrow({ where: { id: id! } })).image
      ).toBe(intentBefore);
      expect(
        (await posts.mcpThread(org, id!)).map((post) => post.state)
      ).toEqual(['PUBLISHED', 'PUBLISHED']);
      expect(
        adapter
          .events()
          .filter((event) => event.kind === 'ACCEPT' && event.segmentId === id!)
      ).toHaveLength(1);
    }, 60000);
    it('an initial fence fault rolls back QUEUE visibility and a failed start returns saved IDs then recovers from the durable dispatch record', async () => {
      const before = await db.post.count({ where: { organizationId: org } });
      failInitialFence = true;
      await expect(create(1)).rejects.toThrow();
      expect(await db.post.count({ where: { organizationId: org } })).toBe(
        before
      );
      failEnqueue = true;
      let failure: any;
      try { await create(1); } catch (error) { failure = error; }
      expect(failure?.code).toBe('DISPATCH_UNCONFIRMED');
      const id = failure.savedPostIds[0];
      expect(await db.post.findUniqueOrThrow({ where: { id } })).toMatchObject({
        state: 'QUEUE',
        mcpWorkflowVersion: 114,
      });
      expect(await repo.mcpFence(org, id)).toMatchObject({
        state: 'ACTIVE',
        revisionHash: expect.any(String),
      });
      expect(
        adapter
          .events()
          .filter((event) => event.kind === 'ACCEPT' && event.segmentId === id)
      ).toHaveLength(0);
      await db.mcpPublishFence.update({ where: { postId: id }, data: { dispatchNotBefore: new Date(0) } });
      expect(await posts.recoverPendingMcpDispatches()).toMatchObject({ confirmed: 1 });
      await waitForRun(id, 0);
      expect(legacyDispatches).toBe(0);
      expect(
        adapter
          .events()
          .filter((event) => event.kind === 'ACCEPT' && event.segmentId === id)
      ).toHaveLength(1);
    }, 60000);
    for (const overdue of [true, false]) it(`approval crash before registration recovers the final persisted revision (overdue=${overdue})`, async () => {
      const { ApprovalsService } = require('../approvals/approvals.service');
      const policy = (posts as any)._approvalPolicyService;
      const approvals = new ApprovalsService((policy as any)._approvalsRepository, policy, (posts as any)._activityLogService, posts);
      await db.approvalSettings.upsert({ where: { organizationId: org }, create: { organizationId: org, requireAgentApproval: true }, update: { requireAgentApproval: true } });
      const date = new Date(Date.now() + (overdue ? -60000 : 60000)).toISOString();
      const actor: any = { type: 'user', userId: 'fixture-admin', role: 'ADMIN' };
      let id: string | undefined;
      const originalStart = posts.startWorkflow;
      try {
        id = await create(2, [], date);
        const before = await repo.mcpFence(org, id);
        // This fault is BEFORE startWorkflow's registerMcpFence, unlike enqueue failure.
        posts.startWorkflow = async () => { throw new Error('Owned post-transition/pre-registration producer crash.'); };
        await expect(approvals.approve(org, id, actor)).rejects.toThrow('pre-registration');
        posts.startWorkflow = originalStart;
        const thread = await posts.mcpThread(org, id);
        const fence = await repo.mcpFence(org, id);
        expect(fence).toMatchObject({ state: 'ACTIVE', dispatchState: 'PENDING', revisionHash: posts.mcpRevision(thread) });
        if (overdue) expect(fence!.revisionHash).not.toBe(before!.revisionHash);
        else expect(fence!.revisionHash).toBe(before!.revisionHash);
        expect(adapter.events().filter(event => event.kind === 'ACCEPT' && thread.some(row => row.id === event.segmentId))).toHaveLength(0);
        // A fresh stateless dispatcher reconstructs its work from SQL alone.
        const { McpDispatchRecoveryService } = require('./mcp.dispatch.recovery.service');
        await new McpDispatchRecoveryService(posts).tick();
        expect((await repo.mcpFence(org, id))!.dispatchState).toBe('CONFIRMED');
        if (overdue) {
          await waitForRun(id, fence!.generation);
          expect(adapter.events().filter(event => event.kind === 'ACCEPT' && thread.some(row => row.id === event.segmentId))).toHaveLength(2);
        } else {
          expect((await client.workflow.getHandle(`post_${id}_mcp_${fence!.generation}`).describe()).status.name).toBe('RUNNING');
          expect(await posts.unscheduleMcp(org, id)).toMatchObject({ status: 'UNSCHEDULED' });
          await client.workflow.getHandle(`post_${id}_mcp_${fence!.generation}`).terminate('Owned unchanged-date approval fixture complete.');
        }
      } finally {
        posts.startWorkflow = originalStart;
        await db.approvalSettings.update({ where: { organizationId: org }, data: { requireAgentApproval: false } });
      }
    }, 60000);
    it('an accepted execution that completes before a lost start response is reconciled without another run or provider acceptance', async () => {
      loseStartReply = true;
      let failure: any;
      try { await create(1); } catch (error) { failure = error; }
      expect(failure?.code).toBe('DISPATCH_UNCONFIRMED');
      const id = failure.savedPostIds[0];
      await waitForRun(id, 0);
      const completed = await client.workflow.getHandle(`post_${id}_mcp_0`).describe();
      await db.mcpPublishFence.update({ where: { postId: id }, data: { dispatchNotBefore: new Date(0) } });
      expect(await posts.recoverPendingMcpDispatches()).toMatchObject({ confirmed: 1 });
      expect((await client.workflow.getHandle(`post_${id}_mcp_0`).describe()).runId).toBe(completed.runId);
      expect((await client.workflow.getHandle(`post_${id}_mcp_0`).describe()).status.name).toBe('COMPLETED');
      expect(adapter.events().filter(event => event.kind === 'ACCEPT' && event.segmentId === id)).toHaveLength(1);
      expect((await repo.mcpFence(org, id))!.generation).toBe(0);
      expect((await repo.mcpFence(org, id))!.dispatchState).toBe('CONFIRMED');
    }, 60000);
    it('concurrent dispatchers converge on the same real Temporal generation with one provider acceptance', async () => {
      failEnqueue = true;
      let failure: any;
      try { await create(1); } catch (error) { failure = error; }
      expect(failure?.code).toBe('DISPATCH_UNCONFIRMED');
      const id = failure.savedPostIds[0];
      await db.mcpPublishFence.update({ where: { postId: id }, data: { dispatchNotBefore: new Date(0) } });
      await Promise.all([posts.recoverPendingMcpDispatches(), posts.recoverPendingMcpDispatches()]);
      await waitForRun(id, 0);
      expect(adapter.events().filter(event => event.kind === 'ACCEPT' && event.segmentId === id)).toHaveLength(1);
      expect((await repo.mcpFence(org, id))!.generation).toBe(0);
      expect((await repo.mcpFence(org, id))!.dispatchState).toBe('CONFIRMED');
    }, 60000);
    it('future dispatch records recover promptly without waiting for the due-date sweep', async () => {
      failEnqueue = true;
      let failure: any;
      try { await create(1, [], new Date(Date.now() + 60000).toISOString()); } catch (error) { failure = error; }
      expect(failure?.code).toBe('DISPATCH_UNCONFIRMED');
      const id = failure.savedPostIds[0];
      await db.mcpPublishFence.update({ where: { postId: id }, data: { dispatchNotBefore: new Date(0) } });
      expect(await posts.recoverPendingMcpDispatches()).toMatchObject({ confirmed: 1 });
      expect((await client.workflow.getHandle(`post_${id}_mcp_0`).describe()).status.name).toBe('RUNNING');
      expect(await posts.unscheduleMcp(org, id)).toMatchObject({ status: 'UNSCHEDULED' });
      // Retire only this fixture-owned cancelled sleeping execution.
      await client.workflow.getHandle(`post_${id}_mcp_0`).terminate('Fixture cancelled before due date.');
      expect(adapter.events().filter(event => event.kind === 'ACCEPT' && event.segmentId === id)).toHaveLength(0);
    }, 60000);
    it('an unchanged-date edit immediately dispatches the correct new generation while the old real workflow is sleeping', async () => {
      const future = new Date(Date.now() + 5000);
      future.setUTCMilliseconds(0);
      const id = await create(1, [], future.toISOString());
      const handle = client.workflow.getHandle(`post_${id}_mcp_0`);
      let sleeping = false;
      for (let sample = 0; sample < 30; sample++) {
        const history = await handle.fetchHistory();
        if (
          history.events?.some((event) => event.timerStartedEventAttributes)
        ) {
          sleeping = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      expect(sleeping).toBe(true);
      await posts.updatePostInPlace(
        org,
        id,
        { value: [{ content: 'edited under the same schedule date' }] },
        'MCP',
        { type: 'agent', source: 'fixture' }
      );
      const fence = await repo.mcpFence(org, id);
      expect(fence!.generation).toBeGreaterThan(0);
      expect(
        (
          await db.post.findUniqueOrThrow({ where: { id } })
        ).publishDate.getTime()
      ).toBe(future.getTime());
      const current = client.workflow.getHandle(
        `post_${id}_mcp_${fence!.generation}`
      );
      expect((await current.describe()).status.name).toBe('RUNNING');
      await current.result();
      await handle.result();
      const accepted = adapter
        .events()
        .filter((event) => event.kind === 'ACCEPT' && event.segmentId === id);
      expect(accepted).toHaveLength(1);
      const attempt = (await repo.mcpAttempts(org, id)).find(
        (attempt) => attempt.status === 'CONFIRMED'
      )!;
      expect((attempt.providerPayload as any)[0].message).toBe(
        'edited under the same schedule date'
      );
      expect(attempt.generation).toBe(fence!.generation);
    }, 60000);
    it('a definitely unattempted segment recovers after a real policy hold without provider reconciliation or parent replay', async () => {
      let observed!: () => void;
      let release!: () => void;
      const reached = new Promise<void>((resolve) => {
        observed = resolve;
      });
      childGate = {
        observed,
        wait: new Promise<void>((resolve) => {
          release = resolve;
        }),
      };
      let id: string;
      try {
        id = await create(2);
        await reached;
        const other = (
          await db.integration.create({
            data: {
              organizationId: org,
              internalId: randomUUID(),
              name: 'Owned policy fixture',
              providerIdentifier: 'fixture',
              type: 'social',
              token: 'fixture-not-a-real-token',
            },
          })
        ).id;
        await db.approvalSettings.upsert({
          where: { organizationId: org },
          create: { organizationId: org, agentIntegrationIds: [other] },
          update: { agentIntegrationIds: [other] },
        });
      } finally {
        release();
        childGate = undefined;
      }
      await waitForRun(id!, 0);
      const thread = await posts.mcpThread(org, id!);
      expect(thread[1].state).toBe('ERROR');
      expect(
        (await repo.mcpAttempts(org, id!)).filter(
          (attempt) => attempt.segmentPostId === thread[1].id
        )
      ).toHaveLength(0);
      await db.approvalSettings.update({
        where: { organizationId: org },
        data: { agentIntegrationIds: [] },
      });
      const priorReconciliations = adapter
        .events()
        .filter((event) => event.kind === 'RECONCILE').length;
      expect(await posts.resumeMcp(org, id!)).toMatchObject({
        status: 'RESUMED',
      });
      await waitForRun(id!, 1);
      expect(
        adapter.events().filter((event) => event.kind === 'RECONCILE')
      ).toHaveLength(priorReconciliations);
      expect(
        (await posts.mcpThread(org, id!)).map((post) => post.state)
      ).toEqual(['PUBLISHED', 'PUBLISHED']);
      expect(
        adapter
          .events()
          .filter((event) => event.kind === 'ACCEPT' && event.segmentId === id!)
      ).toHaveLength(1);
    }, 60000);
    it('a verified live receipt with a thumbnail follow-up failure remains CONFIRMED/PUBLISHED with a separate warning and no replay', async () => {
      adapter.failFollowupNext = true;
      const id = await create(1);
      await waitForRun(id, 0);
      const attempt = (await repo.mcpAttempts(org, id))[0];
      expect(attempt.status).toBe('CONFIRMED');
      expect(attempt.followUpWarning).toContain('Published successfully');
      expect((await db.post.findUniqueOrThrow({ where: { id } })).state).toBe(
        'PUBLISHED'
      );
      expect(await posts.resumeMcp(org, id)).toMatchObject({
        status: 'ALREADY_PUBLISHED',
        warnings: [{ segmentId: id, message: attempt.followUpWarning }],
      });
      expect(
        adapter
          .events()
          .filter((event) => event.kind === 'ACCEPT' && event.segmentId === id)
      ).toHaveLength(1);
    }, 60000);

    it('the real review tool returns saved IDs but cannot submit a recovered Publisher save over a newer authorized schedule', async () => {
      const {
        IntegrationSchedulePostTool,
      } = require('../../../chat/tools/integration.schedule.post');
      const {
        CreatePostForReviewTool,
      } = require('../../../chat/tools/post.review.tool');
      const { ApprovalsService } = require('../approvals/approvals.service');
      const { runWithContext } = require('../../../chat/async.storage');
      const policy = (posts as any)._approvalPolicyService;
      const approvals = new ApprovalsService(
        (policy as any)._approvalsRepository,
        policy,
        (posts as any)._activityLogService,
        posts
      );
      let saved!: () => void;
      let saveFailed!: (error: unknown) => void;
      let release!: () => void;
      let id!: string;
      const observed = new Promise<void>((resolve, reject) => {
        saved = resolve;
        saveFailed = reject;
      });
      const paused = new Promise<void>((resolve) => {
        release = resolve;
      });
      const delegated = {
        validatePosts: posts.validatePosts.bind(posts),
        withAgentAdmission: posts.withAgentAdmission.bind(posts),
        createPost: async (...args: any[]) => {
          const result = await posts
            .createPost(...args)
            .catch((error: unknown) => {
              saveFailed(error);
              throw error;
            });
          id = result[0].postId;
          saved();
          await paused;
          return result;
        },
      };
      const schedule = new IntegrationSchedulePostTool(
        delegated as any,
        (posts as any)._integrationService,
        policy,
        approvals
      );
      const tool = new CreatePostForReviewTool(schedule).run();
      const values = new Map<string, string>();
      const ctx = {
        requestContext: {
          get: (key: string) => values.get(key),
          set: (key: string, value: string) => values.set(key, value),
        },
      };
      const input = {
        socialPost: [
          {
            integrationId: channel,
            isPremium: false,
            date: new Date(Date.now() + 86400000).toISOString(),
            type: 'draft',
            shortLink: false,
            settings: [],
            postsAndComments: [
              {
                content: 'Recovered Publisher review fixture',
                attachments: [],
              },
            ],
          },
        ],
      };
      const old = runWithContext(
        {
          requestId: 'owned-review-fixture',
          auth: { id: org },
          source: 'fixture Publisher',
          authKind: 'legacy',
        },
        () => (tool as any).execute(input, ctx)
      );
      void old.catch(() => undefined);
      let before: any;
      let fenceBefore: any;
      let notificationsBefore = 0;
      try {
        await observed;
        const admission = await repo.agentAdmissionStatus(org);
        await repo.recoverAgentAdmission(
          org,
          admission!.owner,
          'fixture-admin'
        );
        expect(await posts.resumeMcp(org, id)).toMatchObject({
          status: 'RESUMED',
        });
        before = await db.post.findUniqueOrThrow({ where: { id } });
        fenceBefore = await repo.mcpFence(org, id);
        notificationsBefore = fixtureNotifications.length;
      } finally {
        release();
      }
      const result = await old;
      expect(result.output.errors).toContain(id);
      expect(result.output.errors).toContain('recovered');
      expect(await db.post.findUniqueOrThrow({ where: { id } })).toMatchObject({
        state: before.state,
        approvalStatus: before.approvalStatus,
        updatedAt: before.updatedAt,
      });
      expect(await repo.mcpFence(org, id)).toMatchObject({
        state: fenceBefore.state,
        generation: fenceBefore.generation,
        revisionHash: fenceBefore.revisionHash,
      });
      expect(fixtureNotifications).toHaveLength(notificationsBefore);
      expect(
        await db.activityLog.count({
          where: { organizationId: org, postId: id, action: 'SUBMITTED' },
        })
      ).toBe(0);
      expect(
        adapter
          .events()
          .filter((event) => event.kind === 'ACCEPT' && event.segmentId === id)
      ).toHaveLength(0);
      expect(await posts.unscheduleMcp(org, id)).toMatchObject({
        status: 'UNSCHEDULED',
      });
      await client.workflow
        .getHandle(`post_${id}_mcp_${fenceBefore.generation}`)
        .terminate('Owned future fixture cleanup after fencing.');
    }, 60000);
    it('the independent provider oracle never grants retry for contradictory, duplicated or inconsistent attempt history', async () => {
      const file = join(fixtureRoot, 'oracle-negatives.jsonl');
      writeFileSync(file, '');
      const oracle = new FixtureAdapter(file, org, channel);
      const integration = await db.integration.findUniqueOrThrow({
        where: { id: channel },
      });
      const parent = [
        {
          id: 'oracle-parent',
          message: 'parent',
          settings: {},
          media: [],
          clientReference: { attemptId: randomUUID() },
        },
      ];
      const [parentReceipt] = await oracle.post(
        integration.internalId,
        'fixture',
        parent,
        integration
      );
      const attemptId = randomUUID();
      const payload = [
        {
          id: 'oracle-child',
          message: 'child',
          settings: {},
          media: [],
          clientReference: { attemptId },
        },
      ];
      oracle.denyNextComment = true;
      await expect(
        oracle.comment(
          integration.internalId,
          parentReceipt.postId,
          undefined as any,
          'fixture',
          payload,
          integration
        )
      ).rejects.toThrow();
      await oracle.comment(
        integration.internalId,
        parentReceipt.postId,
        undefined as any,
        'fixture',
        payload,
        integration
      );
      const digest = createHash('sha256')
        .update(JSON.stringify(payload))
        .digest('hex');
      expect(
        await oracle.reconcileMcpAttempt(integration, {
          attemptId,
          segmentId: 'oracle-child',
          payloadHash: digest,
        })
      ).toMatchObject({ terminal: false, outcome: 'UNKNOWN' });
      const duplicateId = randomUUID();
      const duplicate = [
        {
          id: 'duplicate',
          message: 'duplicate',
          settings: {},
          media: [],
          clientReference: { attemptId: duplicateId },
        },
      ];
      await oracle.post(
        integration.internalId,
        'fixture',
        duplicate,
        integration
      );
      await oracle.post(
        integration.internalId,
        'fixture',
        duplicate,
        integration
      );
      expect(
        await oracle.reconcileMcpAttempt(integration, {
          attemptId: duplicateId,
          segmentId: 'duplicate',
          payloadHash: createHash('sha256')
            .update(JSON.stringify(duplicate))
            .digest('hex'),
        })
      ).toMatchObject({ terminal: false, outcome: 'UNKNOWN' });
      expect(
        oracle
          .events()
          .filter(
            (event) =>
              event.kind === 'ACCEPT' && event.attemptId === duplicateId
          )
      ).toHaveLength(2);
      expect(
        await oracle.reconcileMcpAttempt(integration, {
          attemptId,
          segmentId: 'oracle-child',
          payloadHash: 'wrong',
        })
      ).toMatchObject({ terminal: false, outcome: 'UNKNOWN' });
    }, 60000);
  }
);
