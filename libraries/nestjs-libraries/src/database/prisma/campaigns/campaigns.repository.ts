import { Injectable } from '@nestjs/common';
import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';

// Campaign dashboards (PD_FF_CAMPAIGNS) are built from the post tags the
// workspace already has: a tag of kind CAMPAIGN is a campaign. Every query is
// scoped to one organization and only reads.
@Injectable()
export class CampaignsRepository {
  constructor(
    private _tags: PrismaRepository<'tags'>,
    private _post: PrismaRepository<'post'>,
    private _analyticsPost: PrismaRepository<'analyticsPost'>
  ) {}

  getTags(orgId: string, kinds: Array<'TAG' | 'CAMPAIGN' | 'PILLAR'>) {
    return this._tags.model.tags.findMany({
      where: { orgId, deletedAt: null, kind: { in: kinds } },
      select: { id: true, name: true, color: true, kind: true, description: true },
      orderBy: { name: 'asc' },
      take: 500,
    });
  }

  // main posts (not comments or thread items) carrying any of the tags
  getTaggedPosts(orgId: string, tagIds: string[], from: Date, to: Date) {
    if (!tagIds.length) {
      return Promise.resolve([]);
    }
    return this._post.model.post.findMany({
      where: {
        organizationId: orgId,
        deletedAt: null,
        parentPostId: null,
        publishDate: { gte: from, lte: to },
        integration: { deletedAt: null },
        tags: { some: { tagId: { in: tagIds } } },
      },
      orderBy: { publishDate: 'desc' },
      take: 5000,
      select: {
        id: true,
        content: true,
        publishDate: true,
        state: true,
        releaseURL: true,
        group: true,
        integration: {
          select: { id: true, name: true, picture: true, providerIdentifier: true },
        },
        tags: { select: { tagId: true } },
      },
    });
  }

  getMetrics(orgId: string, postIds: string[]) {
    if (!postIds.length) {
      return Promise.resolve([]);
    }
    return this._analyticsPost.model.analyticsPost.findMany({
      where: { organizationId: orgId, postId: { in: postIds } },
      take: 10000,
      select: {
        postId: true,
        views: true,
        likes: true,
        comments: true,
        shares: true,
        clicks: true,
      },
    });
  }
}
