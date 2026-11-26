'use client';

// Small presentational pieces shared by the parity features' v2 pages
// (analytics, campaigns, SmartLinks, onboarding). Same tokens as the v2
// calendar (pdSurface, pdLine, lime #c8ff4d, violet #7357ff).
import { FC, KeyboardEvent, ReactNode, useCallback, useRef } from 'react';
import clsx from 'clsx';

export const PageV2: FC<{
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}> = ({ title, subtitle, actions, children }) => (
  <div className="flex-1 min-w-0 bg-newBgColorInner flex flex-col">
    <div className="min-h-[64px] shrink-0 flex flex-wrap items-center gap-[12px] px-[24px] py-[12px] border-b border-pdLine mobile:px-[12px]">
      <div className="flex-1 min-w-[200px]">
        <h1 className="text-[18px] font-[700] leading-[24px]">{title}</h1>
        {subtitle && (
          <p className="text-[12.5px] text-pdInk3 mt-[2px]">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-[8px]">{actions}</div>
      )}
    </div>
    <div className="flex-1 min-h-0 overflow-auto p-[24px] mobile:p-[12px] flex flex-col gap-[16px]">
      {children}
    </div>
  </div>
);

export const CardV2: FC<{
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}> = ({ title, subtitle, actions, className, children }) => (
  <section
    className={clsx(
      'rounded-[14px] bg-pdSurface border border-pdLine p-[16px] flex flex-col gap-[12px] min-w-0',
      className
    )}
  >
    {(title || actions) && (
      <div className="flex items-start gap-[10px]">
        <div className="flex-1 min-w-0">
          {title && <h2 className="text-[14px] font-[700]">{title}</h2>}
          {subtitle && (
            <p className="text-[12px] text-pdInk3 mt-[2px]">{subtitle}</p>
          )}
        </div>
        {actions}
      </div>
    )}
    {children}
  </section>
);

export const KpiCardV2: FC<{
  label: string;
  value: ReactNode;
  delta?: number | null;
  hint?: ReactNode;
  tone?: 'default' | 'danger' | 'lime';
  loading?: boolean;
}> = ({ label, value, delta, hint, tone = 'default', loading }) => (
  <div
    data-pd-kpi=""
    className="rounded-[14px] bg-pdSurface border border-pdLine px-[14px] py-[12px] flex flex-col gap-[6px] min-w-0"
  >
    <span className="text-[12px] font-[600] text-textItemBlur truncate">
      {label}
    </span>
    {loading ? (
      <span className="h-[28px] w-[70px] rounded-[6px] bg-pdSurface2 animate-pulse" />
    ) : (
      <span
        className={clsx(
          'text-[24px] leading-[28px] font-[700] tabular-nums',
          tone === 'danger' && 'text-[#ff5a5f]',
          tone === 'lime' && 'text-[#c8ff4d]'
        )}
      >
        {value}
      </span>
    )}
    <span className="flex items-center gap-[6px] min-h-[18px] text-[11.5px] text-pdInk3">
      {typeof delta === 'number' && !loading && (
        <span
          className={clsx(
            'inline-flex items-center px-[6px] h-[18px] rounded-full font-[700]',
            delta > 0
              ? 'bg-[#3ddc9726] text-[#3ddc97]'
              : delta < 0
              ? 'bg-[#ff5a5f26] text-[#ff5a5f]'
              : 'bg-pdSurface2 text-textItemBlur'
          )}
        >
          {delta > 0 ? '▲' : delta < 0 ? '▼' : '•'} {Math.abs(delta)}%
        </span>
      )}
      {hint}
    </span>
  </div>
);

export const EmptyV2: FC<{ title: string; children?: ReactNode; action?: ReactNode }> = ({
  title,
  children,
  action,
}) => (
  <div className="rounded-[14px] border border-dashed border-pdLine2 p-[24px] flex flex-col items-center text-center gap-[8px]">
    <span className="text-[14px] font-[700]">{title}</span>
    {children && (
      <span className="text-[12.5px] text-pdInk3 max-w-[460px]">{children}</span>
    )}
    {action}
  </div>
);

export const buttonV2 = {
  ghost:
    'inline-flex items-center gap-[6px] h-[32px] px-[12px] rounded-[9px] bg-pdSurface2 border border-pdLine2 text-[13px] font-[600] text-newTextColor hover:border-[#7357ff88] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap',
  primary:
    'inline-flex items-center gap-[6px] h-[32px] px-[12px] rounded-[9px] bg-[#c8ff4d] text-[#0b0f05] text-[13px] font-[700] hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap',
};

export const inputV2 =
  'h-[36px] px-[10px] rounded-[9px] bg-pdSurface2 border border-pdLine2 text-[13px] outline-none focus:border-[#7357ff] w-full';

// accessible tab strip (arrow keys, Home/End) in the v2 style
export function TabsV2<T extends string>({
  value,
  tabs,
  onChange,
  label,
  idPrefix,
}: {
  value: T;
  tabs: Array<{ key: T; label: string }>;
  onChange: (value: T) => void;
  label: string;
  idPrefix: string;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const rtl = document.dir === 'rtl';
      const index = tabs.findIndex((tab) => tab.key === value);
      const next =
        e.key === (rtl ? 'ArrowLeft' : 'ArrowRight')
          ? (index + 1) % tabs.length
          : e.key === (rtl ? 'ArrowRight' : 'ArrowLeft')
          ? (index - 1 + tabs.length) % tabs.length
          : e.key === 'Home'
          ? 0
          : e.key === 'End'
          ? tabs.length - 1
          : -1;
      if (next === -1) return;
      e.preventDefault();
      onChange(tabs[next].key);
      refs.current[next]?.focus();
    },
    [tabs, value, onChange]
  );
  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="flex p-[3px] rounded-[10px] bg-pdSurface border border-pdLine overflow-x-auto scrollbar-none max-w-full self-start"
    >
      {tabs.map((tab, index) => (
        <button
          key={tab.key}
          ref={(el) => {
            refs.current[index] = el;
          }}
          id={`${idPrefix}-tab-${tab.key}`}
          type="button"
          role="tab"
          aria-selected={value === tab.key}
          aria-controls={`${idPrefix}-panel-${tab.key}`}
          tabIndex={value === tab.key ? 0 : -1}
          onClick={() => onChange(tab.key)}
          className={clsx(
            'px-[12px] h-[28px] rounded-[7px] text-[12.5px] font-[600] whitespace-nowrap transition-colors',
            value === tab.key
              ? 'bg-pdSurface2 text-newTextColor shadow-sm ring-1 ring-pdLine2'
              : 'text-textItemBlur hover:text-newTextColor'
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// percent change, rounded, null without a base
export const percentChange = (current?: number | null, previous?: number | null) =>
  current === null || current === undefined || !previous
    ? null
    : Math.round(((current - previous) / Math.abs(previous)) * 100);
