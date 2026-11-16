'use client';

// Status chips and the feed grid of the v2 calendar (PD_FF_CALENDAR_FILTERS).
// The chips filter the posts the calendar already loaded, by re-providing the
// calendar context to the views; the feed grid reads /posts for a wider window
// for one visual channel. No data call or action of the calendar changes.
import { FC, ReactNode, useCallback, useMemo, useState } from 'react';
import clsx from 'clsx';
import useSWR from 'swr';
import useCookie from 'react-use-cookie';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { expandPosts } from '@gitroom/helpers/utils/posts.list.minify';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import {
  CalendarContext,
  useCalendar,
} from '@gitroom/frontend/components/launches/calendar.context';
import { usePostActions } from '@gitroom/frontend/components/launches/calendar';
import { fromUtc, newDayjs } from '@gitroom/frontend/components/layout/set.timezone';
import { stripHtmlValidation } from '@gitroom/helpers/utils/strip.html.validation';
import { ChannelAvatarV2, statusPill } from '@gitroom/frontend/components/launches/v2/ui.v2';
import { useFeature } from '../feature.flags.client';
import {
  countByStatus,
  feedOrder,
  filterByStatus,
  firstPicture,
  isVisualNetwork,
  STATUS_FILTERS,
  StatusFilter,
  statusOf,
} from './status.filter';

const DOT: Record<StatusFilter, string> = {
  all: 'bg-textItemBlur',
  scheduled: 'bg-[#b39aff]',
  review: 'bg-[#ffb547]',
  draft: 'bg-pdInk3',
  published: 'bg-[#3ddc97]',
  failed: 'bg-[#ff5a5f]',
};

