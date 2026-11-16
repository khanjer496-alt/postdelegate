import { TemporalModule } from 'nestjs-temporal-core';
import { socialIntegrationList } from '@gitroom/nestjs-libraries/integrations/integration.manager';
import { providerActivityOptions } from './provider.activity.slots';
import { emailQueues } from '@gitroom/nestjs-libraries/temporal/email.queues';

export const getTemporalModule = (
  isWorkers: boolean,
  path?: string,
  activityClasses?: any[]
) => {
  // Queues this worker server should NOT run, comma-separated
  // (e.g. EXCLUDE_QUEUE="reddit,x,twitch"). Use it to pin a queue to a single
  // server: exclude it on every server except the one that should own it.
  // Meant for the providers whose concurrency is too low to split (limit 1).
  const excludeQueues = (process.env.EXCLUDE_QUEUE || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // How many worker servers share each (non-excluded) queue. Per-server
  // allocation is divided by this ONCE and shared across both queues. RE must
  // verify the number of eligible processes/pinning; this is not membership discovery.
  // 1 server => 1 (full), 2 servers => 2 (half each), 3 servers => 3, etc.
  const divider = process.env.WORKER_CONCURRENCY_DIVIDER ? Number(process.env.WORKER_CONCURRENCY_DIVIDER) : 1;
  const providerWorkers = isWorkers ? socialIntegrationList
    .filter(provider => !provider.identifier.includes('-') && !excludeQueues.includes(provider.identifier))
    .flatMap(provider => {
      // Allocate this process's provider share ONCE, not once per queue.
      const capacity = providerActivityOptions(provider.identifier, provider.maxConcurrentJob, divider);
      return [
        ...(!excludeQueues.includes(`mcp-v114-${provider.identifier}`) ? [{
          taskQueue: `mcp-v114-${provider.identifier}`, activityClasses: activityClasses!, autoStart: true,
          workerOptions: { ...capacity },
        }] : []),
        {
          taskQueue: provider.identifier, activityClasses: activityClasses!, autoStart: true,
          workerOptions: { ...capacity, maxHeartbeatThrottleInterval: '15s' as const },
        },
      ];
    }) : [];

  return TemporalModule.register({
    isGlobal: true,
    connection: {
      address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
      ...(process.env.TEMPORAL_TLS === 'true' ? { tls: true } : {}),
      ...(process.env.TEMPORAL_API_KEY
        ? { apiKey: process.env.TEMPORAL_API_KEY }
        : {}),
      namespace: process.env.TEMPORAL_NAMESPACE || 'default',
    },
    taskQueue: 'main',
    logLevel: 'error',
    ...(isWorkers
      ? {
          workers: [
            ...(excludeQueues.includes('mcp-publish-v114') ? [] : [{
              taskQueue: 'mcp-publish-v114', workflowsPath: path!, activityClasses: activityClasses!, autoStart: true,
              workerOptions: { maxConcurrentActivityTaskExecutions: 4 },
            }]),
            ...providerWorkers,
            ...(!excludeQueues.includes('main') ? [{
              taskQueue: 'main', workflowsPath: path!, activityClasses: activityClasses!, autoStart: true,
              workerOptions: { maxConcurrentActivityTaskExecutions: 1000000, maxHeartbeatThrottleInterval: '15s' as const },
            }] : []),
            // Activity-only Workers for emails, rate limited server side
            // across all workers to stay under the Resend limit
            ...Object.values(emailQueues)
              .filter(({ taskQueue }) => !excludeQueues.includes(taskQueue))
              .map(({ taskQueue, perSecond }) => ({
                taskQueue,
                activityClasses: activityClasses!,
                autoStart: true,
                workerOptions: {
                  maxConcurrentActivityTaskExecutions: 10,
                  maxTaskQueueActivitiesPerSecond: perSecond,
                },
              })),
            // Activity-only Worker for Studio renders. Each render is one
            // ffmpeg on 2 threads, so this is how many cores renders may take
            // on this server. EXCLUDE_QUEUE=studio moves rendering to another
            // container started from the same image
            ...(excludeQueues.includes('studio')
              ? []
              : [
                  {
                    taskQueue: 'studio',
                    activityClasses: activityClasses!,
                    autoStart: true,
                    workerOptions: {
                      maxConcurrentActivityTaskExecutions: Math.max(
                        1,
                        Number(process.env.STUDIO_RENDER_CONCURRENCY) || 1
                      ),
                      maxHeartbeatThrottleInterval: '15s',
                    },
                  },
                ]),
          ],
        }
      : {}),
  });
};
