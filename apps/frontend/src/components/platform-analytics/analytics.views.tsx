'use client';

import React, { FC, useCallback, useMemo, useState } from 'react';
import useSWR from 'swr';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import {
  Card,
  ChannelAvatar,
  formatNumber,
  HistoryEmpty,
  isWebUrl,
  Range,
  Skeleton,
  StatTile,
  swrOptions,
} from '@gitroom/frontend/components/platform-analytics/analytics.ui';

interface ViewGainDay {
  date: string;
  views: number;
}

interface ViewGainsChannel {
  id: string;
  name: string;
  picture: string | null;
  identifier: string;
  status: 'ok' | 'collecting' | 'unavailable' | 'unsupported';
  source: 'live' | 'history' | null;
  points: Array<number | null>;
  total: number | null;
  bestDay: ViewGainDay | null;
}

interface ViewGainsData {
  days: number;
  from: string;
  to: string;
  dates: string[];
  total: Array<number | null>;
  totalViews: number | null;
  bestDay: ViewGainDay | null;
  channels: ViewGainsChannel[];
}

interface ViewGainPost {
  id: string;
  externalId: string;
  postId: string | null;
  channel: { id: string; name: string; picture: string | null; identifier: string };
  title: string | null;
  url: string | null;
  publishedAt: string | null;
  gained: number;
  views: number | null;
}

interface ViewGainPostsData {
  days: number;
  posts: ViewGainPost[];
  unavailable: number;
}

const TOP_POSTS = 10;

const useViewGains = (days: Range) => {
  const fetch = useFetch();
  const load = useCallback(async (path: string) => {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error('views');
    }
    return (await response.json()) as ViewGainsData;
  }, []);
  return useSWR(`/analytics/views?days=${days}`, load, swrOptions);
};

// loaded once the view gains are in: those refresh an expired token, this
// read-only call then uses it
const useViewGainPosts = (
  days: Range,
  integrations: string[],
  ready: boolean
) => {
  const fetch = useFetch();
  const load = useCallback(async (path: string) => {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error('view posts');
    }
    return (await response.json()) as ViewGainPostsData;
  }, []);
  return useSWR(
    ready
      ? `/analytics/views/posts?days=${days}&limit=${TOP_POSTS}${
          integrations.length
            ? `&integrations=${encodeURIComponent(integrations.join(','))}`
            : ''
        }`
      : null,
    load,
    swrOptions
  );
};

const dateLabel = (date: string) => dayjs(date).format('MMM D');

const sumPoints = (dates: string[], channels: ViewGainsChannel[]) => {
  const points = dates.map((_, index) => {
    const values = channels
      .map((channel) => channel.points[index])
      .filter((value): value is number => value !== null);
    return values.length ? values.reduce((a, b) => a + b, 0) : null;
  });
  let total: number | null = null;
  let bestDay: ViewGainDay | null = null;
  points.forEach((value, index) => {
    if (value === null) {
      return;
    }
    total = (total || 0) + value;
    if (value > 0 && (!bestDay || value > bestDay.views)) {
      bestDay = { date: dates[index], views: value };
    }
  });
  return { points, total, bestDay } as {
    points: Array<number | null>;
    total: number | null;
    bestDay: ViewGainDay | null;
  };
};

