'use client';

import { FC, useState } from 'react';
import clsx from 'clsx';
import Link from 'next/link';
import { useClickOutside } from '@mantine/hooks';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useMenuItem } from '@gitroom/frontend/components/layout/top.menu';
import { useReviewCount } from '@gitroom/frontend/components/approvals/approvals.hooks';
import SafeImage from '@gitroom/react/helpers/safe.image';
import { NavItemV2 } from './nav.item.v2';
import { setUiLayoutCookie } from './ui.flag.client';

type MenuItem = ReturnType<typeof useMenuItem>['all'][number];

// same visibility rules as the classic TopMenu
const useVisible = () => {
  const user = useUser();
  const { billingEnabled } = useVariables();
  return (f: MenuItem) => {
    if (f.hide) return false;
    if (f.requireBilling && !billingEnabled) return false;
    if (f.requireAi && !user?.aiAvailable) return false;
    if (f.name === 'Billing' && user?.isLifetime) return false;
    if (f.role) return !!user?.role && f.role.includes(user.role);
    return true;
  };
};

const GROUPS: { key: string; label: [string, string]; paths: string[] }[] = [
  { key: 'plan', label: ['nav_group_plan', 'Plan'], paths: ['/launches', '/review', '/ideas'] },
  { key: 'create', label: ['nav_group_create', 'Create'], paths: ['/studio', '/media', '/agents'] },
  { key: 'measure', label: ['nav_group_measure', 'Measure'], paths: ['/analytics'] },
  { key: 'workspace', label: ['nav_group_workspace', 'Workspace'], paths: ['/settings', '/billing'] },
];

const UserRow: FC<{ collapsed: boolean }> = ({ collapsed }) => {
  const t = useT();
  const user = useUser();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false));
  const label = user?.name || user?.email || '';
  const initials =
    label
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || '?';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={clsx(
          'flex items-center w-full gap-[10px] rounded-[10px] p-[6px] hover:bg-boxHover text-start outline-none focus-visible:ring-2 focus-visible:ring-btnPrimary',
          collapsed && 'justify-center mobile:justify-start'
        )}
      >
        <span className="flex items-center justify-center w-[32px] h-[32px] shrink-0 rounded-full bg-btnPrimary text-white text-[12px] font-[700]">
          {initials}
        </span>
        <span className={clsx('flex-1 min-w-0 leading-tight', collapsed && 'hidden mobile:block')}>
          <span className="block text-[13px] font-[600] truncate">{label}</span>
          {!!user?.tier?.current && (
            <span className="block text-[11px] text-textItemBlur truncate capitalize">
              {String(user.tier.current).toLowerCase()} {t('plan_word', 'plan')}
            </span>
          )}
        </span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute bottom-[calc(100%+6px)] start-0 z-[300] min-w-[220px] p-[6px] rounded-[12px] bg-newBgColorInner ring-1 ring-newBorder shadow-menu"
        >
          <Link
            role="menuitem"
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center h-[34px] px-[10px] rounded-[8px] text-[13px] hover:bg-boxHover"
          >
            {t('settings', 'Settings')}
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setUiLayoutCookie('v1');
              window.location.reload();
            }}
            className="flex items-center w-full h-[34px] px-[10px] rounded-[8px] text-[13px] text-start hover:bg-boxHover"
          >
            {t('switch_to_classic_layout', 'Switch to classic layout')}
          </button>
        </div>
      )}
    </div>
  );
};

export const SidebarV2: FC<{ collapsed: boolean; onToggle: () => void }> = ({
  collapsed,
  onToggle,
}) => {
  const t = useT();
  const user = useUser();
  const { isGeneral, billingEnabled } = useVariables();
  const { all } = useMenuItem();
  const { data: reviewCount } = useReviewCount();
  const visible = useVisible();

  // the classic menu hides the main items until a plan is picked
  const showMain =
    // (same check as the classic TopMenu, tier is compared as it comes in)
    !!user?.orgId &&
    ((user.tier as unknown as string) !== 'FREE' || !isGeneral || !billingEnabled);
  const items = all.filter(visible);
  const known = GROUPS.flatMap((g) => g.paths);
  const groups = GROUPS.map((g) => ({
    ...g,
    items: g.paths
      .map((p) => items.find((i) => i.path === p))
      .filter((i): i is MenuItem => !!i)
      .concat(g.key === 'workspace' ? items.filter((i) => !known.includes(i.path)) : []),
  }))
    .map((g) =>
      // settings and billing stay reachable before a plan is picked
      showMain ? g : { ...g, items: g.key === 'workspace' ? g.items : [] }
    )
    .filter((g) => g.items.length);

  return (
    <div className="flex flex-col h-full">
      <div
        className={clsx(
          'flex items-center h-[60px] shrink-0 gap-[10px]',
          collapsed ? 'justify-center px-[8px] mobile:justify-start mobile:px-[16px]' : 'px-[16px]'
        )}
      >
        <SafeImage
          src="/postdelegate-mark.svg"
          width={32}
          height={32}
          alt="PostDelegate"
          className="w-[32px] h-[32px] min-w-[32px] rounded-[9px]"
        />
        <span
          className={clsx(
            'text-[16px] font-[800] tracking-[-0.01em] flex-1',
            collapsed && 'hidden mobile:block'
          )}
        >
          PostDelegate
        </span>
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? t('expand_menu', 'Expand menu') : t('collapse_menu', 'Collapse menu')}
          aria-pressed={collapsed}
          className={clsx(
            'mobile:hidden flex items-center justify-center w-[28px] h-[28px] rounded-[7px] text-textItemBlur hover:text-newTextColor hover:bg-boxHover',
            collapsed && 'hidden'
          )}
        >
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="rtl:-scale-x-100">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <path d="M9 3v18M16 10l-2 2 2 2" />
          </svg>
        </button>
      </div>
      {collapsed && (
        <button
          type="button"
          onClick={onToggle}
          aria-label={t('expand_menu', 'Expand menu')}
          aria-pressed={collapsed}
          className="mobile:hidden mx-auto mb-[4px] flex items-center justify-center w-[28px] h-[28px] rounded-[7px] text-textItemBlur hover:text-newTextColor hover:bg-boxHover"
        >
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="rtl:-scale-x-100">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <path d="M9 3v18M14 10l2 2-2 2" />
          </svg>
        </button>
      )}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-[12px] pb-[12px] blurMe">
        {groups.map((g) => (
          <div key={g.key} role="group" aria-label={t(g.label[0], g.label[1])}>
            <div
              className={clsx(
                'px-[10px] pt-[14px] pb-[6px] text-[10.5px] font-[700] uppercase tracking-[0.09em] text-pdSection',
                collapsed && 'hidden mobile:block'
              )}
            >
              {t(g.label[0], g.label[1])}
            </div>
            {collapsed && <div className="h-px my-[10px] mx-[8px] bg-blockSeparator mobile:hidden" />}
            <div className="flex flex-col gap-[2px]">
              {g.items.map((item) => (
                <NavItemV2
                  key={item.path}
                  path={item.path}
                  label={item.name}
                  title={item.title}
                  icon={item.icon}
                  onClick={item.onClick}
                  collapsed={collapsed}
                  badge={item.path === '/review' ? reviewCount?.count : undefined}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="shrink-0 px-[12px] py-[10px] border-t border-blockSeparator">
        <UserRow collapsed={collapsed} />
      </div>
    </div>
  );
};
