'use client';

// v2 Analytics (PD_FF_ANALYTICS_V2): a dashboard tab (KPI cards, follower
// trend, top-posts gallery, insights) in front of the existing analytics
// sections, which keep their own data calls and behavior.
import React, { FC, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import clsx from 'clsx';
import useCookie from 'react-use-cookie';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { getTimezone } from '@gitroom/frontend/components/layout/set.timezone';
import {
  formatNumber,
  hourName,
  isWebUrl,
  Range,
  RANGES,
  swrOptions,
  useCsvDownload,
  weekdayName,
} from '@gitroom/frontend/components/platform-analytics/analytics.ui';
import {
  LineChart,
  TrendsSection,
  useAnalyticsTrends,
} from '@gitroom/frontend/components/platform-analytics/analytics.trends';
import { TopPostsSection } from '@gitroom/frontend/components/platform-analytics/analytics.top.posts';
import { ViewsSection } from '@gitroom/frontend/components/platform-analytics/analytics.views';
import {
  InsightsSection,
  useInsightLabels,
} from '@gitroom/frontend/components/platform-analytics/analytics.insights';
import { ReportsSection } from '@gitroom/frontend/components/platform-analytics/analytics.reports';
import { PlatformAnalytics } from '@gitroom/frontend/components/platform-analytics/platform.analytics';
import { ChannelAvatarV2 } from '@gitroom/frontend/components/launches/v2/ui.v2';
import {
  buttonV2,
  CardV2,
  EmptyV2,
  KpiCardV2,
  PageV2,
  TabsV2,
} from '@gitroom/frontend/components/features/ui/kit.v2';
import {
  BestTimesLite,
  dashboardInsights,
  InsightsLite,
} from './analytics.v2.logic';

const SECTIONS = [
  'dashboard',
  'trends',
  'views',
  'top',
  'insights',
  'reports',
  'channels',
] as const;
type Section = (typeof SECTIONS)[number];

interface OverviewTotals {
  totals: { published: number; scheduled: number; failed: number };
}

interface GalleryPost {
  id: string;
  postId: string | null;
  channel: { id: string; name: string; picture: string | null; identifier: string };
  title: string | null;
  url: string | null;
  publishedAt: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  engagement: number | null;
  engagementRate: number | null;
  thumbnail: string | null;
  mediaType: 'video' | 'carousel' | 'image' | 'text';
  excerpt: string;
}

const useJson = <T,>(key: string | null) => {
  const fetch = useFetch();
  const load = useCallback(async (path: string) => {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(path);
    }
    return (await response.json()) as T;
  }, []);
  return useSWR<T>(key, load, swrOptions);
};

const RangeV2: FC<{ value: Range; onChange: (value: Range) => void }> = ({
  value,
  onChange,
}) => {
  const t = useT();
  return (
    <div
      role="group"
      aria-label={t('analytics_range', 'Date range')}
      className="flex p-[3px] rounded-[10px] bg-pdSurface border border-pdLine"
    >
      {RANGES.map((range) => (
        <button
          key={range}
          type="button"
          aria-pressed={value === range}
          onClick={() => onChange(range)}
          className={clsx(
            'px-[10px] h-[26px] rounded-[7px] text-[12.5px] font-[600]',
            value === range
              ? 'bg-pdSurface2 text-newTextColor ring-1 ring-pdLine2'
              : 'text-textItemBlur hover:text-newTextColor'
          )}
        >
          {t('analytics_range_days', '{{days}} days', { days: range })}
        </button>
      ))}
    </div>
  );
};

