'use client';

import { FC, Fragment, useEffect, useMemo, useRef } from 'react';
import clsx from 'clsx';
import dayjs from 'dayjs';
import i18next from 'i18next';
import {
  useCalendar,
  useNow,
} from '@gitroom/frontend/components/launches/calendar.context';
import {
  CalendarColumn,
  DayView,
  hours,
  pdStatus,
  usePostActions,
} from '@gitroom/frontend/components/launches/calendar';
import { fromUtc, newDayjs } from '@gitroom/frontend/components/layout/set.timezone';
import { isUSCitizen } from '@gitroom/frontend/components/launches/helpers/isuscitizen.utils';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { stripHtmlValidation } from '@gitroom/helpers/utils/strip.html.validation';
import { ChannelAvatarV2, IconButton, Pill, PdStatus, statusPill } from './ui.v2';

const HOUR = 66;

const hourLabel = (hour: number) =>
  isUSCitizen()
    ? `${hour % 12 === 0 ? 12 : hour % 12} ${hour < 12 ? 'AM' : 'PM'}`
    : `${String(hour).padStart(2, '0')}:00`;

// the hours a channel's posting slots fall on, in the user's timezone
const useSlotHours = () => {
  const { integrations, posts, postDates } = useCalendar();
  return useMemo(() => {
    const slots = new Map<number, number>(); // local hour -> minute
    for (const integration of integrations as any[]) {
      if (integration.disabled) continue;
      for (const slot of integration.time || []) {
        const local = newDayjs(
          dayjs.utc().startOf('day').add(slot.time, 'minute').toDate()
        );
        if (!slots.has(local.hour())) slots.set(local.hour(), local.minute());
      }
    }
    const taken = new Set<string>();
    for (const post of posts) {
      const at = postDates.get(post) || fromUtc(post.publishDate);
      taken.add(at.format('YYYY-MM-DD-HH'));
    }
    return { slots, taken };
  }, [integrations, posts, postDates]);
};

// posting slots still open in the range on screen
export const useOpenSlotCount = () => {
  const { startDate, endDate } = useCalendar();
  const { slots, taken } = useSlotHours();
  const now = useNow();
  return useMemo(() => {
    let count = 0;
    const end = newDayjs(endDate).endOf('day');
    for (let day = newDayjs(startDate).startOf('day'); day.isBefore(end); day = day.add(1, 'day')) {
      slots.forEach((minute, hour) => {
        const at = day.hour(hour).minute(minute);
        if (at.isAfter(now) && !taken.has(at.format('YYYY-MM-DD-HH'))) count++;
      });
    }
    return count;
  }, [startDate, endDate, slots, taken, now]);
};