// A native SVG bar chart of daily values: an empty slot where a day has no
// value, the hovered or tapped day read out below, and a hidden table with
// every value for screen readers
const BarChart: FC<{
  dates: string[];
  values: Array<number | null>;
  label: string;
  height?: number;
  compact?: boolean;
}> = ({ dates, values, label, height = 180, compact = false }) => {
  const t = useT();
  const [active, setActive] = useState<number | null>(null);
  const width = 600;
  const present = values.filter((v): v is number => v !== null);
  const max = Math.max(1, ...present);
  const slot = width / Math.max(1, dates.length);
  const gap = Math.min(slot * 0.3, compact ? 2 : 6);
  const top = compact ? 0 : 6;
  const barHeight = (value: number) =>
    value > 0 ? Math.max(2, (value / max) * (height - top)) : 1;

  const summary = present.length
    ? t('analytics_views_chart_summary', '{{label}}: {{total}} views over {{days}} days, at most {{max}} in a day', {
        label,
        total: formatNumber(present.reduce((a, b) => a + b, 0)),
        days: dates.length,
        max: formatNumber(Math.max(...present)),
      })
    : t('analytics_chart_no_data', 'No data yet');

  return (
    <figure className="flex flex-col gap-[6px] m-0 min-w-0">
      <div className="relative">
        <svg
          role="img"
          aria-label={summary}
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="w-full block overflow-visible text-btnPrimary"
          style={{ height }}
          onMouseLeave={() => setActive(null)}
        >
          {!compact &&
            [0.25, 0.5, 0.75].map((ratio) => (
              <line
                key={ratio}
                x1={0}
                x2={width}
                y1={height * ratio}
                y2={height * ratio}
                className="stroke-newTableBorder"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          {values.map((value, index) => {
            const x = index * slot + gap / 2;
            return (
              <g key={dates[index]}>
                {value !== null && (
                  <rect
                    x={x}
                    y={height - barHeight(value)}
                    width={Math.max(1, slot - gap)}
                    height={barHeight(value)}
                    rx={compact ? 0.5 : 1.5}
                    fill="currentColor"
                    opacity={
                      active === null || active === index ? 1 : 0.45
                    }
                  />
                )}
                {!compact && (
                  // the whole column is the hover target, so short bars are easy to hit
                  <rect
                    x={index * slot}
                    y={0}
                    width={slot}
                    height={height}
                    fill="transparent"
                    onMouseEnter={() => setActive(index)}
                    onClick={() => setActive(index)}
                  />
                )}
              </g>
            );
          })}
        </svg>
        {!compact && present.length > 0 && (
          <div
            aria-hidden="true"
            className="absolute top-0 start-0 text-[10px] text-newTableText pointer-events-none"
          >
            <span className="px-[2px] rounded bg-newTableHeader">
              {formatNumber(Math.max(...present))}
            </span>
          </div>
        )}
      </div>
      {!compact && (
        <figcaption
          aria-hidden="true"
          className="flex justify-between gap-[8px] text-[11px] text-newTableText"
        >
          <span>{dateLabel(dates[0])}</span>
          {active !== null && (
            <span className="text-newTextColor font-[500] tabular-nums">
              {values[active] === null
                ? t('analytics_views_day_no_data', '{{date}}: no data', {
                    date: dateLabel(dates[active]),
                  })
                : t('analytics_views_day_value', '{{date}}: {{views}} views', {
                    date: dateLabel(dates[active]),
                    views: formatNumber(values[active]!),
                  })}
            </span>
          )}
          <span>{dateLabel(dates[dates.length - 1])}</span>
        </figcaption>
      )}
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {dates.map((date, index) =>
            values[index] === null ? null : (
              <tr key={date}>
                <th scope="row">{date}</th>
                <td>{values[index]}</td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </figure>
  );
};

const ChannelStatusNote: FC<{ channel: ViewGainsChannel }> = ({ channel }) => {
  const t = useT();
  if (channel.status === 'collecting') {
    return (
      <>
        {t(
          'analytics_views_collecting',
          'Collecting: gains show after two daily snapshots of its posts.'
        )}
      </>
    );
  }
  if (channel.status === 'unavailable') {
    return (
      <>
        {t(
          'analytics_views_unavailable',
          'The network did not answer. Try again later, or reconnect the channel.'
        )}
      </>
    );
  }
  return (
    <>
      {t(
        'analytics_views_unsupported',
        'This network doesn’t share view counts yet'
      )}
    </>
  );
};

const ChannelRows: FC<{ data: ViewGainsData; channels: ViewGainsChannel[] }> = ({
  data,
  channels,
}) => {
  const t = useT();
  const sourceLabel = (source: ViewGainsChannel['source']) =>
    source === 'live'
      ? t('analytics_views_source_live', 'Live')
      : t('analytics_views_source_history', 'Daily history');

  return (
    <ul className="flex flex-col divide-y divide-newTableBorder">
      {channels.map((channel) => (
        <li
          key={channel.id}
          className="flex items-center gap-[12px] py-[10px] min-w-0"
        >
          <ChannelAvatar picture={channel.picture} identifier={channel.identifier} />
          <div className="flex-1 min-w-0 flex flex-col gap-[2px]">
            <div className="flex items-center gap-[6px] min-w-0">
              <span className="truncate text-[14px] text-newTextColor">
                {channel.name}
              </span>
              {!!channel.source && channel.status !== 'unsupported' && (
                <span className="shrink-0 text-[11px] px-[6px] py-[1px] rounded-full bg-btnSimple text-btnText">
                  {sourceLabel(channel.source)}
                </span>
              )}
            </div>
            <div className="text-[12px] text-newTableText">
              {channel.status === 'ok' ? (
                channel.bestDay ? (
                  t('analytics_views_channel_best', 'Best day {{date}}, {{views}} views', {
                    date: dateLabel(channel.bestDay.date),
                    views: formatNumber(channel.bestDay.views),
                  })
                ) : (
                  t('analytics_views_channel_none', 'No views gained in this range')
                )
              ) : (
                <ChannelStatusNote channel={channel} />
              )}
            </div>
          </div>
          {channel.status === 'ok' && (
            <>
              <div className="w-[140px] mobile:hidden">
                <BarChart
                  compact
                  height={32}
                  dates={data.dates}
                  values={channel.points}
                  label={channel.name}
                />
              </div>
              <div className="w-[80px] text-end text-[13px] font-[600] tabular-nums text-newTextColor">
                {channel.total === null ? '–' : `+${formatNumber(channel.total)}`}
              </div>
            </>
          )}
        </li>
      ))}
    </ul>
  );
};

const TopViewedPosts: FC<{
  days: Range;
  integrations: string[];
  ready: boolean;
}> = ({ days, integrations, ready }) => {
  const t = useT();
  const { data, isLoading, error } = useViewGainPosts(days, integrations, ready);

  if (error && !data) {
    return (
      <p role="alert" className="text-[13px] text-red-500">
        {t(
          'analytics_views_posts_error',
          'Top posts could not be loaded. Please try again.'
        )}
      </p>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col gap-[8px]">
        {[0, 1, 2].map((p) => (
          <Skeleton key={p} className="h-[44px]" />
        ))}
      </div>
    );
  }

  if (!data.posts.length) {
    return (
      <p className="text-[13px] text-newTableText">
        {t(
          'analytics_views_posts_empty',
          'No post gained views in this range yet.'
        )}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-[8px]">
      <ol className="flex flex-col divide-y divide-newTableBorder" aria-busy={isLoading}>
        {data.posts.map((post, index) => {
          const title =
            post.title || t('analytics_top_posts_untitled', 'Post without text');
          const href = isWebUrl(post.url)
            ? post.url
            : post.postId
            ? `/p/${post.postId}?share=true`
            : '';
          return (
            <li key={post.id} className="flex items-start gap-[12px] py-[10px] min-w-0">
              <span className="w-[18px] shrink-0 pt-[6px] text-[12px] text-newTableText tabular-nums text-end">
                {index + 1}
              </span>
              <ChannelAvatar
                picture={post.channel.picture}
                identifier={post.channel.identifier}
                size={28}
              />
              <div className="flex-1 min-w-0 flex flex-col gap-[2px]">
                <div className="text-[13px] text-newTextColor">
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="line-clamp-2 break-words hover:underline focus-visible:underline outline-none"
                    >
                      {title}
                      <span className="sr-only">
                        {' '}
                        {t('analytics_top_posts_opens_new_tab', '(opens in a new tab)')}
                      </span>
                    </a>
                  ) : (
                    <span className="line-clamp-2 break-words">{title}</span>
                  )}
                </div>
                <div className="text-[12px] text-newTableText truncate">
                  {post.channel.name}
                  {!!post.publishedAt &&
                    ` · ${dayjs(post.publishedAt).format('MMM D, YYYY')}`}
                  {post.views !== null &&
                    ` · ${t('analytics_views_post_lifetime', '{{views}} views in all', {
                      views: formatNumber(post.views),
                    })}`}
                </div>
              </div>
              <div className="shrink-0 text-end">
                <div className="text-[14px] font-[600] text-newTextColor tabular-nums">
                  +{formatNumber(post.gained)}
                </div>
                <div className="text-[11px] text-newTableText">
                  {t('analytics_views_gained', 'views gained')}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      {data.unavailable > 0 && (
        <p className="text-[12px] text-newTableText">
          {t(
            'analytics_views_posts_partial',
            'Some channels did not answer and are left out.'
          )}
        </p>
      )}
    </div>
  );
};

export const ViewsSection: FC<{ days: Range }> = ({ days }) => {
  const t = useT();
  const { data, isLoading, error } = useViewGains(days);
  const [selected, setSelected] = useState<string[]>([]);

  const withData = useMemo(
    () => (data?.channels || []).filter((channel) => channel.status === 'ok'),
    [data]
  );
  const tracked = useMemo(
    () =>
      (data?.channels || []).filter(
        (channel) =>
          channel.status === 'collecting' || channel.status === 'unavailable'
      ),
    [data]
  );
  const unsupported = useMemo(
    () =>
      (data?.channels || []).filter((channel) => channel.status === 'unsupported'),
    [data]
  );

  // the selection only keeps channels that still have data
  const active = useMemo(
    () => selected.filter((id) => withData.some((channel) => channel.id === id)),
    [selected, withData]
  );
  const chosen = useMemo(
    () =>
      active.length
        ? withData.filter((channel) => active.includes(channel.id))
        : withData,
    [active, withData]
  );
  const summary = useMemo(
    () => sumPoints(data?.dates || [], chosen),
    [data, chosen]
  );

  const toggle = useCallback((id: string) => {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }, []);

  if (error && !data) {
    return (
      <p role="alert" className="text-[13px] text-red-500">
        {t('analytics_views_error', 'Views could not be loaded. Please try again.')}
      </p>
    );
  }

  if (isLoading && !data) {
    return (
      <div className="flex flex-col gap-[12px]">
        <div className="grid grid-cols-3 mobile:grid-cols-1 gap-[12px]">
          {[0, 1, 2].map((p) => (
            <Skeleton key={p} className="h-[96px]" />
          ))}
        </div>
        <Skeleton className="h-[240px]" />
      </div>
    );
  }

  if (!data) {
    return null;
  }

  if (!withData.length && !tracked.length) {
    return (
      <div className="flex flex-col gap-[12px]">
        <HistoryEmpty>
          {t(
            'analytics_views_none',
            'None of your channels is on a network that shares view counts yet. Daily view gains show here as soon as one is connected.'
          )}
        </HistoryEmpty>
        {!!unsupported.length && (
          <Card title={t('analytics_views_by_channel', 'By channel')}>
            <ChannelRows data={data} channels={unsupported} />
          </Card>
        )}
      </div>
    );
  }

  const average =
    summary.total === null
      ? null
      : Math.round(
          summary.total /
            Math.max(1, summary.points.filter((value) => value !== null).length)
        );

  return (
    <div className="flex flex-col gap-[12px]">
      {withData.length > 1 && (
        <div
          role="group"
          aria-label={t('analytics_top_posts_filter', 'Filter by channel')}
          className="flex items-center gap-[6px] flex-wrap"
        >
          {withData.map((channel) => {
            const on = active.includes(channel.id);
            return (
              <button
                key={channel.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(channel.id)}
                className={clsx(
                  'flex items-center gap-[6px] h-[32px] ps-[4px] pe-[10px] rounded-full border text-[13px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-btnPrimary',
                  on
                    ? 'border-btnPrimary bg-btnSimple text-newTextColor'
                    : 'border-newTableBorder text-textItemBlur hover:text-newTextColor'
                )}
              >
                <ChannelAvatar
                  picture={channel.picture}
                  identifier={channel.identifier}
                  size={22}
                />
                <span className="max-w-[140px] truncate">{channel.name}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-3 mobile:grid-cols-1 gap-[12px]" aria-live="polite">
        <StatTile
          label={t('analytics_views_total', 'Views gained')}
          value={summary.total ?? 0}
          loading={false}
          hint={
            active.length
              ? t('analytics_views_total_selected', 'Selected channels, last {{days}} days', {
                  days,
                })
              : t('analytics_views_total_all', 'All channels with views, last {{days}} days', {
                  days,
                })
          }
        />
        <StatTile
          label={t('analytics_views_best_day', 'Best day')}
          value={summary.bestDay?.views ?? 0}
          loading={false}
          hint={
            summary.bestDay
              ? dayjs(summary.bestDay.date).format('dddd, MMM D')
              : t('analytics_views_best_day_none', 'No views gained yet')
          }
        />
        <StatTile
          label={t('analytics_views_average', 'Daily average')}
          value={average ?? 0}
          loading={false}
          hint={t('analytics_views_average_hint', 'Over the days with data')}
        />
      </div>

      <Card
        title={t('analytics_views_daily', 'Daily views gained')}
        subtitle={t(
          'analytics_views_daily_hint',
          'New views per day across the selected channels'
        )}
      >
        {withData.length ? (
          <BarChart
            dates={data.dates}
            values={summary.points}
            label={t('analytics_views_daily', 'Daily views gained')}
          />
        ) : (
          <HistoryEmpty>
            {t(
              'analytics_views_collecting_all',
              'View gains show once a channel has two days of view counts to compare.'
            )}
          </HistoryEmpty>
        )}
        <p className="text-[12px] text-newTableText">
          {t(
            'analytics_views_note',
            'Live channels report their views per day when you look. Daily history channels are worked out from the daily view counts of the posts PostDelegate tracks: posts published in the last 30 days and the latest posts the network lists. A missed day shares its gain with the days around it.'
          )}
        </p>
      </Card>

      <div className="grid grid-cols-2 tablet:grid-cols-1 gap-[12px]">
        <Card
          title={t('analytics_views_by_channel', 'By channel')}
          subtitle={t(
            'analytics_views_by_channel_hint',
            'Views gained per channel in the last {{days}} days',
            { days }
          )}
        >
          <ChannelRows data={data} channels={[...withData, ...tracked, ...unsupported]} />
        </Card>
        <Card
          title={t('analytics_views_top_posts', 'Top posts by views gained')}
          subtitle={t(
            'analytics_views_top_posts_hint',
            'The posts that gained the most views in the last {{days}} days',
            { days }
          )}
        >
          <TopViewedPosts
            days={days}
            integrations={active}
            ready={data.days === days}
          />
        </Card>
      </div>
    </div>
  );
};
