'use client';

import { FC, useCallback, useMemo, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { orderBy } from 'lodash';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useIntegrationList } from '@gitroom/frontend/components/launches/helpers/use.integration.list';
import { useCreatePost } from '@gitroom/frontend/components/launches/new.post';
import {
  trialDaysLeft,
  useRenewal,
} from '@gitroom/frontend/components/billing/trial.banner';
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
  { key: 'workspace', label: ['nav_group_workspace', 'Workspace'], paths: ['/channels', '/settings', '/billing'] },
];


// same SWR keys and loaders as the command palette and the organization
// selector, so the sidebar shares their requests instead of adding new ones
const useSets = () => {
  const fetch = useFetch();
  const load = useCallback(async () => (await fetch('/sets')).json(), []);
  return useSWR('sets', load, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    revalidateOnMount: true,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
  });
};
const useOrganizations = () => {
  const fetch = useFetch();
  const load = useCallback(
    async () => await (await fetch('/user/organizations')).json(),
    []
  );
  return useSWR('organizations', load, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    refreshWhenOffline: false,
    refreshWhenHidden: false,
    revalidateOnReconnect: false,
  });
};

const ChevronsIcon = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m7 15 5 5 5-5M7 9l5-5 5 5" />
  </svg>
);

const WorkspaceCard: FC<{ collapsed: boolean; activeChannels: number }> = ({
  collapsed,
  activeChannels,
}) => {
  const t = useT();
  const user = useUser();
  const { data: organizations } = useOrganizations();
  const current = Array.isArray(organizations)
    ? organizations.find((o: any) => o.id === user?.orgId)
    : undefined;
  const name: string = current?.name || '';
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || 'PD';
  const tierName = user?.tier?.current
    ? String(user.tier.current).charAt(0) +
      String(user.tier.current).slice(1).toLowerCase()
    : '';
  return (
    <Link
      href="/settings"
      title={name}
      className={clsx(
        'flex items-center gap-[10px] rounded-[12px] bg-pdSurface border border-pdLine hover:border-pdLine2 transition-colors',
        collapsed ? 'justify-center p-[6px] mobile:justify-start mobile:px-[10px] mobile:py-[8px]' : 'px-[10px] py-[8px]'
      )}
    >
      <span className="flex items-center justify-center w-[28px] h-[28px] shrink-0 rounded-[8px] text-[12px] font-[700] text-white bg-gradient-to-br from-[#7357ff] to-[#3b2bb8]">
        {initials}
      </span>
      <span className={clsx('flex-1 min-w-0 leading-tight', collapsed && 'hidden mobile:block')}>
        <span className="block text-[13px] font-[600] truncate">{name || '\u00a0'}</span>
        <span className="block text-[11px] leading-[1.35] text-pdInk3 line-clamp-2">
          {tierName && `${tierName} ${t('plan_word', 'plan')} · `}
          {t('channels_of_total', '{{active}} of {{total}} channels', {
            active: activeChannels,
            total: user?.totalChannels ?? 0,
          })}
        </span>
      </span>
      <span className={clsx('text-pdInk3', collapsed && 'hidden mobile:block')}>
        <ChevronsIcon />
      </span>
    </Link>
  );
};

const NewPostButton: FC<{ collapsed: boolean; integrations: any[] }> = ({
  collapsed,
  integrations,
}) => {
  const t = useT();
  const { mutate } = useSWRConfig();
  const { data: sets } = useSets();
  const reloadCalendarView = useCallback(() => {
    mutate((key: string) => typeof key === 'string' && key.startsWith('/posts-'));
  }, [mutate]);
  // the same composer the calendar's Create Post button opens
  const createPost = useCreatePost({
    integrations,
    sets: sets || [],
    reloadCalendarView,
  });
  const usable = integrations.some((i: any) => !i.disabled);
  const className = clsx(
    'flex items-center justify-center gap-[8px] w-full h-[38px] rounded-[10px] bg-btnCta text-btnCtaText text-[13.5px] font-[600] hover:bg-btnCtaHover transition-colors outline-none focus-visible:ring-2 focus-visible:ring-btnPrimary',
    collapsed && 'mobile:w-full'
  );
  const icon = (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.4 2.6a2.1 2.1 0 1 1 3 3L12 15l-4 1 1-4Z" />
    </svg>
  );
  const label = (
    <span className={clsx(collapsed && 'hidden mobile:inline')}>
      {t('new_post', 'New post')}
    </span>
  );
  if (!usable) {
    return (
      <Link href="/channels" className={className} title={t('add_channel', 'Add Channel')}>
        {icon}
        {label}
      </Link>
    );
  }
  return (
    <button type="button" onClick={createPost} className={className} title={t('new_post', 'New post')}>
      {icon}
      {label}
    </button>
  );
};

