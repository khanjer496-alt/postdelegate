'use client';

import React, { FC, useState } from 'react';
import clsx from 'clsx';
import useSWR from 'swr';
import { useDebounce } from 'use-debounce';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { Button } from '@gitroom/react/form/button';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import { fromUtc } from '@gitroom/frontend/components/layout/set.timezone';
import { useViewAs } from '@gitroom/frontend/components/layout/impersonate';

type PlanState =
  | 'trial'
  | 'paying'
  | 'comped'
  | 'lifetime'
  | 'expired'
  | 'none';

interface UserPlan {
  state: PlanState;
  tier: string | null;
  period: string | null;
  status: string | null;
  trialDaysLeft: number | null;
  cancelAt: string | null;
}

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  signInMethod: string;
  activated: boolean;
  isSuperAdmin: boolean;
  createdAt: string;
  lastActiveAt: string;
  workspace: {
    membershipId: string;
    id: string;
    name: string;
    role: string;
    plan: UserPlan;
    channels: number;
    postsScheduled: number;
    postsPublished: number;
  } | null;
  otherWorkspaces: number;
}

interface UsersResponse {
  items: UserRow[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

const useAdminUsers = (page: number, q: string) => {
  const fetch = useFetch();
  const query = new URLSearchParams({
    page: String(page),
    ...(q ? { q } : {}),
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
    { keepPreviousData: true, revalidateOnFocus: false }
  );
};

const signInLabel: Record<string, string> = {
  LOCAL: 'Email',
  GOOGLE: 'Google',
  GITHUB: 'GitHub',
  APPLE: 'Apple',
  FARCASTER: 'Farcaster',
  WALLET: 'Wallet',
  GENERIC: 'SSO',
};

const planBadge: Record<PlanState, string> = {
  trial: 'border-blue-600 text-blue-500',
  paying: 'border-green-600 text-green-500',
  comped: 'border-teal-600 text-teal-500',
  lifetime: 'border-purple-600 text-purple-400',
  expired: 'border-red-600 text-red-400',
  none: 'border-newTableBorder text-textItemBlur',
};

const tierOf = (plan: UserPlan) =>
  [plan.tier, plan.period?.toLowerCase()].filter(Boolean).join(' · ');

const planText = (plan: UserPlan) => {
  switch (plan.state) {
    case 'trial':
      return plan.trialDaysLeft === null
        ? `Trial · ${tierOf(plan)}`
        : plan.trialDaysLeft === 0
        ? 'Trial · ends today'
        : `Trial · ${plan.trialDaysLeft} ${
            plan.trialDaysLeft === 1 ? 'day' : 'days'
          } left`;
    case 'paying':
      return `${tierOf(plan)}${
        plan.status && plan.status !== 'active' ? ` · ${plan.status}` : ''
      }`;
    case 'comped':
      return `${tierOf(plan)} · given by admin`;
    case 'lifetime':
      return `Lifetime · ${plan.tier}`;
    case 'expired':
      return 'Expired';
    default:
      return 'No plan';
  }
};

const PlanBadge: FC<{ plan: UserPlan }> = ({ plan }) => (
  <span
    className={clsx(
      'inline-flex px-[8px] rounded-[4px] text-[12px] border whitespace-nowrap',
      planBadge[plan.state]
    )}
    title={
      plan.cancelAt
        ? `Cancels ${fromUtc(plan.cancelAt).format('D MMM YYYY')}`
        : undefined
    }
  >
    {planText(plan)}
    {plan.cancelAt ? ' · cancels' : ''}
  </span>
);

const SuperAdminBadge = () => (
  <span className="px-[6px] rounded-[4px] text-[11px] font-[600] bg-forth text-white whitespace-nowrap">
    Super admin
  </span>
);

const ViewAsButton: FC<{ row: UserRow; self: boolean }> = ({ row, self }) => {
  const viewAs = useViewAs();
  const [loading, setLoading] = useState(false);
  if (!row.workspace || self) {
    return null;
  }
  return (
    <Button
      secondary={true}
      loading={loading}
      title={`Open PostDelegate as ${row.email} in ${row.workspace.name}`}
      onClick={async () => {
        setLoading(true);
        if (!(await viewAs(row.workspace!.membershipId, true))) {
          setLoading(false);
        }
      }}
      className="rounded-[8px] h-[34px] px-[12px] text-[13px] whitespace-nowrap"
    >
      View as
    </Button>
  );
};

const GRID =
  'grid grid-cols-[minmax(220px,1.6fr)_110px_80px_minmax(150px,1fr)_minmax(150px,1fr)_80px_110px_110px_100px] gap-[12px]';

// Every user, newest first. On phones each row is a card
export const AdminUsersComponent: FC = () => {
  const user = useUser();
  const [page, setPage] = useState(0);
  const [input, setInput] = useState('');
  const [q] = useDebounce(input.trim(), 400);
  const { data, isLoading, error } = useAdminUsers(page, q);

  if (!user?.isSuperAdmin) {
    return (
      <div className="text-textColor p-[20px]">
        You do not have access to this page.
      </div>
    );
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="flex flex-col gap-[16px] text-textColor">
      <div className="flex items-center justify-between gap-[12px]">
        <div className="text-[20px] font-[600]">Users</div>
        <div className="text-[13px] opacity-70">
          {data ? `${data.total} ${q ? 'found' : 'total'}` : ''}
        </div>
      </div>

      <div className="flex flex-col gap-[6px] bg-newBgColorInner border border-newTableBorder rounded-[8px] p-[12px]">
        <label htmlFor="admin-users-filter" className="text-[12px] opacity-70">
          Email or workspace name
        </label>
        <input
          id="admin-users-filter"
          type="search"
          autoComplete="off"
          value={input}
          onChange={(e) => {
            setPage(0);
            setInput(e.target.value);
          }}
          placeholder="name@example.com or Acme"
          className="bg-newBgColorInner h-[38px] border border-newTableBorder rounded-[8px] px-[10px] text-[14px] mobile:text-[16px] text-textColor w-full max-w-[420px] outline-none focus-visible:ring-2 focus-visible:ring-btnPrimary"
        />
      </div>

      {isLoading && !data ? (
        <LoadingComponent />
      ) : error ? (
        <div className="text-red-400">Failed to load users.</div>
      ) : !data || data.items.length === 0 ? (
        <div className="opacity-70">No users found.</div>
      ) : (
        <>
          {/* desktop: a table */}
          <div className="mobile:hidden border border-newTableBorder rounded-[8px] overflow-x-auto">
            <div className="min-w-[1180px]">
              <div
                className={clsx(
                  GRID,
                  'px-[12px] py-[10px] bg-newBgColorInner text-[12px] uppercase opacity-70 border-b border-newTableBorder'
                )}
              >
                <div>User</div>
                <div>Signed up</div>
                <div>Sign-in</div>
                <div>Workspace</div>
                <div>Plan</div>
                <div>Channels</div>
                <div title="Scheduled / published top-level posts">
                  Posts sch / pub
                </div>
                <div title="Newest of: the user record changing (opening notifications, settings, password or email) and a post created in the workspace">
                  Last active
                </div>
                <div />
              </div>
              {data.items.map((row) => (
                <div
                  key={row.id}
                  className={clsx(
                    GRID,
                    'px-[12px] py-[10px] text-[13px] border-b border-newTableBorder last:border-b-0 items-center'
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-[6px] min-w-0">
                      <span className="truncate" title={row.email}>
                        {row.email}
                      </span>
                      {row.isSuperAdmin && <SuperAdminBadge />}
                    </div>
                    {(!!row.name || !row.activated) && (
                      <div className="text-[12px] text-textItemBlur truncate">
                        {row.name}
                        {!row.activated && (
                          <span className="text-amber-500">
                            {row.name ? ' · ' : ''}email not confirmed
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div
                    title={fromUtc(row.createdAt).format('D MMM YYYY HH:mm')}
                  >
                    {fromUtc(row.createdAt).format('D MMM YYYY')}
                  </div>
                  <div>{signInLabel[row.signInMethod] || row.signInMethod}</div>
                  <div className="min-w-0">
                    {row.workspace ? (
                      <>
                        <div className="truncate" title={row.workspace.name}>
                          {row.workspace.name}
                        </div>
                        {row.otherWorkspaces > 0 && (
                          <div className="text-[12px] text-textItemBlur">
                            +{row.otherWorkspaces} more
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-textItemBlur">No workspace</span>
                    )}
                  </div>
                  <div>
                    {row.workspace && <PlanBadge plan={row.workspace.plan} />}
                  </div>
                  <div>{row.workspace?.channels ?? '—'}</div>
                  <div>
                    {row.workspace
                      ? `${row.workspace.postsScheduled} / ${row.workspace.postsPublished}`
                      : '—'}
                  </div>
                  <div
                    title={fromUtc(row.lastActiveAt).format('D MMM YYYY HH:mm')}
                  >
                    {fromUtc(row.lastActiveAt).fromNow()}
                  </div>
                  <div className="flex justify-end">
                    <ViewAsButton row={row} self={row.id === user.id} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* phones: a card per user */}
          <div className="hidden mobile:flex flex-col gap-[8px]">
            {data.items.map((row) => (
              <div
                key={row.id}
                className="flex flex-col gap-[8px] p-[12px] text-[13px] bg-newBgColorInner border border-newTableBorder rounded-[8px]"
              >
                <div className="flex items-start justify-between gap-[8px]">
                  <div className="min-w-0">
                    <div className="font-[600] break-all">{row.email}</div>
                    <div className="text-[12px] text-textItemBlur">
                      {signInLabel[row.signInMethod] || row.signInMethod}
                      {' · signed up '}
                      {fromUtc(row.createdAt).format('D MMM YYYY')}
                      {!row.activated && (
                        <span className="text-amber-500"> · not confirmed</span>
                      )}
                    </div>
                  </div>
                  {row.isSuperAdmin && <SuperAdminBadge />}
                </div>
                {row.workspace ? (
                  <>
                    <div className="flex flex-wrap items-center gap-[8px]">
                      <span className="font-[600] break-all">
                        {row.workspace.name}
                      </span>
                      {row.otherWorkspaces > 0 && (
                        <span className="text-[12px] text-textItemBlur">
                          +{row.otherWorkspaces} more
                        </span>
                      )}
                      <PlanBadge plan={row.workspace.plan} />
                    </div>
                    <div className="grid grid-cols-3 gap-[8px] text-[12px]">
                      <div>
                        <div className="text-textItemBlur">Channels</div>
                        <div className="text-[14px]">
                          {row.workspace.channels}
                        </div>
                      </div>
                      <div>
                        <div className="text-textItemBlur">Posts sch / pub</div>
                        <div className="text-[14px]">
                          {row.workspace.postsScheduled} /{' '}
                          {row.workspace.postsPublished}
                        </div>
                      </div>
                      <div>
                        <div className="text-textItemBlur">Last active</div>
                        <div className="text-[14px]">
                          {fromUtc(row.lastActiveAt).fromNow()}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-textItemBlur">No workspace</div>
                )}
                <div className="flex justify-end">
                  <ViewAsButton row={row} self={row.id === user.id} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {!!data && data.total > data.limit && (
        <div className="flex items-center justify-between gap-[12px]">
          <div className="text-[13px] opacity-70">
            Page {page + 1} of {totalPages}
          </div>
          <div className="flex gap-[8px]">
            <Button
              secondary
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="rounded-[8px] h-[36px] px-[16px]"
            >
              Previous
            </Button>
            <Button
              secondary
              disabled={!data.hasMore}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-[8px] h-[36px] px-[16px]"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
