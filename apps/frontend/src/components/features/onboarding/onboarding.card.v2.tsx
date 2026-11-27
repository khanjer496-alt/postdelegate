'use client';

// The v2 getting-started card (PD_FF_ONBOARDING_V2): connect a channel,
// connect your AI, schedule a post, invite an approver. Every step is read
// from the workspace (GET /activation/onboarding) and ticks itself off.
import { FC, useCallback, useEffect, useRef } from 'react';
import clsx from 'clsx';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useCalendar } from '@gitroom/frontend/components/launches/calendar.context';
import { useAddProvider } from '@gitroom/frontend/components/launches/add.provider.component';
import { useCreatePost } from '@gitroom/frontend/components/launches/new.post';
import { useIntegrationList } from '@gitroom/frontend/components/launches/helpers/use.integration.list';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import {
  ONBOARDING_ORDER,
  OnboardingState,
  OnboardingStepId,
  onboardingProgress,
} from './onboarding.steps';

const Check = () => (
  <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none">
    <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const OnboardingCardV2: FC = () => {
  const t = useT();
  const fetch = useFetch();
  const router = useRouter();
  const user = useUser();
  const { integrations, posts } = useCalendar();
  const { mutate: reloadIntegrations } = useIntegrationList();
  const addChannel = useAddProvider(() => reloadIntegrations());
  const createPost = useCreatePost();
  const { data, mutate } = useSWR<OnboardingState>('/activation/onboarding', async (path: string) => {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error('onboarding');
    }
    return response.json();
  });
  const progress = onboardingProgress(data);

  // a channel was added or a post scheduled: check the steps again
  const calendarState = `${integrations.length}:${posts.length}`;
  const last = useRef(calendarState);
  useEffect(() => {
    if (last.current !== calendarState) {
      last.current = calendarState;
      if (progress.visible) mutate();
    }
  }, [calendarState, progress.visible, mutate]);

  const dismiss = useCallback(async () => {
    if (!data) return;
    mutate({ ...data, dismissed: true }, false);
    try {
      const response = await fetch('/activation/checklist/dismiss', { method: 'POST' });
      if (!response.ok) mutate();
    } catch {
      mutate();
    }
  }, [data, fetch, mutate]);

  if (!data || !progress.visible) {
    return null;
  }

  const admin = user?.role !== 'USER';
  const steps: Record<OnboardingStepId, { title: string; hint: string; cta: string; action: () => void }> = {
    channel: {
      title: t('onboarding_v2_channel', 'Connect a channel'),
      hint: t('onboarding_v2_channel_hint', 'Link an account you post to'),
      cta: t('onboarding_v2_channel_cta', 'Add channel'),
      action: addChannel,
    },
    ai: {
      title: t('onboarding_v2_ai', 'Connect your AI'),
      hint: t('onboarding_v2_ai_hint', 'Let Claude, ChatGPT or Cursor plan posts for you over MCP'),
      cta: t('onboarding_v2_ai_cta', 'Connect'),
      action: () => router.push('/settings?tab=agents'),
    },
    scheduled: {
      title: t('onboarding_v2_schedule', 'Schedule a post'),
      hint: data.steps.channel
        ? t('onboarding_v2_schedule_hint', 'Write it once, pick a time')
        : t('checklist_needs_channel', 'Connect a channel first'),
      cta: t('onboarding_v2_schedule_cta', 'Create post'),
      action: createPost,
    },
    approver: {
      title: t('onboarding_v2_approver', 'Invite an approver'),
      hint: t('onboarding_v2_approver_hint', 'A teammate or client signs off before posts go out'),
      cta: t('onboarding_v2_approver_cta', 'Invite'),
      action: () => router.push(admin ? '/settings?tab=approvals' : '/settings?tab=teams'),
    },
  };

  return (
    <section
      data-pd-onboarding-v2=""
      aria-labelledby="pd-onboarding-v2-title"
      className="rounded-[14px] border border-pdLine bg-gradient-to-br from-[#7357ff1a] via-pdSurface to-pdSurface p-[16px] mobile:p-[12px] flex flex-col gap-[12px]"
    >
      <div className="flex items-center gap-[12px]">
        <div className="flex-1 min-w-0">
          <h2 id="pd-onboarding-v2-title" className="text-[15px] font-[700]">
            {t('onboarding_v2_title', 'Set up PostDelegate')}
          </h2>
          <p className="text-[12.5px] text-pdInk3">
            {t('checklist_progress', '{{done}} of {{total}} done', { done: progress.done, total: progress.total })}
          </p>
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress.percent}
          aria-label={t('onboarding_v2_progress', 'Setup progress')}
          className="w-[160px] mobile:w-[90px] h-[6px] rounded-full bg-pdSurface2 overflow-hidden"
        >
          <div className="h-full rounded-full bg-[#c8ff4d] transition-all" style={{ width: `${progress.percent}%` }} />
        </div>
        <span className="text-[12px] font-[700] text-[#c8ff4d] tabular-nums w-[36px] text-end">{progress.percent}%</span>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t('checklist_dismiss', 'Hide the getting started list')}
          title={t('checklist_dismiss', 'Hide the getting started list')}
          className="w-[28px] h-[28px] rounded-[8px] grid place-items-center text-textItemBlur hover:text-newTextColor hover:bg-pdSurface2"
        >
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>
      <ol className="grid grid-cols-4 tablet:grid-cols-2 mobile:grid-cols-1 gap-[8px]">
        {ONBOARDING_ORDER.map((id, index) => {
          const step = steps[id];
          const done = data.steps[id];
          const blocked = !done && !!progress.blocked(id);
          const isNext = progress.next === id;
          return (
            <li
              key={id}
              data-step={id}
              data-done={done ? '' : undefined}
              className={clsx(
                'rounded-[12px] border p-[12px] flex flex-col gap-[8px] min-w-0',
                done ? 'border-[#3ddc9740] bg-[#3ddc970d]' : isNext ? 'border-[#7357ff88] bg-pdSurface2' : 'border-pdLine bg-pdSurface'
              )}
            >
              <div className="flex items-center gap-[8px]">
                <span
                  className={clsx(
                    'w-[22px] h-[22px] rounded-full grid place-items-center text-[11px] font-[700] shrink-0',
                    done ? 'bg-[#3ddc97] text-[#0a0a0b]' : isNext ? 'bg-[#7357ff] text-white' : 'bg-pdSurface2 text-textItemBlur'
                  )}
                >
                  {done ? <Check /> : index + 1}
                </span>
                <span className={clsx('text-[13px] font-[700] truncate', done && 'line-through text-textItemBlur')}>
                  {step.title}
                </span>
              </div>
              <p className="text-[12px] text-pdInk3 min-h-[32px]">{step.hint}</p>
              {!done && (
                <button
                  type="button"
                  disabled={blocked}
                  onClick={step.action}
                  className={clsx(
                    'self-start h-[28px] px-[10px] rounded-[8px] text-[12px] font-[700] disabled:opacity-50 disabled:cursor-not-allowed',
                    isNext ? 'bg-[#c8ff4d] text-[#0b0f05]' : 'bg-pdSurface2 border border-pdLine2 text-newTextColor'
                  )}
                >
                  {step.cta}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
};
