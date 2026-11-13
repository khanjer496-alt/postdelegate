import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import {
  BadRequestException,
  HttpException,
  Injectable,
} from '@nestjs/common';
import { checkAuth } from '@gitroom/nestjs-libraries/chat/auth.context';
import { getSource } from '@gitroom/nestjs-libraries/chat/async.storage';
import {
  IntegrationSchedulePostTool,
  schedulePostInputSchema,
  schedulePostOutputSchema,
} from '@gitroom/nestjs-libraries/chat/tools/integration.schedule.post';
import { ApprovalsService } from '@gitroom/nestjs-libraries/database/prisma/approvals/approvals.service';

// the in-app agent runs with ui on, MCP clients carry their own name
const agentSource = (context: any) =>
  (context?.requestContext as any)?.get('ui') === 'true'
    ? 'PostDelegate agent'
    : getSource() || 'MCP client';

@Injectable()
export class CreatePostForReviewTool implements AgentToolInterface {
  constructor(private _schedulePostTool: IntegrationSchedulePostTool) {}
  name = 'createPostForReviewTool';
  // older self-hosted instances don't have it, they still connect
  optionalOnSelfHosted = true;

  run() {
    return createTool({
      id: 'createPostForReviewTool',
      mcp: {
        annotations: {
          title: 'Create Post for Review',
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      description: `
Use this when the user wants a post created for approval instead of published: it is saved with its date and sent to PostDelegate's Review inbox, and it only publishes once a teammate approves it. Nothing is posted to the social network by this tool.
Same input as the schedule post tool (get the channel rules and settings with the integrationSchema tool first). The "type" of each item is ignored: the post is checked like a scheduled post and kept as a draft until approved. If the date has passed when it is approved, it publishes right away.
On success, each item has approvalStatus "IN_REVIEW" and a previewUrl the user (or their client) can open to see the post.
If validation fails, or the workspace limits what agents can do (allowed channels, posts per day), the result contains output.errors; share that message with the user.
`,
      inputSchema: schedulePostInputSchema,
      outputSchema: schedulePostOutputSchema,
      execute: async (inputData, context) =>
        this._schedulePostTool.schedule(inputData, context, {
          forReview: true,
          tool: 'createPostForReviewTool',
        }),
    });
  }
}

@Injectable()
export class SendPostForReviewTool implements AgentToolInterface {
  constructor(private _approvalsService: ApprovalsService) {}
  name = 'sendPostForReviewTool';
  optionalOnSelfHosted = true;

  run() {
    return createTool({
      id: 'sendPostForReviewTool',
      mcp: {
        annotations: {
          title: 'Send Post for Review',
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      description: `
Use this when the user wants an existing post that was not published yet (a draft or a scheduled post) to be approved by a teammate before it goes out.
The post moves to PostDelegate's Review inbox: a scheduled post stops and is kept as a draft until it is approved, then publishes at its date (right away if the date has passed). The workspace approvers are notified.
Find the post id with postsListTool first and pass the id of the main post (not a comment). AI agents can send posts for review but never approve them.
Returns the post id and approvalStatus "IN_REVIEW"; "submitted" is false when it was already waiting for review. On failure, output.errors says why (already published, being published right now, not found, or a channel agents can't use).
`,
      inputSchema: z.object({
        postId: z
          .string()
          .describe('The id of the main post, from postsListTool'),
      }),
      outputSchema: z.object({
        output: z
          .object({
            postId: z.string(),
            approvalStatus: z.string(),
            state: z.string(),
            submitted: z
              .boolean()
              .describe('false when the post was already waiting for review'),
          })
          .or(z.object({ errors: z.string() })),
      }),
      execute: async (inputData, context) => {
        checkAuth(inputData, context);
        const organizationId = JSON.parse(
          (context?.requestContext as any)?.get('organization') as string
        ).id;

        try {
          const result = await this._approvalsService.submitAsAgent(
            organizationId,
            inputData.postId,
            { type: 'agent', source: agentSource(context) }
          );
          return {
            output: {
              postId: result.id,
              approvalStatus: result.approvalStatus,
              state: result.state,
              submitted: result.submitted,
            },
          };
        } catch (err) {
          if (err instanceof BadRequestException || err instanceof HttpException) {
            return { output: { errors: err.message } };
          }
          throw err;
        }
      },
    });
  }
}