const TrialCard: FC = () => {
  const t = useT();
  const { billingEnabled } = useVariables();
  const { data: renewal } = useRenewal();
  if (!billingEnabled || !renewal?.trialing || !renewal.renewsAt) {
    return null;
  }
  const days = trialDaysLeft(renewal.renewsAt);
  // a 7 day trial: the bar shows how much of it is used
  const used = Math.min(Math.max((7 - days) / 7, 0.05), 1);
  return (
    <div className="rounded-[12px] border border-[#7357ff4d] bg-[#7357ff1a] p-[12px] mb-[8px]">
      <div className="flex items-center gap-[8px] text-[12.5px] font-[600]">
        {days === 0
          ? t('trial_countdown_today', 'Your trial ends today')
          : t('trial_days_left_short', 'Trial · {{days}} days left', { days })}
      </div>
      <div className="h-[6px] rounded-full bg-black/30 mt-[8px] overflow-hidden">
        <div className="h-full rounded-full bg-[#b39aff]" style={{ width: `${used * 100}%` }} />
      </div>
      <Link href="/billing" className="block text-[11.5px] font-[600] text-[#b39aff] mt-[8px] hover:underline">
        {t('choose_a_plan', 'Choose a plan')} →
      </Link>
    </div>
  );
};

const HelpIcon = (
  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="4" />
    <path d="m4.93 4.93 4.24 4.24M14.83 9.17l4.24-4.24M14.83 14.83l4.24 4.24M9.17 14.83l-4.24 4.24" />
  </svg>
);
const ChannelsIcon = (
  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.9 16.1C1 12.2 1 5.8 4.9 1.9M7.8 4.7a6.14 6.14 0 0 0-.8 7.5M16.2 4.8c2 2 2.26 5.11.8 7.47M19.1 1.9a9.96 9.96 0 0 1 0 14.1" />
    <circle cx="12" cy="9" r="2" />
    <path d="m8.5 22 3.5-11 3.5 11M9.5 18h5" />
  </svg>
);

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
  const { data: integrationList } = useIntegrationList();
  const integrations = useMemo(
    () =>
      orderBy(
        integrationList || [],
        ['type', 'disabled', 'identifier'],
        ['desc', 'asc', 'asc']
      ),
    [integrationList]
  );
  const activeChannels = integrations.filter((i: any) => !i.disabled).length;
  // Channels is a v2 page; it sits with the workspace items
  const channelsItem: MenuItem = {
    name: t('channels', 'Channels'),
    icon: ChannelsIcon,
    path: '/channels',
  };
  const items = [...all.filter(visible), channelsItem];
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
      <div className={clsx('flex flex-col gap-[10px] pb-[6px]', collapsed ? 'px-[12px] mobile:px-[12px]' : 'px-[12px]')}>
        <WorkspaceCard collapsed={collapsed} activeChannels={activeChannels} />
        {showMain && <NewPostButton collapsed={collapsed} integrations={integrations} />}
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
                  count={item.path === '/channels' ? integrations.length : undefined}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="shrink-0 px-[12px] pb-[4px]">
        {!collapsed && <TrialCard />}
        <NavItemV2
          path="mailto:support@postdelegate.com"
          label={t('help_and_support', 'Help & support')}
          icon={HelpIcon}
          collapsed={collapsed}
        />
      </div>
      <div className="shrink-0 px-[12px] py-[10px] border-t border-blockSeparator">
        <UserRow collapsed={collapsed} />
      </div>
    </div>
  );
};
