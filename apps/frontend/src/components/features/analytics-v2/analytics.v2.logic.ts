// Pure helpers of the v2 Analytics dashboard (PD_FF_ANALYTICS_V2)

export interface InsightGroupLite {
  key: string;
  label: string;
  posts: number;
  score: number | null;
}

export interface InsightsLite {
  posts: number;
  contentTypes: InsightGroupLite[];
  lengths: InsightGroupLite[];
  hashtags: InsightGroupLite[];
  tags: InsightGroupLite[];
}

export interface BestTimesLite {
  basis: 'engagement' | 'publish_count';
  bestDays: Array<{ weekday: number; score: number; posts: number }>;
  bestHours: Array<{ hour: number; score: number; posts: number }>;
}

export type InsightKind = 'content_type' | 'length' | 'hashtag' | 'tag' | 'day' | 'hour';

export interface DashboardInsight {
  kind: InsightKind;
  key: string | number;
  label: string;
  // engagement relative to a typical post on the same channel (1 = typical)
  score: number;
  posts: number;
}

// a group counts once it has 2+ posts and beats a typical post
const bestOf = (groups: InsightGroupLite[] = []) =>
  groups
    .filter((group) => group.posts >= 2 && (group.score || 0) > 1)
    .sort((a, b) => (b.score || 0) - (a.score || 0) || b.posts - a.posts)[0];

// The strongest signal of each kind, best first, so the dashboard can say
// "Carousels get 1.8x the engagement of a typical post". Nothing is made up:
// without enough data the list is empty.
export const dashboardInsights = (
  insights?: InsightsLite | null,
  bestTimes?: BestTimesLite | null,
  max = 4
): DashboardInsight[] => {
  const result: DashboardInsight[] = [];
  const push = (kind: InsightKind, group?: InsightGroupLite) => {
    if (group && group.score) {
      result.push({ kind, key: group.key, label: group.label, score: group.score, posts: group.posts });
    }
  };
  if (insights) {
    push('content_type', bestOf(insights.contentTypes));
    push('length', bestOf(insights.lengths));
    push('hashtag', bestOf(insights.hashtags));
    push('tag', bestOf(insights.tags));
  }
  if (bestTimes?.basis === 'engagement') {
    const day = bestTimes.bestDays.find((d) => d.score > 1 && d.posts >= 2);
    if (day) {
      result.push({ kind: 'day', key: day.weekday, label: String(day.weekday), score: day.score, posts: day.posts });
    }
    const hour = bestTimes.bestHours.find((h) => h.score > 1 && h.posts >= 2);
    if (hour) {
      result.push({ kind: 'hour', key: hour.hour, label: String(hour.hour), score: hour.score, posts: hour.posts });
    }
  }
  return result.sort((a, b) => b.score - a.score).slice(0, max);
};
