import { Injectable } from '@nestjs/common';
import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';

// SmartLinks (PD_FF_SMARTLINKS). Every owner query is scoped to one
// organization; the public reads go by slug and only return published pages.
@Injectable()
export class SmartLinksRepository {
  constructor(
    private _page: PrismaRepository<'smartLinkPage'>,
    private _item: PrismaRepository<'smartLinkItem'>,
    private _stat: PrismaRepository<'smartLinkStat'>
  ) {}

  getPage(orgId: string) {
    return this._page.model.smartLinkPage.findUnique({
      where: { organizationId: orgId },
      include: { items: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] } },
    });
  }

  getPageBySlug(slug: string) {
    return this._page.model.smartLinkPage.findUnique({
      where: { slug },
      include: {
        items: {
          where: { active: true },
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
  }

  slugTaken(slug: string, orgId: string) {
    return this._page.model.smartLinkPage
      .findFirst({
        where: { slug, NOT: { organizationId: orgId } },
        select: { id: true },
      })
      .then((page) => !!page);
  }

  upsertPage(
    orgId: string,
    data: {
      slug: string;
      title: string;
      bio: string | null;
      avatarUrl: string | null;
      accentColor: string | null;
      published: boolean;
    }
  ) {
    return this._page.model.smartLinkPage.upsert({
      where: { organizationId: orgId },
      create: { organizationId: orgId, ...data },
      update: data,
    });
  }

  countItems(pageId: string) {
    return this._item.model.smartLinkItem.count({ where: { pageId } });
  }

  createItem(
    pageId: string,
    data: { title: string; url: string; imageUrl: string | null; position: number }
  ) {
    return this._item.model.smartLinkItem.create({ data: { pageId, ...data } });
  }

  // updateMany keeps the page scope in the where clause
  updateItem(
    pageId: string,
    id: string,
    data: Partial<{ title: string; url: string; imageUrl: string | null; active: boolean; position: number }>
  ) {
    return this._item.model.smartLinkItem.updateMany({
      where: { id, pageId },
      data,
    });
  }

  deleteItem(pageId: string, id: string) {
    return this._item.model.smartLinkItem.deleteMany({ where: { id, pageId } });
  }

  getStats(pageId: string, from: Date) {
    return this._stat.model.smartLinkStat.findMany({
      where: { pageId, date: { gte: from } },
      select: { itemId: true, date: true, views: true, clicks: true },
    });
  }

  increment(pageId: string, itemId: string, date: Date, field: 'views' | 'clicks') {
    return this._stat.model.smartLinkStat.upsert({
      where: { pageId_itemId_date: { pageId, itemId, date } },
      create: { pageId, itemId, date, [field]: 1 },
      update: { [field]: { increment: 1 } },
    });
  }
}
