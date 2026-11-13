import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { HttpException, Injectable } from '@nestjs/common';
import { checkAuth } from '@gitroom/nestjs-libraries/chat/auth.context';
import { AnalyticsService } from '@gitroom/nestjs-libraries/database/prisma/analytics/analytics.service';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import { ioRedis } from '@gitroom/nestjs-libraries/redis/redis.service';

// the organization the MCP connection (or the dashboard chat) acts for
const organizationOf = (inputData: unknown, context: any) => {
  checkAuth(inputData, context);
  return JSON.parse(
    (context?.requestContext as any)?.get('organization') as string
  );
};

// the ranges the Analytics page offers
const days = z
  .union([z.literal(7), z.literal(30), z.literal(90)])
  .default(30)
  .describe('How many days back to look: 7, 30 or 90 (default 30)');

const readOnly = (title: string, openWorldHint = false) => ({
  annotations: {
    title,
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint,
  },
});

const errorsOf = (err: unknown) => {
  if (err instanceof HttpException) {
    return { output: { errors: err.message } };
  }
  throw err;
};

@Injectable()
export class AnalyticsMetricsTool implements AgentToolInterface {
  constructor(private _analyticsService: AnalyticsService) {}
  name = 'analyticsMetricsTool';
  optionalOnSelfHosted = true;

  run() {
    return createTool({
      id: 'analyticsMetricsTool',
      mcp: readOnly('Get Analytics Metrics'),
      description: `
Use this to answer "how are my socials doing": the workspace's key metrics over the last 7, 30 or 90 days compared with the period before - followers, published posts, engagement (likes + comments + shares) and views - plus the daily follower count of every channel.
Optionally narrow the follower trend to one channel with integrationId (from integrationList).
"collecting" is false when the history is not kept for this workspace or network; values the networks don't report are null, never guessed.
`,
      inputSchema: z.object({
        days,
        integrationId: z
          .string()
          .optional()
          .describe('Optional channel id to narrow the follower trend to'),
      }),
      outputSchema: z.object({
        output: z
          .any()
          .describe(
            '{ collecting, from, to, comparison: [{ key: followers|published|engagement|views, current, previous, change (percent) }], followers: { dates, total, channels: [{ id, name, identifier, points, current, gained }] } }'
          ),
      }),
      execute: async (inputData, context) => {
        const org = organizationOf(inputData, context);
        try {
          return {
            output: await this._analyticsService.getTrends(
              org.id,
              inputData.days || 30,
              inputData.integrationId
            ),
          };
        } catch (err) {
          return errorsOf(err);
        }
      },
    });
  }
}

@Injectable()
export class AnalyticsTopPostsTool implements AgentToolInterface {
  constructor(private _analyticsService: AnalyticsService) {}
  name = 'analyticsTopPostsTool';
  optionalOnSelfHosted = true;

  run() {
    return createTool({
      id: 'analyticsTopPostsTool',
      mcp: readOnly('Get Top Posts'),
      description: `
Use this to find the best (or worst) performing published posts of the last 7, 30 or 90 days, with their views, likes, comments, shares, clicks, engagement and engagement rate, as reported by each network.
Sort by engagement (default), views, likes, comments, shares or date, and optionally limit it to some channels (ids from integrationList).
`,
      inputSchema: z.object({
        days,
        sort: z
          .enum(['engagement', 'views', 'likes', 'comments', 'shares', 'date'])
          .optional()
          .describe('What to rank the posts by, default engagement'),
        order: z.enum(['asc', 'desc']).optional().describe('Default desc'),
        integrationIds: z
          .array(z.string())
          .optional()
          .describe('Optional channel ids to limit the posts to'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe('How many posts to return, 1-50 (default 10)'),
      }),
      outputSchema: z.object({
        output: z
          .any()
          .describe(
            '{ channels, posts: [{ postId, channel, title, url, publishedAt, views, likes, comments, shares, clicks, engagement, engagementRate }] }'
          ),
      }),
      execute: async (inputData, context) => {
        const org = organizationOf(inputData, context);
        try {
          return {
            output: await this._analyticsService.getTopPosts(
              org.id,
              inputData.days || 30,
              {
                sort: inputData.sort,
                order: inputData.order,
                integrations: inputData.integrationIds,
                limit: inputData.limit || 10,
              }
            ),
          };
        } catch (err) {
          return errorsOf(err);
        }
      },
    });
  }
}

@Injectable()
export class BestTimeToPostTool implements AgentToolInterface {
  constructor(private _analyticsService: AnalyticsService) {}
  name = 'bestTimeToPostTool';
  optionalOnSelfHosted = true;

