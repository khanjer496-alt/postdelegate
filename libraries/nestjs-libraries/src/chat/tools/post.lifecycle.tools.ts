import { Injectable } from '@nestjs/common';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { AgentToolInterface } from '../agent.tool.interface';
import { checkAuth } from '../auth.context';
import { PostsService } from '../../database/prisma/posts/posts.service';

@Injectable()
export class PostUnscheduleTool implements AgentToolInterface {
  constructor(private readonly posts: PostsService) {}
  name = 'postUnscheduleTool';
  optionalOnSelfHosted = true;
  run() {
    return createTool({
      id: this.name,
      description: 'Reversibly unschedule a new MCP job using its shared worker fence. Preserve draft content and durable attempt history. Legacy/unreconciled/in-flight attempts return BLOCKED or OUTCOME_UNKNOWN, never cancellation success. Does not delete a social post. Publisher permission required.',
      mcp: { annotations: { title: 'Unschedule Post', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false } },
      inputSchema: z.object({ postId: z.string() }), outputSchema: z.object({ output: z.any() }),
      execute: async (input, context) => { checkAuth(input, context); const org = JSON.parse((context?.requestContext as any)?.get('organization')).id; return { output: await this.posts.unscheduleMcp(org, input.postId) }; },
    });
  }
}

@Injectable()
export class PostResumeTool implements AgentToolInterface {
  constructor(private readonly posts: PostsService) {}
  name = 'postResumeTool';
  optionalOnSelfHosted = true;
  run() {
    return createTool({
      id: this.name,
      description: 'Recover a tracked MCP job without resending confirmed published segments. Current review/channel policy applies. Retry requires adapter-confirmed terminal unpublished outcome; absent receipts, legacy ERROR, timeout or unsupported reconciliation returns BLOCKED/OUTCOME_UNKNOWN. No provider currently promises universal reconciliation. Publisher permission required.',
      mcp: { annotations: { title: 'Resume Confirmed Unpublished Segments', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true } },
      inputSchema: z.object({ postId: z.string() }), outputSchema: z.object({ output: z.any() }),
      execute: async (input, context) => { checkAuth(input, context); const org = JSON.parse((context?.requestContext as any)?.get('organization')).id; return { output: await this.posts.resumeMcp(org, input.postId) }; },
    });
  }
}
