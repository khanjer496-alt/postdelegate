import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { HttpException, Injectable } from '@nestjs/common';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import { checkAuth } from '@gitroom/nestjs-libraries/chat/auth.context';
import { getSource } from '@gitroom/nestjs-libraries/chat/async.storage';
import { postAttachment, toMedia } from '@gitroom/nestjs-libraries/chat/tools/integration.schedule.post';

@Injectable()
export class PostUpdateTool implements AgentToolInterface {
  constructor(private _postsService: PostsService) {}
  name = 'postUpdateTool';
  // older self-hosted instances don't have it, they still connect
  optionalOnSelfHosted = true;

  run() {
    return createTool({
      id: 'postUpdateTool',
      mcp: {
        annotations: {
          title: 'Update Post',
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      description: `
Use this to edit a post that was not published yet (a scheduled post or a draft): its text, its media, its publish date and its settings, in place (it keeps its id, it is not duplicated).
First find the post with postsListTool, and pass the id of the main post. Only pass what changes:
- "postsAndComments": the new text and media, one item per entry the post has now (the main post first, then each comment, in order). Leave out "content" or "attachments" of an item to keep it as it is. Same content format as the schedule post tool.
- "date": the new publish date in UTC (must be in the future for a scheduled post).
- "settings": provider settings keys to change (get them with the integrationSchema tool), merged into the current ones.
A post waiting for review, or approved, goes back to review when the workspace requires approval for AI agents. Published posts can't be edited here.
Show the user which post and what will change, and get their confirmation first.
On failure, output.errors says what to fix.
`,
      inputSchema: z.object({
        id: z.string().describe('The id of the main post, from postsListTool'),
        date: z
          .string()
          .optional()
          .describe('New publish date in UTC, for example 2026-12-01T09:30:00'),
        postsAndComments: z
          .array(
            z.object({
              content: z
                .string()
                .optional()
                .describe(
                  'New HTML content, each line wrapped in <p>; leave out to keep the current text'
                ),
              attachments: z
                .array(postAttachment)
                .optional()
                .describe(
                  'The full new media list of this entry (uploaded media URLs or { path, alt?, thumbnail?, thumbnailTimestamp? }); pass [] to remove the media, leave out to keep it'
                ),
            })
          )
          .optional()
          .describe(
            'One item per entry of the post (main post, then its comments), in order'
          ),
        settings: z
          .array(
            z.object({
              key: z.string().describe('Name of the settings key to change'),
              value: z.any().describe('New value of the key'),
            })
          )
          .optional()
          .describe(
            'Settings keys to change, merged into the existing settings [input:settings]'
          ),
      }),
      outputSchema: z.object({
        output: z
          .object({
            postId: z.string(),
            publishDate: z.string(),
            previewUrl: z.string(),
          })
          .or(z.object({ errors: z.string() })),
      }),
      execute: async (inputData, context) => {
        checkAuth(inputData, context);
        const organizationId = JSON.parse(
          (context?.requestContext as any)?.get('organization') as string
        ).id;

        if (
          !inputData.date &&
          !inputData.postsAndComments &&
          !inputData.settings?.length
        ) {
          return {
            output: {
              errors:
                'Nothing to change: pass a new date, postsAndComments or settings',
            },
          };
        }

        const settings = inputData.settings?.length
          ? inputData.settings.reduce(
              (acc: Record<string, any>, s: { key: string; value: any }) => ({
                ...acc,
                [s.key]: s.value,
              }),
              {} as Record<string, any>
            )
          : undefined;

        try {
          const output = await this._postsService.updatePostInPlace(
            organizationId,
            inputData.id,
            {
              settings,
              date: inputData.date,
              value: inputData.postsAndComments?.map((p: any) => ({
                content: p.content,
                image: p.attachments?.map(toMedia),
              })),
            },
            'MCP',
            {
              type: 'agent',
              source:
                (context?.requestContext as any)?.get('ui') === 'true'
                  ? 'PostDelegate agent'
                  : getSource() || 'MCP client',
            }
          );

          return {
            output: {
              ...output,
              previewUrl: `${process.env.FRONTEND_URL}/p/${output.postId}?share=true`,
            },
          };
        } catch (err: any) {
          if (err instanceof HttpException) {
            return { output: { errors: err.message } };
          }
          throw err;
        }
      },
    });
  }
}
