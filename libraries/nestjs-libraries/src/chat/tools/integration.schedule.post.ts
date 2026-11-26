import { McpDispatchUnconfirmed } from '../../database/prisma/posts/mcp.dispatch.status';
import { AgentSaveRecovered } from '../../database/prisma/posts/agent-admission.context';
import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import { AllProvidersSettings } from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/all.providers.settings';
import { Integration } from '@prisma/client';
import { checkAuth } from '@gitroom/nestjs-libraries/chat/auth.context';
import { getSource } from '@gitroom/nestjs-libraries/chat/async.storage';
import {
  ApprovalActor,
  ApprovalPolicyService,
} from '@gitroom/nestjs-libraries/database/prisma/approvals/approval.policy.service';
import { ApprovalsService } from '@gitroom/nestjs-libraries/database/prisma/approvals/approvals.service';
import {
  ValidUrlExtension,
  ValidUrlPath,
} from '@gitroom/helpers/utils/valid.url.path';

const validUrlExtension = new ValidUrlExtension();
const validUrlPath = new ValidUrlPath();

// Same URL validation as MediaDto (valid.url.path) - each attachment must
// point to an allowed upload domain and a supported file extension.
const attachmentUrl = z
  .string()
  .refine((url) => validUrlPath.validate(url, {} as any), {
    message: validUrlPath.defaultMessage({} as any),
  })
  .refine((url) => validUrlExtension.validate(url, {} as any), {
    message: validUrlExtension.defaultMessage({} as any),
  });

// Attachments are either a plain URL string or { path, alt?, thumbnail?,
// thumbnailTimestamp? }, the same per-media fields as the public API.
export const postAttachment = z.union([
  attachmentUrl,
  z.object({
    path: attachmentUrl,
    alt: z.string().optional(),
    thumbnail: attachmentUrl.optional(),
    thumbnailTimestamp: z.number().int().min(0).optional(),
  }),
]);

export const toMedia = (
  a:
    | string
    | {
        path: string;
        alt?: string;
        thumbnail?: string;
        thumbnailTimestamp?: number;
      }
) =>
  typeof a === 'string'
    ? { path: a }
    : {
        path: a.path,
        alt: a.alt,
        thumbnail: a.thumbnail,
        thumbnailTimestamp: a.thumbnailTimestamp,
      };

export const schedulePostInputSchema = z.object({
  socialPost: z
    .array(
      z.object({
        integrationId: z
          .string()
          .describe('The id of the integration (not internal id)'),
        isPremium: z
          .boolean()
          .describe("If the integration is X, return if it's premium or not"),
        date: z.string().describe('The date of the post in UTC time'),
        shortLink: z
          .boolean()
          .describe(
            'If the post has a link inside, we can ask the user if they want to add a short link'
          ),
        type: z
          .enum(['draft', 'schedule', 'now'])
          .describe(
            'The type of the post, if we pass now, we should pass the current date also'
          ),
        postsAndComments: z
          .array(
            z.object({
              content: z
                .string()
                .describe(
                  'The content of the post, HTML, Each line must be wrapped in <p> here is the possible tags: h1, h2, h3, u, strong, li, ul, p (you can\'t have u and strong together), img (<img src="...">) only when the integration rules say pictures go inside the content, and span only for a mention in the exact format given by a mention tool from the integrationSchema tools'
                ),
              attachments: z
                .array(postAttachment)
                .describe(
                  'The media of the post: either an uploaded media URL string, or { path, alt?, thumbnail?, thumbnailTimestamp? } where path is the uploaded media URL, alt is its alt text, thumbnail is the path of an uploaded jpeg/png (returned by uploadFromUrlTool) used as the video thumbnail / cover, and thumbnailTimestamp is the video frame to use as the cover, in milliseconds'
                ),
            })
          )
          .describe('first item is the post, every other item is the comments'),
        settings: z
          .array(
            z.object({
              key: z.string().describe('Name of the settings key to pass'),
              value: z
                .any()
                .describe(
                  'Value of the key, always prefer the id then label if possible. When the settings schema says a field is an id, pass the id returned by the channel tools, never the display label'
                ),
            })
          )
          .describe(
            'This relies on the integrationSchema tool to get the settings [input:settings]'
          ),
      })
    )
    .describe('Individual post'),
});

export const schedulePostOutputSchema = z.object({
  output: z
    .array(
      z.object({
        postId: z.string(),
        integration: z.string(),
        previewUrl: z
          .string()
          .describe(
            'Public preview page of the created post, share it with the user'
          ),
        approvalStatus: z
          .string()
          .optional()
          .describe(
            'IN_REVIEW when the post waits for a teammate to approve it before it publishes'
          ),
      })
    )
    .or(z.object({ errors: z.string(), code: z.literal('DISPATCH_UNCONFIRMED').optional(), savedPostIds: z.array(z.string()).optional() })),
});

