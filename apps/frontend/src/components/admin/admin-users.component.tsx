'use client';

import React, {
  FC,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import useSWR from 'swr';
import clsx from 'clsx';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { Button } from '@gitroom/react/form/button';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import { newDayjs } from '@gitroom/frontend/components/layout/set.timezone';

export type PlanState =
  | 'trialing'
  | 'paying'
  | 'cancelling'
  | 'lifetime'
  | 'comped'
  | 'unpaid'
  | 'no_plan'
  | 'ended';

export interface AdminPlan {
  state: PlanState;
  tier: string | null;
  period: string | null;
  status: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAt: string | null;
}

export interface AdminWorkspace {
  userOrganizationId: string;
  organizationId: string;
  name: string;
  role: string;
  disabled: boolean;
  deletedAt: string | null;
  plan: AdminPlan;
  channels: { active: number; needsAttention: number; disabled: number };
  posts: {
    scheduled: number;
    published: number;
    failed: number;
    failedLast7d: number;
  };
}

export interface AdminUserSummary {
  id: string;
  name: string | null;
  email: string;
  providerName: string;
  activated: boolean;
  createdAt: string;
  lastActive: string | null;
  isSuperAdmin: boolean;
  deletedAt: string | null;
  workspaces: AdminWorkspace[];
}

interface UsersResponse {
  items: AdminUserSummary[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

interface UsersSummary {
  total: number;
  trialing: number;
  paying: number;
  cancelling: number;
  noPlan: number;
  needsAttention: number;
}

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'trialing', label: 'On trial' },
  { value: 'paying', label: 'Paying' },
  { value: 'cancelling', label: 'Cancelling' },
  { value: 'no_plan', label: 'No plan' },
  { value: 'needs_attention', label: 'Needs attention' },
];

const PAGE_SIZE = 25;

const SIGN_IN_METHODS: Record<string, string> = {
  LOCAL: 'Email',
  GOOGLE: 'Google',
  GITHUB: 'GitHub',
  APPLE: 'Apple',
  FARCASTER: 'Farcaster',
  WALLET: 'Wallet',
  GENERIC: 'Single sign-on',
};

export const signInMethodOf = (provider: string) =>
  SIGN_IN_METHODS[provider] || provider;

const capitalize = (value: string) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : '';

export const shortDate = (date: string) => newDayjs(date).format('D MMM YYYY');
export const fullDate = (date: string) =>
  newDayjs(date).format('D MMM YYYY, HH:mm');
export const relativeDate = (date: string) => newDayjs(date).fromNow();

// "in 3 days", "today", "tomorrow"
const daysUntil = (date: string) => {
  const days = Math.ceil(newDayjs(date).diff(newDayjs(), 'hour') / 24);
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
};

export const tierLabelOf = (plan: AdminPlan) =>
  [plan.tier && capitalize(plan.tier), plan.period && plan.period.toLowerCase()]
    .filter(Boolean)
    .join(' ');

// The plan of a workspace in a few words
export const planLabelOf = (plan: AdminPlan) => {
  switch (plan.state) {
    case 'trialing':
      return plan.trialEndsAt
        ? `Trial · ends ${daysUntil(plan.trialEndsAt)}`
        : 'Trial';
    case 'paying':
      return ['Paying', tierLabelOf(plan)].filter(Boolean).join(' · ');
    case 'cancelling':
      return plan.cancelAt
        ? `Cancels ${newDayjs(plan.cancelAt).format('D MMM')}`
        : 'Cancelling';
    case 'lifetime':
      return ['Lifetime', plan.tier && capitalize(plan.tier)]
        .filter(Boolean)
        .join(' · ');
    case 'comped':
      return ['Free', plan.tier && capitalize(plan.tier), 'set by admin']
        .filter(Boolean)
        .join(' · ');
    case 'unpaid':
      return 'Not paid';
    case 'ended':
      return 'Plan ended';
    default:
      return 'No plan';
  }
};

const PLAN_COLORS: Record<PlanState, string> = {
  trialing: 'bg-blue-500/15 text-blue-500',
  paying: 'bg-green-500/15 text-green-500',
  cancelling: 'bg-orange-500/15 text-orange-500',
  lifetime: 'bg-purple-500/15 text-purple-500',
  comped: 'bg-purple-500/15 text-purple-500',
  unpaid: 'bg-red-500/15 text-red-500',
  no_plan: 'bg-newBgLineColor text-textItemBlur',
  ended: 'bg-newBgLineColor text-textItemBlur',
};

// a provider status that means the last charge did not go through
export const PAYMENT_PROBLEMS = ['past_due', 'unpaid', 'incomplete'];

export const Pill: FC<{ className?: string; children: ReactNode }> = ({
  className,
  children,
}) => (
  <span
    className={clsx(
      'inline-flex items-center rounded-full px-[8px] py-[2px] text-[12px] font-[500]',
      className
    )}
  >
    {children}
  </span>
);

export const PlanPill: FC<{ plan: AdminPlan }> = ({ plan }) => (
  <span className="inline-flex flex-wrap gap-[4px]">
    <Pill className={PLAN_COLORS[plan.state]}>{planLabelOf(plan)}</Pill>
    {!!plan.status && PAYMENT_PROBLEMS.includes(plan.status) && (
      <Pill className="bg-red-500/15 text-red-500">Payment failing</Pill>
    )}
  </span>
);

export const Tag: FC<{ className?: string; children: ReactNode }> = ({
  className,
  children,
}) => (
  <span
    className={clsx(
      'inline-flex items-center rounded-[4px] border border-newTableBorder px-[6px] text-[11px] leading-[18px] whitespace-nowrap',
      className
    )}
  >
    {children}
  </span>
);

export const UserTags: FC<{ user: AdminUserSummary }> = ({ user }) => (
  <span className="inline-flex flex-wrap gap-[4px]">
    {!!user.deletedAt && (
      <Tag className="text-red-500 border-red-500/40">Deleted</Tag>
    )}
    {!user.activated && (
      <Tag className="text-orange-500 border-orange-500/40">Not verified</Tag>
    )}
    {user.isSuperAdmin && (
      <Tag className="text-purple-500 border-purple-500/40">Admin</Tag>
    )}
    <Tag className="text-textItemBlur">{signInMethodOf(user.providerName)}</Tag>
  </span>
);

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? '' : 's'}`;

export const ChannelsLine: FC<{ channels: AdminWorkspace['channels'] }> = ({
  channels,
}) => (
  <span className="flex flex-col">
    <span className={clsx(!channels.active && 'text-textItemBlur')}>
      {channels.active ? `${channels.active} connected` : 'None connected'}
    </span>
    {!!channels.needsAttention && (
      <span className="text-red-500 text-[12px]">
        {channels.needsAttention} {channels.needsAttention === 1 ? 'needs' : 'need'}{' '}
        reconnect
      </span>
    )}
    {!!channels.disabled && (
      <span className="text-textItemBlur text-[12px]">
        {channels.disabled} turned off
      </span>
    )}
  </span>
);

export const PostsLine: FC<{ posts: AdminWorkspace['posts'] }> = ({
  posts,
}) => (
  <span className="flex flex-col">
    <span
      className={clsx(
        !posts.scheduled && !posts.published && 'text-textItemBlur'
      )}
    >
      {!posts.scheduled && !posts.published
        ? 'No posts yet'
        : `${posts.scheduled} scheduled · ${posts.published} published`}
    </span>
    {!!posts.failed && (
      <span className="text-red-500 text-[12px]">
        {posts.failed} failed
        {posts.failedLast7d ? ` (${posts.failedLast7d} this week)` : ''}
      </span>
    )}
  </span>
);

const SummaryCard: FC<{
  label: string;
  value?: number;
  active: boolean;
  onClick: () => void;
}> = ({ label, value, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={clsx(
      'text-start border rounded-[8px] p-[16px] bg-newBgColorInner outline-none focus-visible:ring-2 focus-visible:ring-btnPrimary',
      active ? 'border-btnPrimary' : 'border-newTableBorder hover:bg-boxHover'
    )}
  >
    <div className="text-[12px] opacity-70">{label}</div>
    <div className="text-[28px] font-[600]">
      {value === undefined ? '—' : value.toLocaleString()}
    </div>
  </button>
);

const useAdminUsersSummary = () => {
  const fetch = useFetch();
  return useSWR<UsersSummary>('/admin/users/summary', async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error('Failed to load the summary');
    }
    return res.json();
  });
};

const useAdminUsersList = (params: {
  search: string;
  filter: string;
  page: number;
}) => {
  const fetch = useFetch();
  const query = new URLSearchParams({
    page: String(params.page),
    limit: String(PAGE_SIZE),
    filter: params.filter,
    ...(params.search ? { search: params.search } : {}),
  });
  return useSWR<UsersResponse>(
    `/admin/users?${query.toString()}`,
    async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('Failed to load users');
      }
      return res.json();
    },
    { keepPreviousData: true }
  );
};

const GRID =
  'grid grid-cols-[minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.2fr)] gap-[12px]';

const Column: FC<{ label: string; children: ReactNode }> = ({
  label,
  children,
}) => (
  <div className="min-w-0 mobile:flex mobile:gap-[8px] mobile:items-start">
    <div className="hidden mobile:block text-[12px] opacity-60 w-[90px] shrink-0">
      {label}
    </div>
    <div className="min-w-0">{children}</div>
  </div>
);

const UserRow: FC<{ user: AdminUserSummary; listQuery: string }> = ({
  user,
  listQuery,
}) => {
  const [workspace] = user.workspaces;
  const more = user.workspaces.length - 1;
  const href = `/admin/users/${user.id}${
    listQuery ? `?list=${encodeURIComponent(listQuery)}` : ''
  }`;

  return (
    <Link
      href={href}
      className={clsx(
        GRID,
        'px-[12px] py-[12px] text-[13px] border-b border-newTableBorder last:border-b-0 items-start hover:bg-boxHover transition-colors',
        'mobile:flex mobile:flex-col mobile:gap-[6px]',
        !!user.deletedAt && 'opacity-60'
      )}
    >
      <div className="min-w-0 flex flex-col gap-[4px]">
        <div className="font-[600] truncate">{user.name || user.email}</div>
        {!!user.name && (
          <div className="text-textItemBlur truncate">{user.email}</div>
        )}
        <UserTags user={user} />
      </div>
      <Column label="Signed up">
        <span title={fullDate(user.createdAt)}>
          {relativeDate(user.createdAt)}
        </span>
      </Column>
      <Column label="Last active">
        {user.lastActive ? (
          <span title={fullDate(user.lastActive)}>
            {relativeDate(user.lastActive)}
          </span>
        ) : (
          <span className="text-textItemBlur">Not seen yet</span>
        )}
      </Column>
      <Column label="Plan">
        {workspace ? (
          <span className="flex flex-col gap-[4px] items-start">
            <PlanPill plan={workspace.plan} />
            <span className="text-[12px] text-textItemBlur truncate max-w-full">
              {workspace.name}
              {!!workspace.deletedAt && ' (deleted)'}
              {more > 0 && ` · +${plural(more, 'workspace')}`}
            </span>
          </span>
        ) : (
          <span className="text-textItemBlur">No workspace</span>
        )}
      </Column>
      <Column label="Channels">
        {workspace ? <ChannelsLine channels={workspace.channels} /> : '—'}
      </Column>
      <Column label="Posts">
        {workspace ? <PostsLine posts={workspace.posts} /> : '—'}
      </Column>
    </Link>
  );
};

export const AdminUsersComponent: FC = () => {
  const user = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const search = searchParams.get('search') || '';
  const filterParam = searchParams.get('filter') || 'all';
  const filter = FILTERS.some((item) => item.value === filterParam)
    ? filterParam
    : 'all';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);

  const [searchInput, setSearchInput] = useState(search);
  // the search the box last wrote to the address
  const written = useRef(search);

  // the address changed on its own (a tab, back): the box follows it
  useEffect(() => {
    if (search === written.current) {
      return;
    }
    written.current = search;
    setSearchInput(search);
  }, [search]);

  // search, filter and page live in the address, so a link shows the same list
  const setQuery = useCallback(
    (next: { search?: string; filter?: string; page?: number }) => {
      const params = new URLSearchParams();
      const values = { search, filter, page, ...next };
      if (values.search) params.set('search', values.search);
      if (values.filter && values.filter !== 'all')
        params.set('filter', values.filter);
      if (values.page > 1) params.set('page', String(values.page));
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    },
    [search, filter, page, pathname, router]
  );

  useEffect(() => {
    const value = searchInput.trim();
    if (value === search) {
      return;
    }
    const timer = setTimeout(() => {
      written.current = value;
      setQuery({ search: value, page: 1 });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, search, setQuery]);

  const { data: summary } = useAdminUsersSummary();
  const { data, isLoading, error } = useAdminUsersList({
    search,
    filter,
    page,
  });

  if (!user?.isSuperAdmin) {
    return (
      <div className="text-textColor p-[20px]">
        You do not have access to this page.
      </div>
    );
  }

  const listQuery = searchParams.toString();
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="flex flex-col gap-[16px] text-textColor">
      <div className="flex items-center justify-between gap-[12px]">
        <div className="text-[20px] font-[600]">Users</div>
        <div className="text-[13px] opacity-70">
          {data ? plural(data.total, 'user') : ''}
        </div>
      </div>

      <div className="grid grid-cols-4 mobile:grid-cols-2 gap-[12px]">
        <SummaryCard
          label="All users"
          value={summary?.total}
          active={filter === 'all'}
          onClick={() => setQuery({ filter: 'all', page: 1 })}
        />
        <SummaryCard
          label="On trial"
          value={summary?.trialing}
          active={filter === 'trialing'}
          onClick={() => setQuery({ filter: 'trialing', page: 1 })}
        />
        <SummaryCard
          label="Paying"
          value={summary?.paying}
          active={filter === 'paying'}
          onClick={() => setQuery({ filter: 'paying', page: 1 })}
        />
        <SummaryCard
          label="Needs attention"
          value={summary?.needsAttention}
          active={filter === 'needs_attention'}
          onClick={() => setQuery({ filter: 'needs_attention', page: 1 })}
        />
      </div>

      <div className="flex flex-col gap-[12px] bg-newBgColorInner border border-newTableBorder rounded-[8px] p-[12px]">
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search name, email, workspace, Stripe or record id"
          aria-label="Search users"
          className="bg-newBgColorInner h-[38px] border border-newTableBorder rounded-[8px] px-[10px] text-[14px] text-textColor w-full"
        />
        <div className="flex flex-wrap gap-[8px]">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setQuery({ filter: item.value, page: 1 })}
              aria-pressed={filter === item.value}
              className={clsx(
                'h-[30px] px-[12px] rounded-full border text-[13px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-btnPrimary',
                filter === item.value
                  ? 'bg-btnPrimary border-btnPrimary text-white'
                  : 'border-newTableBorder hover:bg-boxHover'
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <LoadingComponent />
      ) : error ? (
        <div className="text-red-400">Failed to load users.</div>
      ) : !data || data.items.length === 0 ? (
        <div className="flex flex-col items-center gap-[12px] py-[48px] border border-newTableBorder rounded-[8px] text-center">
          <div className="text-[15px] font-[600]">No users found</div>
          <div className="text-[13px] opacity-70">
            {page > 1
              ? 'This page is past the end of the list.'
              : search || filter !== 'all'
              ? 'Nobody matches this search or filter.'
              : 'Nobody has signed up yet.'}
          </div>
          {page > 1 ? (
            <Button secondary onClick={() => setQuery({ page: 1 })}>
              Go to the first page
            </Button>
          ) : (search || filter !== 'all') && (
            <Button
              secondary
              onClick={() => {
                setSearchInput('');
                setQuery({ search: '', filter: 'all', page: 1 });
              }}
            >
              Clear search and filter
            </Button>
          )}
        </div>
      ) : (
        <div className="border border-newTableBorder rounded-[8px] overflow-hidden">
          <div
            className={clsx(
              GRID,
              'px-[12px] py-[10px] bg-newBgColorInner text-[12px] uppercase opacity-70 border-b border-newTableBorder mobile:hidden'
            )}
          >
            <div>User</div>
            <div>Signed up</div>
            <div>Last active</div>
            <div>Plan</div>
            <div>Channels</div>
            <div>Posts</div>
          </div>
          {data.items.map((row) => (
            <UserRow key={row.id} user={row} listQuery={listQuery} />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-[13px] opacity-70">
          Page {page} of {totalPages}
        </div>
        <div className="flex gap-[8px]">
          <Button
            secondary
            disabled={page <= 1}
            onClick={() => setQuery({ page: Math.max(1, page - 1) })}
          >
            Previous
          </Button>
          <Button
            disabled={!data?.hasMore}
            onClick={() => setQuery({ page: page + 1 })}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
};
