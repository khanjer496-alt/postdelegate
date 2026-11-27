// Pure helpers for the best-time slots (PD_FF_BEST_TIMES). The data comes
// from GET /analytics/best-times, which scores the workspace's published
// posts by engagement relative to each channel's typical post, bucketed by
// weekday (0 = Sunday) and hour in the user's timezone.
import type { Dayjs } from 'dayjs';

export interface BestTimesData {
  timezone: string;
  basis: 'engagement' | 'publish_count';
  posts: number;
  required: number;
  bestDays: Array<{ weekday: number; score: number; posts: number }>;
  bestHours: Array<{ hour: number; score: number; posts: number }>;
  heatmap: number[][];
  counts: number[][];
}

export interface BestSlot {
  weekday: number; // 0 = Sunday, like Dayjs#day()
  hour: number;
  score: number; // 1 = a typical post on its channel
  posts: number;
}

// a bucket needs this many posts before it counts (the same as the API)
export const MIN_SLOT_POSTS = 2;
export const MAX_SLOTS = 6;

export const slotKey = (weekday: number, hour: number) => `${weekday}-${hour}`;

// The strongest weekday/hour buckets that beat a typical post. Empty until
// the workspace has enough posts with stats (basis "engagement"), so nothing
// is shown from guesswork.
export const pickBestSlots = (
  data?: BestTimesData | null,
  max = MAX_SLOTS
): BestSlot[] => {
  if (!data || data.basis !== 'engagement' || !data.heatmap?.length) {
    return [];
  }
  const slots: BestSlot[] = [];
  data.heatmap.forEach((hours, weekday) =>
    hours.forEach((score, hour) => {
      const posts = data.counts?.[weekday]?.[hour] || 0;
      if (posts >= MIN_SLOT_POSTS && score > 1) {
        slots.push({ weekday, hour, score, posts });
      }
    })
  );
  return slots
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.posts - a.posts ||
        a.weekday - b.weekday ||
        a.hour - b.hour
    )
    .slice(0, max);
};

// The next start of a best slot after `now` (within two weeks), skipping
// hours that already have a post. `now` is a Dayjs in the user's timezone.
export const nextBestTime = (
  now: Dayjs,
  slots: BestSlot[],
  taken: Set<string> = new Set()
): Dayjs | null => {
  if (!slots.length) {
    return null;
  }
  const wanted = new Set(slots.map((slot) => slotKey(slot.weekday, slot.hour)));
  let at = now.startOf('hour').add(1, 'hour');
  for (let i = 0; i < 24 * 14; i++, at = at.add(1, 'hour')) {
    if (
      wanted.has(slotKey(at.day(), at.hour())) &&
      !taken.has(at.format('YYYY-MM-DD-HH'))
    ) {
      return at;
    }
  }
  return null;
};

// The next channel posting slot (Settings > time slots, minutes after UTC
// midnight) after `now`; the fallback while there are no best times yet.
export const nextPostingSlot = (
  now: Dayjs,
  slotMinutesUtc: number[],
  toLocal: (utcMidnightPlusMinutes: Date) => Dayjs
): Dayjs | null => {
  if (!slotMinutesUtc.length) {
    return null;
  }
  const local = slotMinutesUtc.map((minutes) =>
    toLocal(new Date(Date.UTC(2000, 0, 1) + minutes * 60000))
  );
  for (let day = 0; day < 8; day++) {
    const base = now.startOf('day').add(day, 'day');
    const candidates = local
      .map((slot) => base.hour(slot.hour()).minute(slot.minute()))
      .filter((at) => at.isAfter(now))
      .sort((a, b) => a.valueOf() - b.valueOf());
    if (candidates.length) {
      return candidates[0];
    }
  }
  return null;
};