@Injectable()
export class IntegrationSchedulePostTool implements AgentToolInterface {
  constructor(
    private _postsService: PostsService,
    private _integrationService: IntegrationService,
    private _approvalPolicyService: ApprovalPolicyService,
    private _approvalsService: ApprovalsService
  ) {}
  name = 'integrationSchedulePostTool';

  run() {
    return createTool({
      id: 'schedulePostTool',
      mcp: {
        annotations: {
          title: 'Schedule Social Media Post',
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
          openWorldHint: true,
        },
      },
      description: `
Use this when the user wants to create a draft, scheduled, or immediate social media post on their connected channels, based on the integrationSchema tool.
Examples of the input shape:

A single LinkedIn post with one comment
- socialPost array length will be one
- postsAndComments array length will be two (one for the post, one for the comment)

20 Facebook posts each on individual days without comments
- socialPost array length will be 20
- postsAndComments array length will be one

Do not use this to update or delete existing posts (use postUpdateTool or deletePostTool). When the user wants a teammate to approve the post before it publishes, use createPostForReviewTool instead.
On success, each item in output contains a previewUrl the user can open to see the post.
When an item has approvalStatus "IN_REVIEW", the workspace requires approval for posts made by AI agents: tell the user the post is waiting in PostDelegate's Review inbox and will publish once a teammate approves it. Do not try to schedule it again.
If validation fails, or the workspace limits what agents can do (allowed channels, posts per day), the result contains output.errors describing what to fix; share that message with the user.
`,
      inputSchema: schedulePostInputSchema,
      outputSchema: schedulePostOutputSchema,
      execute: async (inputData, context) => this.schedule(inputData, context),
    });
  }

  // Validates and creates the posts. forReview: they are saved as drafts and
  // sent to the workspace's Review inbox (whatever its approval settings), so
  // nothing publishes until a teammate approves it
  async schedule(
    inputData: any,
    context: any,
    options: { forReview?: boolean; tool?: string } = {}
  ): Promise<{ output: any }> {
    const toolName = options.tool || 'integrationSchedulePostTool';
    // a post for review is checked like a scheduled one: it publishes as is
    // once a teammate approves it
    const checkedType = (type: 'draft' | 'schedule' | 'now') =>
      options.forReview && type === 'draft' ? 'schedule' : type;
    checkAuth(inputData, context);
    const organizationId = JSON.parse(
      (context?.requestContext as any)?.get('organization') as string
    ).id;
    return this._postsService.withAgentAdmission(organizationId, () => this.scheduleAdmitted(inputData, context, options, organizationId));
  }

