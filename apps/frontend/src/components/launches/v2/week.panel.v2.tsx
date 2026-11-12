'use client';

import { FC, ReactNode, useMemo, useState } from 'react';
import clsx from 'clsx';
import Link from 'next/link';
import { useCalendar } from '@gitroom/frontend/components/launches/calendar.context';
import { pdStatus, usePostActions } from '@gitroom/frontend/components/launches/calendar';
import { useApprovalActions } from '@gitroom/frontend/components/approvals/approval.actions';
import { useReviewCount } from '@gitroom/frontend/components/approvals/approvals.hooks';
import { fromUtc, newDayjs } from '@gitroom/frontend/components/layout/set.timezone';
import { isUSCitizen } from '@gitroom/frontend/components/launches/helpers/isuscitizen.utils';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { stripHtmlValidation } from '@gitroom/helpers/utils/strip.html.validation';
import { useOpenSlotCount } from './views.v2';
import { ChannelAvatarV2, Pill, PdStatus, statusPill } from './ui.v2';

type Tab = 'next' | 'approval' | 'drafts';

// the right column of the v2 calendar: what this range holds, what is next,
// what waits for approval. Uses only the calendar's loaded posts and the
// existing approval actions.
export const WeekPanelV2: FC<{
  refreshChannel: (integration: any) => () => void;
  tools?: ReactNode;
}> = ({ refreshChannel, tools }) => {
  const t = useT();
  const toaster = useToaster();
  const { posts: rangePosts, listPosts, integrations, reloadCalendarView, display } = useCalendar();
  // the list view loads its own page of posts
  const posts = display === 'list' ? listPosts : rangePosts;
  const openSlots = useOpenSlotCount();
  const { editPost } = usePostActions();
  const { approve, requestChanges } = useApprovalActions();
  const { data: reviewCount } = useReviewCount();
  const [tab, setTab] = useState<Tab>('next');

  const byStatus = useMemo(() => {
    const now = newDayjs();
    const sorted = [...posts].sort(
      (a, b) => fromUtc(a.publishDate).valueOf() - fromUtc(b.publishDate).valueOf()
    );
    const status = (p: any) => pdStatus(p.state, p.approvalStatus);
    return {
      scheduled: sorted.filter((p) => status(p) === 'scheduled'),
      review: sorted.filter((p) => status(p) === 'review'),
      published: sorted.filter((p) => status(p) === 'published'),
      drafts: sorted.filter((p) => status(p) === 'draft'),
      upNext: sorted.filter(
        (p) => status(p) === 'scheduled' && fromUtc(p.publishDate).isAfter(now)
      ),
      approval: sorted.filter((p) => p.approvalStatus === 'IN_REVIEW'),
    };
  }, [posts]);

  const failing = useMemo(
    () => (integrations as any[]).filter((i) => i.refreshNeeded && !i.disabled),
    [integrations]
  );

  const integrationOf = (post: any) =>
    (integrations as any[]).find((i) => i.id === post.integration?.id) ||
    post.integration ||
    {};

  const rows =
    tab === 'next' ? byStatus.upNext : tab === 'approval' ? byStatus.approval : byStatus.drafts;

  const copyPrompt = async () => {
    const prompt = t(
      'mcp_open_slots_prompt',
      'Look at my PostDelegate calendar for this week, find the open posting slots and draft a post for each one. Keep them as drafts for my review.'
    );
    try {
      await navigator.clipboard.writeText(prompt);
      toaster.show(t('copied_to_clipboard', 'Copied to clipboard'), 'success');
    } catch {
      toaster.show(t('could_not_copy', 'Could not copy'), 'warning');
    }
  };

  const rangeWord =
    display === 'month'
      ? t('this_month', 'This month')
      : display === 'day'
      ? t('today', 'Today')
      : display === 'list'
      ? t('upcoming', 'Upcoming')
      : t('this_week', 'This week');

  // month and list use the whole width, like the mockups
  if (display === 'list' || display === 'month') {
    return null;
  }

  return (
    <aside className="w-[300px] shrink-0 border-s border-pdLine bg-pdPanel flex flex-col min-h-0 tablet:hidden">
      <div className="p-[16px] pb-[12px]">
        <div className="flex items-center justify-between mb-[10px] h-[32px]">
          <div className="text-[14px] font-[700]">{rangeWord}</div>
          {tools}
        </div>
        <div className="grid grid-cols-3 gap-[8px]">
          {(
            [
              [byStatus.scheduled.length, t('scheduled', 'Scheduled'), 'text-[#b39aff]'],
              [byStatus.review.length, t('in_review', 'In review'), 'text-[#ffb547]'],
              [byStatus.published.length, t('published', 'Published'), 'text-[#3ddc97]'],
            ] as const
          ).map(([count, label, color]) => (
            <div key={label} className="rounded-[10px] bg-pdSurface border border-pdLine px-[10px] py-[9px]">
              <div className={clsx('text-[20px] font-[800] leading-none', color)}>{count}</div>
              <div className="text-[11px] text-textItemBlur mt-[5px] whitespace-nowrap">{label}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="px-[16px] flex gap-[4px] border-b border-pdLine">
        {(
          [
            ['next', t('up_next', 'Up next'), byStatus.upNext.length],
            [
              'approval',
              t('needs_approval', 'Needs approval'),
              Math.max(byStatus.approval.length, reviewCount?.count || 0),
            ],
            ['drafts', t('drafts', 'Drafts'), byStatus.drafts.length],
          ] as const
        ).map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            aria-pressed={tab === key}
            onClick={() => setTab(key)}
            className={clsx(
              'h-[36px] px-[6px] -mb-px border-b-2 text-[12px] font-[600] whitespace-nowrap flex items-center gap-[5px]',
              tab === key ? 'border-[#7357ff] text-newTextColor' : 'border-transparent text-textItemBlur hover:text-newTextColor'
            )}
          >
            {label}
            {count > 0 && (
              <span
                className={clsx(
                  'text-[10.5px] px-[5px] rounded-full',
                  key === 'approval' ? 'bg-[#ffb5472a] text-[#ffb547]' : 'bg-pdSurface2 text-textItemBlur'
                )}
              >
                {count}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-[12px] flex flex-col gap-[8px] scrollbar scrollbar-thumb-pdLine2 scrollbar-track-transparent">
        {!rows.length && (
          <div className="text-[12.5px] text-textItemBlur text-center py-[24px]">
            {tab === 'approval'
              ? t('nothing_waits_for_approval', 'Nothing waits for approval')
              : tab === 'drafts'
              ? t('no_draft_posts', 'No draft posts')
              : t('no_upcoming_posts', 'No upcoming posts scheduled')}
          </div>
        )}
        {rows.slice(0, 8).map((post: any) => {
          const integration = integrationOf(post);
          const at = fromUtc(post.publishDate);
          const text = stripHtmlValidation('normal', post.content || '', false, true).trim();
          return (
            <div
              key={post.id}
              className={clsx(
                'rounded-[10px] bg-pdSurface border border-pdLine p-[10px]',
                tab === 'approval' && 'border-s-[3px] border-s-[#ffb547]'
              )}
            >
              <button type="button" onClick={editPost(post, false)} className="w-full text-start flex gap-[10px]">
                <ChannelAvatarV2
                  picture={integration.picture}
                  identifier={integration.providerIdentifier || integration.identifier || ''}
                  name={integration.name || ''}
                  size={28}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex justify-between gap-[6px] text-[11.5px] text-textItemBlur">
                    <span className="truncate">{integration.customer?.name || integration.name}</span>
                    <span className="whitespace-nowrap tabular-nums">
                      {at.format(isUSCitizen() ? 'ddd h:mm A' : 'ddd HH:mm')}
                    </span>
                  </span>
                  {tab !== 'drafts' && (
                    <span className="float-end ms-[6px] mt-[3px]">
                      <Pill className={statusPill[pdStatus(post.state, post.approvalStatus) as PdStatus]}>
                        {pdStatus(post.state, post.approvalStatus) === 'review'
                          ? t('in_review', 'In review')
                          : t('scheduled', 'Scheduled')}
                      </Pill>
                    </span>
                  )}
                  <span className="block text-[12.5px] leading-[1.4] mt-[2px] line-clamp-2">
                    {text || t('pd_no_content', 'No content')}
                  </span>
                </span>
              </button>
              {tab === 'approval' && (
                <div className="flex gap-[6px] mt-[8px]">
                  <button
                    type="button"
                    onClick={async () => {
                      if (await approve(post)) reloadCalendarView();
                    }}
                    className="flex-1 h-[28px] rounded-[7px] bg-[#c8ff4d] text-[#0a0a0b] text-[12px] font-[700]"
                  >
                    {t('approve', 'Approve')}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (await requestChanges(post)) reloadCalendarView();
                    }}
                    className="flex-1 h-[28px] rounded-[7px] bg-pdSurface2 border border-pdLine2 text-[12px] font-[600]"
                  >
                    {t('approval_request_changes', 'Request changes')}
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {tab === 'approval' && (reviewCount?.count || 0) > byStatus.approval.length && (
          <Link href="/review" className="text-[12px] text-[#b39aff] hover:underline text-center py-[4px]">
            {t('open_review_inbox', 'Open the review inbox')} ({reviewCount?.count})
          </Link>
        )}
        {failing.map((integration) => (
          <div key={integration.id} className="rounded-[10px] border border-[#ff5a5f55] bg-[#ff5a5f12] p-[10px] flex items-center gap-[10px]">
            <ChannelAvatarV2 picture={integration.picture} identifier={integration.identifier} name={integration.name} size={28} />
            <span className="flex-1 min-w-0 text-[12px]">
              <span className="block font-[600] truncate">{integration.name}</span>
              <span className="text-[#ff5a5f]">{t('channel_disconnected', 'Disconnected')}</span>
            </span>
            <button
              type="button"
              onClick={refreshChannel(integration)}
              className="h-[28px] px-[10px] rounded-[7px] bg-pdSurface2 border border-pdLine2 text-[12px] font-[600]"
            >
              {t('reconnect', 'Reconnect')}
            </button>
          </div>
        ))}
      </div>
      <div className="m-[12px] mt-0 rounded-[12px] border border-pdLine bg-gradient-to-br from-[#7357ff1f] to-transparent p-[12px]">
        <div className="text-[12.5px] font-[700]">
          {display !== 'list' && openSlots > 0
            ? display === 'week'
              ? t('open_slots_this_week', '{{count}} open slots this week', { count: openSlots })
              : t('open_slots_in_view', '{{count}} open slots in view', { count: openSlots })
            : t('let_your_assistant_fill_slots', 'Let your assistant fill open slots')}
        </div>
        <div className="text-[11.5px] text-textItemBlur mt-[3px] leading-[1.4]">
          {t('mcp_card_hint', 'Paste this prompt into your AI assistant connected over MCP.')}
        </div>
        <div className="flex gap-[6px] mt-[10px]">
          <button type="button" onClick={copyPrompt} className="flex-1 h-[30px] rounded-[8px] bg-[#7357ff] text-white text-[12px] font-[600]">
            {t('copy_mcp_prompt', 'Copy MCP prompt')}
          </button>
          <Link href="/channels" className="h-[30px] px-[10px] rounded-[8px] bg-pdSurface2 border border-pdLine2 text-[12px] font-[600] grid place-items-center whitespace-nowrap">
            {t('pd_edit_time_slots', 'Edit time slots')}
          </Link>
        </div>
      </div>
    </aside>
  );
};
