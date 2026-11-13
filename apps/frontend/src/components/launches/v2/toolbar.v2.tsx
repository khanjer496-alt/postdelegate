'use client';

import { FC, useCallback, useMemo, useState } from 'react';
import clsx from 'clsx';
import { useClickOutside } from '@mantine/hooks';
import { useCalendar } from '@gitroom/frontend/components/launches/calendar.context';
import { uniqBy } from 'lodash';
import { useShallow } from 'zustand/react/shallow';
import { useLaunchStore } from '@gitroom/frontend/components/new-launch/store';
import { SelectChannels } from '@gitroom/frontend/components/launches/select.channels';
import {
  SelectTags,
  useWorkspaceTags,
} from '@gitroom/frontend/components/launches/select.tags';
import { newDayjs, getTimezone } from '@gitroom/frontend/components/layout/set.timezone';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { ghostButton } from './ui.v2';
import { BestTimesLegend } from '@gitroom/frontend/components/features/best-times/use.best.times';

type Display = 'day' | 'week' | 'month' | 'list';

// same ranges as the classic Filters bar
const getDateRange = (display: Display, referenceDate?: string) => {
  const date = referenceDate ? newDayjs(referenceDate) : newDayjs();
  switch (display) {
    case 'day':
    case 'list':
      return { startDate: date.format('YYYY-MM-DD'), endDate: date.format('YYYY-MM-DD') };
    case 'week':
      return {
        startDate: date.startOf('isoWeek').format('YYYY-MM-DD'),
        endDate: date.endOf('isoWeek').format('YYYY-MM-DD'),
      };
    case 'month':
      return {
        startDate: date.startOf('month').format('YYYY-MM-DD'),
        endDate: date.endOf('month').format('YYYY-MM-DD'),
      };
  }
};

const Chevron: FC<{ dir: 'left' | 'right' }> = ({ dir }) => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="rtl:-scale-x-100">
    <path d={dir === 'left' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} />
  </svg>
);

