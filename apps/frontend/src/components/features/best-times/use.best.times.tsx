'use client';

import { FC, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import dayjs from 'dayjs';
import clsx from 'clsx';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import {
  getTimezone,
  newDayjs,
} from '@gitroom/frontend/components/layout/set.timezone';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useFeature } from '../feature.flags.client';
import {
  BestSlot,
  BestTimesData,
  nextBestTime,
  nextPostingSlot,
  pickBestSlots,
  slotKey,
} from './best.times';

// the last 90 days of the workspace's published posts
const DAYS = 90;

// Best-time slots for the calendar and the composer, empty while the flag is
// off or the workspace has too few posts with stats. Same endpoint and
// timezone as Analytics > Best times.
export const useBestTimes = () => {
  const enabled = useFeature('best_times');
  const fetch = useFetch();
  let timezone = 'UTC';
  try {
    timezone = getTimezone();
  } catch {
    timezone = 'UTC';
  }
  const load = useCallback(async (path: string) => {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error('best times');
    }
    return (await response.json()) as BestTimesData;
  }, []);
  const { data } = useSWR(
    enabled
      ? `/analytics/best-times?days=${DAYS}&timezone=${encodeURIComponent(
          timezone
        )}`
      : null,
    load,
    { revalidateOnFocus: false, dedupingInterval: 10 * 60 * 1000 }
  );
  return useMemo(() => {
    const slots = pickBestSlots(data);
    const keys = new Map<string, BestSlot>(
      slots.map((slot) => [slotKey(slot.weekday, slot.hour), slot])
    );
    return {
      enabled,
      data,
      slots,
      // the best slot at a weekday/hour, if it is one
      at: (weekday: number, hour: number) => keys.get(slotKey(weekday, hour)),
    };
  }, [enabled, data]);
};

const Star: FC<{ size?: number }> = ({ size = 11 }) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z" />
  </svg>
);

// the badge on a week-view hour that is one of the best times
export const BestTimeBadge: FC<{ slot: BestSlot; time: string }> = ({
  slot,
  time,
}) => {
  const t = useT();
  const label = t('best_time_to_post', 'Best time to post');
  return (
    <div
      data-pd-best-time=""
      title={`${label} · ${t(
        'best_time_score',
        '{{score}}x a typical post, {{posts}} posts',
        { score: slot.score.toFixed(1), posts: slot.posts }
      )}`}
      className="pointer-events-none absolute top-[4px] end-[4px] z-[16] flex items-center gap-[3px] h-[18px] px-[6px] rounded-full bg-[#c8ff4d1f] text-[#c8ff4d] ring-1 ring-[#c8ff4d55] text-[10.5px] font-[700] whitespace-nowrap"
    >
      <Star size={10} />
      <span className="tablet:hidden">{t('best_time', 'Best time')}</span>
      <span className="sr-only">{`${label} ${time}`}</span>
    </div>
  );
};

// the legend chip in the calendar toolbar while best times are shown
export const BestTimesLegend: FC = () => {
  const t = useT();
  const { enabled, slots } = useBestTimes();
  if (!enabled || !slots.length) {
    return null;
  }
  return (
    <span
      data-pd-best-times-legend=""
      className="hidden desktop:flex items-center gap-[5px] h-[26px] px-[9px] rounded-full bg-[#c8ff4d14] text-[#c8ff4d] ring-1 ring-[#c8ff4d40] text-[11.5px] font-[600] whitespace-nowrap"
    >
      <Star />
      {t('best_times_from_your_posts', 'Best times from your posts')}
    </span>
  );
};

// "Next best time" in the composer: moves the post to the next best slot,
// or, until there is enough data, to the next posting slot of its channels
export const NextBestTimeButton: FC<{
  onPick: (date: dayjs.Dayjs) => void;
  slotMinutesUtc: number[];
}> = ({ onPick, slotMinutesUtc }) => {
  const t = useT();
  const { enabled, slots, data } = useBestTimes();
  if (!enabled) {
    return null;
  }
  const now = newDayjs();
  const best = nextBestTime(now, slots);
  const fallback = best
    ? null
    : nextPostingSlot(now, slotMinutesUtc, (date) => newDayjs(date));
  const target = best || fallback;
  const label = best
    ? t('next_best_time', 'Next best time')
    : t('next_open_slot', 'Next posting slot');
  const hint = best
    ? t('next_best_time_hint', 'Based on engagement of your last 90 days of posts')
    : data && data.basis !== 'engagement'
    ? t('best_time_needs_posts', 'Best times appear after {{required}} published posts with stats; using your posting slots for now', { required: data.required })
    : t('best_time_no_slots', 'Using the posting slots of your channels');
  return (
    <button
      type="button"
      data-pd-next-best-time=""
      disabled={!target}
      title={target ? `${hint} · ${target.format('ddd D MMM, HH:mm')}` : hint}
      onClick={() => target && onPick(target)}
      className={clsx(
        'flex items-center gap-[6px] h-[44px] px-[12px] rounded-[8px] text-[13px] font-[600] whitespace-nowrap',
        'bg-pdSurface2 border border-pdLine2 hover:border-[#c8ff4d66] disabled:opacity-50 disabled:cursor-not-allowed',
        best ? 'text-[#c8ff4d]' : 'text-textItemBlur'
      )}
    >
      <Star size={12} />
      <span>{label}</span>
      {target && (
        <span className="text-[11.5px] font-[500] text-pdInk3">
          {target.format('ddd HH:mm')}
        </span>
      )}
    </button>
  );
};
