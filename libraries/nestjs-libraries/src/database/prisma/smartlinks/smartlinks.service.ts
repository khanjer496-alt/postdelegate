import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { SmartLinksRepository } from '@gitroom/nestjs-libraries/database/prisma/smartlinks/smartlinks.repository';

dayjs.extend(utc);

export const SMARTLINKS_MAX_ITEMS = 50;

// paths and words a page address can't take
const RESERVED = new Set([
  'admin', 'api', 'app', 'auth', 'bio', 'billing', 'help', 'login', 'new',
  'postdelegate', 'settings', 'signup', 'support', 'www',
]);

export const smartLinksEnabled = () =>
  ['on', 'optin'].includes((process.env.PD_FF_SMARTLINKS || '').trim().toLowerCase());

export const normalizeSlug = (value: string) =>
  (value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');

export const validSlug = (slug: string) =>
  /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/.test(slug) && !RESERVED.has(slug);

// only web links; no javascript:, data: or relative paths
export const safeUrl = (value?: string | null) => {
  const raw = (value || '').trim();
  if (!raw) {
    return null;
  }
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.')) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
};

const safeColor = (value?: string | null) => {
  const match = /^#?([0-9a-f]{6})$/i.exec((value || '').trim());
  return match ? `#${match[1].toLowerCase()}` : null;
};

export interface SmartLinkStatRow {
  itemId: string;
  date: Date;
  views: number;
  clicks: number;
}

// views, clicks and click rate of the range, per day and per link
export const summarizeStats = (rows: SmartLinkStatRow[], from: Date, days: number) => {
  const byDay = new Map<string, { views: number; clicks: number }>();
  for (let i = 0; i < days; i++) {
    byDay.set(dayjs.utc(from).add(i, 'day').format('YYYY-MM-DD'), { views: 0, clicks: 0 });
  }
  const byItem: Record<string, number> = {};
  let views = 0;
  let clicks = 0;
  for (const row of rows) {
    const key = dayjs.utc(row.date).format('YYYY-MM-DD');
    const day = byDay.get(key);
    if (row.itemId === '') {
      views += row.views;
      if (day) day.views += row.views;
    } else {
      clicks += row.clicks;
      byItem[row.itemId] = (byItem[row.itemId] || 0) + row.clicks;
      if (day) day.clicks += row.clicks;
    }
  }
  return {
    views,
    clicks,
    // percent, null before the first view
    ctr: views ? Math.round((clicks / views) * 1000) / 10 : null,
    days: [...byDay.entries()].map(([date, value]) => ({ date, ...value })),
    byItem,
  };
};

export interface SmartLinkPageInput {
  slug: string;
  title: string;
  bio?: string | null;
  avatarUrl?: string | null;
  accentColor?: string | null;
  published?: boolean;
}

export interface SmartLinkItemInput {
  title?: string;
  url?: string;
  imageUrl?: string | null;
  active?: boolean;
}

@Injectable()
export class SmartLinksService {
  constructor(private _repository: SmartLinksRepository) {}

  private today(now = new Date()) {
    return dayjs.utc(now).startOf('day').toDate();
  }

  async get(orgId: string, days = 30, now = new Date()) {
    const page = await this._repository.getPage(orgId);
    if (!page) {
      return { page: null, items: [], stats: null };
    }
    const from = dayjs.utc(now).startOf('day').subtract(days - 1, 'day').toDate();
    const rows = await this._repository.getStats(page.id, from);
    const { items, ...rest } = page;
    return { page: rest, items, stats: summarizeStats(rows, from, days) };
  }

  async savePage(orgId: string, body: SmartLinkPageInput) {
    const slug = normalizeSlug(body.slug);
    if (!validSlug(slug)) {
      throw new BadRequestException(
        'Use 3 to 40 letters, numbers or dashes for the page address'
      );
    }
    if (await this._repository.slugTaken(slug, orgId)) {
      throw new ConflictException('That page address is taken');
    }
    const title = (body.title || '').trim().slice(0, 80);
    if (!title) {
      throw new BadRequestException('Add a page title');
    }
    await this._repository.upsertPage(orgId, {
      slug,
      title,
      bio: (body.bio || '').trim().slice(0, 300) || null,
      avatarUrl: safeUrl(body.avatarUrl),
      accentColor: safeColor(body.accentColor),
      published: !!body.published,
    });
    return this.get(orgId);
  }

  private async pageOf(orgId: string) {
    const page = await this._repository.getPage(orgId);
    if (!page) {
      throw new BadRequestException('Create your page first');
    }
    return page;
  }

  async addItem(orgId: string, body: SmartLinkItemInput) {
    const page = await this.pageOf(orgId);
    const url = safeUrl(body.url);
    const title = (body.title || '').trim().slice(0, 100);
    if (!url || !title) {
      throw new BadRequestException('Add a title and a web link (https://…)');
    }
    if (page.items.length >= SMARTLINKS_MAX_ITEMS) {
      throw new BadRequestException(`A page holds up to ${SMARTLINKS_MAX_ITEMS} links`);
    }
    await this._repository.createItem(page.id, {
      title,
      url,
      imageUrl: safeUrl(body.imageUrl),
      position: page.items.length
        ? Math.max(...page.items.map((item) => item.position)) + 1
        : 0,
    });
    return this.get(orgId);
  }

  async updateItem(orgId: string, id: string, body: SmartLinkItemInput) {
    const page = await this.pageOf(orgId);
    const data: Parameters<SmartLinksRepository['updateItem']>[2] = {};
    if (body.title !== undefined) {
      const title = body.title.trim().slice(0, 100);
      if (!title) throw new BadRequestException('Add a title');
      data.title = title;
    }
    if (body.url !== undefined) {
      const url = safeUrl(body.url);
      if (!url) throw new BadRequestException('Add a web link (https://…)');
      data.url = url;
    }
    if (body.imageUrl !== undefined) data.imageUrl = safeUrl(body.imageUrl);
    if (body.active !== undefined) data.active = !!body.active;
    const result = await this._repository.updateItem(page.id, id, data);
    if (!result.count) {
      throw new NotFoundException('Link not found');
    }
    return this.get(orgId);
  }

  async deleteItem(orgId: string, id: string) {
    const page = await this.pageOf(orgId);
    await this._repository.deleteItem(page.id, id);
    return this.get(orgId);
  }

  // ids in their new order; links of other pages are ignored
  async reorder(orgId: string, ids: string[]) {
    const page = await this.pageOf(orgId);
    const own = new Set(page.items.map((item) => item.id));
    const ordered = [...new Set(ids)].filter((id) => own.has(id));
    await Promise.all(
      ordered.map((id, position) => this._repository.updateItem(page.id, id, { position }))
    );
    return this.get(orgId);
  }

  // ---- public ----

  async publicPage(slug: string) {
    const page = await this._repository.getPageBySlug(normalizeSlug(slug));
    if (!page || !page.published) {
      throw new NotFoundException();
    }
    return {
      slug: page.slug,
      title: page.title,
      bio: page.bio,
      avatarUrl: page.avatarUrl,
      accentColor: page.accentColor,
      items: page.items
        .map((item) => ({
          id: item.id,
          title: item.title,
          imageUrl: item.imageUrl,
          url: safeUrl(item.url),
        }))
        .filter((item) => !!item.url),
    };
  }

  async recordView(slug: string, now = new Date()) {
    const page = await this._repository.getPageBySlug(normalizeSlug(slug));
    if (!page || !page.published) {
      throw new NotFoundException();
    }
    await this._repository.increment(page.id, '', this.today(now), 'views');
    return { ok: true };
  }

  // counts a click; the visitor follows the link itself
  async click(slug: string, itemId: string, now = new Date()) {
    const page = await this._repository.getPageBySlug(normalizeSlug(slug));
    const item = page?.published ? page.items.find((i) => i.id === itemId) : undefined;
    const url = safeUrl(item?.url);
    if (!page || !item || !url) {
      throw new NotFoundException();
    }
    await this._repository.increment(page.id, item.id, this.today(now), 'clicks');
    return { ok: true };
  }
}