const FeedGridV2: FC = () => {
  const t = useT();
  const fetch = useFetch();
  const { integrations, customer } = useCalendar();
  const { editPost } = usePostActions();
  const visual = useMemo(
    () => (integrations as any[]).filter((i) => !i.disabled && isVisualNetwork(i.identifier)),
    [integrations]
  );
  const [channelId, setChannelId] = useState<string>('');
  const channel = visual.find((i) => i.id === channelId) || visual[0];
  const [drafts, setDrafts] = useState(false);

  // 60 days back and 60 ahead, like scrolling a profile
  const range = useMemo(() => {
    const now = newDayjs();
    return new URLSearchParams({
      display: 'month',
      customer: (customer as string) || '',
      startDate: now.subtract(60, 'day').startOf('day').utc().format(),
      endDate: now.add(60, 'day').endOf('day').utc().format(),
    }).toString();
  }, [customer]);
  const { data, isLoading } = useSWR(
    channel ? `/posts?${range}#feed-grid` : null,
    async () => expandPosts(await (await fetch(`/posts?${range}`)).json()),
    { revalidateOnFocus: false }
  );
  const feed = useMemo(
    () =>
      feedOrder(
        ((data?.posts || []) as any[]).filter((post) => post.integration?.id === channel?.id),
        drafts
      ),
    [data, channel?.id, drafts]
  );

  if (!channel) {
    return (
      <div className="flex-1 grid place-items-center p-[24px] text-[13px] text-pdInk3 text-center">
        {t('feed_grid_no_channel', 'Connect Instagram, TikTok, Pinterest, YouTube or Threads to preview their feed.')}
      </div>
    );
  }
  const now = newDayjs();
  return (
    <div className="flex-1 min-h-0 overflow-auto p-[20px] mobile:p-[12px]" data-pd-feed-grid="">
      <div className="max-w-[640px] mx-auto flex flex-col gap-[12px]">
        <div className="flex flex-wrap items-center gap-[8px]">
          <div role="group" aria-label={t('channels', 'Channels')} className="flex flex-wrap gap-[6px]">
            {visual.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={item.id === channel.id}
                onClick={() => setChannelId(item.id)}
                className={clsx(
                  'flex items-center gap-[6px] h-[32px] ps-[4px] pe-[10px] rounded-full border text-[12.5px] font-[600]',
                  item.id === channel.id ? 'border-[#7357ff] bg-[#7357ff1f]' : 'border-pdLine2 bg-pdSurface2 text-textItemBlur'
                )}
              >
                <ChannelAvatarV2 picture={item.picture} identifier={item.identifier} name={item.name} size={24} />
                <span className="max-w-[140px] truncate">{item.name}</span>
              </button>
            ))}
          </div>
          <label className="ms-auto flex items-center gap-[6px] text-[12px] text-textItemBlur">
            <input type="checkbox" checked={drafts} onChange={(e) => setDrafts(e.target.checked)} />
            {t('feed_grid_show_drafts', 'Show drafts')}
          </label>
        </div>
        <p className="text-[12px] text-pdInk3">
          {t('feed_grid_hint', 'How the profile grid will look: upcoming posts first, then what is already live.')}
        </p>
        {isLoading && !data ? (
          <div className="grid grid-cols-3 gap-[3px]">
            {Array.from({ length: 9 }, (_, i) => (
              <div key={i} className="aspect-square bg-pdSurface2 animate-pulse" />
            ))}
          </div>
        ) : !feed.length ? (
          <div className="rounded-[12px] border border-dashed border-pdLine2 p-[24px] text-center text-[13px] text-pdInk3">
            {t('feed_grid_empty', 'No posts for this channel in the last or next 60 days.')}
          </div>
        ) : (
          <ul className="grid grid-cols-3 gap-[3px] rounded-[10px] overflow-hidden">
            {feed.map((post: any) => {
              const picture = firstPicture(post.image);
              const status = statusOf(post);
              const upcoming = fromUtc(post.publishDate).isAfter(now);
              return (
                <li key={`${post.id}-${post.publishDate}`} className="relative aspect-square bg-pdSurface2">
                  <button
                    type="button"
                    onClick={editPost(post, false)}
                    className="absolute inset-0 w-full h-full text-start group"
                    aria-label={`${t('edit', 'Edit')} · ${fromUtc(post.publishDate).format('ddd D MMM HH:mm')}`}
                  >
                    {picture && !picture.video ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={picture.path} alt="" loading="lazy" className={clsx('w-full h-full object-cover', upcoming && 'opacity-90')} />
                    ) : picture?.video ? (
                      <video src={picture.path} muted preload="metadata" className="w-full h-full object-cover" />
                    ) : (
                      <span className="block w-full h-full p-[8px] text-[11px] leading-[15px] text-textItemBlur overflow-hidden">
                        {stripHtmlValidation('normal', post.content || '', false, true).slice(0, 160)}
                      </span>
                    )}
                    <span className="absolute inset-x-0 bottom-0 flex items-center gap-[4px] p-[5px] bg-gradient-to-t from-[#000000b3] to-transparent">
                      {status !== 'published' && (
                        <span className={clsx('text-[10px] font-[700] px-[6px] py-[1px] rounded-full', statusPill[status])}>
                          {t(`status_${status}`, status)}
                        </span>
                      )}
                      <span className="ms-auto text-[10px] font-[600] text-white">
                        {fromUtc(post.publishDate).format('D MMM')}
                      </span>
                    </span>
                    <span className="absolute inset-0 ring-2 ring-inset ring-transparent group-hover:ring-[#7357ff]" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

// wraps the v2 calendar views; renders them unchanged while the flag is off
export const CalendarFiltersV2: FC<{ children: ReactNode }> = ({ children }) => {
  const t = useT();
  const enabled = useFeature('calendar_filters');
  const calendar = useCalendar();
  const [saved, setSaved] = useCookie('pd_calendar_status', 'all');
  const status = (STATUS_FILTERS as string[]).includes(saved) ? (saved as StatusFilter) : 'all';
  const [mode, setMode] = useState<'calendar' | 'grid'>('calendar');
  const counts = useMemo(
    () => countByStatus(calendar.display === 'list' ? calendar.listPosts : calendar.posts),
    [calendar.display, calendar.posts, calendar.listPosts]
  );
  const value = useMemo(
    () => ({
      ...calendar,
      posts: filterByStatus(calendar.posts, status),
      listPosts: filterByStatus(calendar.listPosts, status),
    }),
    [calendar, status]
  );
  const setStatus = useCallback((next: StatusFilter) => setSaved(next, { days: 365 }), []);
  const hasVisual = (calendar.integrations as any[]).some(
    (i) => !i.disabled && isVisualNetwork(i.identifier)
  );

  if (!enabled) {
    return <>{children}</>;
  }

  const labels: Record<StatusFilter, string> = {
    all: t('all', 'All'),
    scheduled: t('status_scheduled', 'Scheduled'),
    review: t('needs_approval', 'Needs approval'),
    draft: t('drafts', 'Drafts'),
    published: t('status_published', 'Published'),
    failed: t('status_failed', 'Failed'),
  };

  return (
    <>
      <div
        data-pd-status-chips=""
        className="shrink-0 flex items-center gap-[6px] px-[20px] py-[8px] border-b border-pdLine overflow-x-auto scrollbar-none mobile:px-[12px]"
      >
        {mode === 'calendar' &&
          STATUS_FILTERS.map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={status === key}
              onClick={() => setStatus(key)}
              className={clsx(
                'flex items-center gap-[6px] h-[28px] px-[10px] rounded-full border text-[12px] font-[600] whitespace-nowrap transition-colors',
                status === key
                  ? 'border-[#7357ff] bg-[#7357ff26] text-newTextColor'
                  : 'border-pdLine2 bg-pdSurface2 text-textItemBlur hover:text-newTextColor'
              )}
            >
              {key !== 'all' && <span aria-hidden="true" className={clsx('w-[7px] h-[7px] rounded-full', DOT[key])} />}
              {labels[key]}
              <span className="text-[11px] text-pdInk3 tabular-nums">{counts[key]}</span>
            </button>
          ))}
        {hasVisual && (
          <div role="group" aria-label={t('view', 'View')} className="ms-auto flex p-[3px] rounded-[10px] bg-pdSurface border border-pdLine shrink-0">
            {(['calendar', 'grid'] as const).map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={mode === key}
                onClick={() => setMode(key)}
                className={clsx(
                  'px-[10px] h-[24px] rounded-[7px] text-[12px] font-[600] whitespace-nowrap',
                  mode === key ? 'bg-pdSurface2 text-newTextColor ring-1 ring-pdLine2' : 'text-textItemBlur hover:text-newTextColor'
                )}
              >
                {key === 'calendar' ? t('calendar', 'Calendar') : t('feed_grid', 'Feed grid')}
              </button>
            ))}
          </div>
        )}
      </div>
      {mode === 'grid' && hasVisual ? (
        <FeedGridV2 />
      ) : (
        <CalendarContext.Provider value={value}>{children}</CalendarContext.Provider>
      )}
    </>
  );
};