  run() {
    return createTool({
      id: 'bestTimeToPostTool',
      mcp: readOnly('Get Best Time to Post'),
      description: `
Use this before scheduling when the user asks when to post: the best weekdays and hours to publish, worked out from the engagement of the workspace's own published posts (each post compared with the typical post of its channel).
Narrow it to one network with "platform" (for example linkedin, x, instagram, facebook, tiktok, threads, bluesky) or to some channels with integrationIds, and pass the user's IANA timezone so the hours are local.
weekday 0 is Sunday. "basis" is "engagement" once there are at least "required" posts with engagement data, otherwise the suggestion is based on how many posts went out at each time and is weaker; say so to the user. Empty lists mean there is not enough history yet.
`,
      inputSchema: z.object({
        days: z
          .union([z.literal(7), z.literal(30), z.literal(90)])
          .default(90)
          .describe('How many days of history to use: 7, 30 or 90 (default 90)'),
        timezone: z
          .string()
          .optional()
          .describe('IANA timezone for the hours, for example Asia/Dubai (default UTC)'),
        platform: z
          .string()
          .optional()
          .describe('Optional network, for example linkedin or instagram'),
        integrationIds: z
          .array(z.string())
          .optional()
          .describe('Optional channel ids from integrationList'),
      }),
      outputSchema: z.object({
        output: z
          .any()
          .describe(
            '{ timezone, basis, posts, required, bestDays: [{ weekday, score, posts }], bestHours: [{ hour, score, posts }], heatmap[weekday][hour], counts[weekday][hour] }'
          ),
      }),
      execute: async (inputData, context) => {
        const org = organizationOf(inputData, context);
        let timezone = 'UTC';
        if (inputData.timezone) {
          try {
            new Intl.DateTimeFormat('en-US', { timeZone: inputData.timezone });
            timezone = inputData.timezone;
          } catch (err) {
            return {
              output: {
                errors: `Unknown timezone "${inputData.timezone}", use an IANA name such as Europe/London`,
              },
            };
          }
        }
        try {
          return {
            output: await this._analyticsService.getBestTimes(
              org.id,
              inputData.days || 90,
              timezone,
              new Date(),
              {
                provider: inputData.platform,
                integrationIds: inputData.integrationIds,
              }
            ),
          };
        } catch (err) {
          return errorsOf(err);
        }
      },
    });
  }
}

// Live reads per workspace and hour: each one can call the network's API and
// refresh the channel's token. Redis is the only state; when it is
// unavailable the reads keep working (fail open), as in LoginLockoutService
export const CHANNEL_ANALYTICS_HOURLY_LIMIT = 60;
const CHANNEL_ANALYTICS_WINDOW_SECONDS = 60 * 60;

@Injectable()
export class ChannelAnalyticsTool implements AgentToolInterface {
  constructor(
    private _integrationService: IntegrationService,
    private _postsService: PostsService
  ) {}
  name = 'channelAnalyticsTool';
  optionalOnSelfHosted = true;
  // replaced in tests
  public redis = ioRedis;

  private async overLimit(orgId: string) {
    try {
      const key = `mcp-channel-analytics:${orgId}`;
      const count = await this.redis.incr(key);
      if (count === 1) {
        await this.redis.expire(key, CHANNEL_ANALYTICS_WINDOW_SECONDS);
      }
      return count > CHANNEL_ANALYTICS_HOURLY_LIMIT;
    } catch (err) {
      console.error(
        'Channel analytics limit check failed',
        (err as Error).message
      );
      return false;
    }
  }

  run() {
    return createTool({
      id: 'channelAnalyticsTool',
      mcp: readOnly('Get Channel or Post Analytics', true),
      description: `
Use this for the metrics the network itself reports, read live: for a channel (integrationId from integrationList) such as followers, impressions, reach, views, likes or page views, depending on what that network offers; or for one published post (postId from postsListTool) such as its likes, comments, shares and views.
Each metric comes back as { label, data: [{ total, date }], percentageChange }. An empty list means the network gives no analytics for this channel or post (or it is not connected); say so instead of guessing numbers.
`,
      inputSchema: z.object({
        integrationId: z
          .string()
          .optional()
          .describe('Channel id, for the channel metrics'),
        postId: z
          .string()
          .optional()
          .describe('Published post id, for the metrics of that post'),
        days,
      }),
      outputSchema: z.object({
        output: z
          .any()
          .describe('[{ label, data: [{ total, date }], percentageChange }]'),
      }),
      execute: async (inputData, context) => {
        const org = organizationOf(inputData, context);
        if (!inputData.integrationId === !inputData.postId) {
          return {
            output: { errors: 'Pass either integrationId or postId' },
          };
        }
        if (await this.overLimit(org.id)) {
          return {
            output: {
              errors: `This workspace reached ${CHANNEL_ANALYTICS_HOURLY_LIMIT} live analytics reads in the last hour. Try again later, or use analyticsMetricsTool or analyticsTopPostsTool, which read the stored history.`,
            },
          };
        }
        try {
          if (inputData.postId) {
            const result = await this._postsService.checkPostAnalytics(
              org.id,
              inputData.postId,
              inputData.days || 30
            );
            return { output: Array.isArray(result) ? result : [] };
          }
          return {
            // 'soft': an expired token is refreshed, a failure only leaves
            // this answer empty, the channel is never flagged or disconnected
            output: await this._integrationService.checkAnalytics(
              org,
              inputData.integrationId!,
              String(inputData.days || 30),
              false,
              'soft'
            ),
          };
        } catch (err) {
          return errorsOf(err);
        }
      },
    });
  }
}
