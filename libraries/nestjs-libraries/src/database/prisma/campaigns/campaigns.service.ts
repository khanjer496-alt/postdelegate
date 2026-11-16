import { Injectable } from '@nestjs/common';
import { CampaignsRepository } from '@gitroom/nestjs-libraries/database/prisma/campaigns/campaigns.repository';

export interface CampaignTotals {
  posts: number;
  scheduled: number;
  published: number;
  drafts: number;
  failed: number;
  channels: number;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  clicks: number | null;
  engagement: number | null;
}

export interface CampaignSummary {
  id: string;
  name: string;
  color: string;
  kind: 'TAG' | 'CAMPAIGN' | 'PILLAR';
  description: string | null;
  firstPost: string | null;
  lastPost: string | null;
  totals: CampaignTotals;
}

type PostRow = Awaited<ReturnType<CampaignsRepository['getTaggedPosts']>>[number];
type MetricRow = Awaited<ReturnType<CampaignsRepository['getMetrics']>>[number];

const DAY = 24 * 60 * 60 * 1000;
const sum = (values: Array<number | null | undefined>) => {
  const present = values.filter((v): v is number => typeof v === 'number');
  return present.length ? present.reduce((a, b) => a + b, 0) : null;
};

const plain = (html: string | null) =>
  (html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

@Injectable()
export class CampaignsService {
  constructor(private _campaignsRepository: CampaignsRepository) {}

  range(days: number, now = new Date()) {
    // campaigns span the past and the scheduled future
    return {
      from: new Date(now.getTime() - days * DAY),
      to: new Date(now.getTime() + days * DAY),
    };
  }

  totalsOf(posts: PostRow[], metrics: Map<string, MetricRow[]>): CampaignTotals {
    const rows = posts.flatMap((post) => metrics.get(post.id) || []);
    const likes = sum(rows.map((r) => r.likes));
    const comments = sum(rows.map((r) => r.comments));
    const shares = sum(rows.map((r) => r.shares));
    const engagement =
      likes === null && comments === null && shares === null
        ? null
        : (likes || 0) + (comments || 0) + (shares || 0);
    return {
      posts: posts.length,
      scheduled: posts.filter((p) => p.state === 'QUEUE').length,
      published: posts.filter((p) => p.state === 'PUBLISHED').length,
      drafts: posts.filter((p) => p.state === 'DRAFT').length,
      failed: posts.filter((p) => p.state === 'ERROR').length,
      channels: new Set(posts.map((p) => p.integration.id)).size,
      views: sum(rows.map((r) => r.views)),
      likes,
      comments,
      shares,
      clicks: sum(rows.map((r) => r.clicks)),
      engagement,
    };
  }

  private async load(orgId: string, tagIds: string[], days: number, now: Date) {
    const { from, to } = this.range(days, now);
    const posts = await this._campaignsRepository.getTaggedPosts(orgId, tagIds, from, to);
    const metricRows = await this._campaignsRepository.getMetrics(
      orgId,
      posts.map((p) => p.id)
    );
    const metrics = new Map<string, MetricRow[]>();
    for (const row of metricRows) {
      if (!row.postId) continue;
      metrics.set(row.postId, [...(metrics.get(row.postId) || []), row]);
    }
    return { posts, metrics };
  }

  // every campaign (and, when asked, every tag and pillar) with its totals
  async list(orgId: string, days: number, includeTags = false, now = new Date()) {
    const tags = await this._campaignsRepository.getTags(
      orgId,
      includeTags ? ['CAMPAIGN', 'PILLAR', 'TAG'] : ['CAMPAIGN']
    );
    const { posts, metrics } = await this.load(orgId, tags.map((t) => t.id), days, now);
    const campaigns: CampaignSummary[] = tags.map((tag) => {
      const tagged = posts.filter((p) => p.tags.some((t) => t.tagId === tag.id));
      const dates = tagged.map((p) => p.publishDate.getTime());
      return {
        id: tag.id,
        name: tag.name,
        color: tag.color,
        kind: tag.kind as CampaignSummary['kind'],
        description: tag.description,
        firstPost: dates.length ? new Date(Math.min(...dates)).toISOString() : null,
        lastPost: dates.length ? new Date(Math.max(...dates)).toISOString() : null,
        totals: this.totalsOf(tagged, metrics),
      };
    });
    return {
      days,
      campaigns: campaigns.sort(
        (a, b) =>
          b.totals.posts - a.totals.posts || a.name.localeCompare(b.name)
      ),
    };
  }

  // one campaign: totals, per-channel split and its posts
  async detail(orgId: string, tagId: string, days: number, now = new Date()) {
    const tags = await this._campaignsRepository.getTags(orgId, ['CAMPAIGN', 'PILLAR', 'TAG']);
    const tag = tags.find((t) => t.id === tagId);
    if (!tag) {
      return null;
    }
    const { posts, metrics } = await this.load(orgId, [tag.id], days, now);
    const byChannel = new Map<string, PostRow[]>();
    for (const post of posts) {
      byChannel.set(post.integration.id, [...(byChannel.get(post.integration.id) || []), post]);
    }
    return {
      days,
      campaign: {
        id: tag.id,
        name: tag.name,
        color: tag.color,
        kind: tag.kind,
        description: tag.description,
      },
      totals: this.totalsOf(posts, metrics),
      channels: [...byChannel.values()]
        .map((list) => ({
          id: list[0].integration.id,
          name: list[0].integration.name,
          picture: list[0].integration.picture,
          identifier: list[0].integration.providerIdentifier,
          totals: this.totalsOf(list, metrics),
        }))
        .sort((a, b) => b.totals.posts - a.totals.posts),
      posts: posts.slice(0, 200).map((post) => {
        const totals = this.totalsOf([post], metrics);
        const text = plain(post.content);
        return {
          id: post.id,
          group: post.group,
          publishDate: post.publishDate.toISOString(),
          state: post.state,
          url: /^https?:\/\//i.test(post.releaseURL || '') ? post.releaseURL : null,
          excerpt: text.length > 120 ? `${text.slice(0, 119)}…` : text,
          channel: {
            id: post.integration.id,
            name: post.integration.name,
            picture: post.integration.picture,
            identifier: post.integration.providerIdentifier,
          },
          views: totals.views,
          engagement: totals.engagement,
        };
      }),
    };
  }
}
