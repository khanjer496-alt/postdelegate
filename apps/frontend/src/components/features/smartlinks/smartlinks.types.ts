// SmartLinks (PD_FF_SMARTLINKS): shapes shared by the editor and the public page
export interface SmartLinkPage {
  id: string;
  slug: string;
  title: string;
  bio: string | null;
  avatarUrl: string | null;
  accentColor: string | null;
  published: boolean;
}

export interface SmartLinkItem {
  id: string;
  title: string;
  url: string;
  imageUrl: string | null;
  position: number;
  active: boolean;
}

export interface SmartLinkStats {
  views: number;
  clicks: number;
  ctr: number | null;
  days: Array<{ date: string; views: number; clicks: number }>;
  byItem: Record<string, number>;
}

export interface SmartLinksResponse {
  page: SmartLinkPage | null;
  items: SmartLinkItem[];
  stats: SmartLinkStats | null;
}

export interface PublicSmartLinkPage {
  slug: string;
  title: string;
  bio: string | null;
  avatarUrl: string | null;
  accentColor: string | null;
  items: Array<{ id: string; title: string; imageUrl: string | null; url: string }>;
}

export const DEFAULT_ACCENT = '#7357ff';

export const accentOf = (value?: string | null) =>
  /^#[0-9a-f]{6}$/i.test(value || '') ? (value as string) : DEFAULT_ACCENT;

// black or white text, whichever reads better on the accent
export const textOnAccent = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6 ? '#111118' : '#ffffff';
};

export const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

export const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};
