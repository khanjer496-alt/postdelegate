import { McpDispatchUnconfirmed } from './mcp.dispatch.status';
import { getContext } from '../../../chat/async.storage';
import { hostname } from 'os';
import { readFile } from 'fs/promises';
import { agentAdmissionContext as agentAdmission, AgentSaveRecovered } from './agent-admission.context';
import { createHash } from 'crypto';
import { assertAgentPostWrite, agentDraftOnly } from '../../../chat/agent-credential.policy';
import {
  BadRequestException,
  HttpException,
  ServiceUnavailableException,
  Injectable,
  Logger,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { PostsRepository, mcpPayloadRevision } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.repository';
import { CreatePostDto } from '@gitroom/nestjs-libraries/dtos/posts/create.post.dto';
import dayjs from 'dayjs';
import { IntegrationManager } from '@gitroom/nestjs-libraries/integrations/integration.manager';
import {
  Integration,
  Post,
  Media,
  From,
  CreationMethod,
  State,
} from '@prisma/client';
import { GetPostsDto } from '@gitroom/nestjs-libraries/dtos/posts/get.posts.dto';
import { GetPostsListDto } from '@gitroom/nestjs-libraries/dtos/posts/get.posts.list.dto';
import { groupBy, shuffle, uniqBy } from 'lodash';
import { v4 as uuidv4 } from 'uuid';
import { CreateGeneratedPostsDto } from '@gitroom/nestjs-libraries/dtos/generator/create.generated.posts.dto';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import utc from 'dayjs/plugin/utc';
import { MediaService } from '@gitroom/nestjs-libraries/database/prisma/media/media.service';
import { ShortLinkService } from '@gitroom/nestjs-libraries/short-linking/short.link.service';
import { CreateTagDto } from '@gitroom/nestjs-libraries/dtos/posts/create.tag.dto';
import {
  minifyPostsList,
  minifyPosts,
} from '@gitroom/helpers/utils/posts.list.minify';
import { getSsrfSafeAxios } from '@gitroom/nestjs-libraries/dtos/webhooks/ssrf.safe.dispatcher';
import { isSafePublicHttpsUrl } from '@gitroom/nestjs-libraries/dtos/webhooks/webhook.url.validator';
import sharp from 'sharp';
import { UploadFactory } from '@gitroom/nestjs-libraries/upload/upload.factory';
import { Readable } from 'stream';
import { resolve, sep } from 'path';
import { OpenaiService } from '@gitroom/nestjs-libraries/openai/openai.service';
dayjs.extend(utc);
import * as Sentry from '@sentry/nestjs';
import { TemporalService } from 'nestjs-temporal-core';
import { TypedSearchAttributes } from '@temporalio/common';
import {
  organizationId,
  postId as postIdSearchParam,
} from '@gitroom/nestjs-libraries/temporal/temporal.search.attribute';
import { AnalyticsData } from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import { timer } from '@gitroom/helpers/utils/timer';
import { ioRedis } from '@gitroom/nestjs-libraries/redis/redis.service';
import { BadBody, providerCause, RefreshToken } from '@gitroom/nestjs-libraries/integrations/social.abstract';
import { RefreshIntegrationService } from '@gitroom/nestjs-libraries/integrations/refresh.integration.service';
import { hasExtension } from '@gitroom/helpers/utils/has.extension';
import { stripLinks } from '@gitroom/helpers/utils/strip.links';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { stripHtmlValidation } from '@gitroom/helpers/utils/strip.html.validation';
import { postContentPlainText } from '@gitroom/helpers/utils/sanitize.post.content';
import { CreatePublicCommentDto } from '@gitroom/nestjs-libraries/dtos/comments/add.comment.dto';
import { countLength } from '@gitroom/helpers/utils/count.length';
import {
  ApprovalActor,
  ApprovalDecision,
  ApprovalPolicyService,
  actorName,
  isBeingPublished,
} from '@gitroom/nestjs-libraries/database/prisma/approvals/approval.policy.service';
import { ActivityLogService } from '@gitroom/nestjs-libraries/database/prisma/activity-log/activity.log.service';
import {
  planMonth,
  SubscriptionService,
} from '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.service';
import {
  isCappedProvider,
  pricing,
  TRIAL_POSTS_CAP_TIER,
} from '@gitroom/nestjs-libraries/database/prisma/subscriptions/pricing';
import { PaymentService } from '@gitroom/nestjs-libraries/services/payment/payment.service';
import { curatedPostError } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.curated.error';
import {
  isChannelConnected,
  isChannelReady,
} from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.state';
import {
  AuthorizationActions,
  Sections,
  SubscriptionException,
} from '@gitroom/backend/services/auth/permissions/permission.exception.class';
import {
  OrgScope,
  PUBLIC_PREVIEW,
} from '@gitroom/nestjs-libraries/database/prisma/posts/posts.repository';

const agentInstanceId = uuidv4();

type PostWithConditionals = Post & {
  integration?: Integration;
  childrenPost: Post[];
};

@Injectable()
export class PostsService {
  private readonly _logger = new Logger(PostsService.name);
  private storage = UploadFactory.createStorage();
  constructor(
    private _postRepository: PostsRepository,
    private _integrationManager: IntegrationManager,
    private _integrationService: IntegrationService,
    private _mediaService: MediaService,
    private _shortLinkService: ShortLinkService,
    private _openaiService: OpenaiService,
    private _temporalService: TemporalService,
    private _refreshIntegrationService: RefreshIntegrationService,
    private _approvalPolicyService: ApprovalPolicyService,
    private _activityLogService: ActivityLogService,
    private _subscriptionService: SubscriptionService,
    private _paymentService: PaymentService
  ) {}

  searchForMissingThreeHoursPosts() {
    return this._postRepository.searchForMissingThreeHoursPosts();
  }

  async updatePost(id: string, postId: string, releaseURL: string) {
    const updated = await this._postRepository.updatePost(
      id,
      postId,
      releaseURL
    );
    // comments are skipped there, only the main post is in the history
    await this._activityLogService.recordPublished(id);
    return updated;
  }

  updateResolvedRelease(
    id: string,
    orgId: string,
    releaseId: string,
    releaseURL: string,
    expectedIntegrationId?: string
  ) {
    return this._postRepository.updateResolvedRelease(
      id,
      orgId,
      releaseId,
      releaseURL,
      expectedIntegrationId
    );
  }

  async getMissingContent(
    orgId: string,
    postId: string,
    forceRefresh = false
  ): Promise<{ id: string; url: string }[]> {
    const post = await this._postRepository.getPostById(postId, orgId);
    if (!post || post.releaseId !== 'missing') {
      return [];
    }

    const integrationProvider = this._integrationManager.getSocialIntegration(
      post.integration.providerIdentifier
    );

    if (!integrationProvider.missing) {
      return [];
    }

    const getIntegration = post.integration!;

    if (
      dayjs(getIntegration?.tokenExpiration).isBefore(dayjs()) ||
      forceRefresh
    ) {
      const data = await this._refreshIntegrationService.refresh(
        getIntegration
      );
      if (!data) {
        return [];
      }

      const { accessToken } = data;

      if (accessToken) {
        getIntegration.token = accessToken;

        if (integrationProvider.refreshWait) {
          await timer(10000);
        }
      } else {
        await this._integrationService.disconnectChannel(orgId, getIntegration);
        return [];
      }
    }

    try {
      return await integrationProvider.missing(
        getIntegration.internalId,
        getIntegration.token
      );
    } catch (e) {
      console.log(e);
      if (e instanceof RefreshToken) {
        return this.getMissingContent(orgId, postId, true);
      }
    }

    return [];
  }

  async getPostById(postId: string, orgId: string) {
    return this._postRepository.getPostById(postId, orgId);
  }

  async getPostTimeline(postId: string, orgId: string) {
    return this._postRepository.getPostTimeline(postId, orgId);
  }

  async updateReleaseId(orgId: string, postId: string, releaseId: string) {
    const post = await this._postRepository.getPostById(postId, orgId);
    if (!post || post.deletedAt || !post.integration || !isChannelConnected(post.integration)) {
      throw new BadRequestException('Post is no longer available.');
    }

    // the URL is a bonus: connecting must not fail when it cannot be fetched
    let releaseURL: string | undefined;
    if (post?.releaseId === 'missing') {
      try {
        releaseURL = await this._integrationManager
          .getSocialIntegration(post.integration.providerIdentifier)
          .releaseUrl?.(
            post.integration.token,
            String(releaseId),
            post.integration
          );
      } catch (e) {
        console.log(e);
      }
    }

    return this._postRepository.updateReleaseId(
      postId,
      orgId,
      releaseId,
      releaseURL,
      post.integration.id
    );
  }

  async resolveRelease(
    orgId: string,
    post: {
      id: string;
      releaseId: string;
      releaseURL: string;
      settings: string;
      integration: Integration;
    }
  ) {
    const integrationProvider = this._integrationManager.getSocialIntegration(
      post.integration.providerIdentifier
    );

    const resolved = await integrationProvider.resolveReleaseId?.(
      post.integration.token,
      post.releaseId,
      post.integration,
      JSON.parse(post.settings || '{}'),
      post.releaseURL
    );
    if (
      !resolved ||
      !('postId' in resolved) ||
      resolved.postId === post.releaseId
    ) {
      return {
        releaseId: post.releaseId,
        releaseURL: post.releaseURL,
        pending: !!resolved && 'pending' in resolved,
        unavailable: !!resolved && 'unavailable' in resolved,
      };
    }

    await this._postRepository.updateResolvedRelease(
      post.id,
      orgId,
      resolved.postId,
      resolved.releaseURL,
      post.integration.id
    );
    return {
      releaseId: resolved.postId,
      releaseURL: resolved.releaseURL,
      pending: false,
      unavailable: false,
    };
  }

  private async canReturnProviderData(
    orgId: string,
    postId: string,
    expectedIntegration: Integration
  ): Promise<boolean> {
    const current = await this._postRepository.getPostById(postId, orgId);
    return !!current && !current.deletedAt &&
      current.integrationId === expectedIntegration.id &&
      !!current.integration && isChannelReady(current.integration) &&
      current.integration.token === expectedIntegration.token;
  }

  async getReleaseURL(
    orgId: string,
    postId: string,
    forceRefresh = false
  ): Promise<{
    releaseURL: string;
    pending?: boolean;
    unavailable?: boolean;
    reconnect?: boolean;
  }> {
    const post = await this._postRepository.getPostById(postId, orgId);
    if (!post || !post.releaseURL) {
      return { releaseURL: '' };
    }
    if (post.deletedAt || !post.integration || !isChannelConnected(post.integration)) {
      return { releaseURL: '', unavailable: true };
    }

    const integrationProvider = this._integrationManager.getSocialIntegration(
      post.integration.providerIdentifier
    );

    if (!integrationProvider.resolveReleaseId) {
      return { releaseURL: post.releaseURL };
    }

    const getIntegration = post.integration!;

    // only refreshed once the platform rejects the token, so a post that is
    // already resolved never reaches the platform
    if (forceRefresh) {
      const data = await this._refreshIntegrationService.refresh(
        getIntegration
      );
      if (!data) {
        return { releaseURL: post.releaseURL, reconnect: true };
      }

      const { accessToken } = data;

      if (accessToken) {
        getIntegration.token = accessToken;

        if (integrationProvider.refreshWait) {
          await timer(10000);
        }
      } else {
        await this._integrationService.disconnectChannel(orgId, getIntegration);
        return { releaseURL: post.releaseURL, reconnect: true };
      }
    }

    try {
      if (integrationProvider.authorizationPolicy && !await this.canReturnProviderData(orgId, postId, getIntegration)) {
        return { releaseURL: '', unavailable: true };
      }
      const { releaseURL, pending, unavailable } = await this.resolveRelease(
        orgId,
        post
      );
      if (integrationProvider.authorizationPolicy && !await this.canReturnProviderData(orgId, postId, getIntegration)) {
        return { releaseURL: '', unavailable: true };
      }
      return { releaseURL, pending, unavailable };
    } catch (e) {
      console.log(e);
      if (e instanceof RefreshToken && !forceRefresh) {
        return this.getReleaseURL(orgId, postId, true);
      }
    }

    if (integrationProvider.authorizationPolicy && !await this.canReturnProviderData(orgId, postId, getIntegration)) {
      return { releaseURL: '', unavailable: true };
    }
    return { releaseURL: post.releaseURL, pending: true };
  }

  async checkPostAnalytics(
    orgId: string,
    postId: string,
    date: number,
    forceRefresh = false
  ): Promise<AnalyticsData[] | { missing: true }> {
    const post = await this._postRepository.getPostById(postId, orgId);
    if (!post || !post.releaseId) {
      return [];
    }
    if (post.deletedAt || !post.integration || !isChannelConnected(post.integration)) {
      return [];
    }

    if (post.releaseId === 'missing') {
      return { missing: true };
    }

    const integrationProvider = this._integrationManager.getSocialIntegration(
      post.integration.providerIdentifier
    );

    if (!integrationProvider.postAnalytics) {
      return [];
    }

    const getIntegration = post.integration!;

    if (
      dayjs(getIntegration?.tokenExpiration).isBefore(dayjs()) ||
      forceRefresh
    ) {
      const data = await this._refreshIntegrationService.refresh(
        getIntegration
      );
      if (!data) {
        return [];
      }

      const { accessToken } = data;

      if (accessToken) {
        getIntegration.token = accessToken;

        if (integrationProvider.refreshWait) {
          await timer(10000);
        }
      } else {
        await this._integrationService.disconnectChannel(orgId, getIntegration);
        return [];
      }
    }

    try {
      if (integrationProvider.authorizationPolicy && !await this.canReturnProviderData(orgId, postId, getIntegration)) {
        return [];
      }
      const { releaseId } = await this.resolveRelease(orgId, post);
      if (integrationProvider.authorizationPolicy && !await this.canReturnProviderData(orgId, postId, getIntegration)) {
        return [];
      }

      if (integrationProvider.analyticsAvailable === false) return [];
      const loadAnalytics = await integrationProvider.postAnalytics(
        getIntegration.internalId,
        getIntegration.token,
        releaseId,
        date
      );
      if (integrationProvider.authorizationPolicy && !await this.canReturnProviderData(orgId, postId, getIntegration)) {
        return [];
      }
      if (!integrationProvider.authorizationPolicy?.bypassAnalyticsCache) {
        await ioRedis.set(
          `integration:${orgId}:${post.id}:${date}`,
          JSON.stringify(loadAnalytics),
          'EX',
          !process.env.NODE_ENV || process.env.NODE_ENV === 'development'
            ? 1
            : 3600
        );
      }
      return loadAnalytics;
    } catch (e) {
      // Retry once with a refreshed token
      if (e instanceof RefreshToken && !forceRefresh) {
        return this.checkPostAnalytics(orgId, postId, date, true);
      }
      console.log(e);
    }

    return [];
  }

  async getStatistics(orgId: string, id: string) {
    const getPost = await this.getPostsRecursively(id, true, orgId, true);
    const content = getPost.map((p) => p.content);
    const shortLinksTracking = await this._shortLinkService.getStatistics(
      content
    );

    return {
      clicks: shortLinksTracking,
    };
  }

  async mapTypeToPost(
    body: CreatePostDto,
    organization: string,
    replaceDraft: boolean = false,
    validationOperation?: CreatePostDto['type']
  ): Promise<CreatePostDto> {
    if (!body?.posts?.every((p) => p?.integration?.id)) {
      throw new BadRequestException('All posts must have an integration id');
    }

    const mappedType = replaceDraft ? 'schedule' : body?.type;
    const operation = validationOperation ?? mappedType;
    const mappedValues = {
      ...body,
      type: mappedType,
      posts: await Promise.all(
        body?.posts?.map(async (post) => {
          const integration = await this._integrationService.getIntegrationById(
            organization,
            post.integration.id
          );

          if (!integration) {
            throw new BadRequestException(
              `Integration with id ${post.integration.id} not found`
            );
          }

          return {
            ...post,
            // Actual saves execute one operation for the whole request. Child
            // hints are only used by the separate validation-preview endpoint.
            type: mappedType,
            settings: {
              ...(post.settings || ({} as any)),
              __type: integration.providerIdentifier,
              __validationOperation: operation,
              __validationDate: post.date || body?.date,
            },
          };
        }) || []
      ),
    };

    const validationPipe = new ValidationPipe({
      skipMissingProperties: false,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    });

    const validated = await validationPipe.transform(mappedValues, {
      type: 'body',
      metatype: CreatePostDto,
    });
    // The trusted operation and date are validation context, never stored
    // post settings.
    for (const post of validated.posts) {
      delete (post.settings as any).__validationOperation;
      delete (post.settings as any).__validationDate;
    }
    return validated;
  }

  async getPostsRecursively(
    id: string,
    includeIntegration = false,
    orgId: OrgScope,
    isFirst?: boolean
  ): Promise<PostWithConditionals[]> {
    const post = await this._postRepository.getPost(
      id,
      includeIntegration,
      orgId,
      isFirst
    );

    if (!post) {
      return [];
    }

    return [
      post!,
      ...(post?.childrenPost?.length
        ? await this.getPostsRecursively(
            post?.childrenPost?.[0]?.id,
            false,
            orgId,
            false
          )
        : []),
    ];
  }

  async getPosts(orgId: string, query: GetPostsDto) {
    return this._postRepository.getPosts(orgId, query);
  }

  // the calendar gets a label per published post instead of its settings
  async getPostsMinified(orgId: string, query: GetPostsDto) {
    return minifyPosts({
      posts: this.firstMediaOnly(
        await this._postRepository.getPosts(orgId, query, true)
      ).map(({ settings, ...post }) => {
        const publishedLabel = this.publishedLabel(post, settings);
        return publishedLabel ? { ...post, publishedLabel } : post;
      }),
    });
  }

  // a provider can name the published state for some settings, like media
  // that was only sent to an inbox
  private publishedLabel(
    post: { state: State; integration?: { providerIdentifier: string } },
    settings?: string | null
  ) {
    if (post.state !== State.PUBLISHED || !post.integration) {
      return undefined;
    }
    const provider = this._integrationManager.getSocialIntegration(
      post.integration.providerIdentifier
    );
    if (!provider?.publishedLabel) {
      return undefined;
    }
    try {
      return provider.publishedLabel(JSON.parse(settings || '{}') || {});
    } catch (err) {
      return undefined;
    }
  }

  // The link to the published post for the shared preview page, which anyone
  // with the link opens without logging in, or nothing when there is no URL we
  // can vouch for. Only a provider that declares the release URL it stored to
  // be a public permalink gets one, so a release URL that is really an inbox,
  // a self-hosted admin page or a workspace-internal link is never handed out.
  // This is the whole gate, the URL check included, so no caller can reach the
  // stored URL through a half-checked answer. Deliberately works off the post
  // row the caller already read: no provider call and no token refresh on an
  // unauthenticated request.
  async publicPostLink(post: {
    state: State;
    deletedAt?: Date | null;
    releaseURL?: string | null;
    settings?: string | null;
    integration?: {
      providerIdentifier: string;
      deletedAt?: Date | null;
      disabled?: boolean | null;
      inBetweenSteps?: boolean | null;
      refreshNeeded?: boolean | null;
    } | null;
  }): Promise<string | undefined> {
    if (
      post.state !== State.PUBLISHED ||
      post.deletedAt ||
      !post.releaseURL ||
      !post.integration
    ) {
      return undefined;
    }

    // the same channel states that keep getReleaseURL from handing back
    // provider data, plus refreshNeeded: a channel that lost its grant is
    // never spoken for on a public page
    if (!isChannelReady(post.integration)) {
      return undefined;
    }

    const provider = this._integrationManager.getSocialIntegration(
      post.integration.providerIdentifier
    );
    if (!provider?.isPublicReleaseURL) {
      return undefined;
    }

    // a provider under an authorizationPolicy may only show platform data to
    // the authorized user, so its posts get no link on an anonymous page
    if (provider.authorizationPolicy) {
      return undefined;
    }

    // providers that publish to several targets at once comma-join the URLs,
    // the calendar links the first one too
    const url = post.releaseURL.split(',')[0]?.trim();
    if (!url) {
      return undefined;
    }

    let settings: any;
    try {
      settings = JSON.parse(post.settings || '{}');
    } catch (err) {
      return undefined;
    }

    // a provider reads its own fields off these settings, and every miss reads
    // as "not set", so anything that is not an object would open the guards
    // that keep a community or story post private
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      return undefined;
    }

    try {
      if (!provider.isPublicReleaseURL(url, settings)) {
        return undefined;
      }
    } catch (err) {
      return undefined;
    }

    // the release URL is tenant data however well the provider vouches for it,
    // so it leaves only as a public HTTPS URL that resolves off our own
    // network, never as something that could turn a trusted-looking page into
    // a redirect to an internal host
    return (await isSafePublicHttpsUrl(url)) ? url : undefined;
  }

  async getPostsList(orgId: string, query: GetPostsListDto) {
    const list = await this._postRepository.getPostsList(orgId, query);
    return minifyPostsList({
      ...list,
      posts: this.firstMediaOnly(list.posts),
    });
  }

  // the calendar preview shows only the first picture, the rest stays out of
  // the response
  private firstMediaOnly<T extends { image?: string | null }>(posts: T[]) {
    return posts.map((post) => {
      let first: { path?: string; thumbnail?: string } | undefined;
      try {
        first = JSON.parse(post.image || '[]')?.[0];
      } catch (err) {
        first = undefined;
      }

      return {
        ...post,
        image: first?.path
          ? JSON.stringify([{ path: first.path, thumbnail: first.thumbnail }])
          : null,
      };
    });
  }

  async updateMedia(
    id: string,
    orgId: string,
    imagesList: any[],
    convertToJPEG = false,
    persistImages = true
  ) {
    try {
      let imageUpdateNeeded = false;
      const getImageList = await Promise.all(
        (
          await Promise.all(
            (imagesList || []).map(async (p: any) => {
              if (!p.id) {
                return p;
              }

              if (!p.path) {
                imageUpdateNeeded = true;
                return this._mediaService.getOrgMediaById(orgId, p.id);
              }

              // the normalizer may have replaced the file after the post was
              // composed; a record still processing publishes the original
              const fresh = await this._mediaService.getOrgMediaById(
                orgId,
                p.id
              );
              if (fresh?.status === 'ready' && fresh.path !== p.path) {
                imageUpdateNeeded = true;
                return { ...p, name: fresh.name, path: fresh.path };
              }

              return p;
            })
          )
        )
          .filter((m) => m && this.isAllowedMediaPath(m.path))
          .map((m) => {
            return {
              ...m,
              url:
                m.path.indexOf('http') === -1
                  ? process.env.FRONTEND_URL +
                    '/' +
                    process.env.NEXT_PUBLIC_UPLOAD_STATIC_DIRECTORY +
                    m.path
                  : m.path,
              type: 'image',
              path:
                m.path.indexOf('http') === -1
                  ? process.env.UPLOAD_DIRECTORY + m.path
                  : m.path,
            };
          })
          .map(async (m) => {
            if (!convertToJPEG) {
              return m;
            }

            if (hasExtension(m.path, 'png')) {
              imageUpdateNeeded = true;
              // the media url is user-influenced, so it goes through the same
              // SSRF-safe client as the providers' media reads
              // New immutable preparation can read an already validated local
              // upload directly. Remote assets retain the SSRF-safe transport.
              const imageBuffer = !persistImages && !/^https?:\/\//.test(m.path)
                ? await readFile(m.path)
                : Buffer.from((await getSsrfSafeAxios().get(m.url, { responseType: 'arraybuffer' })).data);

              // Use sharp to get the metadata of the image
              const buffer = await sharp(imageBuffer)
                .jpeg({ quality: 100 })
                .toBuffer();

              const { path, originalname } = await this.storage.uploadFile({
                buffer,
                mimetype: 'image/jpeg',
                size: buffer.length,
                path: '',
                fieldname: '',
                destination: '',
                stream: new Readable(),
                filename: '',
                originalname: '',
                encoding: '',
              });

              return {
                ...m,
                name: originalname,
                url:
                  path.indexOf('http') === -1
                    ? process.env.FRONTEND_URL +
                      '/' +
                      process.env.NEXT_PUBLIC_UPLOAD_STATIC_DIRECTORY +
                      path
                    : path,
                type: 'image',
                path:
                  path.indexOf('http') === -1
                    ? process.env.UPLOAD_DIRECTORY + path
                    : path,
              };
            }

            return m;
          })
      );

      if (imageUpdateNeeded && persistImages) {
        await this._postRepository.updateImages(
          id,
          JSON.stringify(getImageList)
        );
      }

      return getImageList;
    } catch (err: any) {
      if (!persistImages) throw new BadRequestException('Media preparation failed; no provider payload was sent.');
      return (imagesList || []).filter((m) =>
        this.isAllowedMediaPath(m?.path)
      );
    }
  }

  // a media path that isn't a remote url is read straight from the worker's
  // disk, so it has to resolve inside UPLOAD_DIRECTORY
  private isAllowedMediaPath(path: unknown) {
    if (typeof path !== 'string' || /^https?:\/\//.test(path)) {
      return true;
    }

    // containing "http" anywhere skips the UPLOAD_DIRECTORY prefix, and the
    // providers would then read it relative to the working directory
    if (path.indexOf('http') > -1) {
      return false;
    }

    const base = resolve(String(process.env.UPLOAD_DIRECTORY));
    const filePath = resolve(process.env.UPLOAD_DIRECTORY + path);
    return filePath.startsWith(base + sep);
  }

  async getPostGroupDebugExport(orgId: string, group: string) {
    const loadAll = await this._postRepository.getPostsByGroup(orgId, group);
    const errors = await this._postRepository.getErrorsByPostIds(
      loadAll.map((p) => p.id)
    );
    const posts = this.arrangePostsByGroup(loadAll, undefined);
    const rootPost = posts[0] as any;

    return {
      type: 'draft' as const,
      shortLink: false,
      date: rootPost.publishDate.toISOString(),
      tags:
        rootPost.tags?.map((t: any) => ({
          value: t.tag.id,
          label: t.tag.name,
        })) || [],
      posts: [
        {
          integration: { id: 'REPLACE_WITH_LOCAL_INTEGRATION_ID' },
          group: rootPost.group,
          settings: JSON.parse(rootPost.settings || '{}'),
          value: posts.map((post) => ({
            content: post.content,
            image: JSON.parse(post.image || '[]'),
            delay: post.delay || 0,
          })),
        },
      ],
      _debug: {
        providerIdentifier: rootPost.integration?.providerIdentifier,
        providerName: rootPost.integration?.name,
        state: rootPost.state,
        error: rootPost.error,
        errors: errors.map((e) => ({
          message: e.message,
          platform: e.platform,
          body: e.body,
          createdAt: e.createdAt,
        })),
        originalGroup: group,
        originalPublishDate: rootPost.publishDate,
        exportedAt: new Date().toISOString(),
      },
    };
  }

  async getPostsByGroup(orgId: string, group: string) {
    const loadAll = await this._postRepository.getPostsByGroup(orgId, group);
    const posts = this.arrangePostsByGroup(loadAll, undefined);
    if (!posts.length) {
      throw new NotFoundException('Post not found');
    }

    const batch = posts[0].batchId
      ? await this._postRepository.getPostsByBatch(
          orgId,
          posts[0].batchId,
          group
        )
      : [];

    // the other channels the post was created with, the editor holds one
    // post per channel, and a channel that repeats differently is its own post
    const siblings = uniqBy(
      Object.values(groupBy(batch, (post) => post.group))
        .map((batchPosts) => this.arrangePostsByGroup(batchPosts, undefined))
        .filter(
          (batchPosts) =>
            batchPosts.length &&
            batchPosts[0].integrationId !== posts[0].integrationId &&
            batchPosts[0].intervalInDays === posts[0].intervalInDays
        ),
      (batchPosts) => batchPosts[0].integrationId
    );

    return {
      ...(await this.groupForEditor(posts)),
      siblings: await Promise.all(
        siblings.map((batchPosts) => this.groupForEditor(batchPosts))
      ),
    };
  }

  // the post as the editor loads it, its channel without the tokens
  private async groupForEditor(
    posts: PostWithConditionals[],
    convertToJPEG = false
  ) {
    return {
      group: posts?.[0]?.group,
      posts: await Promise.all(
        (posts || []).map(async ({ integration, ...post }) => ({
          ...post,
          // the raw column is the serialized workflow failure; the editor and
          // the approvals inbox get the same curated message as the calendar
          error: curatedPostError(post.error),
          ...(integration
            ? {
                integration: {
                  id: integration.id,
                  name: integration.name,
                  picture: integration.picture,
                  providerIdentifier: integration.providerIdentifier,
                  profile: integration.profile,
                },
              }
            : {}),
          image: await this.updateMedia(
            post.id,
            post.organizationId,
            JSON.parse(post.image || '[]'),
            convertToJPEG
          ),
        }))
      ),
      integrationPicture: posts[0]?.integration?.picture,
      integration: posts[0].integrationId,
      settings: JSON.parse(posts[0].settings || '{}'),
    };
  }

  arrangePostsByGroup(all: any, parent?: string): PostWithConditionals[] {
    const findAll = all
      .filter((p: any) =>
        !parent ? !p.parentPostId : p.parentPostId === parent
      )
      .map(({ integration, ...all }: any) => ({
        ...all,
        ...(!parent ? { integration } : {}),
      }));

    return [
      ...findAll,
      ...(findAll.length
        ? findAll.flatMap((p: any) => this.arrangePostsByGroup(all, p.id))
        : []),
    ];
  }

  async getPost(orgId: string, id: string, convertToJPEG = false) {
    const posts = await this.getPostsRecursively(id, true, orgId, true);
    if (!posts?.[0]) {
      throw new NotFoundException('Post not found');
    }

    return this.groupForEditor(posts, convertToJPEG);
  }

  async getOldPosts(orgId: string, date: string) {
    return this._postRepository.getOldPosts(orgId, date);
  }

  public async updateTags(orgId: string, post: Post[]): Promise<Post[]> {
    const plainText = JSON.stringify(post);
    const extract = Array.from(
      plainText.match(/\(post:[a-zA-Z0-9-_]+\)/g) || []
    );
    if (!extract.length) {
      return post;
    }

    const ids = (extract || []).map((e) =>
      e.replace('(post:', '').replace(')', '')
    );
    const principal = getContext()?.agentPrincipal;
    if (principal) {
      for (const id of ids) {
        const referenced = await this._postRepository.getPostById(id, orgId);
        if (!referenced || principal.organizationId !== orgId || (principal.channelIds !== null && !principal.channelIds.includes(referenced.integrationId))) throw new BadRequestException('A referenced post is not available on this assistant’s permitted channels.');
      }
    }
    const urls = await this._postRepository.getPostUrls(orgId, ids);
    const replaceTags = (text: string, escape = (url: string) => url) =>
      ids.reduce((acc, value) => {
        const findUrl = urls?.find?.((u) => u.id === value)?.releaseURL || '';
        return acc.replace(new RegExp(`\\(post:${value}\\)`, 'g'), () =>
          escape(findUrl.split(',')[0])
        );
      }, text);

    // the release url is whatever the platform answered, so it only goes where
    // a tag is written, the content and the settings (escaped for their json),
    // and never into the media list, which was validated before this runs
    return post.map((p) => ({
      ...p,
      content: p.content && replaceTags(p.content),
      settings:
        p.settings &&
        replaceTags(p.settings, (url) => JSON.stringify(url).slice(1, -1)),
    }));
  }

  public async checkInternalPlug(
    integration: Integration,
    orgId: string,
    id: string,
    settings: any
  ) {
    const plugs = Object.entries(settings).filter(([key]) => {
      return key.indexOf('plug-') > -1;
    });

    if (plugs.length === 0) {
      return [];
    }

    const parsePlugs = plugs.reduce((all, [key, value]) => {
      const [_, name, identifier] = key.split('--');
      all[name] = all[name] || { name };
      all[name][identifier] = value;
      return all;
    }, {} as any);

    const list: {
      name: string;
      integrations: { id: string }[];
      delay: string;
      active: boolean;
    }[] = Object.values(parsePlugs);

    return (list || []).flatMap((trigger) => {
      return (trigger?.integrations || []).flatMap((int) => ({
        type: 'internal-plug',
        post: id,
        originalIntegration: integration.id,
        integration: int.id,
        plugName: trigger.name,
        orgId: orgId,
        delay: +trigger.delay,
        information: trigger,
      }));
    });
  }

  public async checkPlugs(
    orgId: string,
    providerName: string,
    integrationId: string
  ) {
    // Consent defaults hide new automations; saved automations retain their definitions.
    const loadAllPlugs = this._integrationManager.getAllPlugs(true);
    const getPlugs = await this._integrationService.getPlugs(
      orgId,
      integrationId
    );

    const currentPlug = loadAllPlugs.find((p) => p.identifier === providerName);

    return getPlugs
      .filter((plug) => {
        return currentPlug?.plugs?.some(
          (p: any) => p.methodName === plug.plugFunction
        );
      })
      .map((plug) => {
        const runPlug = currentPlug?.plugs?.find(
          (p: any) => p.methodName === plug.plugFunction
        )!;
        return {
          type: 'global',
          plugId: plug.id,
          delay: runPlug.runEveryMilliseconds,
          totalRuns: runPlug.totalRuns,
        };
      });
  }

  // byUser: a signed-in person in the app (not an agent, the public API or
  // a cleanup), who may delete a tracked MCP post that failed with an
  // uncertain outcome once no workflow can still send it
  async deletePost(orgId: string, group: string, byUser = false) {
    const agent = !!getContext()?.agentPrincipal;
    if (agent) {
      const groupPosts = await this._postRepository.getPostsByGroup(orgId, group);
      for (const post of groupPosts) assertAgentPostWrite(orgId, post.integrationId, 'delete');
      await this._approvalPolicyService.assertAgentGuardrails(orgId, { type: 'agent', source: 'MCP' }, [...new Set(groupPosts.map(p => p.integrationId))], { countsTowardLimit: false });
    }
    const post = await this._postRepository.deletePost(
      orgId,
      group,
      byUser && !agent ? await this.failedMcpRootsWithoutWorkflow(orgId, group) : []
    );

    if (post?.id) {
      try {
        const workflows = this._temporalService.client
          .getRawClient()
          ?.workflow.list({
            query: `postId="${post.id}" AND ExecutionStatus="Running"`,
          });

        for await (const executionInfo of workflows) {
          try {
            const workflow =
              await this._temporalService.client.getWorkflowHandle(
                executionInfo.workflowId
              );
            if (
              workflow &&
              (await workflow.describe()).status.name !== 'TERMINATED'
            ) {
              await workflow.terminate();
            }
          } catch (err) {}
        }
      } catch (err) {}

      return { id: post.id };
    }

    return { error: true };
  }

  // Deleting it only drops the post here, it never claims the uncertain
  // attempt was not published. A thread failed when any of its rows did (a
  // comment can fail after the root went out), and nothing of the group may
  // still run or be unknown.
  private async failedMcpRootsWithoutWorkflow(orgId: string, group: string) {
    const rows = await this._postRepository.getPostsByGroup(orgId, group);
    const roots = rows.filter((p) => !p.parentPostId && p.mcpWorkflowVersion === 114);
    const failed = roots.filter((root) =>
      rows.some((p) => p.state === 'ERROR' && p.integrationId === root.integrationId)
    );
    if (!failed.length) return [];
    for (const root of roots) {
      if (await this.hasRunningWorkflow(root.id)) return [];
    }
    return failed.map((root) => root.id);
  }

  // unknown counts as running: the caller then keeps the post
  private async hasRunningWorkflow(postId: string) {
    try {
      const workflows = this._temporalService.client
        .getRawClient()
        ?.workflow.list({
          query: `postId="${postId}" AND ExecutionStatus="Running"`,
        });
      if (!workflows) return true;
      for await (const _ of workflows) return true;
      return false;
    } catch (err) {
      return true;
    }
  }

  async countPostsFromDay(orgId: string, date: Date) {
    return this._postRepository.countPostsFromDay(orgId, date);
  }

  getPostByForWebhookId(id: string, integrationId: string) {
    return this._postRepository.getPostByForWebhookId(id, integrationId);
  }

  private mcpRevision(posts: Array<any>) { return mcpPayloadRevision(posts); }

  async recoverMissingMcpJob(orgId: string, rootId: string) {
    if (await this._postRepository.mcpWorkflowVersion(orgId, rootId) !== 114) return false;
    const rows = await this.mcpThread(orgId, rootId);
    await this.startWorkflow(rows[0].integration!.providerIdentifier.split('-')[0].toLowerCase(), rootId, orgId, 'QUEUE');
    return true;
  }

  async mcpWorkflowName(orgId: string, postId: string) {
    return await this._postRepository.mcpWorkflowVersion(orgId, postId) === 114 ? 'postWorkflowV114' : 'postWorkflowV113';
  }

  async unscheduleMcp(orgId: string, postId: string) {
    const root = await this.getStoredRootPost(orgId, postId);
    await this._approvalPolicyService.assertAgentGuardrails(orgId, { type: 'agent', source: 'MCP' }, [root.integrationId], { countsTowardLimit: false });
    // The fence makes sleeping/racing workers harmless; Temporal termination is
    // deliberately not used as publication proof.
    const policy = await this._approvalPolicyService.getSettings(orgId);
    return this._postRepository.unscheduleMcp(orgId, postId, false, policy.requireAgentApproval);
  }

  private async mcpRpc<T>(operation: (workflow: any) => Promise<T>): Promise<T> {
    const raw = this._temporalService.client?.getRawClient();
    if (!raw?.workflow || typeof raw.connection?.withDeadline !== 'function') throw new Error('Temporal deadline client unavailable.');
    return raw.connection.withDeadline(Date.now() + 10000, () => operation(raw.workflow));
  }

  async reconcileMcpDispatch(orgId: string, rootId: string, generation: number, revisionHash: string) {
    const fence = await this._postRepository.mcpFence(orgId, rootId);
    if (!fence || fence.state !== 'ACTIVE' || fence.generation !== generation || fence.revisionHash !== revisionHash) throw new McpDispatchUnconfirmed(rootId, generation);
    let rows: Awaited<ReturnType<PostsService['mcpThread']>>;
    try { rows = await this.mcpThread(orgId, rootId); }
    catch (error) {
      if (error instanceof BadRequestException) {
        await this._postRepository.recordMcpDispatch(orgId, rootId, generation, revisionHash, 'HELD', 'POST_NOT_DISPATCHABLE');
        throw new McpDispatchUnconfirmed(rootId, generation);
      }
      throw error;
    }

    const workflowId = `post_${rootId}_mcp_${generation}`;
    const acknowledge = async () => {
      const marked = await this._postRepository.recordMcpDispatch(orgId, rootId, generation, revisionHash, 'CONFIRMED');
      if (!marked.count) throw new McpDispatchUnconfirmed(rootId, generation);
    };
    const describe = async () => {
      const execution: any = await this.mcpRpc(workflow => workflow.getHandle(workflowId).describe());
      if (!['RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'CANCELED', 'TERMINATED', 'TIMED_OUT', 'CONTINUED_AS_NEW'].includes(execution?.status?.name)) throw new Error('Unrecognized workflow execution status.');
    };
    try {
      await describe();
      await acknowledge();
      return;
    } catch (error) {
      if (error instanceof AgentSaveRecovered || error instanceof McpDispatchUnconfirmed) throw error;
      if ((error as Error)?.name !== 'WorkflowNotFoundError') {
        await this._postRepository.recordMcpDispatch(orgId, rootId, generation, revisionHash, 'UNKNOWN', 'STATUS_UNCONFIRMED');
        throw new McpDispatchUnconfirmed(rootId, generation);
      }
    }
    if (this.mcpRevision(rows) !== revisionHash || !rows.some(post => post.state === 'QUEUE') || rows.some(post => ['ERROR', 'DRAFT'].includes(post.state))) {
      await this._postRepository.recordMcpDispatch(orgId, rootId, generation, revisionHash, 'HELD', 'POST_NOT_DISPATCHABLE');
      throw new McpDispatchUnconfirmed(rootId, generation);
    }
    // Missing execution is not permission to replay a provider attempt. Only
    // an unattempted exact generation may enter the deterministic start path.
    const attempts = await this._postRepository.mcpAttempts(orgId, rootId);
    if (attempts.some(attempt => attempt.generation === generation)) {
      await this._postRepository.recordMcpDispatch(orgId, rootId, generation, revisionHash, 'HELD', 'PROVIDER_RECONCILIATION_REQUIRED');
      throw new McpDispatchUnconfirmed(rootId, generation);
    }
    const admitted = await this._postRepository.recordMcpDispatch(orgId, rootId, generation, revisionHash, 'UNKNOWN', 'START_UNCONFIRMED', true);
    if (!admitted.count) throw new McpDispatchUnconfirmed(rootId, generation);
    try {
      const providerQueue = rows[0].integration!.providerIdentifier.split('-')[0].toLowerCase();
      await this.mcpRpc(workflow => workflow.start('postWorkflowV114', {
        workflowId, taskQueue: 'mcp-publish-v114', workflowIdConflictPolicy: 'USE_EXISTING', workflowIdReusePolicy: 'REJECT_DUPLICATE',
        args: [{ taskQueue: `mcp-v114-${providerQueue}`, postId: rootId, organizationId: orgId, generation, revisionHash }],
        typedSearchAttributes: new TypedSearchAttributes([{ key: postIdSearchParam, value: rootId }, { key: organizationId, value: orgId }]),
      }));
    } catch (error) {
      if ((error as Error)?.name === 'WorkflowExecutionAlreadyStartedError') {
        try { await describe(); await acknowledge(); return; }
        catch (inspection) { if (inspection instanceof AgentSaveRecovered) throw inspection; }
      }
      await this._postRepository.recordMcpDispatch(orgId, rootId, generation, revisionHash, 'UNKNOWN', 'START_UNCONFIRMED');
      throw new McpDispatchUnconfirmed(rootId, generation);
    }
    await acknowledge();
  }

  async recoverPendingMcpDispatches(limit = 16) {
    const pending = await this._postRepository.pendingMcpDispatches(limit);
    let confirmed = 0;
    let unconfirmed = 0;
    for (const fence of pending) {
      try { await this.reconcileMcpDispatch(fence.organizationId, fence.postId, fence.generation, fence.revisionHash); confirmed++; }
      catch { unconfirmed++; } // One unavailable/changed row must not starve the rest.
    }
    return { examined: pending.length, confirmed, unconfirmed };
  }

  async mcpExecutionState(orgId: string, postId: string) {
    const fence = await this._postRepository.mcpFence(orgId, postId);
    if (!fence) return { generation: -1, closed: undefined as boolean | undefined };
    try {
      const execution: any = await this.mcpRpc(workflow => workflow.getHandle(`post_${postId}_mcp_${fence.generation}`).describe());
      if (execution.status.name === 'RUNNING') return { generation: fence.generation, closed: false };
      if (['COMPLETED', 'FAILED', 'CANCELLED', 'CANCELED', 'TERMINATED', 'TIMED_OUT'].includes(execution.status.name)) return { generation: fence.generation, closed: true };
    } catch (error) {
      if ((error as Error)?.name === 'WorkflowNotFoundError') return { generation: fence.generation, closed: true };
    }
    return { generation: fence.generation, closed: undefined as boolean | undefined };
  }

  async resumeMcp(orgId: string, postId: string) {
    const rows = await this.mcpThread(orgId, postId);
    const root = rows[0];
    if (root.mcpWorkflowVersion !== 114 || !root.integration) return { status: 'BLOCKED', reason: 'Legacy execution has no durable attempt proof.' };
    if (process.env.MCP_V114_ADMISSION_ENABLED !== 'true') return { status: 'BLOCKED', reason: 'Assistant post saves are temporarily unavailable while the service updates.' };
    await this._approvalPolicyService.assertAgentGuardrails(orgId, { type: 'agent', source: 'MCP' }, [root.integrationId], { countsTowardLimit: false });
    const policy = await this._approvalPolicyService.getSettings(orgId);
    if (rows.some(p => p.state !== 'PUBLISHED' && (['IN_REVIEW', 'REJECTED', 'CHANGES_REQUESTED'].includes(p.approvalStatus) || (policy.requireAgentApproval && p.approvalStatus !== 'APPROVED'))) || ['IN_REVIEW', 'REJECTED', 'CHANGES_REQUESTED'].includes(root.approvalStatus)) return { status: 'BLOCKED', reason: 'Current revision requires human approval.' };
    const provider = this._integrationManager.getSocialIntegration(root.integration.providerIdentifier);
    const attempts = await this._postRepository.mcpAttempts(orgId, postId);
    for (const attempt of attempts.filter(a => ['STARTED', 'UNKNOWN'].includes(a.status))) {
      if (!provider.reconcileMcpAttempt) return { status: 'OUTCOME_UNKNOWN', reason: 'This provider cannot prove a terminal publication outcome; retry is blocked.' };
      const result = await provider.reconcileMcpAttempt(root.integration, { attemptId: attempt.id, payloadHash: attempt.providerPayloadHash || attempt.revisionHash, segmentId: attempt.segmentPostId });
      if (!result || !result.terminal) return { status: 'OUTCOME_UNKNOWN' };
      if (result.outcome === 'UNPUBLISHED') await this._postRepository.reconcileMcpAttempt(orgId, attempt.id, 'FAILED');
      else if (result.outcome === 'PUBLISHED' && result.receipt?.postId && result.receipt.postId !== 'missing' && !['pending', 'unknown', 'error', 'failed', 'processing'].includes(result.receipt.status) && result.receipt.id === attempt.segmentPostId) await this._postRepository.reconcileMcpAttempt(orgId, attempt.id, 'CONFIRMED', [result.receipt]);
      else return { status: 'OUTCOME_UNKNOWN' };
    }
    const materialized = await this.mcpThread(orgId, postId);
    const confirmed = await this._postRepository.mcpAttempts(orgId, postId);
    if (materialized.every(post => post.state === 'PUBLISHED' && confirmed.some(attempt => attempt.segmentPostId === post.id && attempt.status === 'CONFIRMED' && (attempt.receipt as any)?.[0]?.postId))) return { status: 'ALREADY_PUBLISHED', warnings: confirmed.filter(attempt => attempt.followUpWarning).map(attempt => ({ segmentId: attempt.segmentPostId, message: attempt.followUpWarning })) };
    const execution = await this.mcpExecutionState(orgId, postId);
    if (execution.closed === undefined) return { status: 'OUTCOME_UNKNOWN', reason: 'Current workflow execution could not be confirmed.' };
    const result = await this._postRepository.resumeMcp(orgId, postId, this.mcpRevision(rows), execution.closed ? execution.generation : undefined);
    if (result.status === 'RESUMED') await this.startWorkflow(root.integration.providerIdentifier.split('-')[0].toLowerCase(), postId, orgId, 'QUEUE');
    return result;
  }

  holdRemainingMcp(orgId: string, rootId: string, status: 'CHANGES_REQUESTED' | 'REJECTED', updatedAt: Date) { return this._postRepository.holdRemainingMcp(orgId, rootId, status, updatedAt); }

  async approveRemainingMcp(orgId: string, postId: string, updatedAt: Date) {
    const result = await this._postRepository.approveRemainingMcp(orgId, postId, updatedAt);
    const rows = await this.mcpThread(orgId, postId);
    await this.startWorkflow(rows[0].integration!.providerIdentifier.split('-')[0].toLowerCase(), postId, orgId, 'QUEUE');
    return result;
  }

  async activateApprovedMcp(orgId: string, postId: string) {
    if (await this._postRepository.mcpWorkflowVersion(orgId, postId) === 114) await this._postRepository.activateApprovedMcp(orgId, postId);
  }

  async failMcpSegment(orgId: string, rootId: string, segmentId: string, generation: number, revisionHash: string, err?: any) {
    return this._postRepository.failMcpSegment(orgId, rootId, segmentId, generation, revisionHash, err);
  }

  async mcpPlan(orgId: string, rootId: string, generation: number, revisionHash: string) {
    const rows = await this.mcpThread(orgId, rootId);
    const fence = await this._postRepository.mcpFence(orgId, rootId);
    if (!fence || fence.state !== 'ACTIVE' || fence.generation !== generation || fence.revisionHash !== revisionHash || this.mcpRevision(rows) !== revisionHash) throw new BadRequestException('Workflow fence or revision changed.');
    return { publishAt: new Date(rows[0].publishDate).getTime(), segments: rows.map(p => ({ id: p.id, delay: p.delay })) };
  }

  getMcpDispatchStatuses(orgId: string, postIds: string[]) { return this._postRepository.mcpDispatchStatuses(orgId, postIds); }

  getMcpWarnings(orgId: string, postIds: string[]) { return this._postRepository.mcpWarnings(orgId, postIds); }

  async mcpThread(orgId: string, postId: string) {
    const rows = await this.getPostsRecursively(postId, true, orgId, true);
    if (!rows.length || rows[0].parentPostId) throw new BadRequestException('Post not found.');
    return rows;
  }

  private mcpReplayReceipt(value: unknown, segmentId: string) {
    const receipt = Array.isArray(value) && value.length === 1 ? value[0] : undefined;
    if (!receipt || typeof receipt !== 'object' || receipt.id !== segmentId ||
      typeof receipt.postId !== 'string' || !receipt.postId || receipt.postId === 'missing' ||
      typeof receipt.releaseURL !== 'string' || typeof receipt.status !== 'string' ||
      ['pending', 'unknown', 'error', 'failed', 'processing'].includes(receipt.status))
      throw new BadRequestException('OUTCOME_UNKNOWN: stored publication receipt is not valid for this segment.');
    return [{ id: segmentId, postId: receipt.postId, releaseURL: receipt.releaseURL, status: receipt.status,
      ...(typeof receipt.warning === 'string' ? { warning: receipt.warning } : {}) }];
  }

  async runMcpSegment(orgId: string, rootId: string, segmentId: string, generation: number, expectedRevision: string, send: (integration: Integration, post: Post, predecessors: { parent?: string; previous?: string }, attemptId: string) => Promise<any>) {
    const rows = await this.mcpThread(orgId, rootId);
    const root = rows[0];
    const segment = rows.find(p => p.id === segmentId);
    if (!segment || !root.integration || root.mcpWorkflowVersion !== 114) throw new BadRequestException('Legacy or missing publication fence.');
    const actor = { type: 'agent' as const, source: root.agentSource || 'MCP' };
    await this._approvalPolicyService.assertAgentGuardrails(orgId, actor, [root.integrationId], { countsTowardLimit: false });
    const policy = await this._approvalPolicyService.getSettings(orgId);
    if (rows.some(p => p.state !== 'PUBLISHED' && (['IN_REVIEW', 'REJECTED', 'CHANGES_REQUESTED'].includes(p.approvalStatus) || (policy.requireAgentApproval && p.approvalStatus !== 'APPROVED'))) || ['IN_REVIEW', 'REJECTED', 'CHANGES_REQUESTED'].includes(root.approvalStatus)) throw new BadRequestException('Current revision requires human approval.');
    if (!['QUEUE', 'PUBLISHED', 'ERROR'].includes(root.state) || !['QUEUE', 'PUBLISHED', 'ERROR'].includes(segment.state)) throw new BadRequestException('Post is not queued.');
    const actualRevision = this.mcpRevision(rows);
    if (actualRevision !== expectedRevision) throw new BadRequestException('Workflow payload revision changed.');
    const storedAttempts = await this._postRepository.mcpAttempts(orgId, rootId) || [];
    if (storedAttempts.some(a => a.segmentPostId === segmentId && a.status === 'CONFIRMED' && a.revisionHash === actualRevision)) {
      const replay = await this._postRepository.claimMcpSegment(orgId, rootId, segmentId, actualRevision, generation);
      if (!replay.replay) throw new BadRequestException('Confirmed receipt changed unexpectedly.');
      return this.mcpReplayReceipt(replay.receipt, segmentId);
    }
    const predecessors: { parent?: string; previous?: string } = {};
    const priorSegments = rows.slice(0, rows.findIndex(p => p.id === segmentId));
    if (priorSegments.length) {
      const attempts = await this._postRepository.mcpAttempts(orgId, rootId);
      for (const previous of priorSegments) {
        const attempt = attempts.find(a => a.segmentPostId === previous.id && a.status === 'CONFIRMED' && a.revisionHash === expectedRevision);
        const receipt = (attempt?.receipt as any)?.[0];
        if (!receipt?.postId) throw new BadRequestException('A confirmed predecessor receipt is required.');
        predecessors.parent ||= receipt.postId;
        predecessors.previous = receipt.postId;
      }
    }
    if (!await this.ownedMcpMedia(orgId, rows.filter(p => p.state !== 'PUBLISHED').flatMap(p => JSON.parse(p.image || '[]')), true)) throw new BadRequestException('Media is not confirmed ready in this workspace.');
    const problem = await this.getStoredPostProblem(orgId, rootId);
    if (problem) throw new BadRequestException(problem);
        const revision = this.mcpRevision(rows);
    if (revision !== expectedRevision) throw new BadRequestException('Workflow payload revision changed.');
    const admission = await this._postRepository.claimMcpSegment(orgId, rootId, segmentId, revision, generation);
    if (admission.replay) return this.mcpReplayReceipt(admission.receipt, segmentId);
    try {
      const result = await send(root.integration, segment, predecessors, admission.id);
      if (!Array.isArray(result) || result.length !== 1 || !result[0]?.postId || result[0].postId === 'missing' || result[0].id !== segmentId || ['pending', 'unknown', 'error', 'failed', 'processing'].includes(result[0].status)) throw new BadRequestException('OUTCOME_UNKNOWN: provider did not return a final receipt.');
      // Persist before reporting success. A failure here keeps the durable
      // STARTED/UNKNOWN marker and may never be converted into a fresh send.
      const receipt = result.map(r => ({ id: r.id, postId: String(r.postId), releaseURL: String(r.releaseURL || ''), status: String(r.status || 'published'), ...(r.warning ? { warning: 'Published successfully, but a follow-up change failed. Inspect the post in the provider.' } : {}) }));
      if (result[0].publicationAccountingPending) await this.recordProviderPublish(orgId, root.integration.providerIdentifier, [segmentId]).catch(() => undefined);
      await this._postRepository.finishMcpSegment(orgId, admission.id, receipt);
      return receipt;
    } catch (err) {
      const settled = await this._postRepository.markMcpUnfinished(orgId, admission.id).catch(() => undefined);
      const outcome = settled === 'FAILED' ? 'FAILED' : 'OUTCOME_UNKNOWN';
      // what the platform said (a BadBody, never one of our own failures) is
      // carried to the failed segment, which curates it like any post error
      const reason = (err as any)?.type === 'bad_body' ? providerCause((err as any)?.message) : undefined;
      if (reason) throw new BadBody(root.integration.providerIdentifier, JSON.stringify({ outcome }), '{}', reason);
      if (settled === 'FAILED') throw new BadRequestException('FAILED: publication stopped before anything was sent to the provider.');
      throw new BadRequestException('OUTCOME_UNKNOWN: publication was admitted; reconcile before retrying.');
    }
  }

  async startWorkflow(
    taskQueue: string,
    postId: string,
    orgId: string,
    state: State
  ) {
    if (await this._postRepository.mcpWorkflowVersion(orgId, postId) === 114) {
      if (state === 'DRAFT') {
        const result = await this._postRepository.unscheduleMcp(orgId, postId, true);
        if (result.status !== 'UNSCHEDULED') throw new BadRequestException('OUTCOME_UNKNOWN: cancellation is blocked.');
        return;
      }
      const rows = await this.mcpThread(orgId, postId);
      await this._postRepository.registerMcpFence(orgId, postId, rows[0].integrationId, this.mcpRevision(rows));
      const fence = await this._postRepository.mcpFence(orgId, postId);
      if (!fence || fence.state !== 'ACTIVE') return;
      await this.reconcileMcpDispatch(orgId, postId, fence.generation, fence.revisionHash);
      return;
    }
    try {
      const workflows = this._temporalService.client
        .getRawClient()
        ?.workflow.list({
          query: `postId="${postId}" AND ExecutionStatus="Running"`,
        });

      for await (const executionInfo of workflows) {
        try {
          const workflow = await this._temporalService.client.getWorkflowHandle(
            executionInfo.workflowId
          );
          if (
            workflow &&
            (await workflow.describe()).status.name !== 'TERMINATED'
          ) {
            await workflow.terminate();
          }
        } catch (err) {
          this._logger.warn(
            `Could not stop workflow ${executionInfo.workflowId} of post ${postId}: ${err}`
          );
        }
      }
    } catch (err) {
      this._logger.warn(
        `Could not list the running workflows of post ${postId}: ${err}`
      );
    }

    if (state === 'DRAFT') { return; }

    try {
      await this._temporalService.client
        .getRawClient()
        ?.workflow.start('postWorkflowV113', {
          workflowId: `post_${postId}`,
          taskQueue: 'main',
          workflowIdConflictPolicy: 'TERMINATE_EXISTING',
          args: [
            {
              taskQueue: taskQueue,
              postId: postId,
              organizationId: orgId,
            },
          ],
          typedSearchAttributes: new TypedSearchAttributes([
            {
              key: postIdSearchParam,
              value: postId,
            },
            {
              key: organizationId,
              value: orgId,
            },
          ]),
        });
    } catch (err) {
      // the post stays queued with nothing to publish it until the sweep
      // finds it, say so instead of failing silently
      this._logger.error(
        `Could not start the publish workflow of ${state} post ${postId} (organization ${orgId}): ${err}`
      );
    }
  }

  /**
   * Server-side validation that used to live on the client (`checkValidity` +
   * the manage modal loop). Runs the provider's settings DTO validation, the
   * provider `checkValidity` (media rules) and the empty-content / too-long
   * character checks. Returns one result per post so the frontend can show the
   * same toasts it did before — and so `/posts` can refuse to create invalid
   * posts.
   */
  async validatePosts(
    orgId: string,
    posts: Array<{
      type?: CreatePostDto['type'];
      // a channel that keeps a date of its own, the others use `date`
      date?: string;
      integration: { id: string };
      value: Array<{
        id?: string;
        content?: string;
        image?: Array<{ path: string; thumbnail?: string }>;
      }>;
      settings?: any;
    }>,
    operation: CreatePostDto['type'] = 'schedule',
    allowPerPostOperation = false,
    // when the post goes out, for the settings that must be checked against it
    date?: string,
    snapshots?: Map<string, Integration>
  ) {
    return Promise.all(
      (posts || []).map(async (post) => {
        const integration = snapshots?.get(post?.integration?.id) || await this._integrationService.getIntegrationById(
          orgId,
          post?.integration?.id
        );

        if (!integration) {
          throw new BadRequestException(
            `Integration with id ${post?.integration?.id} not found`
          );
        }

        const provider = this._integrationManager.getSocialIntegration(
          integration.providerIdentifier
        );

        let additionalSettings: any[] = [];
        try {
          additionalSettings = JSON.parse(
            integration.additionalSettings || '[]'
          );
        } catch {
          additionalSettings = [];
        }

        const settings: Record<string, any> = {
          ...(post.settings || {}),
          __type: integration.providerIdentifier,
        };
        delete settings.__validationOperation;
        delete settings.__validationDate;
        const validationOperation = allowPerPostOperation
          ? post.type || operation
          : operation;
        const media = (post.value || []).map((p) => p.image || []);

        // Settings DTO validation — mirrors the client `form.trigger()`.
        let valid = true;
        let settingsError = '';
        if (provider?.dto) {
          const instance = plainToInstance(
            provider.dto,
            {
              ...settings,
              __validationOperation: validationOperation,
              __validationDate: post.date || date,
            },
            { enableImplicitConversion: false }
          );
          const validationErrors = await validate(instance as object, {
            skipMissingProperties: false,
          });
          settingsError = this.firstValidationError(validationErrors);
          valid = validationErrors.length === 0;
        }

        // Provider-specific media validation (the old client `checkValidity`).
        let errors: string | true = true;
        try {
          errors = await provider.checkValidity(
            media,
            settings,
            additionalSettings,
            // each entry as the provider receives it when it publishes
            (post.value || []).map((p) => this.preparedText(provider, p.content || '', settings))
          );
        } catch (err: any) {
          errors = err?.message || 'Invalid media';
        }

        if (provider.plugsAvailable === false && (post.value || []).length > 1) {
          const ids = post.value.map(entry => entry.id);
          const savedSequence = ids.every((id): id is string => typeof id === 'string' && !!id) &&
            await this._postRepository.isExistingPostSequence(orgId, integration.id, ids as string[]);
          if (!savedSequence) {
            errors = 'Comment and reply automation needs an approved optional permission. Existing saved entries can be edited; new replies are unavailable.';
          }
        }

        const maximumCharacters = provider.maxLength(
          additionalSettings,
          settings
        );

        // counted like the composer shows it: the visible text, not the
        // markup the provider receives (an html editor keeps <p>, <a>...)
        const emptyContent = !(post.value || []).length || (post.value || []).some((a) => {
          const strip = stripHtmlValidation('normal', a.content || '', true);
          const length = countLength(integration.providerIdentifier, strip);
          return length === 0 && (a.image || []).length === 0;
        });

        const tooLong = (post.value || []).some((a) => {
          const strip = stripHtmlValidation('normal', a.content || '', true);
          const counted = countLength(integration.providerIdentifier, strip);
          return counted > (maximumCharacters || 1000000);
        });

        return {
          id: integration.id,
          identifier: integration.providerIdentifier,
          name: integration.name,
          valid,
          settingsError,
          errors,
          emptyContent,
          tooLong,
          maximumCharacters,
          // a turned off channel never publishes, API and MCP refuse it
          disabled: !!integration.disabled,
        };
      })
    );
  }

  /** Pure formatting shared by validation and publication preparation. */
  private preparedText(provider: any, content: string, settings: any) {
    const text = provider.stripLinks?.() ? stripLinks(content) : content;
    return stripHtmlValidation(
      provider.editor, text, true, false,
      !/<\/?[a-z][\s\S]*>/i.test(text), provider.mentionFormat,
      !!provider.inlineImages?.(settings)
    );
  }

  private async bindOwnedMcpMedia(orgId: string, media: Array<any>, requireReady = true) {
    const paths = [...new Set(media.flatMap(m => [m.path, ...(m.thumbnail ? [m.thumbnail] : [])]))];
    if (!paths.length) return media;
    const records = await this._mediaService.getOrgMediaByPaths(orgId, paths);
    if (!paths.every(path => records.some(r => r.path === path && (!requireReady || r.status === 'ready')))) throw new BadRequestException('Media is not confirmed ready in this workspace. Reuse a ready library path.');
    return media.map(m => ({ ...m, id: records.find(r => r.path === m.path)!.id }));
  }

  bindMcpProviderPayload(orgId: string, attemptId: string, payload: any) { return this._postRepository.bindMcpProviderPayload(orgId, attemptId, payload); }

  async ownedMcpMedia(orgId: string, media: Array<{ id?: string; path: string; thumbnail?: string }>, serverBoundIds = false) {
    const unresolved = [];
    for (const item of media) {
      const record = serverBoundIds && item.id ? await this._mediaService.getOrgMediaById(orgId, item.id) : null;
      if (!record || record.deletedAt || record.status !== 'ready') unresolved.push({ path: item.path, thumbnail: item.thumbnail });
      else if (item.thumbnail) unresolved.push({ path: item.thumbnail });
    }
    const paths = [...new Set(unresolved.flatMap(m => [m.path, ...(m.thumbnail ? [m.thumbnail] : [])]))];
    if (!paths.length) return true;
    const owned = await this._mediaService.getOrgMediaByPaths(orgId, paths);
    return paths.every(path => owned.some(m => m.path === path && m.status === 'ready'));
  }

  /** A snapshot, never an authorization or a durable promise to publish. */
  async preflightPosts(
    orgId: string,
    posts: Parameters<PostsService['validatePosts']>[1],
    operation: CreatePostDto['type'] = 'schedule',
    date?: string,
    shortLink = false
  ) {
    const output = [];
    for (const [index, post] of posts.entries()) {
      if (!await this.ownedMcpMedia(orgId, (post.value || []).flatMap(p => p.image || []))) {
        output.push({ index, channel: post.integration.id, checkedAt: new Date().toISOString(), status: 'UNKNOWN', checks: [{ field: 'mediaIdentity', status: 'UNKNOWN', message: 'The attachment or thumbnail is not confirmed ready in this workspace media library.', fix: 'Upload it to this workspace or wait for mediaStatusTool; reuse the exact library path.' }] });
        continue;
      }
      const integration = await this._integrationService.getIntegrationById(orgId, post.integration.id);
      const [validation] = await this.validatePosts(orgId, [post], operation, false, date, new Map([[post.integration.id, integration]]));
      const checks: Array<{ field: string; status: 'VALID' | 'INVALID' | 'UNKNOWN'; message: string; fix?: string }> = [];
      const add = (field: string, valid: boolean, message: string, fix: string) =>
        checks.push({ field, status: valid ? 'VALID' : 'INVALID', message, ...(valid ? {} : { fix }) });
      add('value', !!post.value?.length && !validation.emptyContent, 'Content or media is required.', 'Add a nonempty post or ready uploaded media.');
      add('settings', validation.valid, validation.settingsError || 'Settings checked.', 'Read integrationSchema and correct the channel settings.');
      add('media', validation.errors === true, validation.errors === true ? 'Provider media rules checked.' : String(validation.errors), 'Correct the attachments and channel media settings.');
      add('integration', !validation.disabled, 'Channel enabled state checked.', 'Enable this channel or choose another.');
      add('date', operation === 'draft' || Number.isFinite(Date.parse(post.date || date || '')), 'Schedule date checked.', 'Supply an explicit UTC date.');
      const provider = this._integrationManager.getSocialIntegration(integration.providerIdentifier);
      for (const [entry, value] of (post.value || []).entries()) {
        // the same visible-text count the save enforces (validatePosts tooLong)
        const count = countLength(integration.providerIdentifier, stripHtmlValidation('normal', value.content || '', true));
        add(`value.${entry}.content.length`, count <= (validation.maximumCharacters || 1000000), `${count}/${validation.maximumCharacters || 1000000} characters under this provider counting rule.`, 'Shorten this entry.');
        if (value.image?.length) checks.push({ field: `value.${entry}.image`, status: 'UNKNOWN', message: 'File readiness and later media transformations are not proven by URL shape.', fix: 'Wait for mediaStatusTool to report ready, then check the final payload again.' });
      }
      if (shortLink && !provider.stripLinks?.() && this._shortLinkService.askShortLinkedin((post.value || []).map(p => p.content || ''))) {
        checks.push({ field: 'shortLink', status: 'UNKNOWN', message: 'Pending short-link transformation; configured provider supplies no proven maximum URL length. No URL was minted.', fix: 'Disable short links for an exact text check; saving must validate materialized links.' });
      }
      if (/\(post:[a-zA-Z0-9_-]+\)/.test(JSON.stringify(post))) checks.push({ field: 'postReferences', status: 'UNKNOWN', message: 'Referenced post URLs are resolved at save time and may change the final length.', fix: 'Wait for referenced posts to publish; saving resolves and validates their URLs before review.' });
      checks.push({ field: 'providerReadiness', status: 'UNKNOWN', message: 'Live provider authorization/readiness is not checked or refreshed.', fix: 'Reconnect in PostDelegate if required; publication checks current workspace policy.' });
      const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
      output.push({ index, channel: post.integration.id, checkedAt: new Date().toISOString(), inputHash: hash({ post, operation, date, shortLink }), configHash: hash({ identifier: integration.providerIdentifier, additionalSettings: integration.additionalSettings, disabled: integration.disabled, maximumCharacters: validation.maximumCharacters }), status: checks.some(c => c.status === 'INVALID') ? 'INVALID' : checks.some(c => c.status === 'UNKNOWN') ? 'UNKNOWN' : 'VALID', checks });
    }
    return output;
  }

  /** Returns the first class-validator message (incl. nested children), or ''. */
  private firstValidationError(errors: any[]): string {
    for (const e of errors || []) {
      if (e?.constraints) {
        return Object.values(e.constraints as Record<string, string>)[0] || '';
      }
      const child = e?.children?.length
        ? this.firstValidationError(e.children)
        : '';
      if (child) {
        return child;
      }
    }
    return '';
  }

  // A schedule-type save targeting an already-PUBLISHED post republishes it to
  // the platform: require the explicit `republish` opt-in instead. The message
  // doubles as the confirmation dialog for API/MCP automation.
  private guardAgainstRepublish(
    post: {
      state: State;
      publishDate: Date;
      integration?: { providerIdentifier: string };
    } | null,
    source: 'createPost' | 'changeDate' | 'changePostStatus'
  ) {
    if (post?.state !== 'PUBLISHED') {
      return;
    }

    const howToUpdate =
      source === 'createPost'
        ? ` To edit without republishing, use type 'update'.`
        : source === 'changeDate'
        ? ` To edit without republishing, use action 'update'.`
        : '';

    throw new BadRequestException(
      `This post was already published on ${dayjs
        .utc(post.publishDate)
        .format('YYYY-MM-DD HH:mm')} UTC. ${
        source === 'changePostStatus'
          ? 'Changing its status can publish it again to'
          : 'Saving it this way would publish it again to'
      } ${
        post.integration?.providerIdentifier || 'the channel'
      }.${howToUpdate} To intentionally publish again, pass republish: true.`
    );
  }

  // A scheduled post whose time came may be going out right now: changing its
  // status or time restarts its workflow, which could publish it twice. The
  // `republish` opt-in is the way to do it on purpose (a post that never went
  // out is also picked up again by the missing-posts sweep).
  private guardAgainstPublishing(post: { state: State; publishDate: Date }) {
    if (isBeingPublished(post)) {
      throw new BadRequestException(
        'This post is already being published, it cannot be scheduled again now. To intentionally publish it again, pass republish: true.'
      );
    }
  }

  // A stored main post a status or date change can act on: deleted posts are
  // gone, and a comment moves with its main post
  private async getStoredRootPost(orgId: string, id: string) {
    const post = await this._postRepository.getPostById(id, orgId);
    if (!post || post.deletedAt) {
      throw new BadRequestException('Post not found');
    }
    if (post.parentPostId) {
      throw new BadRequestException(
        'This id belongs to a comment, pass the id of the main post'
      );
    }
    return post;
  }

  assertMcpAdmissionReady() {
    if (process.env.MCP_V114_ADMISSION_ENABLED !== 'true') throw new ServiceUnavailableException('Assistant post saves are temporarily unavailable while the service updates.');
  }

  // A network can tie some settings to the signed-in composer (TikTok's
  // Direct Post needs the account check and consent shown there). A post
  // saved from anywhere else - public API, CLI, MCP, the agent, CSV import,
  // bulk, clipping or auto post - gets the settings the provider allows
  // outside it, or a readable error. The provider is the one of __type, which
  // mapTypeToPost and every internal caller set from the channel (like the
  // rest of createPost); a request that has none yet is looked up.
  async applyOutsideComposerRules<
    T extends { integration: { id: string }; settings?: any }
  >(orgId: string, posts: T[]): Promise<T[]> {
    return Promise.all(
      (posts || []).map(async (post) => {
        const identifier =
          post?.settings?.__type ||
          (
            await this._integrationService.getIntegrationById(
              orgId,
              post?.integration?.id
            )
          )?.providerIdentifier;
        const provider = identifier
          ? this._integrationManager.getSocialIntegration(identifier)
          : undefined;
        if (!provider?.settingsOutsideComposer) {
          return post;
        }
        const result = provider.settingsOutsideComposer(post.settings || {});
        if ('error' in result) {
          throw new BadRequestException(`${provider.name}: ${result.error}`);
        }
        return { ...post, settings: result.settings };
      })
    );
  }

  async createPost(
    orgId: string,
    body: CreatePostDto,
    creationMethod: CreationMethod,
    keepGroup = false,
    // who saves the post, decides whether it waits for an approver. Internal
    // callers (auto post, clipping, settings updates) pass nothing.
    actor?: ApprovalActor,
    // Server-captured revision from the in-place draft editor, never authority.
    expectedDraftUpdatedAt?: Date,
    validationIntent?: 'review',
    // only the signed-in composer (POST /posts) and the drafts it generates
    // pass true, see applyOutsideComposerRules
    fromComposer = false
  ): Promise<any[]> {
    for (const post of body.posts) assertAgentPostWrite(orgId, post.integration.id, body.type);
    if (creationMethod === 'MCP') this.assertMcpAdmissionReady();
    if (!fromComposer) {
      body = {
        ...body,
        posts: await this.applyOutsideComposerRules(orgId, body.posts),
      };
    }

    // One agent save at a time per workspace, for MCP saves only (new ones, or
    // edits of a tracked MCP post). The public API and the CLI are agent
    // actors too, but save concurrently as they always did.
    const mcpSave = actor?.type === 'agent' && await this.isMcpSave(orgId, body, creationMethod);
    // a closed rollout refuses before the admission, it is no stopped save
    if (mcpSave) this.assertMcpAdmissionReady();
    return mcpSave
      ? this.withAgentAdmission(orgId, async () => {
          try { return await this.createPostAdmitted(orgId, body, creationMethod, keepGroup, actor, expectedDraftUpdatedAt, validationIntent); }
          catch (error) {
            if (error instanceof McpDispatchUnconfirmed) throw error;
            const ids = agentAdmission.getStore()?.persistedIds || [];
            if (ids.length) throw new BadRequestException(`Save incomplete. Already saved post IDs (do not recreate): ${ids.join(', ')}. Inspect these posts before retrying remaining work.`);
            throw error;
          }
        })
      : this.createPostAdmitted(orgId, body, creationMethod, keepGroup, actor, expectedDraftUpdatedAt, validationIntent);
  }

  private async isMcpSave(orgId: string, body: CreatePostDto, creationMethod: CreationMethod) {
    if (creationMethod === 'MCP') return true;
    for (const post of body.posts) {
      const id = post.value?.[0]?.id;
      if (id && await this._postRepository.mcpWorkflowVersion(orgId, id) === 114) return true;
    }
    return false;
  }

  // Called once when the backend starts, from its main.ts. Only the backend
  // takes agent save admissions, and the deployment runs ONE backend process
  // per database (a single container), so a row of another instance id
  // belongs to a process that is gone. Never call it from the orchestrator or
  // from a second backend sharing the database: their instance ids differ and
  // they would release saves that are still running.
  releaseAbandonedAgentAdmissions() { return this._postRepository.releaseAgentAdmissionsOfOtherInstances(agentInstanceId); }

  agentAdmissionStatus(orgId: string) { return this._postRepository.agentAdmissionStatus(orgId); }
  recoverAgentAdmission(orgId: string, owner: string, actorId: string) { return this._postRepository.recoverAgentAdmission(orgId, owner, actorId); }

  async withAgentAdmission<T>(orgId: string, action: () => Promise<T>): Promise<T> {
    if (agentAdmission.getStore()?.orgId === orgId) return action();
    const owner = uuidv4();
    try { await this._postRepository.acquireAgentAdmission(orgId, owner, { instanceId: agentInstanceId, host: hostname(), processId: process.pid }); }
    catch (error) {
      throw new BadRequestException((error as any)?.code === 'P2002'
        ? 'Another agent save is active. A workspace admin can inspect or recover it in Settings > Agent access.'
        : 'A safe save admission could not be confirmed. Inspect the workspace before retrying.');
    }
    const scope = { orgId, owner, persistedIds: [] as string[] };
    let result: T | undefined; let failed = false; let failure: unknown;
    try { result = await agentAdmission.run(scope, action); }
    catch (error) { failed = true; failure = error; }
    let persistedIds = scope.persistedIds;
    try {
      // a plain refusal (validation 400, plan 402) is no stopped save: unless
      // it wrote something, nothing is recorded for an admin to recover
      const refused = failure instanceof HttpException && [400, 402].includes(failure.getStatus());
      const settlement = await this._postRepository.releaseAgentAdmission(orgId, owner, failed, refused);
      persistedIds = settlement?.writtenPostIds?.length ? settlement.writtenPostIds : persistedIds;
    } catch {
      throw new BadRequestException(`Save cleanup is unconfirmed. ${persistedIds.length ? `Already saved post IDs: ${persistedIds.join(', ')}. ` : ''}Do not recreate blindly; a workspace admin can inspect Settings > Agent access.`);
    }
    if (failed) {
      if (failure instanceof McpDispatchUnconfirmed) throw new McpDispatchUnconfirmed(failure.rootId, failure.generation, [...new Set([...failure.savedPostIds, ...persistedIds])]);
      if (persistedIds.length) throw new BadRequestException(`Save incomplete. Already saved post IDs (do not recreate): ${persistedIds.join(', ')}. Inspect these posts before retrying remaining work.`);
      if (failure instanceof HttpException) throw failure;
      throw new BadRequestException('The save could not be completed. Inspect the workspace before retrying.');
    }
    return result as T;
  }

  // Same messages as updatePostSettings and the public API. A draft is only
  // checked for content; a turned off channel is refused only for what
  // publishes (schedule, now, or a draft sent for review), as on main an
  // update or a draft may still be saved on it.
  private assertFinalPayload(
    validation: Awaited<ReturnType<PostsService['validatePosts']>>[number],
    type: CreatePostDto['type'],
    validationIntent?: 'review'
  ) {
    const name = validation.name;
    if (validation.emptyContent) {
      throw new BadRequestException(`${name}: Your post should have at least one character or one image.`);
    }
    if (type !== 'draft' || validationIntent === 'review') {
      if (!validation.valid) {
        throw new BadRequestException(`${name}: ${validation.settingsError || 'Please fix your settings'}`);
      }
      if (validation.errors !== true) {
        throw new BadRequestException(`${name}: ${validation.errors}`);
      }
      if (validation.tooLong) {
        throw new BadRequestException(`${name}: The maximum characters is ${validation.maximumCharacters}`);
      }
    }
    if (validation.disabled && (type === 'schedule' || type === 'now' || validationIntent === 'review')) {
      throw new BadRequestException(`${name} is turned off. Turn it on from the channel menu in the calendar, or pick another channel.`);
    }
  }

  private async createPostAdmitted(
    orgId: string, body: CreatePostDto, creationMethod: CreationMethod,
    keepGroup = false, actor?: ApprovalActor, expectedDraftUpdatedAt?: Date, validationIntent?: 'review'
  ): Promise<any[]> {
    if (actor?.type === 'agent') {
      // an agent's in-place update must point at posts that exist, it can't
      // be used to create posts around the guardrails
      if (body.type === 'update') {
        for (const post of body.posts) {
          const id = post.value?.[0]?.id;
          if (!id || !(await this._postRepository.getPostById(id, orgId))) {
            throw new BadRequestException(
              'This post was not found. To create a post, use the type "schedule", "now" or "draft".'
            );
          }
        }
      }
      await this._approvalPolicyService.assertAgentGuardrails(
        orgId,
        actor,
        body.posts.map((p) => p.integration.id),
        { countsTowardLimit: body.type !== 'update' }
      );
    }

    const cappedChannels = await this.checkProviderPostsLimit(orgId, body);
    await this.checkPostingLimits(orgId, body);

    const postList = [];
    // posts sent for review in this save, the approvers hear about them once
    const submitted: { id: string; content: string; integrationName?: string; provider?: string }[] = [];
    const batchId = uuidv4();
    // Every channel is prepared and checked before the first one is saved: a
    // refusal of a later channel must not leave the earlier ones saved (and
    // dispatched), which a retry would then save twice.
    const checked: { post: (typeof body.posts)[number]; existing: Awaited<ReturnType<PostsRepository['getPostById']>> | null; decision?: ApprovalDecision }[] = [];
    for (const post of body.posts) {
      // Defensive boundary for internal callers that skip mapTypeToPost.
      post.settings = { ...post.settings };
      delete (post.settings as any).__validationOperation;
      delete (post.settings as any).__validationDate;
      // an update reads it too: a queued post it moves is restarted below
      const existing =
        post.value?.[0]?.id && (actor || body.type !== 'draft')
          ? await this._postRepository.getPostById(post.value[0].id, orgId)
          : null;
      if (
        (body.type === 'schedule' || body.type === 'now') &&
        !body.republish &&
        post.value?.[0]?.id
      ) {
        this.guardAgainstRepublish(existing, 'createPost');
      }
      if (existing?.mcpWorkflowVersion === 114) this.assertMcpAdmissionReady();
      const decision = actor
        ? await this._approvalPolicyService.decide(
            orgId,
            actor,
            body.type,
            existing
          )
        : undefined;
      const provider = this._integrationManager.getSocialIntegration(
        (post.settings as any)?.__type
      );
      const removeLinks = !!provider?.stripLinks?.();

      if (creationMethod === 'MCP' || existing?.mcpWorkflowVersion === 114) post.value = await Promise.all(post.value.map(async p => ({ ...p, image: await this.bindOwnedMcpMedia(orgId, p.image || [], body.type !== 'draft' || validationIntent === 'review') })));
      if (creationMethod === 'MCP' || existing?.mcpWorkflowVersion === 114) {
        const prepared = await this.updateTags(orgId, post.value.map(p => ({ ...p, organizationId: orgId, settings: JSON.stringify(post.settings) })) as any);
        post.value = post.value.map((p, index) => ({ ...p, content: prepared[index].content }));
        if (prepared[0]) post.settings = JSON.parse(prepared[0].settings || '{}');
      }
      const messages = (post.value || []).map((p) => p.content);
      // No point shortlinking links on platforms that strip them out anyway
      const updateContent =
        !body.shortLink || removeLinks
          ? messages
          : await this._shortLinkService.convertTextToShortLinks(
              orgId,
              messages
            );

      post.value = (post.value || []).map((p, i) => ({
        ...p,
        content: removeLinks ? stripLinks(updateContent[i]) : updateContent[i],
      }));

      // Materialized links can grow. Validate the exact transformed text before
      // enqueueing; a preflight snapshot never authorizes this payload.
      // an in-place update of a draft is checked like the draft it stays: on
      // main the settings of an incomplete draft could still be updated
      const checkedAs = body.type === 'update' && existing?.state === 'DRAFT' ? 'draft' : body.type;
      const [finalValidation] = await this.validatePosts(orgId, [post], validationIntent === 'review' ? 'schedule' : checkedAs, false, post.date || body.date);
      this.assertFinalPayload(finalValidation, checkedAs, validationIntent);
      checked.push({ post, existing, decision });
    }

    for (const { post, existing, decision } of checked) {
      const { posts } = await this._postRepository.createOrUpdatePost(
        // a post that waits for an approver is kept as a draft until approved
        decision?.hold ? 'draft' : body.type,
        orgId,
        body.type === 'now'
          ? dayjs().format('YYYY-MM-DDTHH:mm:00')
          : // a passed date on a capped network is stored as now, the
          // plan month it was counted in. Not for an in-place update: it
          // keeps the date of posts already published, and the new entries
          // it adds are counted in the current month and checked again
          // when they go out
          cappedChannels.has(post.integration.id) &&
            body.type === 'schedule' &&
            dayjs(post.date || body.date).isBefore(dayjs())
          ? dayjs().format('YYYY-MM-DDTHH:mm:ss')
          : post.date || body.date,
        post,
        body.tags,
        creationMethod,
        body.inter,
        keepGroup,
        batchId,
        {
          ...(agentDraftOnly() && body.type === 'update' ? { requireExistingDraft: true, expectedDraftUpdatedAt } : {}),
          approvalStatus: decision?.approvalStatus,
          agentSource: actor?.type === 'agent' ? actor.source : undefined,
        }
      );

      if (!posts?.length) {
        return [] as any[];
      }

      if (agentAdmission.getStore()?.orgId === orgId && posts[0]?.id) agentAdmission.getStore()!.persistedIds.push(posts[0].id);

      const existingIds = (post.value || []).map((p) => p.id).filter(Boolean);
      await this.detachStaleAnchors(
        posts.filter((p) => existingIds.includes(p.id))
      );

      // an update that moved a queued post restarts its workflow, the one
      // waiting would fire at the old time. Not while it is going out.
      const movedQueued =
        body.type === 'update' &&
        existing?.state === 'QUEUE' &&
        posts[0].state === 'QUEUE' &&
        !isBeingPublished(existing) &&
        dayjs(existing.publishDate).valueOf() !==
          dayjs(posts[0].publishDate).valueOf();

      // an update held for review must stop the workflow already waiting
      if (body.type !== 'update' || decision?.hold || movedQueued || (existing?.mcpWorkflowVersion === 114 && posts[0].state === 'QUEUE')) {
        const dispatched = this.startWorkflow(
          post.settings.__type.split('-')[0].toLowerCase(), posts[0].id, orgId, posts[0].state
        );
        // A tracked producer must finish its guarded dispatch before its save
        // admission is settled. Legacy fire-and-forget behavior stays intact.
        if (creationMethod === 'MCP' || existing?.mcpWorkflowVersion === 114) await dispatched;
        else dispatched.catch(() => undefined);
      }

      if (actor) {
        const saved = {
          id: posts[0].id,
          content: posts[0].content,
          integrationName: (post.integration as any)?.name,
          provider: (post.settings as any)?.__type,
        };
        const outcome = await this._approvalPolicyService.afterSave(
          orgId,
          saved,
          actor,
          { created: !existing, decision, notify: false }
        );
        if (outcome.submitted) {
          submitted.push(saved);
        }
      }

      Sentry.metrics.count('post_created', 1);
      postList.push({
        postId: posts[0].id,
        integration: post.integration.id,
        ...(decision?.approvalStatus === 'IN_REVIEW'
          ? { approvalStatus: 'IN_REVIEW' }
          : {}),
      });
    }

    if (actor && submitted.length) {
      await this._approvalPolicyService.notifyApprovers(
        orgId,
        submitted[0],
        actorName(actor),
        submitted.length
      );
    }

    return postList;
  }

  // The plan's monthly caps (provider_posts_per_month) and the capped network
  // of a channel, null when nothing is capped
  private async providerCaps(orgId: string) {
    const plan = await this._subscriptionService.getProviderPostsLimits(orgId);
    if (!plan || !Object.keys(plan.limits).length) {
      return null;
    }

    const providers = new Map(
      (await this._integrationService.getIntegrationsList(orgId)).map((p) => [
        p.id,
        p.providerIdentifier,
      ])
    );

    return {
      plan,
      capped: (integrationId?: string) => {
        const provider = providers.get(integrationId || '');
        return provider && plan.limits[provider] !== undefined
          ? provider
          : undefined;
      },
    };
  }

  // The plan counts a post when it is published, a repeating or evergreen post
  // is published again without being saved, so it is refused on a network the
  // plan caps a month
  private repeatError(provider: string, plan: string) {
    const social = this._integrationManager.getSocialIntegration(provider);
    return new BadRequestException(
      social?.planRepeatHint ||
        `Repeating and evergreen posts on ${
          social?.name || provider
        } aren't available on the ${plan} plan.`
    );
  }

  async checkRepeatAllowed(orgId: string, integrationIds: string[]) {
    const caps = await this.providerCaps(orgId);
    const provider = integrationIds.map((id) => caps?.capped(id)).find(Boolean);
    if (caps && provider) {
      throw this.repeatError(provider, caps.plan.plan);
    }
  }

  // The early warning of a plan's monthly cap on a network
  // (provider_posts_per_month), for the whole save before anything is stored:
  // the posts already published this plan month (ProviderPostUsage) and the
  // ones queued in it, plus the entries this save queues, each in the plan
  // month it publishes in (a passed date publishes now). The publish activity
  // enforces the cap again when a post goes out (providerPublishProblem).
  // Returns the capped channels of the save.
  async checkProviderPostsLimit(
    orgId: string,
    body: {
      type: CreatePostDto['type'];
      date?: string | Date;
      inter?: number | null;
      posts: {
        integration: { id: string };
        date?: string | Date;
        value?: { id?: string }[];
      }[];
    }
  ): Promise<Set<string>> {
    const caps = await this.providerCaps(orgId);
    const saving = (body.posts || [])
      .map((post) => ({ post, provider: caps?.capped(post.integration?.id) }))
      .filter(({ provider }) => !!provider);
    if (!caps || !saving.length) {
      return new Set();
    }

    if (body.inter) {
      throw this.repeatError(saving[0].provider!, caps.plan.plan);
    }

    const cappedChannels = new Set(
      saving.map(({ post }) => post.integration.id)
    );
    if (body.type === 'draft') {
      return cappedChannels;
    }

    const ids = saving
      .flatMap(({ post }) => post.value || [])
      .map((value) => value.id!)
      .filter(Boolean);
    const stored = new Map(
      (await this._postRepository.getPostsState(orgId, ids)).map((row) => [
        row.id,
        row,
      ])
    );

    const windows = groupBy(
      saving.map((item) => ({
        ...item,
        window: planMonth(
          caps.plan.anchor,
          this.publishAt(body.type, item.post.date || body.date)
        ),
      })),
      ({ provider, window }) => `${provider} ${window.from.getTime()}`
    );

    const trialing = this.liveTrial(orgId);
    for (const group of Object.values(windows)) {
      const { provider, window } = group[0];
      const values = group.flatMap(({ post }) => post.value || []);

      // after the save: schedule and now queue every entry, an update keeps
      // the state of the stored ones and queues the new ones
      const queued = values.filter((value) => {
        const row = stored.get(value.id || '');
        return body.type !== 'update' || !row || row.state === 'QUEUE';
      });
      // already counted: stored entries queued in this plan month
      const counted = values.filter((value) => {
        const row = stored.get(value.id || '');
        return (
          row?.state === 'QUEUE' &&
          !row.deletedAt &&
          row.publishDate >= window.from &&
          row.publishDate < window.until
        );
      });
      if (queued.length <= counted.length) {
        continue;
      }

      const used =
        (await this._postRepository.countProviderUsage(
          orgId,
          provider!,
          window.from,
          window.until
        )) +
        (await this._postRepository.countQueuedProviderPosts(
          orgId,
          provider!,
          window.from,
          window.until,
          ids
        ));

      const { limit, trial } = await this.capFor(
        caps.plan,
        provider!,
        used + queued.length,
        trialing
      );
      if (used + queued.length <= limit) {
        continue;
      }

      const social = this._integrationManager.getSocialIntegration(provider!);
      const name = social?.name || provider;
      const period = dayjs(window.from).isAfter(dayjs())
        ? `the plan month starting ${dayjs(window.from).format('MMMM D')}`
        : 'this month';
      const left = Math.max(0, limit - used);
      const plan = `${caps.plan.plan} ${trial ? 'trial' : 'plan'}`;
      throw new SubscriptionException({
        action: AuthorizationActions.Create,
        section: Sections.PROVIDER_POSTS_PER_MONTH,
        message: `${
          left
            ? `Only ${left} of your ${limit} ${name} posts for ${period} on the ${plan} are left, and this needs ${queued.length} (every post of a thread counts).`
            : `You've used your ${limit} ${name} posts for ${period} on the ${plan}.`
        } ${this.limitHint(trial, social?.planLimitHint)}`,
      });
    }

    return cappedChannels;
  }

  // when a saved post publishes: now for "now" and for a date that passed
  private publishAt(type: CreatePostDto['type'], date?: string | Date) {
    return type === 'now' || !date || dayjs(date).isBefore(dayjs())
      ? new Date()
      : dayjs(date).toDate();
  }

  // The same check for a stored post that is queued again (a draft or a
  // published post scheduled through the API, rescheduled, or approved), with
  // every post of its thread, at its new date when it moves. Tells whether
  // its network is capped
  async checkStoredPostLimit(
    orgId: string,
    postId: string,
    date?: string | Date
  ) {
    // without billing nothing is capped, the thread isn't loaded
    if (!(await this._subscriptionService.getProviderPostsLimits(orgId))) {
      return false;
    }

    const ordered = await this.getPostsRecursively(postId, false, orgId, true);
    const [root] = ordered;
    if (!root) {
      return false;
    }

    const capped = await this.checkProviderPostsLimit(orgId, {
      type: 'schedule',
      date: date || root.publishDate,
      inter: root.intervalInDays,
      posts: [
        {
          integration: { id: root.integrationId },
          value: ordered.map((post) => ({ id: post.id })),
        },
      ],
    });
    return capped.size > 0;
  }

  // The backstop when a post goes out, whatever path queued it: a network the
  // plan caps a month only gets posts while the posts published this plan
  // month leave room for the whole thread. Returns why it can't go out
  async providerPublishProblem(
    orgId: string,
    providerIdentifier: string,
    posts: { id: string; parentPostId?: string | null }[]
  ): Promise<string | null> {
    if (!isCappedProvider(providerIdentifier) || !posts.length) {
      return null;
    }

    const plan = await this._subscriptionService.getProviderPostsLimits(orgId);
    if (!plan || plan.limits[providerIdentifier] === undefined) {
      return null;
    }

    // a main post reserves its comments, they go out right after it
    const count =
      posts.length === 1 && !posts[0].parentPostId
        ? Math.max(
            1,
            (await this.getPostsRecursively(posts[0].id, false, orgId)).length
          )
        : posts.length;

    const window = planMonth(plan.anchor);
    const used = await this._postRepository.countProviderUsage(
      orgId,
      providerIdentifier,
      window.from,
      window.until
    );
    const { limit, trial } = await this.capFor(
      plan,
      providerIdentifier,
      used + count,
      this.liveTrial(orgId)
    );
    if (used + count <= limit) {
      return null;
    }

    const social =
      this._integrationManager.getSocialIntegration(providerIdentifier);
    return `Monthly ${
      social?.name || providerIdentifier
    } post limit reached on the ${plan.plan} ${
      trial ? 'trial' : 'plan'
    } (${limit}). ${this.limitHint(trial, social?.planLimitHint)}`;
  }

  // The early warning of a network's posting rules for one connected account
  // (postingLimits, e.g. Reddit's 5 a day, 10 minutes apart), for the whole
  // save before anything is stored: each entry at the time it publishes,
  // against the account's published and queued posts around it. The publish
  // activity enforces the rules again when a post goes out
  // (postingLimitProblem).
  async checkPostingLimits(
    orgId: string,
    body: {
      type: CreatePostDto['type'];
      date?: string | Date;
      posts: {
        integration: { id: string };
        date?: string | Date;
        settings?: any;
        value?: { id?: string }[];
      }[];
    }
  ) {
    if (body.type === 'draft') {
      return;
    }

    for (const post of body.posts || []) {
      const provider = this._integrationManager.getSocialIntegration(
        post.settings?.__type
      );
      if (!provider?.postingLimits) {
        continue;
      }

      const ids = (post.value || []).map((value) => value.id!).filter(Boolean);
      // an update keeps the state of a stored post: only a queued one (or a
      // new one) still has to go out
      if (body.type === 'update') {
        const [root] = await this._postRepository.getPostsState(
          orgId,
          ids.slice(0, 1)
        );
        if (root && root.state !== 'QUEUE') {
          continue;
        }
      }

      const integration = await this._integrationService.getIntegrationById(
        orgId,
        post.integration.id
      );
      if (
        !integration ||
        integration.providerIdentifier !== provider.identifier
      ) {
        continue;
      }

      const problem = await this.postingLimitsProblemAt(
        integration,
        this.publishAt(body.type, post.date || body.date),
        true,
        ids
      );
      if (problem) {
        throw new BadRequestException(problem);
      }
    }
  }

  // The backstop when a post goes out, whatever path queued it: the account's
  // posts already published leave room for this one under the network's
  // posting rules. A published post counts at its publishDate, the time it
  // was due, which is when it went out unless the queue was backed up.
  // Returns why it can't go out
  async postingLimitProblem(
    integration: {
      providerIdentifier: string;
      internalId: string;
    },
    posts: { id: string }[]
  ): Promise<string | null> {
    // 30 seconds of slack: a post saved exactly 10 minutes after the last
    // one (accepted when saved) still goes out when the worker picks it up a
    // few seconds early or the clocks drift
    return this.postingLimitsProblemAt(
      integration,
      new Date(Date.now() + 30 * 1000),
      false,
      posts.map((post) => post.id)
    );
  }

  // The same check for a stored post that is queued again (a draft
  // scheduled, a post rescheduled or approved), at its new date when it moves.
  // Takes the post the caller already loaded: nothing is read for a network
  // without posting rules
  async checkStoredPostingLimits(
    orgId: string,
    post: {
      id: string;
      parentPostId?: string | null;
      publishDate: Date;
      integration?: {
        id: string;
        providerIdentifier: string;
        internalId?: string;
      } | null;
    },
    date?: string | Date
  ) {
    if (
      !post.integration ||
      post.parentPostId ||
      !this._integrationManager.getSocialIntegration(
        post.integration.providerIdentifier
      )?.postingLimits
    ) {
      return;
    }

    const integration = post.integration.internalId
      ? post.integration
      : await this._integrationService.getIntegrationById(
          orgId,
          post.integration.id
        );
    if (!integration?.internalId) {
      return;
    }

    const problem = await this.postingLimitsProblemAt(
      {
        providerIdentifier: integration.providerIdentifier,
        internalId: integration.internalId,
      },
      this.publishAt('schedule', date || post.publishDate),
      true,
      [post.id]
    );
    if (problem) {
      throw new BadRequestException(problem);
    }
  }

  // Whether one more post of the account at `at` keeps at most perDay posts
  // in any 24 hours and minSpacingMinutes between two posts, and if not, the
  // first time it could go out
  private async postingLimitsProblemAt(
    integration: {
      providerIdentifier: string;
      internalId: string;
    },
    at: Date,
    includeQueued: boolean,
    excludeIds: string[]
  ): Promise<string | null> {
    const provider = this._integrationManager.getSocialIntegration(
      integration.providerIdentifier
    );
    const limits = provider?.postingLimits;
    if (!limits) {
      return null;
    }

    const day = 24 * 60 * 60 * 1000;
    const spacing = limits.minSpacingMinutes * 60 * 1000;
    const dates = (
      await this._postRepository.getAccountPostingDates(
        integration.providerIdentifier,
        integration.internalId,
        new Date(at.getTime() - day),
        // queued posts up to two days ahead: the next allowed time can be
        // up to a day after the last post around `at`
        new Date(at.getTime() + (includeQueued ? 2 : 1) * day),
        includeQueued,
        excludeIds
      )
    ).map((date) => date.getTime());

    const fits = (time: number) => {
      if (dates.some((date) => Math.abs(date - time) < spacing)) {
        return false;
      }
      // the busiest 24 hours around `time` start at one of the posts
      const all = [...dates, time];
      return all
        .filter((start) => start <= time && start > time - day)
        .every(
          (start) =>
            all.filter((date) => date >= start && date < start + day).length <=
            limits.perDay
        );
    };

    if (fits(at.getTime())) {
      return null;
    }

    // the first moment that fits: right after a post's spacing, or when a
    // post leaves the 24 hours
    const next = dates
      .flatMap((date) => [date + spacing, date + day])
      .filter((time) => time > at.getTime())
      .sort((a, b) => a - b)
      .find(fits);

    return `${provider.name} allows ${limits.perDay} posts a day per account, at least ${
      limits.minSpacingMinutes
    } minutes apart.${
      next
        ? ` Next allowed at ${dayjs
            .utc(Math.ceil(next / 60000) * 60000)
            .format('YYYY-MM-DD HH:mm')} UTC.`
        : ''
    }`;
  }

  // Asks the payment provider once, and only when a check needs it, whether
  // the workspace is really in its trial
  private liveTrial(orgId: string) {
    let asked: Promise<boolean> | undefined;
    return () => (asked = asked || this._paymentService.isTrialing(orgId));
  }

  // The cap `total` posts are held to: the plan's, or the lower trial cap when
  // only that one would refuse them and the payment provider says the
  // subscription is trialing right now. isTrailing alone is not enough, the
  // stored flag can lag behind a webhook still on its way, and a provider
  // that can't be reached keeps the plan's cap
  private async capFor(
    plan: {
      limits: Record<string, number>;
      trialLimits?: Record<string, number>;
    },
    provider: string,
    total: number,
    trialing: () => Promise<boolean>
  ) {
    const limit = plan.limits[provider];
    const trialLimit = plan.trialLimits?.[provider];
    if (
      trialLimit === undefined ||
      trialLimit >= limit ||
      total <= trialLimit ||
      total > limit ||
      !(await trialing())
    ) {
      return { limit, trial: false };
    }
    return { limit: trialLimit, trial: true };
  }

  // What to do at a network's monthly cap. A trial has the trial cap whatever
  // plan it tries, a card and the end of the trial lift it to the plan's
  private limitHint(trial: boolean, planLimitHint?: string) {
    return trial
      ? `A free trial posts here as much as the ${pricing[TRIAL_POSTS_CAP_TIER].label} plan. Add a card, then end your trial on the Billing page to get your plan's full limit.`
      : planLimitHint || 'Upgrade your plan to post more.';
  }

  // the posts that went out to a capped network, what the cap counts
  async recordProviderPublish(
    orgId: string,
    providerIdentifier: string,
    postIds: string[]
  ) {
    if (!isCappedProvider(providerIdentifier) || !postIds.length) {
      return;
    }
    await this._postRepository.recordProviderUsage(
      orgId,
      providerIdentifier,
      postIds
    );
  }

  // Update ONLY the provider settings of a not-yet-published post (scheduled or
  // draft). The passed keys are merged into the existing settings; content and
  // publish date stay as they are, so the running publish workflow is left
  // untouched (type "update"). Shared by the agent/MCP tool and the public API
  // PUT /posts/:id/settings so both go through one path.
  async updatePostSettings(
    orgId: string,
    postId: string,
    settings: Record<string, any>,
    creationMethod: CreationMethod,
    // an agent's change to an approved or waiting post goes back to review
    actor?: ApprovalActor
  ): Promise<{ postId: string; publishDate: string }> {
    return this.updatePostInPlace(
      orgId,
      postId,
      { settings },
      creationMethod,
      actor
    );
  }

  // In-place edit of a post that was not published yet (scheduled or draft):
  // its settings (merged), its text and media (post and comments, the same
  // number of entries it has now) and its publish date. The post keeps its id
  // and group, so the calendar and the running workflow stay attached; a new
  // date restarts the workflow at that time (see createPost, type 'update').
  async updatePostInPlace(
    orgId: string,
    postId: string,
    changes: {
      settings?: Record<string, any>;
      // one entry per stored item (main post first, then its comments);
      // content or image left out keeps the stored one
      value?: Array<{ content?: string; image?: any[] }>;
      // UTC, YYYY-MM-DDTHH:mm:ss
      date?: string;
    },
    creationMethod: CreationMethod,
    actor?: ApprovalActor
  ): Promise<{ postId: string; publishDate: string }> {
    // Ordered as post -> comments, root includes integration and tags.
    const ordered = await this.getPostsRecursively(postId, true, orgId, true);

    const [root] = ordered;
    if (!root) {
      throw new NotFoundException('Post not found');
    }

    if (root.parentPostId) {
      throw new BadRequestException(
        'This id belongs to a comment, pass the id of the main post'
      );
    }

    if (root.state !== 'QUEUE' && root.state !== 'DRAFT') {
      throw new BadRequestException(
        'Only scheduled posts that were not published yet (or drafts) can be updated'
      );
    }

    if (
      root.state === 'QUEUE' &&
      dayjs.utc(root.publishDate).isBefore(dayjs.utc())
    ) {
      throw new BadRequestException(
        'The publish time of this post already passed, it cannot be updated'
      );
    }

    if (changes.value && changes.value.length !== ordered.length) {
      throw new BadRequestException(
        `This post has ${ordered.length} ${
          ordered.length === 1 ? 'entry' : 'entries'
        } (the post${
          ordered.length > 1 ? ` and ${ordered.length - 1} comment(s)` : ''
        }), pass exactly ${ordered.length} to change its text or media`
      );
    }

    let date = dayjs.utc(root.publishDate).format('YYYY-MM-DDTHH:mm:ss');
    if (changes.date) {
      const parsed = dayjs.utc(changes.date);
      if (!parsed.isValid()) {
        throw new BadRequestException(
          'The new date is not a valid date, use UTC like 2026-12-01T09:30:00'
        );
      }
      if (root.state === 'QUEUE' && !parsed.isAfter(dayjs.utc())) {
        throw new BadRequestException(
          'The new date of a scheduled post must be in the future'
        );
      }
      date = parsed.format('YYYY-MM-DDTHH:mm:ss');
    }

    const integration = (root as any).integration;

    let existingSettings: Record<string, any>;
    try {
      existingSettings = JSON.parse(root.settings || '{}');
    } catch (err) {
      existingSettings = {};
    }

    // Merge: only the passed keys change, everything else stays.
    const mergedSettings = {
      ...existingSettings,
      ...(changes.settings || {}),
      __type: integration.providerIdentifier,
    };

    // Keep the existing ids so the posts are updated in place (the workflow
    // identity is preserved)
    const value = ordered.map((p, index) => {
      let image = [];
      try {
        image = JSON.parse(p.image || '[]');
      } catch (err) {}
      const change = changes.value?.[index];
      return {
        id: p.id,
        content:
          change?.content !== undefined ? change.content : p.content,
        delay: p.delay || 0,
        image:
          change?.image !== undefined
            ? change.image.map((media: any) => ({
                ...media,
                id: media.id || makeId(10),
              }))
            : image,
      };
    });

    // Same server-side validation as the dashboard / public create route.
    const [validation] = await this.validatePosts(
      orgId,
      [
        {
          integration: { id: integration.id },
          date,
          settings: mergedSettings,
          value: value.map((p) => ({ content: p.content, image: p.image })),
        },
      ],
      'update'
    );

    if (validation.emptyContent) {
      throw new BadRequestException(
        `${validation.name}: Your post should have at least one character or one image.`
      );
    }

    if (root.state !== 'DRAFT') {
      if (!validation.valid) {
        throw new BadRequestException(
          `${validation.name}: ${
            validation.settingsError || 'Please fix your settings'
          }`
        );
      }

      if (validation.errors !== true) {
        throw new BadRequestException(
          `${validation.name}: ${validation.errors}`
        );
      }

      if (validation.tooLong) {
        throw new BadRequestException(
          `${validation.name}: The maximum characters is ${validation.maximumCharacters}`
        );
      }
    }

    const [output] = await this.createPost(
      orgId,
      {
        date,
        // In-place update: keep the current state; the running publish
        // workflow is only restarted when the date moved
        type: 'update',
        shortLink: false,
        tags: ((root as any).tags || []).map((t: any) => ({
          value: t.tag.name,
          label: t.tag.name,
        })),
        posts: [
          {
            integration,
            group: root.group,
            settings: mergedSettings,
            value,
          },
        ],
      } as any,
      creationMethod,
      // Keep the group stable: a client may have the calendar open while the
      // post is updated out of band, and the calendar links posts by group.
      true,
      actor,
      agentDraftOnly() ? root.updatedAt : undefined
    );

    if (!output) {
      throw new BadRequestException('Failed to update the post');
    }

    return {
      postId: output.postId,
      publishDate: date,
    };
  }

  async separatePosts(orgId: string, content: string, len: number) {
    return this._openaiService.separatePosts(orgId, content, len);
  }

  async changeState(id: string, state: State, err?: any, body?: any) {
    return this._postRepository.changeState(id, state, err, body);
  }

  async changePostStatus(
    orgId: string,
    id: string,
    status: 'draft' | 'schedule',
    actor?: ApprovalActor,
    // the explicit opt-in to change a post that went out, or is going out
    republish = false
  ) {
    const getPostById = await this.getStoredRootPost(orgId, id);
    if (getPostById.mcpWorkflowVersion === 114) {
      if (status === 'draft') return this.unscheduleMcp(orgId, id);
      return this.resumeMcp(orgId, id);
    }


    if (!republish) {
      this.guardAgainstRepublish(getPostById, 'changePostStatus');
      // a draft stops it, the safe direction; scheduling restarts it
      if (status === 'schedule') {
        this.guardAgainstPublishing(getPostById);
      }
    }

    // queued again from a draft, a failure or a published post (a draft held
    // for review is scheduled once approved, the check can't wait)
    if (status === 'schedule' && getPostById.state !== 'QUEUE') {
      await this.checkStoredPostLimit(orgId, id);
      await this.checkStoredPostingLimits(orgId, getPostById);
    }

    if (status === 'schedule' && actor?.type === 'agent') {
      await this._approvalPolicyService.assertAgentGuardrails(
        orgId,
        actor,
        [getPostById.integrationId],
        { countsTowardLimit: false }
      );
    }

    const decision =
      status === 'schedule' && actor
        ? await this._approvalPolicyService.decide(
            orgId,
            actor,
            'schedule',
            getPostById
          )
        : undefined;

    if (decision?.hold) {
      return this.holdStoredPost(orgId, getPostById, actor!, decision);
    }

    // the comments of a thread move with it, a scheduled thread whose
    // comments stayed drafts would fail every comment
    const state = status === 'draft' ? ('DRAFT' as const) : ('QUEUE' as const);
    await this._postRepository.changeGroupState(
      orgId,
      getPostById,
      state,
      republish
    );

    // startWorkflow logs its own failures
    await this.startWorkflow(
      getPostById.integration.providerIdentifier.split('-')[0].toLowerCase(),
      getPostById.id,
      orgId,
      state
    );

    return { id, state };
  }

  // A post that can't go out without an approver's review stays a draft
  private assertCanHold(post: { state: State; publishDate: Date }) {
    // a post that went out, or is going out now, can't be held anymore: a
    // published one can't wait as a draft for its second publish
    if (post.state === 'PUBLISHED') {
      throw new BadRequestException(
        'This post was already published. Publishing it again needs an approver in this workspace: ask one to reschedule it.'
      );
    }
    if (isBeingPublished(post)) {
      throw new BadRequestException('This post is already being published.');
    }
  }

  // Holds a stored post and its comments for review instead of queueing it,
  // like createPost does with a held save, and tells the approvers
  private async holdStoredPost(
    orgId: string,
    post: NonNullable<Awaited<ReturnType<PostsRepository['getPostById']>>>,
    actor: ApprovalActor,
    decision: ApprovalDecision
  ) {
    this.assertCanHold(post);
    if (post.approvalStatus !== 'IN_REVIEW' || post.state !== 'DRAFT') {
      await this._postRepository.holdForReview(orgId, post.group);
      // stops a publish workflow that may already be waiting
      await this.startWorkflow(
        post.integration.providerIdentifier.split('-')[0].toLowerCase(),
        post.id,
        orgId,
        'DRAFT'
      );
      await this._approvalPolicyService.afterSave(
        orgId,
        {
          id: post.id,
          content: post.content,
          integrationName: post.integration?.name,
          provider: post.integration?.providerIdentifier,
        },
        actor,
        { created: false, decision }
      );
    }
    // it stays a draft until an approver approves it
    return {
      id: post.id,
      state: 'DRAFT' as State,
      approvalStatus: 'IN_REVIEW',
      message:
        'The post is waiting for approval in PostDelegate, it will be scheduled once a teammate approves it.',
    };
  }

  // What would stop a stored post from publishing, checked again when it is
  // approved: it may have been saved as a draft (unchecked) while it waited.
  // Same checks and messages as updatePostSettings.
  async getStoredPostProblem(
    orgId: string,
    postId: string
  ): Promise<string | null> {
    const ordered = await this.getPostsRecursively(postId, true, orgId, true);
    const [root] = ordered;
    const integration = (root as any)?.integration;
    if (!root || !integration) {
      return null;
    }

    let settings: Record<string, any>;
    try {
      settings = JSON.parse(root.settings || '{}');
    } catch (err) {
      settings = {};
    }

    if (root.mcpWorkflowVersion === 114 && !await this.ownedMcpMedia(orgId, ordered.filter(p => p.state !== 'PUBLISHED').flatMap(p => JSON.parse(p.image || '[]')), true)) return 'its media is still processing or unavailable in this workspace';

    const [validation] = await this.validatePosts(orgId, [
      {
        integration: { id: integration.id },
        date: dayjs.utc(root.publishDate).format('YYYY-MM-DDTHH:mm:ss'),
        settings: { ...settings, __type: integration.providerIdentifier },
        value: ordered.map((p) => {
          let image = [];
          try {
            image = JSON.parse(p.image || '[]');
          } catch (err) {}
          return { content: p.content, image };
        }),
      },
    ]);

    if (!validation) {
      return null;
    }
    if (validation.disabled) return 'its channel is disabled';
    if (validation.emptyContent) {
      return 'it needs at least one character or one image';
    }
    if (!validation.valid) {
      return validation.settingsError || 'its channel settings need fixing';
    }
    if (validation.errors !== true) {
      return String(validation.errors);
    }
    if (validation.tooLong) {
      return `it is longer than the ${validation.maximumCharacters} characters the channel allows`;
    }
    return null;
  }

  // Review feedback joins the post's comments, the preview page shows them
  addReviewComment(
    orgId: string,
    postId: string,
    content: string,
    userId: string | null,
    displayName?: string
  ) {
    return this._postRepository.createComment(orgId, userId, postId, content, {
      displayName: userId ? undefined : displayName,
    });
  }

  async changeDate(
    orgId: string,
    id: string,
    date: string,
    action: 'schedule' | 'update' = 'schedule',
    republish = false,
    // who moves it: a failed or published post queued again goes through the
    // approval rules like any other schedule. Internal callers pass nothing.
    actor?: ApprovalActor
  ) {
    const getPostById = await this.getStoredRootPost(orgId, id);
    if (getPostById.mcpWorkflowVersion === 114) throw new BadRequestException('Unschedule this tracked MCP post before changing its schedule; review the new revision before resuming.');


    // schedule restarts the workflow: refused for a post that went out or is
    // going out, unless asked. update only moves the date, see below.
    if (action === 'schedule' && !republish) {
      this.guardAgainstRepublish(getPostById, 'changeDate');
      this.guardAgainstPublishing(getPostById);
    }

    // a post that ends up queued, again or in another plan month, is checked
    // against the plan's monthly cap on its network at its new date
    const queued =
      getPostById.state !== 'DRAFT' &&
      (action === 'schedule' || getPostById.state === 'QUEUE');
    if (queued) {
      await this.checkStoredPostingLimits(orgId, getPostById, date);
    }

    // queued again from a failure or a published post: an edit made while it
    // failed was never reviewed, a workspace that asks for approval holds it
    const requeued =
      action === 'schedule' &&
      getPostById.state !== 'DRAFT' &&
      getPostById.state !== 'QUEUE';
    const decision =
      requeued && actor
        ? await this._approvalPolicyService.decide(
            orgId,
            actor,
            'schedule',
            getPostById
          )
        : undefined;

    if (decision?.hold) {
      // checked before the new time is written, holdStoredPost checks again
      this.assertCanHold(getPostById);
      // the new time is kept, the post waits as a draft until approved
      await this._postRepository.changeDate(orgId, id, date, true, 'update');
      return this.holdStoredPost(orgId, getPostById, actor!, decision);
    }

    if (
      queued &&
      (await this.checkStoredPostLimit(orgId, id, date)) &&
      dayjs(date).isBefore(dayjs())
    ) {
      // a passed date publishes now, stored in the plan month it counted in
      date = dayjs().format('YYYY-MM-DDTHH:mm:ss');
    }

    // schedule: Set status to QUEUE and change date (reschedule the post)
    // update: Just change the date without changing the status
    const newDate = await this._postRepository.changeDate(
      orgId,
      id,
      date,
      getPostById.state === 'DRAFT',
      action
    );

    // schedule (re)starts it; update moves a queued post, the workflow
    // already waiting would still fire at the old time. Not one that is
    // going out now: restarting it could publish it twice, the date alone
    // moves. startWorkflow logs its own failures.
    if (
      action === 'schedule' ||
      (getPostById.state === 'QUEUE' && !isBeingPublished(getPostById))
    ) {
      await this.startWorkflow(
        getPostById.integration.providerIdentifier.split('-')[0].toLowerCase(),
        getPostById.id,
        orgId,
        getPostById.state === 'DRAFT' ? 'DRAFT' : 'QUEUE'
      );
    }

    return newDate;
  }

  async generatePostsDraft(orgId: string, body: CreateGeneratedPostsDto) {
    const getAllIntegrations = (
      await this._integrationService.getIntegrationsList(orgId)
    ).filter(
      (f) =>
        !f.disabled &&
        !['reddit', 'reddit-own-key'].includes(f.providerIdentifier)
    );

    // const posts = chunk(body.posts, getAllIntegrations.length);
    const allDates = dayjs()
      .isoWeek(body.week)
      .year(body.year)
      .startOf('isoWeek');

    const dates = [...new Array(7)].map((_, i) => {
      return allDates.add(i, 'day').format('YYYY-MM-DD');
    });

    const findTime = (): string => {
      const totalMinutes = Math.floor(Math.random() * 144) * 10;

      // Convert total minutes to hours and minutes
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;

      // Format hours and minutes to always be two digits
      const formattedHours = hours.toString().padStart(2, '0');
      const formattedMinutes = minutes.toString().padStart(2, '0');
      const randomDate =
        shuffle(dates)[0] + 'T' + `${formattedHours}:${formattedMinutes}:00`;

      if (dayjs(randomDate).isBefore(dayjs())) {
        return findTime();
      }

      return randomDate;
    };

    for (const integration of getAllIntegrations) {
      for (const toPost of body.posts) {
        const group = makeId(10);
        const randomDate = findTime();

        await this.createPost(
          orgId,
          {
            type: 'draft',
            date: randomDate,
            order: '',
            shortLink: false,
            tags: [],
            posts: [
              {
                group,
                integration: {
                  id: integration.id,
                },
                settings: {
                  __type: integration.providerIdentifier as any,
                  title: '',
                  tags: [],
                  subreddit: [],
                },
                value: [
                  ...toPost.list.map((l) => ({
                    id: '',
                    content: l.post,
                    delay: 0,
                    image: [],
                  })),
                  {
                    id: '',
                    delay: 0,
                    content: `Check out the full story here:\n${
                      body.postId || body.url
                    }`,
                    image: [],
                  },
                ],
              },
            ],
          },
          'WEB',
          false,
          undefined,
          undefined,
          undefined,
          // drafts the dashboard generator opens in the composer
          true
        );
      }
    }
  }

  findAllExistingCategories() {
    return this._postRepository.findAllExistingCategories();
  }

  findAllExistingTopicsOfCategory(category: string) {
    return this._postRepository.findAllExistingTopicsOfCategory(category);
  }

  findPopularPosts(category: string, topic?: string) {
    return this._postRepository.findPopularPosts(category, topic);
  }

  // the dates channels already post at, for a bulk schedule
  getPublishDatesOfIntegrations(
    orgId: string,
    integrationIds: string[],
    from: Date,
    until: Date
  ) {
    return this._postRepository.getPublishDatesOfIntegrations(
      orgId,
      integrationIds,
      from,
      until
    );
  }

  async findFreeDateTime(orgId: string, integrationId?: string) {
    const findTimes = await this._integrationService.findFreeDateTime(
      orgId,
      integrationId
    );
    return this.findFreeDateTimeRecursive(
      orgId,
      findTimes.length ? findTimes : [120, 400, 700],
      dayjs.utc().startOf('day'),
      0
    );
  }

  async createPopularPosts(post: {
    category: string;
    topic: string;
    content: string;
    hook: string;
  }) {
    return this._postRepository.createPopularPosts(post);
  }

  private async findFreeDateTimeRecursive(
    orgId: string,
    times: number[],
    date: dayjs.Dayjs,
    daysChecked: number
  ): Promise<string> {
    // stop searching after a year so an empty times list can never recurse forever
    if (daysChecked > 365) {
      return date
        .clone()
        .add(times[0] || 0, 'minutes')
        .format('YYYY-MM-DDTHH:mm:00');
    }

    const list = await this._postRepository.getPostsCountsByDates(
      orgId,
      times,
      date
    );

    if (!list.length) {
      return this.findFreeDateTimeRecursive(
        orgId,
        times,
        date.add(1, 'day'),
        daysChecked + 1
      );
    }

    const num = list.reduce<null | number>((prev, curr) => {
      if (prev === null || prev > curr) {
        return curr;
      }
      return prev;
    }, null) as number;

    return date.clone().add(num, 'minutes').format('YYYY-MM-DDTHH:mm:00');
  }

  // the public preview's comment list: unauthenticated by design
  async getComments(previewId: string) {
    const posts = await this.getPostsRecursively(
      previewId,
      false,
      PUBLIC_PREVIEW
    );
    const comments = await this._postRepository.getCommentsForPosts(
      posts.map((p) => p.id)
    );

    return comments.map((comment) => ({
      id: comment.id,
      postId: comment.postId,
      parentId: comment.parentId,
      content: comment.content,
      anchorStart: comment.anchorStart,
      anchorEnd: comment.anchorEnd,
      anchorQuote: comment.anchorQuote,
      resolvedAt: comment.resolvedAt,
      createdAt: comment.createdAt,
      name: comment.userId
        ? [comment.user?.name, comment.user?.lastName]
            .filter(Boolean)
            .join(' ')
            .trim() || null
        : comment.displayName,
    }));
  }

  async createPublicComment(
    previewId: string,
    body: CreatePublicCommentDto,
    userId: string | null,
    ip: string,
    // authenticated flow: the post must belong to the caller's organization
    orgId?: string
  ) {
    // unauthenticated commenters are allowed; the authenticated flow below
    // still checks the post belongs to the caller's organization
    const posts = await this.getPostsRecursively(
      previewId,
      false,
      PUBLIC_PREVIEW
    );
    if (!posts.length || (orgId && posts[0].organizationId !== orgId)) {
      throw new NotFoundException('Post not found');
    }

    let post = body.postId ? posts.find((p) => p.id === body.postId) : posts[0];
    if (!post) {
      throw new BadRequestException('Post does not belong to this preview');
    }

    if (!userId) {
      if (!body.displayName?.trim()) {
        throw new BadRequestException('Name is required');
      }
      await this.verifyRecaptcha(body.recaptchaToken, ip);
    }

    const hasStart = typeof body.anchorStart === 'number';
    const hasEnd = typeof body.anchorEnd === 'number';
    if (hasStart !== hasEnd) {
      throw new BadRequestException('Both anchor offsets are required');
    }

    if (body.parentId) {
      const parent = await this._postRepository.getCommentById(body.parentId);
      if (!parent || !posts.some((p) => p.id === parent.postId)) {
        throw new BadRequestException('Parent comment not found');
      }
      if (parent.parentId) {
        throw new BadRequestException(
          'Replies can only be added to a root comment'
        );
      }
      if (hasStart || body.anchorQuote) {
        throw new BadRequestException('Replies cannot be anchored');
      }
      post = posts.find((p) => p.id === parent.postId)!;
    }

    if (hasStart) {
      const plainText = postContentPlainText(post.content);
      if (
        body.anchorStart! < 0 ||
        body.anchorStart! >= body.anchorEnd! ||
        body.anchorEnd! > plainText.length
      ) {
        throw new BadRequestException('Anchor is out of range');
      }
      if (
        body.anchorQuote !== plainText.slice(body.anchorStart!, body.anchorEnd!)
      ) {
        throw new BadRequestException('Anchor does not match the post text');
      }
    }

    return this._postRepository.createComment(
      post.organizationId,
      userId,
      post.id,
      body.content,
      {
        displayName: userId ? undefined : body.displayName!.trim(),
        parentId: body.parentId,
        anchorStart: hasStart ? body.anchorStart : undefined,
        anchorEnd: hasStart ? body.anchorEnd : undefined,
        anchorQuote: hasStart ? body.anchorQuote : undefined,
      }
    );
  }

  private async verifyRecaptcha(token: string | undefined, ip: string) {
    if (!process.env.RECAPTCHA_SECRET_KEY) {
      return;
    }

    if (!token) {
      throw new BadRequestException('Captcha verification failed');
    }

    const result = await (
      await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          secret: process.env.RECAPTCHA_SECRET_KEY,
          response: token,
          remoteip: ip,
        }),
      })
    ).json();

    if (!result?.success) {
      throw new BadRequestException('Captcha verification failed');
    }
  }

  async resolveComment(orgId: string, commentId: string, resolved: boolean) {
    const comment = await this._postRepository.getCommentById(commentId);
    if (!comment || comment.post.organizationId !== orgId) {
      throw new NotFoundException('Comment not found');
    }
    if (comment.parentId) {
      throw new BadRequestException('Only root comments can be resolved');
    }

    return this._postRepository.setCommentResolved(
      commentId,
      resolved ? new Date() : null
    );
  }

  // A comment anchored to a span of text keeps its quote but loses the
  // highlight once the span no longer reads the same on the new content.
  async detachStaleAnchors(posts: { id: string; content: string }[]) {
    for (const post of posts) {
      const anchored = await this._postRepository.getAnchoredCommentsForPost(
        post.id
      );
      if (!anchored.length) {
        continue;
      }

      const plainText = postContentPlainText(post.content);
      const stale = anchored
        .filter(
          (c) => c.anchorQuote !== plainText.slice(c.anchorStart!, c.anchorEnd!)
        )
        .map((c) => c.id);

      if (stale.length) {
        await this._postRepository.detachAnchorsForPost(post.id, stale);
      }
    }
  }

  getTags(orgId: string) {
    return this._postRepository.getTags(orgId);
  }

  createTag(orgId: string, body: CreateTagDto) {
    return this._postRepository.createTag(orgId, body);
  }

  editTag(id: string, orgId: string, body: CreateTagDto) {
    return this._postRepository.editTag(id, orgId, body);
  }

  deleteTag(id: string, orgId: string) {
    return this._postRepository.deleteTag(id, orgId);
  }

  changeStateIf(
    id: string,
    expectedStates: State[],
    state: State,
    err?: any,
    body?: any,
    release?: { releaseId: string; releaseURL?: string }
  ) {
    return this._postRepository.changeStateIf(
      id,
      expectedStates,
      state,
      err,
      body,
      release
    );
  }
}