export const WeekViewV2: FC = () => {
  const { startDate } = useCalendar();
  const t = useT();
  const now = useNow();
  const scroller = useRef<HTMLDivElement>(null);
  const { slots, taken } = useSlotHours();

  const days = useMemo(() => {
    dayjs.locale(i18next.resolvedLanguage || 'en');
    const weekStart = newDayjs(startDate);
    return Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day'));
  }, [startDate, i18next.resolvedLanguage]);

  useEffect(() => {
    // open on the working day, like a paper planner
    const hour = newDayjs().hour();
    const top = (hour >= 8 && hour < 18 ? 8 : Math.max(0, Math.min(hour - 2, 16))) * HOUR;
    // a little above the hour so its label isn't under the sticky day row
    scroller.current?.scrollTo({ top: Math.max(0, top - 12) });
    // narrow screens scroll sideways: start on today's column
    const el = scroller.current;
    const today = el?.querySelector<HTMLElement>('[data-pd-today]');
    if (el && today && el.scrollWidth > el.clientWidth) {
      const box = el.getBoundingClientRect();
      const cell = today.getBoundingClientRect();
      const rtl = getComputedStyle(el).direction === 'rtl';
      const gutter = 56;
      el.scrollLeft += rtl ? cell.right - box.right + gutter : cell.left - box.left - gutter;
    }
  }, [startDate]);

  return (
    <div className="flex-1 relative min-h-0">
      <div
        ref={scroller}
        className="absolute inset-0 overflow-auto scrollbar scrollbar-thumb-pdLine2 scrollbar-track-transparent"
      >
        <div className="grid [grid-template-columns:56px_repeat(7,minmax(0,1fr))] tablet:[grid-template-columns:56px_repeat(7,minmax(110px,1fr))] mobile:[grid-template-columns:56px_repeat(7,minmax(108px,1fr))] min-w-full tablet:min-w-[826px] mobile:min-w-[812px]">
          <div className="sticky top-0 start-0 z-[27] h-[44px] bg-newBgColorInner border-b border-pdLine" />
          {days.map((day) => {
            const isToday = day.isSame(now, 'day');
            return (
              <div
                key={day.format('YYYY-MM-DD')}
                data-pd-today={isToday ? '' : undefined}
                className={clsx(
                  'sticky top-0 z-[25] h-[44px] bg-newBgColorInner border-b border-s border-pdLine flex items-center gap-[8px] px-[10px] text-[12px]',
                  isToday ? 'text-newTextColor' : 'text-textItemBlur'
                )}
              >
                <span className="font-[600]">{day.format('ddd')}</span>
                <span
                  className={clsx(
                    'font-[700]',
                    isToday
                      ? 'w-[24px] h-[24px] rounded-full grid place-items-center bg-[#c8ff4d] text-[#0a0a0b]'
                      : 'text-newTextColor'
                  )}
                >
                  {day.date()}
                </span>
              </div>
            );
          })}
          {hours.map((hour) => (
            <Fragment key={hour}>
              <div
                className="relative text-end pe-[8px] text-[11px] text-pdInk3 sticky start-0 z-[20] bg-newBgColorInner"
                style={{ minHeight: HOUR }}
              >
                <span className="relative -top-[7px]">{hour === 0 ? '' : hourLabel(hour)}</span>
              </div>
              {days.map((day) => {
                const cellDate = day.hour(hour).startOf('hour');
                const isNowCell = day.isSame(now, 'day') && hour === now.hour();
                const slotMinute = slots.get(hour);
                const showSlot =
                  slotMinute !== undefined &&
                  cellDate.add(slotMinute, 'minute').isAfter(now) &&
                  !taken.has(cellDate.format('YYYY-MM-DD-HH'));
                return (
                  <div
                    key={`${startDate}-${cellDate.format('YYYY-MM-DD-HH')}`}
                    data-pd-week-cell=""
                    className={clsx(
                      'relative border-b border-s border-pdLine flex',
                      day.isSame(now, 'day') && 'bg-[#7357ff10]'
                    )}
                    style={{ minHeight: HOUR }}
                  >
                    {showSlot && (
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-[5px] rounded-[8px] border border-dashed border-pdLine2 text-[11px] text-pdInk3 flex items-center justify-center whitespace-nowrap overflow-hidden"
                      >
                        {t('open_slot', 'Open slot')}{' '}
                        {cellDate.minute(slotMinute).format('HH:mm')}
                      </div>
                    )}
                    <CalendarColumn getDate={cellDate} />
                    {isNowCell && (
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute -start-[1px] -end-[1px] h-[2px] bg-[#c8ff4d] z-[17]"
                        style={{ top: `${(now.minute() / 60) * 100}%` }}
                      >
                        <span className="absolute -start-[5px] -top-[4px] w-[10px] h-[10px] rounded-full bg-[#c8ff4d]" />
                      </div>
                    )}
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};

export const MonthViewV2: FC = () => {
  const { startDate } = useCalendar();
  const t = useT();
  const weekdays = useMemo(() => {
    dayjs.locale(i18next.resolvedLanguage || 'en');
    return Array.from({ length: 7 }, (_, i) => newDayjs().isoWeekday(i + 1).format('ddd'));
  }, [i18next.resolvedLanguage]);
  const days = useMemo(() => {
    const first = newDayjs(startDate).startOf('month');
    const gridStart = first.subtract(first.isoWeekday() - 1, 'day');
    return Array.from({ length: 42 }, (_, i) => gridStart.add(i, 'day'));
  }, [startDate]);
  const month = newDayjs(startDate).month();

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 relative min-h-0">
        <div className="absolute inset-0 overflow-auto scrollbar scrollbar-thumb-pdLine2 scrollbar-track-transparent">
          <div className="grid grid-cols-7 tablet:[grid-template-columns:repeat(7,minmax(110px,1fr))] mobile:!grid-cols-7 [grid-template-rows:36px] auto-rows-[minmax(112px,auto)]">
            {weekdays.map((name) => (
              <div
                key={name}
                className="sticky top-0 z-[25] bg-newBgColorInner border-b border-s border-pdLine first:border-s-0 flex items-center px-[12px] text-[11px] font-[700] uppercase tracking-[0.08em] text-pdInk3"
              >
                {name}
              </div>
            ))}
            {days.map((day) => (
              <div
                key={day.format('YYYY-MM-DD')}
                data-pd-month-cell=""
                data-pd-outside={day.month() !== month ? '' : undefined}
                className="relative border-b border-s border-pdLine [&:nth-child(7n+8)]:border-s-0 flex min-w-0"
              >
                <CalendarColumn getDate={newDayjs(day).endOf('day')} randomHour={true} />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="h-[40px] shrink-0 border-t border-pdLine flex items-center gap-[18px] px-[20px] text-[11.5px] text-textItemBlur overflow-x-auto">
        {(
          [
            ['scheduled', t('scheduled', 'Scheduled'), 'bg-[#7357ff]'],
            ['review', t('in_review', 'In review'), 'bg-[#ffb547]'],
            ['draft', t('draft', 'Draft'), 'border border-dashed border-textItemBlur'],
            ['published', t('published', 'Published'), 'bg-[#3ddc97]'],
            ['failed', t('failed', 'Failed'), 'bg-[#ff5a5f]'],
          ] as const
        ).map(([key, label, dot]) => (
          <span key={key} className="flex items-center gap-[6px] whitespace-nowrap">
            <span className={clsx('w-[9px] h-[9px] rounded-[3px]', dot)} />
            {label}
          </span>
        ))}
        <span className="ms-auto text-pdInk3 whitespace-nowrap mobile:hidden">
          {t('drag_to_reschedule', 'Drag a post to another day to reschedule it')}
        </span>
      </div>
    </div>
  );
};

const statusText = (status: PdStatus, t: ReturnType<typeof useT>) =>
  ({
    scheduled: t('scheduled', 'Scheduled'),
    draft: t('draft', 'Draft'),
    published: t('published', 'Published'),
    failed: t('failed', 'Failed'),
    review: t('in_review', 'In review'),
  }[status]);

const approvalText = (post: any, t: ReturnType<typeof useT>) => {
  switch (post.approvalStatus) {
    case 'IN_REVIEW':
      return { label: t('approval_waiting', 'Waiting'), className: 'text-[#ffb547]' };
    case 'CHANGES_REQUESTED':
      return { label: t('changes_requested', 'Changes requested'), className: 'text-[#ff5a5f]' };
    case 'APPROVED':
      return { label: t('approved', 'Approved'), className: 'text-[#3ddc97]' };
    case 'REJECTED':
      return { label: t('rejected', 'Rejected'), className: 'text-[#ff5a5f]' };
    default:
      return { label: '—', className: 'text-pdInk3' };
  }
};

export const ListViewV2: FC = () => {
  const t = useT();
  const {
    integrations,
    loading,
    listPosts,
    listState,
    setListState,
    listPage,
    listTotalPages,
    setListPage,
  } = useCalendar();
  const { editPost, deletePost, openStatistics } = usePostActions();

  const grouped = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const post of listPosts) {
      const key = fromUtc(post.publishDate).format('YYYY-MM-DD');
      (groups[key] = groups[key] || []).push(post);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [listPosts]);

  const tabs: { key: typeof listState; label: string }[] = [
    { key: 'all', label: t('all', 'All') },
    { key: 'scheduled', label: t('scheduled', 'Scheduled') },
    { key: 'draft', label: t('drafts', 'Drafts') },
    { key: 'published', label: t('published', 'Published') },
  ];
  const cols =
    '[grid-template-columns:84px_minmax(150px,1.1fr)_minmax(240px,2.6fr)_minmax(120px,1fr)_110px_130px_112px]';
  // phones and tablets: each post is a small card (time, channel, status /
  // text / approval, actions) instead of a wide table row
  const mobileRow =
    'mobile:[grid-template-columns:auto_minmax(0,1fr)_auto] mobile:gap-x-[10px] mobile:gap-y-[6px] mobile:py-[10px]';

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="h-[48px] mobile:h-[56px] shrink-0 flex items-center gap-[4px] px-[20px] mobile:px-[12px] border-b border-pdLine overflow-x-auto scrollbar-none">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            aria-pressed={listState === tab.key}
            onClick={() => setListState(tab.key)}
            className={clsx(
              'h-[30px] mobile:h-[44px] px-[12px] rounded-[8px] text-[12.5px] mobile:text-[13px] font-[600] whitespace-nowrap',
              listState === tab.key
                ? 'bg-pdSurface2 text-newTextColor ring-1 ring-pdLine2'
                : 'text-textItemBlur hover:text-newTextColor'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-1 relative min-h-0">
        <div className="absolute inset-0 overflow-auto scrollbar scrollbar-thumb-pdLine2 scrollbar-track-transparent">
          <div className="min-w-[960px] mobile:min-w-0 pb-[20px] mobile:pb-[84px]">
            <div
              className={clsx(
                'grid mobile:!hidden gap-[12px] px-[36px] h-[38px] items-center sticky top-0 z-[5] bg-newBgColorInner border-b border-pdLine text-[11px] font-[700] uppercase tracking-[0.08em] text-pdInk3',
                cols
              )}
            >
              <span>{t('time', 'Time')}</span>
              <span>{t('channels', 'Channels')}</span>
              <span>{t('post', 'Post')}</span>
              <span>{t('pd_col_customer', 'Customer')}</span>
              <span>{t('pd_col_status', 'Status')}</span>
              <span>{t('approval', 'Approval')}</span>
              <span className="text-end">{t('actions', 'Actions')}</span>
            </div>
            {loading && (
              <div className="p-[40px] text-center text-textItemBlur">{t('loading', 'Loading')}</div>
            )}
            {!loading && !listPosts.length && (
              <div className="p-[60px] text-center text-textItemBlur text-[14px]">
                {listState === 'scheduled'
                  ? t('no_upcoming_posts', 'No upcoming posts scheduled')
                  : listState === 'draft'
                  ? t('no_draft_posts', 'No draft posts')
                  : listState === 'published'
                  ? t('no_published_posts', 'No published posts')
                  : t('no_posts', 'No posts')}
              </div>
            )}
            {!loading &&
              grouped.map(([key, posts]) => (
                <Fragment key={key}>
                  <div className="px-[20px] mobile:px-[12px] pt-[16px] pb-[8px] text-[12px] mobile:text-[13px] font-[700] text-textItemBlur flex items-center gap-[8px]">
                    {newDayjs(key).isSame(newDayjs(), 'day') && (
                      <span className="text-[#c8ff4d]">{t('today', 'Today')} ·</span>
                    )}
                    {newDayjs(key).format(isUSCitizen() ? 'dddd, MMMM D' : 'dddd, D MMMM')}
                    <span className="text-pdInk3 font-[500]">· {posts.length}</span>
                  </div>
                  <div className="mx-[20px] mobile:mx-[12px] rounded-[12px] border border-pdLine bg-pdSurface overflow-hidden">
                  {posts.map((post: any) => {
                    const integration =
                      (integrations as any[]).find((i) => i.id === post.integration?.id) ||
                      post.integration ||
                      {};
                    const status = pdStatus(post.state, post.approvalStatus) as PdStatus;
                    const approval = approvalText(post, t);
                    const text = stripHtmlValidation('normal', post.content || '', false, true).trim();
                    return (
                      <div
                        key={post.id}
                        className={clsx(
                          'group grid gap-[12px] px-[16px] mobile:px-[12px] min-h-[54px] items-center border-b border-pdLine last:border-b-0 hover:bg-boxHover',
                          cols,
                          mobileRow
                        )}
                      >
                        <span className="text-[13px] font-[600] tabular-nums">
                          {fromUtc(post.publishDate).format(isUSCitizen() ? 'h:mm A' : 'HH:mm')}
                        </span>
                        <span className="flex items-center gap-[8px] min-w-0">
                          <ChannelAvatarV2
                            picture={integration.picture}
                            identifier={integration.providerIdentifier || integration.identifier || ''}
                            name={integration.name || ''}
                            size={26}
                          />
                          <span className="text-[12.5px] truncate">{integration.name}</span>
                        </span>
                        <button
                          type="button"
                          onClick={editPost(post, false)}
                          className="text-start text-[13px] mobile:text-[14px] text-newTextColor/90 truncate mobile:whitespace-normal mobile:line-clamp-2 mobile:min-h-[44px] mobile:col-span-3 mobile:order-4 hover:underline"
                        >
                          {text || t('pd_no_content', 'No content')}
                        </button>
                        <span className="text-[12.5px] text-textItemBlur truncate mobile:hidden">
                          {integration.customer?.name || '—'}
                        </span>
                        <span className="mobile:order-3">
                          <Pill className={statusPill[status]}>{statusText(status, t)}</Pill>
                        </span>
                        <span className={clsx('text-[12.5px] mobile:text-[13px] font-[600] mobile:order-5 mobile:col-span-2', approval.className)}>
                          {approval.label}
                        </span>
                        <span className="flex justify-end gap-[2px] opacity-70 group-hover:opacity-100 mobile:opacity-100 mobile:order-6 mobile:-me-[10px]">
                          <IconButton label={t('edit', 'Edit')} onClick={editPost(post, false)}>
                            <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z" /></svg>
                          </IconButton>
                          <IconButton label={t('duplicate', 'Duplicate')} onClick={editPost(post, true)}>
                            <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="8" width="14" height="14" rx="2" /><path d="M4 16V4a2 2 0 0 1 2-2h12" /></svg>
                          </IconButton>
                          {post.state === 'PUBLISHED' && (
                            <IconButton label={t('statistics', 'Statistics')} onClick={openStatistics(post.id)}>
                              <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 3v18h18M7 15l4-4 3 3 5-6" /></svg>
                            </IconButton>
                          )}
                          <IconButton label={t('delete', 'Delete')} onClick={deletePost(post)} className="hover:!text-[#ff5a5f]">
                            <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
                          </IconButton>
                        </span>
                      </div>
                    );
                  })}
                  </div>
                </Fragment>
              ))}
          </div>
        </div>
      </div>
      {listTotalPages > 1 && (
        <div className="h-[48px] mobile:h-[60px] shrink-0 border-t border-pdLine flex items-center justify-between px-[20px] mobile:px-[12px] text-[12.5px] mobile:text-[13px] text-textItemBlur">
          <span>
            {t('page', 'Page')} {listPage + 1} / {listTotalPages}
          </span>
          <span className="flex gap-[6px]">
            <button
              type="button"
              disabled={listPage <= 0}
              onClick={() => setListPage(listPage - 1)}
              className="h-[30px] mobile:h-[44px] px-[12px] rounded-[8px] bg-pdSurface2 border border-pdLine2 disabled:opacity-40"
            >
              {t('previous', 'Previous')}
            </button>
            <button
              type="button"
              disabled={listPage >= listTotalPages - 1}
              onClick={() => setListPage(listPage + 1)}
              className="h-[30px] mobile:h-[44px] px-[12px] rounded-[8px] bg-pdSurface2 border border-pdLine2 disabled:opacity-40"
            >
              {t('next', 'Next')}
            </button>
          </span>
        </div>
      )}
    </div>
  );
};

export const CalendarV2: FC = () => {
  const { display } = useCalendar();
  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0">
      {display === 'day' && (
        <div className="flex-1 flex flex-col p-[12px] min-h-0">
          <DayView />
        </div>
      )}
      {display === 'week' && <WeekViewV2 />}
      {display === 'month' && <MonthViewV2 />}
      {display === 'list' && <ListViewV2 />}
    </div>
  );
};
