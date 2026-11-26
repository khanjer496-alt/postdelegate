import {
  AnalyticsData,
  AuthTokenDetails,
  CommentPost,
  PostComment,
  PostDetails,
  PostResponse,
  SocialProvider,
  ViewsMetric,
} from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import { makeSecureId } from '@gitroom/nestjs-libraries/services/make.secure.id';
import dayjs from 'dayjs';
import {
  BadBody,
  AnalyticsUnavailable,
  markPartialAnalytics,
  SocialAbstract,
  ValidityMedia,
} from '@gitroom/nestjs-libraries/integrations/social.abstract';
import { InstagramDto } from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/instagram.dto';
import { InstagramProvider } from '@gitroom/nestjs-libraries/integrations/social/instagram.provider';
import { META_GRAPH_API_VERSION } from '@gitroom/nestjs-libraries/integrations/social/facebook.provider';
import { Integration } from '@prisma/client';
import { Rules } from '@gitroom/nestjs-libraries/chat/rules.description.decorator';

const instagramProvider = new InstagramProvider();

// pages of 50 comments read per post (the comments view and auto-replies)
const COMMENT_PAGES = 4;

@Rules(
  "Instagram should have at least one attachment, if it's a story, it can have only one picture"
)
export class InstagramStandaloneProvider
  extends SocialAbstract
  implements SocialProvider
{
  identifier = 'instagram-standalone';
  name = 'Instagram\n(Standalone)';
  isBetweenSteps = false;
  refreshCron = true;
  optionalScopes = [
    'instagram_business_manage_comments',
    'instagram_business_manage_insights',
  ];
  override get analyticsAvailable() {
    return ['instagram_business_manage_insights'].every((scope) =>
      this.scopes.includes(scope)
    );
  }
  override get plugsAvailable() {
    return this.scopes.includes('instagram_business_manage_comments');
  }
  // the comments view needs instagram_business_manage_comments, which is only
  // requested when INSTAGRAM_STANDALONE_OPTIONAL_SCOPES lists it
  override get commentsAvailable() {
    return this.scopes.includes('instagram_business_manage_comments');
  }
  get scopes() {
    return this.requestedScopes([
      'instagram_business_basic',
      'instagram_business_content_publish',
    ]);
  }
  override maxConcurrentJob = 200; // Instagram standalone has stricter limits
  dto = InstagramDto;

  editor = 'normal' as const;

  // the same analytics as the Instagram provider, see its viewsMetric
  viewsMetric: ViewsMetric = { post: ['Views'] };
  maxLength() {
    return 2200;
  }

  override async checkValidity(
    [firstPost]: Array<ValidityMedia[]>,
    settings: any
  ): Promise<string | true> {
    if (!firstPost?.length) {
      return 'Should have at least one media';
    }
    if (this.assetBoolean(settings?.is_trial_reel)) {
      if ((firstPost?.length ?? 0) > 1) {
        return 'Trial Reels can only have one video';
      }
      const hasVideo = firstPost?.some(
        (f) => (f?.path?.indexOf?.('mp4') ?? -1) > -1
      );
      if (!hasVideo) {
        return 'Trial Reels must be a video';
      }
    }
    if (firstPost?.some((f) => (f?.alt?.length ?? 0) > 1000)) {
      return 'Instagram alt text can be up to 1000 characters';
    }
    return true;
  }

  public override handleErrors(
    body: string,
    status: number
  ):
    | {
        type: 'refresh-token' | 'bad-body' | 'retry' | 'disconnect';
        value: string;
      }
    | undefined {
    return instagramProvider.handleErrors(body, status);
  }

  async refreshToken(refresh_token: string): Promise<AuthTokenDetails> {
    const { access_token } = await (
      await fetch(
        `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${refresh_token}`
      )
    ).json();

    const {
      user_id,
      name,
      username,
      profile_picture_url = '',
    } = await (
      await fetch(
        `https://graph.instagram.com/${META_GRAPH_API_VERSION}/me?fields=user_id,username,name,profile_picture_url&access_token=${access_token}`
      )
    ).json();

    return {
      id: user_id,
      name,
      accessToken: access_token,
      refreshToken: access_token,
      expiresIn: dayjs().add(58, 'days').unix() - dayjs().unix(),
      picture: profile_picture_url || '',
      username,
    };
  }

  async generateAuthUrl() {
    const state = makeSecureId(6);
    return {
      url:
        `https://www.instagram.com/oauth/authorize?enable_fb_login=0&client_id=${
          process.env.INSTAGRAM_APP_ID
        }&redirect_uri=${encodeURIComponent(
          `${
            process?.env.FRONTEND_URL?.indexOf('https') == -1
              ? `https://redirectmeto.com/${process?.env.FRONTEND_URL}`
              : `${process?.env.FRONTEND_URL}`
          }/integrations/social/instagram-standalone`
        )}&response_type=code&scope=${encodeURIComponent(
          this.scopes.join(',')
        )}` + `&state=${state}`,
      codeVerifier: makeSecureId(10),
      state,
    };
  }

  async authenticate(params: {
    code: string;
    codeVerifier: string;
    refresh: string;
  }) {
    const formData = new FormData();
    formData.append('client_id', process.env.INSTAGRAM_APP_ID!);
    formData.append('client_secret', process.env.INSTAGRAM_APP_SECRET!);
    formData.append('grant_type', 'authorization_code');
    formData.append(
      'redirect_uri',
      `${
        process?.env.FRONTEND_URL?.indexOf('https') == -1
          ? `https://redirectmeto.com/${process?.env.FRONTEND_URL}`
          : `${process?.env.FRONTEND_URL}`
      }/integrations/social/instagram-standalone`
    );
    formData.append('code', params.code);

    const getAccessToken = await (
      await fetch('https://api.instagram.com/oauth/access_token', {
        method: 'POST',
        body: formData,
      })
    ).json();

    if (!getAccessToken.access_token) {
      console.error(
        'Instagram standalone token exchange failed:',
        JSON.stringify(getAccessToken)
      );
      throw new Error(
        getAccessToken.error_message || 'Instagram token exchange failed'
      );
    }

    const { access_token, expires_in, ...all } = await (
      await fetch(
        'https://graph.instagram.com/access_token' +
          '?grant_type=ig_exchange_token' +
          `&client_id=${process.env.INSTAGRAM_APP_ID}` +
          `&client_secret=${process.env.INSTAGRAM_APP_SECRET}` +
          `&access_token=${getAccessToken.access_token}`
      )
    ).json();

    this.checkScopes(this.scopes, getAccessToken.permissions);
    const scopeWarnings = this.scopeWarnings(getAccessToken.permissions);

    const { user_id, name, username, profile_picture_url } = await (
      await fetch(
        `https://graph.instagram.com/${META_GRAPH_API_VERSION}/me?fields=user_id,username,name,profile_picture_url&access_token=${access_token}`
      )
    ).json();

    return {
      scopeWarnings,
      id: user_id,
      name,
      accessToken: access_token,
      refreshToken: access_token,
      expiresIn: dayjs().add(58, 'days').unix() - dayjs().unix(),
      picture: profile_picture_url,
      username,
    };
  }

  // it publishes through the same provider, so it stores the same permalinks
  isPublicReleaseURL(releaseURL: string, settings: Partial<InstagramDto>) {
    return instagramProvider.isPublicReleaseURL(releaseURL, settings);
  }

  async post(
    id: string,
    accessToken: string,
    postDetails: PostDetails<InstagramDto>[],
    integration: Integration
  ): Promise<PostResponse[]> {
    return instagramProvider.post(
      id,
      accessToken,
      postDetails,
      integration,
      'graph.instagram.com'
    );
  }

  async postPending(
    id: string,
    accessToken: string,
    postDetails: PostDetails<InstagramDto>[],
    integration: Integration
  ): Promise<PostResponse[]> {
    return instagramProvider.postPending(
      id,
      accessToken,
      postDetails,
      integration,
      'graph.instagram.com'
    );
  }

  // the graph domain travels inside pendingData, so these are pure delegations
  override async checkPostStatus(
    accessToken: string,
    pendingData: any,
    integration: Integration
  ) {
    return instagramProvider.checkPostStatus(
      accessToken,
      pendingData,
      integration
    );
  }

  override async finalizePost(
    accessToken: string,
    pendingData: any,
    integration: Integration
  ) {
    return instagramProvider.finalizePost(
      accessToken,
      pendingData,
      integration
    );
  }

  async comment(
    id: string,
    postId: string,
    lastCommentId: string | undefined,
    accessToken: string,
    postDetails: PostDetails<InstagramDto>[],
    integration: Integration
  ): Promise<PostResponse[]> {
    // Existing scheduled replies use their token grants, not consent defaults.
    return instagramProvider.comment(
      id,
      postId,
      lastCommentId,
      accessToken,
      postDetails,
      integration,
      'graph.instagram.com'
    );
  }

  // The comments view (PD_FF_COMMENTS), instagram_business_manage_comments:
  // the channel's latest media, their comments, and replying, hiding and
  // deleting a comment through the Instagram Login Graph API
  async commentPosts(
    id: string,
    accessToken: string,
    limit: number
  ): Promise<CommentPost[]> {
    const [token] = accessToken.split('___');
    const { data = [] } = await (
      await this.fetch(
        `https://graph.instagram.com/${META_GRAPH_API_VERSION}/${id}/media?fields=id,caption,permalink,media_type,media_url,thumbnail_url,timestamp,comments_count&access_token=${token}&limit=${limit}`
      )
    ).json();
    return data.map((media: any) => ({
      id: media.id,
      caption: media.caption || '',
      permalink: media.permalink,
      thumbnail: media.thumbnail_url || media.media_url,
      createdAt: media.timestamp,
      comments: media.comments_count || 0,
    }));
  }

  private toComment(id: string, comment: any): PostComment {
    return {
      id: comment.id,
      text: comment.text || '',
      username: comment.username || comment.from?.username || '',
      createdAt: comment.timestamp,
      hidden: !!comment.hidden,
      // Instagram only returns `user` on comments the account wrote itself
      own: !!comment.user || comment.from?.id === id,
      replies: (comment.replies?.data || []).map((reply: any) =>
        this.toComment(id, reply)
      ),
    };
  }

  async postComments(
    id: string,
    accessToken: string,
    postId: string
  ): Promise<PostComment[]> {
    const [token] = accessToken.split('___');
    const fields = encodeURIComponent(
      'id,text,username,from,user,timestamp,hidden,replies{id,text,username,from,user,timestamp,hidden}'
    );
    // follows the pages Instagram returns, up to COMMENT_PAGES of 50, so the
    // view and the auto-reply rules see more than the first 50 comments
    const comments: PostComment[] = [];
    let nextUrl: string | undefined = `https://graph.instagram.com/${META_GRAPH_API_VERSION}/${postId}/comments?fields=${fields}&limit=50&access_token=${token}`;
    for (let page = 0; nextUrl && page < COMMENT_PAGES; page++) {
      const response: any = await (await this.fetch(nextUrl)).json();
      comments.push(
        ...(response.data || []).map((comment: any) => this.toComment(id, comment))
      );
      nextUrl = response.paging?.next;
    }
    return comments;
  }

  async replyToComment(
    id: string,
    accessToken: string,
    commentId: string,
    message: string
  ) {
    const [token] = accessToken.split('___');
    const { id: replyId } = await (
      await this.fetch(
        `https://graph.instagram.com/${META_GRAPH_API_VERSION}/${commentId}/replies?message=${encodeURIComponent(
          message
        )}&access_token=${token}`,
        { method: 'POST' }
      )
    ).json();
    return { id: replyId };
  }

  async hideComment(
    id: string,
    accessToken: string,
    commentId: string,
    hide: boolean
  ) {
    const [token] = accessToken.split('___');
    await this.fetch(
      `https://graph.instagram.com/${META_GRAPH_API_VERSION}/${commentId}?hide=${hide}&access_token=${token}`,
      { method: 'POST' }
    );
  }

  async deleteComment(id: string, accessToken: string, commentId: string) {
    const [token] = accessToken.split('___');
    await this.fetch(
      `https://graph.instagram.com/${META_GRAPH_API_VERSION}/${commentId}?access_token=${token}`,
      { method: 'DELETE' }
    );
  }

  async accountStats(id: string, accessToken: string) {
    return instagramProvider.accountStats(
      id,
      accessToken,
      'graph.instagram.com'
    );
  }

  // percentageChange 0 hides the trend badge: nothing here measures a real
  // comparison against an earlier period, so no trend is claimed.
  // A finite total_value is the card number when the daily series is missing
  // or is only zeros. A real series is kept. One failed request does not drop
  // totals already read from the other. Same two requests as production.
  private insightCard(metric: any): AnalyticsData | null {
    const labels: Record<string, string> = {
      follower_count: 'Follower Count',
      reach: 'Reach',
      likes: 'Likes',
      views: 'Views',
      comments: 'Comments',
      shares: 'Shares',
      saves: 'Saves',
      replies: 'Replies',
    };
    const label =
      metric && typeof metric.name === 'string' ? labels[metric.name] : undefined;
    if (!label) return null;
    const rawTotal = metric.total_value?.value;
    const total =
      typeof rawTotal === 'number' && Number.isFinite(rawTotal) && rawTotal >= 0
        ? rawTotal
        : undefined;
    const series = Array.isArray(metric.values)
      ? metric.values.filter(
          (point: any) =>
            typeof point?.value === 'number' &&
            Number.isFinite(point.value) &&
            point.value >= 0
        )
      : [];
    const seriesSum = series.reduce(
      (sum: number, point: any) => sum + point.value,
      0
    );
    const today = dayjs().format('YYYY-MM-DD');
    if (total !== undefined && (series.length === 0 || (seriesSum === 0 && total > 0))) {
      return {
        label,
        percentageChange: 0,
        data: [{ total: String(total), date: today }],
      };
    }
    if (series.length === 0) return null;
    return {
      label,
      percentageChange: 0,
      data: series.map((point: any) => ({
        total: String(point.value),
        date: dayjs(point.end_time).format('YYYY-MM-DD'),
      })),
    };
  }

  async analytics(
    id: string,
    accessToken: string,
    date: number
  ): Promise<AnalyticsData[]> {
    const [token] = accessToken.split('___');
    const until = dayjs().startOf('day').unix();
    const since = dayjs().subtract(date, 'day').unix();
    const root = `https://graph.instagram.com/${META_GRAPH_API_VERSION}/${id}/insights`;
    const urls = [
      `${root}?metric=follower_count,reach&access_token=${token}&period=day&since=${since}&until=${until}`,
      `${root}?metric_type=total_value&metric=likes,views,comments,shares,saves,replies&access_token=${token}&period=day&since=${since}&until=${until}`,
    ];
    const analytics: AnalyticsData[] = [];
    let failed = false;
    for (const url of urls) {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          failed = true;
          continue;
        }
        const body = await response.json();
        if (body?.error || !Array.isArray(body?.data)) {
          failed = true;
          continue;
        }
        for (const metric of body.data) {
          const card = this.insightCard(metric);
          if (card) analytics.push(card);
        }
      } catch {
        failed = true;
      }
    }
    if (analytics.length === 0 && failed) throw new AnalyticsUnavailable();
    return failed ? markPartialAnalytics(analytics) : analytics;
  }

  async postAnalytics(
    integrationId: string,
    accessToken: string,
    postId: string,
    date: number
  ) {
    return instagramProvider.postAnalytics(
      integrationId,
      accessToken,
      postId,
      date,
      'graph.instagram.com'
    );
  }
}
