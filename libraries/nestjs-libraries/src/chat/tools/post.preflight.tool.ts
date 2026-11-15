import { Injectable } from '@nestjs/common';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { AgentToolInterface } from '../agent.tool.interface';
import { checkAuth } from '../auth.context';
import { PostsService } from '../../database/prisma/posts/posts.service';
import { schedulePostInputSchema, toMedia } from './integration.schedule.post';

@Injectable()
export class PostPreflightTool implements AgentToolInterface {
  constructor(private readonly posts: PostsService) {}
  name = 'postPreflightTool';
  optionalOnSelfHosted = true;
  run() {
    return createTool({
      id: this.name,
      description: 'Check proposed channel posts without saving, minting short links, refreshing credentials, importing media or publishing. Same input as integrationSchedulePostTool. Each check is VALID, INVALID or UNKNOWN and bound to input/config hashes and checkedAt. UNKNOWN is not ready; this snapshot is not authorization. Pending short links have no invented length bound. Saving validates materialized text again.',
      mcp: { annotations: { title: 'Check Proposed Posts', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } },
      inputSchema: schedulePostInputSchema,
      outputSchema: z.object({ output: z.array(z.any()) }),
      execute: async (input, context) => {
        checkAuth(input, context);
        const orgId = JSON.parse((context?.requestContext as any)?.get('organization')).id;
        const output = [];
        for (const channel of input.socialPost) {
          output.push(...await this.posts.preflightPosts(orgId, [{
            integration: { id: channel.integrationId }, date: channel.date,
            settings: Object.fromEntries(channel.settings.map(s => [s.key, s.value])),
            value: channel.postsAndComments.map(p => ({ content: p.content, image: p.attachments.map(toMedia) })),
          }], channel.type, channel.date, channel.shortLink));
        }
        return { output };
      },
    });
  }
}