// customer filter: same change as the classic SelectCustomer, plus a way
// back to every customer
const CustomerSelectV2: FC<{
  integrations: any[];
  customer: string;
  onChange: (customer: string) => void;
}> = ({ integrations, customer, onChange }) => {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));
  const setCurrent = useLaunchStore(useShallow((state) => state.setCurrent));
  const customers = useMemo(
    () =>
      uniqBy(integrations, (i) => i?.customer?.id)
        .map((i) => i.customer)
        .filter((c) => c?.name),
    [integrations]
  );
  if (customers.length <= 1) return null;
  const current = customers.find((c) => c.id === customer);
  const pick = (id: string) => {
    onChange(id);
    setCurrent('global');
    setOpen(false);
  };
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-label={current?.name || t('all_customers', 'All customers')}
        onClick={() => setOpen(!open)}
        className={ghostButton}
      >
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></svg>
        <span className="max-w-[140px] truncate mobile:hidden">{current?.name || t('all_customers', 'All customers')}</span>
        <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <div role="menu" className="absolute top-[calc(100%+6px)] end-0 z-[60] min-w-[220px] p-[6px] rounded-[12px] bg-newBgColorInner ring-1 ring-newBorder shadow-menu flex flex-col">
          {[{ id: '', name: t('all_customers', 'All customers') }, ...customers].map((c) => (
            <button
              key={c.id || 'all'}
              role="menuitemradio"
              aria-checked={(customer || '') === c.id}
              type="button"
              onClick={() => pick(c.id)}
              className={clsx(
                'h-[34px] px-[10px] rounded-[8px] text-start text-[13px] hover:bg-boxHover',
                (customer || '') === c.id && 'text-[#b39aff] font-[600]'
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const ToolbarV2: FC = () => {
  const calendar = useCalendar();
  const t = useT();
  const display = calendar.display as Display;
  const { data: workspaceTags } = useWorkspaceTags();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersRef = useClickOutside(() => setFiltersOpen(false));
  const activeFilters =
    (calendar.selectedChannels ? 1 : 0) + (calendar.selectedTags ? 1 : 0);

  const setView = useCallback(
    (next: Display) => {
      const range = getDateRange(next);
      calendar.setFilters({ ...range, display: next, customer: calendar.customer });
    },
    [calendar]
  );
  const move = useCallback(
    (step: 1 | -1) => {
      const unit = display === 'day' ? 'day' : display === 'month' ? 'month' : 'week';
      const start = newDayjs(calendar.startDate).add(step, unit);
      const range = getDateRange(display, start.format('YYYY-MM-DD'));
      calendar.setFilters({ ...range, display, customer: calendar.customer });
    },
    [calendar, display]
  );
  const setCustomer = useCallback(
    (customer: string) => {
      if (calendar.customer === customer) return;
      calendar.setFilters({
        startDate: calendar.startDate,
        endDate: calendar.endDate,
        display,
        customer,
      });
    },
    [calendar, display]
  );

  const start = newDayjs(calendar.startDate);
  const end = newDayjs(calendar.endDate);
  const label =
    display === 'day'
      ? start.format('ddd, MMM D')
      : display === 'week'
      ? start.month() === end.month()
        ? `${start.format('MMM D')} – ${end.format('D, YYYY')}`
        : `${start.format('MMM D')} – ${end.format('MMM D, YYYY')}`
      : display === 'month'
      ? start.format('MMMM YYYY')
      : t('upcoming', 'Upcoming');

  let tz = '';
  try {
    tz = getTimezone();
  } catch {
    tz = '';
  }

  const views: { key: Display; label: string }[] = [
    { key: 'day', label: t('day', 'Day') },
    { key: 'week', label: t('week', 'Week') },
    { key: 'month', label: t('month', 'Month') },
    { key: 'list', label: t('list', 'List') },
  ];

  return (
    <div className="min-h-[56px] shrink-0 flex flex-wrap items-center gap-x-[10px] gap-y-[8px] px-[20px] py-[10px] border-b border-pdLine mobile:px-[12px]">
      {display !== 'list' && (
        <>
          <button type="button" className={ghostButton} onClick={() => setView(display)}>
            {t('today', 'Today')}
          </button>
          <div className="flex">
            <button
              type="button"
              aria-label={t('previous', 'Previous')}
              onClick={() => move(-1)}
              className="w-[32px] h-[32px] mobile:w-[44px] mobile:h-[44px] grid place-items-center rounded-s-[9px] bg-pdSurface2 border border-pdLine2 hover:text-textItemFocused"
            >
              <Chevron dir="left" />
            </button>
            <button
              type="button"
              aria-label={t('next', 'Next')}
              onClick={() => move(1)}
              className="w-[32px] h-[32px] mobile:w-[44px] mobile:h-[44px] grid place-items-center rounded-e-[9px] bg-pdSurface2 border border-pdLine2 border-s-0 hover:text-textItemFocused"
            >
              <Chevron dir="right" />
            </button>
          </div>
        </>
      )}
      <div className="text-[15px] font-[700] whitespace-nowrap">{label}</div>
      {display === 'week' && <BestTimesLegend />}
      {!!tz && (
        <span className="text-[11.5px] text-pdInk3 whitespace-nowrap flex items-center gap-[4px] tablet:hidden">
          <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" /></svg>
          {tz}
        </span>
      )}
      <div className="ms-auto flex flex-wrap items-center gap-[8px] justify-end mobile:w-full mobile:ms-0 mobile:flex-nowrap">
        <div role="group" aria-label={t('calendar', 'Calendar')} className="flex p-[3px] rounded-[10px] bg-pdSurface border border-pdLine mobile:flex-1 mobile:min-w-0">
          {views.map((v) => (
            <button
              key={v.key}
              type="button"
              aria-pressed={display === v.key}
              onClick={() => display !== v.key && setView(v.key)}
              className={clsx(
                'px-[10px] h-[26px] mobile:h-[38px] mobile:flex-1 mobile:px-[4px] rounded-[7px] text-[12.5px] mobile:text-[13px] font-[600] transition-colors',
                display === v.key ? 'bg-pdSurface2 text-newTextColor shadow-sm ring-1 ring-pdLine2' : 'text-textItemBlur hover:text-newTextColor'
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
        <CustomerSelectV2
          customer={(calendar.customer as string) || ''}
          onChange={setCustomer}
          integrations={calendar.integrations}
        />
        {(calendar.integrations.length > 1 || !!workspaceTags?.tags?.length) && (
          <div ref={filtersRef} className="relative">
            <button
              type="button"
              aria-expanded={filtersOpen}
              aria-label={t('filters', 'Filters')}
              onClick={() => setFiltersOpen(!filtersOpen)}
              className={ghostButton}
            >
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4" /></svg>
              <span className="mobile:hidden">{t('filters', 'Filters')}</span>
              {activeFilters > 0 && (
                <span className="text-[11px] font-[700] px-[6px] rounded-full bg-[#7357ff33] text-[#b39aff]">
                  {activeFilters}
                </span>
              )}
            </button>
            {filtersOpen && (
              <div className="absolute top-[calc(100%+6px)] end-0 z-[60] flex flex-col gap-[8px] p-[10px] rounded-[12px] bg-newBgColorInner ring-1 ring-newBorder shadow-menu min-w-[220px]">
                <SelectChannels />
                <SelectTags />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