  private async scheduleAdmitted(inputData: any, context: any, options: { forReview?: boolean; tool?: string }, organizationId: string): Promise<{ output: any }> {
    const toolName = options.tool || 'integrationSchedulePostTool';
    const checkedType = (type: 'draft' | 'schedule' | 'now') => options.forReview && type === 'draft' ? 'schedule' : type;
    const finalOutput = [];
    // the in-app agent runs with ui on, MCP clients carry their own name
    const actor: ApprovalActor = {
      type: 'agent',
      source:
        (context?.requestContext as any)?.get('ui') === 'true'
          ? 'PostDelegate agent'
          : getSource() || 'MCP client',
    };

    const integrations = {} as Record<string, Integration>;
    for (const platform of inputData.socialPost) {
      integrations[platform.integrationId] =
        await this._integrationService.getIntegrationById(
          organizationId,
          platform.integrationId
        );

      // Same server-side validation as the dashboard / public API
      // (settings DTO + media checkValidity + empty / too-long content).
      let settings = {
        ...platform.settings.reduce(
          (acc: AllProvidersSettings, s: { key: string; value: any }) => ({
            ...acc,
            [s.key]: s.value,
          }),
          {} as AllProvidersSettings
        ),
        // always the channel's network, never a passed key
        __type: integrations[platform.integrationId]?.providerIdentifier,
      } as AllProvidersSettings;

      // settings only the composer can take (TikTok Direct Post) are refused
      // or replaced here too; createPost applies the same rule when it saves
      try {
        [{ settings }] = await this._postsService.applyOutsideComposerRules(
          organizationId,
          [{ integration: { id: platform.integrationId }, settings }]
        );
      } catch (err) {
        if (err instanceof BadRequestException) {
          return { output: { errors: err.message } };
        }
        throw err;
      }

      const [validation] = await this._postsService.validatePosts(
        organizationId,
        [
          {
            integration: { id: platform.integrationId },
            date: platform.date,
            settings,
            value: platform.postsAndComments.map((p: any) => ({
              content: p.content,
              image: (p.attachments || []).map(toMedia),
            })),
          },
        ],
        checkedType(platform.type)
      );

      if (validation.emptyContent) {
        return {
          output: {
            errors: `${validation.name}: Your post should have at least one character or one image.`,
          },
        };
      }

      // a turned off channel would only fail at publish, a draft never
      // publishes from here
      if (validation.disabled && checkedType(platform.type) !== 'draft') {
        return {
          output: {
            errors: `${validation.name} is turned off. Turn it on from the channel menu in the PostDelegate calendar, or pick another channel.`,
          },
        };
      }

      if (checkedType(platform.type) !== 'draft') {
        if (!validation.valid) {
          return {
            output: {
              errors: `${validation.name}: ${
                validation.settingsError || 'Please fix your settings'
              }, please fix it, and try ${toolName} again.`,
            },
          };
        }

        if (validation.errors !== true) {
          return {
            output: {
              errors: `${validation.name}: ${validation.errors}, please fix it, and try ${toolName} again.`,
            },
          };
        }

        if (validation.tooLong) {
          return {
            output: {
              errors: `${validation.name}: The maximum characters is ${validation.maximumCharacters}, please fix it, and try ${toolName} again.`,
            },
          };
        }
      }
    }

    // the workspace limits for agents apply to the whole request, so a
    // batch is never half created
    try {
      await this._approvalPolicyService.assertAgentGuardrails(
        organizationId,
        actor,
        inputData.socialPost.map((p: any) => p.integrationId)
      );
    } catch (err) {
      if (err instanceof BadRequestException) {
        return { output: { errors: err.message } };
      }
      throw err;
    }

    for (const post of inputData.socialPost) {
      const integration = integrations[post.integrationId];

      if (!integration) {
        throw new Error('Integration not found');
      }

      const body = {
        date: post.date,
        // held as a draft until approved, see submitAsAgent below
        type: (options.forReview ? 'draft' : post.type) as
          | 'draft'
          | 'schedule'
          | 'now',
        shortLink: post.shortLink,
        tags: [] as { value: string; label: string }[],
        posts: [
          {
            integration,
            group: makeId(10),
            settings: {
              ...post.settings.reduce(
                (acc: AllProvidersSettings, s: { key: string; value: any }) => ({
                  ...acc,
                  [s.key]: s.value,
                }),
                {} as AllProvidersSettings
              ),
              // always the channel's network, never a passed key: createPost
              // picks the provider (and its rules) from it
              __type: integration.providerIdentifier,
            } as AllProvidersSettings,
            value: post.postsAndComments.map((p: any) => ({
              content: p.content,
              id: makeId(10),
              delay: 0,
              image: p.attachments.map((a: any) => ({
                id: makeId(10),
                ...toMedia(a),
              })),
            })),
          },
        ],
      };

      let output: Awaited<ReturnType<PostsService['createPost']>>;
      try {
        output = await this._postsService.createPost(
          organizationId,
          body as any,
          'MCP',
          false,
          actor,
          ...((options.forReview ? [undefined, 'review'] : []) as [undefined?, 'review'?])
        );
      } catch (err) {
        if (err instanceof McpDispatchUnconfirmed) return { output: { errors: err.message, code: err.code, savedPostIds: [...new Set([...finalOutput.map(post => post.postId), ...err.savedPostIds])] } };
        // a plan limit (402) carries the message written for the customer
        if (
          err instanceof BadRequestException ||
          (err instanceof HttpException && err.getStatus() === 402)
        ) {
          return { output: { errors: err.message + (finalOutput.length ? ` Already created post IDs (do not recreate): ${finalOutput.map(p => p.postId).join(', ')}. Remaining channels were not created.` : '') } };
        }
        throw err;
      }
      if (options.forReview) {
        for (const [index, created] of output.entries()) {
          try {
            await this._approvalsService.submitAsAgent(
              organizationId,
              created.postId,
              actor as Extract<ApprovalActor, { type: 'agent' }>
            );
          } catch (err) {
            if (err instanceof AgentSaveRecovered) {
              const createdIds = [...finalOutput.map(p => p.postId), ...output.map(p => p.postId)];
              return { output: { errors: `This save was recovered; its remaining review submission was stopped. Already created IDs (do not recreate): ${createdIds.join(', ')}. Inspect their current state before continuing; another authorized action may have changed it.` } };
            }
            // the posts so far exist: say which, so the client does not
            // create them again
            if (!(err instanceof HttpException)) {
              console.error(
                'Sending a post for review failed',
                (err as Error)?.message
              );
            }
            const inReview = [
              ...finalOutput.map((p) => p.postId),
              ...output.slice(0, index).map((p) => p.postId),
            ];
            const drafts = output.slice(index).map((p) => p.postId);
            return {
              output: {
                errors: `${
                  err instanceof HttpException
                    ? err.message
                    : 'Sending the post for review failed.'
                } Already created, do not create them again: in review: ${
                  inReview.join(', ') || 'none'
                }; saved as drafts, not sent for review: ${drafts.join(
                  ', '
                )}. The rest of this request was not created. Send each draft with sendPostForReviewTool once the problem is fixed.`,
              },
            };
          }
          created.approvalStatus = 'IN_REVIEW';
        }
      }
      // Same public preview page the calendar "Preview Post" button opens.
      finalOutput.push(
        ...output.map((p) => ({
          ...p,
          previewUrl: `${process.env.FRONTEND_URL}/p/${p.postId}?share=true`,
        }))
      );
    }

    return {
      output: finalOutput,
    };
  }
}
