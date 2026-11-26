// Dedicated QA image entrypoint; deliberately NEVER imports apps/backend/src/main.
import {
  loadRun,
  access,
  installHttpBoundary,
  fixtureAllowsRequest,
} from './guard';
import { installCatalog, QaFixtureSettings } from './catalog';

export async function startQa() {
  const c = loadRun(),
    a = access(c);
  // Explicit QA-image dependency gate before importing any application module.
  let Test: any;
  try {
    const testingVersion = require('@nestjs/testing/package.json').version;
    const nestVersion = require('@nestjs/core/package.json').version;
    if (testingVersion !== nestVersion) throw new Error('Version mismatch');
    Test = require('@nestjs/testing').Test;
  } catch {
    throw new Error(
      'QA image must contain matching @nestjs/testing and @nestjs/core from frozen lockfile.'
    );
  }
  process.env.JWT_SECRET = a.jwtSecret;
  installHttpBoundary(c);
  const catalog = installCatalog(c, a);
  const { Runtime, NativeConnection, Worker } = require('@temporalio/worker');
  Runtime.install({ shutdownSignals: [] });
  const { AppModule } = require('@gitroom/backend/app.module');
  const {
    PostActivity,
  } = require('@gitroom/orchestrator/activities/post.activity');
  const {
    PrismaService,
  } = require('@gitroom/nestjs-libraries/database/prisma/prisma.service');
  const {
    PostsService,
  } = require('@gitroom/nestjs-libraries/database/prisma/posts/posts.service');
  const {
    IntegrationService,
  } = require('@gitroom/nestjs-libraries/database/prisma/integrations/integration.service');
  const {
    PostPreflightTool,
  } = require('@gitroom/nestjs-libraries/chat/tools/post.preflight.tool');
  const {
    EmailService,
  } = require('@gitroom/nestjs-libraries/services/email.service');
  const { TemporalService } = require('nestjs-temporal-core');
  const { ValidationPipe } = require('@nestjs/common');
  const manager = new catalog.IntegrationManager();
  const sendMail = async (to: string) => {
    if (!a.accounts.some((account) => account.email === to))
      throw new Error('Unknown fixture recipient denied.');
    const response = await fetch(c.sinkOrigin + '/mail', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${a.sinkToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ runId: c.runId, to }),
    });
    if (!response.ok) throw new Error('Internal email sink unavailable.');
  };
  const module = await Test.createTestingModule({
    imports: [AppModule],
    providers: [PostActivity],
  })
    .setLogger({
      log() {},
      error() {},
      warn() {},
      debug() {},
      verbose() {},
      fatal() {},
    })
    .overrideProvider(catalog.IntegrationManager)
    .useValue(manager)
    .overrideProvider(EmailService)
    .useValue({
      hasProvider: () => true,
      sendEmail: sendMail,
      sendEmailSync: sendMail,
      emailService: {
        name: 'qa-internal',
        validateEnvKeys: [],
        sendEmail: sendMail,
      },
    })
    .compile();
  const app = module.createNestApplication({
    rawBody: true,
    logger: false,
    cors: {
      credentials: true,
      origin: [c.origin],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'auth',
        'showorg',
        'impersonate',
        'x-postiz-org',
        'x-postiz-include-deleted',
        'x-copilotkit-runtime-client-gql-version',
      ],
      exposedHeaders: [
        'reload',
        'onboarding',
        'activate',
        'x-copilotkit-runtime-client-gql-version',
      ],
    },
  });
  // No fixture control route. Limit the REAL controllers to the intended QA surface.
  app.use((req: any, res: any, next: any) => {
    const allowed = fixtureAllowsRequest(req.method, req.path);
    if (!allowed || (req.headers.origin && req.headers.origin !== c.origin))
      return res.status(403).json({ message: 'Outside fixture surface' });
    next();
  });
  await require('@gitroom/nestjs-libraries/chat/start.mcp').startMcp(app);
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  const { json } = require('express');
  app.use(['/copilot/{*splat}', '/posts'], (req: any, res: any, next: any) =>
    json({ limit: '50mb' })(req, res, next)
  );
  app.use('/posts-bulk-videos', (req: any, res: any, next: any) =>
    json({ limit: '4mb' })(req, res, next)
  );
  app.use(
    ['/posts-import', '/public/v1/posts'],
    (req: any, res: any, next: any) => json({ limit: '2mb' })(req, res, next)
  );
  app.use(require('cookie-parser')());
  app.use(require('compression')());
  app.useGlobalFilters(
    new (require('@gitroom/backend/services/auth/permissions/subscription.exception').SubscriptionExceptionFilter)()
  );
  app.useGlobalFilters(
    new (require('@gitroom/backend/api/routes/posts.validation.exception').PostValidationExceptionFilter)()
  );
  app.useGlobalFilters(
    new (require('@gitroom/nestjs-libraries/services/exception.filter').HttpExceptionFilter)()
  );
  await app.init();
  const db = app.get(PrismaService);
  const orgs = await db.organization.findMany({ select: { id: true } });
  const channels = await db.integration.findMany({
    select: { id: true, organizationId: true, providerIdentifier: true },
  });
  if (
    orgs.length !== 2 ||
    orgs.some((o: any) => !c.tenants.some((t) => t.orgId === o.id)) ||
    channels.length !== 2 ||
    channels.some(
      (i: any) =>
        i.providerIdentifier !== 'fixture' ||
        !c.tenants.some(
          (t) => t.orgId === i.organizationId && t.channelId === i.id
        )
    )
  )
    throw new Error('Unexpected fixture database identity.');
  const users = await db.user.findMany({
    select: {
      id: true,
      providerName: true,
      activated: true,
      isSuperAdmin: true,
    },
  });
  const memberships = await db.userOrganization.findMany({
    select: { userId: true, organizationId: true, role: true },
  });
  if (
    users.length !== 4 ||
    users.some(
      (u: any) =>
        !a.accounts.some((x) => x.userId === u.id) ||
        u.providerName !== 'LOCAL' ||
        !u.activated ||
        u.isSuperAdmin
    ) ||
    memberships.length !== 4 ||
    memberships.some(
      (m: any) =>
        !c.tenants.some(
          (t) =>
            t.orgId === m.organizationId &&
            ((t.adminId === m.userId && m.role === 'ADMIN') ||
              (t.memberId === m.userId && m.role === 'USER'))
        )
    )
  )
    throw new Error('Unexpected fixture user/membership identity.');
  const activity = app.get(PostActivity),
    posts = app.get(PostsService);
  for (const service of [posts, app.get(IntegrationService), activity])
    if (service._integrationManager !== manager)
      throw new Error('Fixture manager injection identity mismatch.');
  if (
    app.get(PostPreflightTool).posts !== posts ||
    manager.getSocialIntegration('fixture') !==
      catalog.socialIntegrationList[0] ||
    catalog.provider.dto !== QaFixtureSettings ||
    require('@gitroom/nestjs-libraries/integrations/integration.manager')
      .socialIntegrationList !== catalog.socialIntegrationList
  )
    throw new Error(
      'Catalog/preflight/reconciliation/worker identity mismatch.'
    );
  const schema =
    require('@gitroom/nestjs-libraries/chat/validation.schemas.helper').getValidationSchemas()[
      QaFixtureSettings.name
    ];
  if (
    !schema?.properties?.__type ||
    !JSON.stringify(schema).includes('fixture')
  )
    throw new Error('Fixture DTO metadata missing.');
  const redis =
    require('@gitroom/nestjs-libraries/redis/redis.service').ioRedis;
  if (typeof redis.ping !== 'function' || (await redis.ping()) !== 'PONG')
    throw new Error('Real dedicated Redis required.');
  const temporal = app.get(TemporalService).client.getRawClient();
  if (temporal.options.namespace !== c.namespace)
    throw new Error('Wrong Temporal namespace.');
  const connection = await NativeConnection.connect({
    address: c.temporalAddress,
  });
  const workers = await Promise.all([
    Worker.create({
      connection,
      namespace: c.namespace,
      taskQueue: 'mcp-publish-v114',
      workflowsPath: require.resolve(
        '../../../apps/orchestrator/src/workflows/post-workflows/post.workflow.v1.1.4'
      ),
      maxConcurrentActivityTaskExecutions: 1,
      activities: {
        mcpThreadPlan: activity.mcpThreadPlan.bind(activity),
        mcpFailSegment: activity.mcpFailSegment.bind(activity),
      },
    }),
    Worker.create({
      connection,
      namespace: c.namespace,
      taskQueue: 'mcp-v114-fixture',
      maxConcurrentActivityTaskExecutions: 1,
      activities: {
        mcpPublishSegment: activity.mcpPublishSegment.bind(activity),
      },
    }),
  ]);
  const running = workers.map((worker) => worker.run());
  await app.listen(3000, '0.0.0.0');
  const server = app.getHttpServer();
  server.keepAliveTimeout = 905000;
  server.headersTimeout = 906000;
  let stopping = false;
  const close = async () => {
    if (stopping) return;
    stopping = true;
    workers.forEach((w) => w.shutdown());
    await Promise.allSettled(running);
    await connection.close();
    await app.close();
    await redis.quit();
  };
  process.once('SIGTERM', () => void close());
  process.once('SIGINT', () => void close());
  running.forEach((promise) =>
    promise.catch(() => {
      process.stderr.write('QA worker stopped; fixture cannot continue.\n');
      void close();
      process.exitCode = 1;
    })
  );
  process.stdout.write(
    JSON.stringify({
      ready: 'authenticated-qa',
      runId: c.runId,
      sourceSha: c.sourceSha,
      tenants: 2,
      channels: 2,
      provider: 'fixture',
      schema: QaFixtureSettings.name,
    }) + '\n'
  );
  return { app, close }; // no secrets/credential-response observer exposed
}
if (require.main === module)
  void startQa().catch(() => {
    process.stderr.write('Authenticated QA bootstrap refused startup.\n');
    process.exit(1);
  });