const Gallery: FC<{ days: Range }> = ({ days }) => {
  const t = useT();
  const { data, isLoading, error } = useJson<{ total: number; posts: GalleryPost[] }>(
    `/analytics/top-posts/gallery?days=${days}&limit=8`
  );
  if (isLoading && !data) {
    return (
      <div className="grid grid-cols-4 tablet:grid-cols-2 mobile:grid-cols-1 gap-[12px]">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[220px] rounded-[12px] bg-pdSurface2 animate-pulse" />
        ))}
      </div>
    );
  }
  if (error || !data?.posts.length) {
    return (
      <EmptyV2 title={t('analytics_v2_no_top_posts', 'No posts with stats yet')}>
        {t(
          'analytics_v2_no_top_posts_hint',
          'Posts published through PostDelegate show up here once their network shares metrics.'
        )}
      </EmptyV2>
    );
  }
  return (
    <ul className="grid grid-cols-4 tablet:grid-cols-2 mobile:grid-cols-1 gap-[12px]" data-pd-gallery="">
      {data.posts.map((post, index) => {
        const body = (
          <>
            <div className="relative aspect-[4/3] bg-pdSurface2 overflow-hidden">
              {post.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={post.thumbnail}
                  alt=""
                  loading="lazy"
                  className="w-full h-full object-cover"
                  onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')}
                />
              ) : (
                <div className="w-full h-full p-[12px] text-[12.5px] leading-[18px] text-textItemBlur line-clamp-6">
                  {post.excerpt || post.title || ''}
                </div>
              )}
              <span className="absolute top-[8px] start-[8px] h-[20px] min-w-[20px] px-[6px] grid place-items-center rounded-full bg-[#0a0a0bcc] text-[11px] font-[700] text-[#c8ff4d]">
                #{index + 1}
              </span>
              {post.mediaType !== 'text' && post.mediaType !== 'image' && (
                <span className="absolute top-[8px] end-[8px] h-[20px] px-[7px] grid place-items-center rounded-full bg-[#0a0a0bcc] text-[10.5px] font-[600] text-white capitalize">
                  {post.mediaType}
                </span>
              )}
            </div>
            <div className="p-[10px] flex flex-col gap-[8px]">
              <div className="flex items-center gap-[8px] min-w-0">
                <ChannelAvatarV2
                  picture={post.channel.picture}
                  identifier={post.channel.identifier}
                  name={post.channel.name}
                  size={22}
                />
                <span className="text-[12px] font-[600] truncate flex-1">{post.channel.name}</span>
                <span className="text-[11px] text-pdInk3 whitespace-nowrap">
                  {new Date(post.publishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
              </div>
              {post.thumbnail && (
                <p className="text-[12px] text-textItemBlur line-clamp-2 min-h-[32px]">
                  {post.excerpt || post.title || ''}
                </p>
              )}
              <dl className="grid grid-cols-4 gap-[4px] text-[11px]">
                {[
                  [t('views', 'Views'), post.views],
                  [t('likes', 'Likes'), post.likes],
                  [t('comments', 'Comments'), post.comments],
                  [t('shares', 'Shares'), post.shares],
                ].map(([label, value]) => (
                  <div key={label as string} className="flex flex-col min-w-0">
                    <dt className="text-pdInk3 truncate">{label}</dt>
                    <dd className="font-[700] tabular-nums">
                      {value === null || value === undefined ? '–' : formatNumber(value as number)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </>
        );
        return (
          <li key={post.id} className="rounded-[12px] bg-pdSurface border border-pdLine overflow-hidden hover:border-pdLine2">
            {isWebUrl(post.url) ? (
              <a href={post.url} target="_blank" rel="noopener noreferrer" className="block">
                {body}
              </a>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ul>
  );
};

const Insights: FC<{ days: Range }> = ({ days }) => {
  const t = useT();
  const labels = useInsightLabels();
  let timezone = 'UTC';
  try {
    timezone = getTimezone();
  } catch {
    timezone = 'UTC';
  }
  const { data: insights, isLoading } = useJson<InsightsLite>(`/analytics/insights?days=${days}`);
  const { data: best } = useJson<BestTimesLite>(
    `/analytics/best-times?days=${days}&timezone=${encodeURIComponent(timezone)}`
  );
  const items = useMemo(() => dashboardInsights(insights, best), [insights, best]);
  if (isLoading && !insights) {
    return <div className="h-[120px] rounded-[10px] bg-pdSurface2 animate-pulse" />;
  }
  if (!items.length) {
    return (
      <p className="text-[12.5px] text-pdInk3">
        {t(
          'analytics_v2_insights_empty',
          'Insights appear once a few posts in this range have engagement stats.'
        )}
      </p>
    );
  }
  const sentence = (item: (typeof items)[number]) => {
    const score = item.score.toFixed(1);
    switch (item.kind) {
      case 'content_type':
        return t('analytics_v2_insight_type', '{{type}} posts get {{score}}x the engagement of a typical post', {
          type: (labels.contentTypes as Record<string, string>)[item.key as string] || item.label,
          score,
        });
      case 'length':
        return t('analytics_v2_insight_length', 'Posts of {{length}} get {{score}}x the usual engagement', {
          length: ((labels.lengths as Record<string, string>)[item.key as string] || item.label).toLowerCase(),
          score,
        });
      case 'hashtag':
        return t('analytics_v2_insight_hashtag', 'Posts with #{{tag}} get {{score}}x the usual engagement', {
          tag: item.label,
          score,
        });
      case 'tag':
        return t('analytics_v2_insight_tag', 'Posts tagged “{{tag}}” get {{score}}x the usual engagement', {
          tag: item.label,
          score,
        });
      case 'day':
        return t('analytics_v2_insight_day', '{{day}} is your best day ({{score}}x a typical post)', {
          day: weekdayName(item.key as number, 'dddd'),
          score,
        });
      default:
        return t('analytics_v2_insight_hour', 'Posts around {{hour}} do best ({{score}}x a typical post)', {
          hour: hourName(item.key as number),
          score,
        });
    }
  };
  return (
    <ul className="flex flex-col gap-[8px]" data-pd-insights="">
      {items.map((item) => (
        <li
          key={`${item.kind}-${item.key}`}
          className="flex items-start gap-[10px] rounded-[10px] bg-pdSurface2 border border-pdLine px-[12px] py-[10px]"
        >
          <span aria-hidden="true" className="mt-[2px] w-[8px] h-[8px] rounded-full bg-[#c8ff4d] shrink-0" />
          <span className="flex-1 text-[13px]">
            {sentence(item)}
            <span className="block text-[11.5px] text-pdInk3 mt-[2px]">
              {t('analytics_v2_insight_basis', 'From {{posts}} posts', { posts: item.posts })}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
};

const Dashboard: FC<{ days: Range }> = ({ days }) => {
  const t = useT();
  let timezone = 'UTC';
  try {
    timezone = getTimezone();
  } catch {
    timezone = 'UTC';
  }
  const { data: trends, isLoading: trendsLoading } = useAnalyticsTrends(days);
  const { data: overview, isLoading: overviewLoading } = useJson<OverviewTotals>(
    `/analytics/overview?days=${days}&timezone=${encodeURIComponent(timezone)}`
  );
  const compare = (key: 'followers' | 'published' | 'engagement' | 'views') =>
    trends?.comparison.find((item) => item.key === key);
  const kpi = (key: 'followers' | 'published' | 'engagement' | 'views') => {
    const item = compare(key);
    return {
      value:
        item?.current === null || item?.current === undefined
          ? '–'
          : `${key === 'followers' && item.current > 0 ? '+' : ''}${formatNumber(item.current)}`,
      delta: item?.change === null || item?.change === undefined ? null : Math.round(item.change),
    };
  };
  const vs = t('analytics_v2_vs_previous', 'vs previous {{days}} days', { days });
  const hasTrend = !!trends?.followers.total.some((value) => value !== null);

  return (
    <div className="flex flex-col gap-[16px]">
      <div className="grid grid-cols-6 desktop:grid-cols-3 tablet:grid-cols-2 mobile:grid-cols-1 gap-[12px]">
        <KpiCardV2 label={t('analytics_compare_followers', 'Followers gained')} {...kpi('followers')} hint={vs} loading={trendsLoading && !trends} tone="lime" />
        <KpiCardV2 label={t('analytics_compare_engagement', 'Engagement')} {...kpi('engagement')} hint={vs} loading={trendsLoading && !trends} />
        <KpiCardV2 label={t('analytics_compare_views', 'Views')} {...kpi('views')} hint={vs} loading={trendsLoading && !trends} />
        <KpiCardV2 label={t('analytics_compare_published', 'Posts published')} {...kpi('published')} hint={vs} loading={trendsLoading && !trends} />
        <KpiCardV2
          label={t('analytics_overview_scheduled', 'Scheduled')}
          value={overview ? formatNumber(overview.totals.scheduled) : '–'}
          hint={t('analytics_overview_next_days', 'Next {{days}} days', { days })}
          loading={overviewLoading && !overview}
        />
        <KpiCardV2
          label={t('analytics_overview_failed', 'Failed')}
          value={overview ? formatNumber(overview.totals.failed) : '–'}
          hint={t('analytics_overview_last_days', 'Last {{days}} days', { days })}
          tone={overview?.totals.failed ? 'danger' : 'default'}
          loading={overviewLoading && !overview}
        />
      </div>

      <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] tablet:grid-cols-1 gap-[12px]">
        <CardV2
          title={t('analytics_v2_followers_trend', 'Audience trend')}
          subtitle={t('analytics_v2_followers_trend_hint', 'Followers across all channels, saved daily')}
        >
          {trendsLoading && !trends ? (
            <div className="h-[200px] rounded-[10px] bg-pdSurface2 animate-pulse" />
          ) : hasTrend && trends ? (
            <div data-pd-trend-chart="">
              <LineChart
                dates={trends.followers.dates}
                values={trends.followers.total}
                label={t('analytics_v2_followers_trend', 'Audience trend')}
                height={200}
              />
            </div>
          ) : (
            <EmptyV2 title={t('analytics_v2_trend_collecting', 'Collecting history')}>
              {t(
                'analytics_v2_trend_collecting_hint',
                'Follower counts are saved once a day, so the trend fills in over the next days.'
              )}
            </EmptyV2>
          )}
        </CardV2>
        <CardV2
          title={t('analytics_section_insights', 'Insights')}
          subtitle={t('analytics_v2_insights_hint', 'What works best, compared with a typical post on each channel')}
        >
          <Insights days={days} />
        </CardV2>
      </div>

      <CardV2
        title={t('analytics_v2_top_posts', 'Top posts')}
        subtitle={t('analytics_v2_top_posts_hint', 'Ranked by engagement in the last {{days}} days', { days })}
      >
        <Gallery days={days} />
      </CardV2>
    </div>
  );
};

export const AnalyticsV2: FC = () => {
  const t = useT();
  const download = useCsvDownload();
  const [savedRange, setSavedRange] = useCookie('analyticsOverviewRange', '30');
  const days = (RANGES as readonly number[]).includes(+savedRange)
    ? (+savedRange as Range)
    : 30;
  const setDays = useCallback((value: Range) => {
    setSavedRange(String(value), { days: 365 });
  }, []);
  const [savedSection, setSavedSection] = useCookie('analyticsSectionV2', 'dashboard');
  const section = (SECTIONS as readonly string[]).includes(savedSection)
    ? (savedSection as Section)
    : 'dashboard';
  const setSection = useCallback((value: Section) => {
    setSavedSection(value, { days: 365 });
  }, []);

  const tabs: Array<{ key: Section; label: string }> = [
    { key: 'dashboard', label: t('analytics_v2_dashboard', 'Dashboard') },
    { key: 'trends', label: t('analytics_section_trends', 'Trends') },
    { key: 'views', label: t('analytics_section_views', 'Views') },
    { key: 'top', label: t('analytics_section_top_posts', 'Top posts') },
    { key: 'insights', label: t('analytics_section_insights', 'Insights') },
    { key: 'reports', label: t('analytics_section_reports', 'Reports') },
    { key: 'channels', label: t('analytics_v2_channels', 'Channels') },
  ];

  return (
    <PageV2
      title={t('analytics', 'Analytics')}
      subtitle={t('analytics_overview_subtitle', 'Every channel in this workspace, last {{days}} days', { days })}
      actions={
        <>
          <button
            type="button"
            className={buttonV2.ghost}
            onClick={() => download(`/analytics/export/daily?days=${days}`, `daily-metrics-${days}d.csv`)}
          >
            {t('analytics_v2_export_csv', 'Export CSV')}
          </button>
          <RangeV2 value={days} onChange={setDays} />
        </>
      }
    >
      <TabsV2
        value={section}
        tabs={tabs}
        onChange={setSection}
        label={t('analytics_sections', 'Analytics sections')}
        idPrefix="analytics-v2"
      />
      <div role="tabpanel" id={`analytics-v2-panel-${section}`} aria-labelledby={`analytics-v2-tab-${section}`} className="flex flex-col gap-[16px] min-w-0">
        {section === 'dashboard' && <Dashboard days={days} />}
        {section === 'trends' && <TrendsSection days={days} />}
        {section === 'views' && <ViewsSection days={days} />}
        {section === 'top' && <TopPostsSection days={days} />}
        {section === 'insights' && <InsightsSection days={days} />}
        {section === 'reports' && <ReportsSection days={days} />}
        {section === 'channels' && (
          <div className="flex flex-1 min-w-0 gap-[1px] mobile:flex-col rounded-[14px] overflow-hidden border border-pdLine">
            <PlatformAnalytics />
          </div>
        )}
      </div>
    </PageV2>
  );
};
