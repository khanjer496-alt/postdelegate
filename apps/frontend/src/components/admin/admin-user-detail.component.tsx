'use client';

import React, { FC, ReactNode, useCallback, useState } from 'react';
import useSWR from 'swr';
import clsx from 'clsx';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { Button } from '@gitroom/react/form/button';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import ImageWithFallback from '@gitroom/react/helpers/image.with.fallback';
import {
  AdminPlan,
  AdminUserSummary,
  AdminWorkspace,
  ChannelsLine,
  fullDate,
  PAYMENT_PROBLEMS,
  Pill,
  PlanPill,
  PostsLine,
  relativeDate,
  shortDate,
  Tag,
  tierLabelOf,
  UserTags,
} from '@gitroom/frontend/components/admin/admin-users.component';

interface Channel {
  id: string;
  name: string;
  providerIdentifier: string;
  picture: string | null;
  status: 'connected' | 'needs_reconnect' | 'setup_unfinished' | 'disabled';
  tokenExpiration: string | null;
  createdAt: string;
  lastPublishedAt: string | null;
  lastPublishedUrl: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
}

interface RecentPost {
  id: string;
  state: 'QUEUE' | 'PUBLISHED' | 'ERROR' | 'DRAFT';
  publishDate: string;
  createdAt: string;
  preview: string;
  error: string | null;
  url: string | null;
  channel: { name: string; providerIdentifier: string; picture: string | null };
}

interface RecentError {
  id: string;
  message: string;
  platform: string;
  createdAt: string;
  postId: string;
}

interface TeamMember {
  userId: string;
  name: string | null;
  email: string;
  role: string;
  disabled: boolean;
  deletedAt: string | null;
  joinedAt: string;
}

interface JourneyEvent {
  kind: string;
  occurredAt: string;
  source: string;
  medium: string;
  campaign: string;
  internalOrTest: boolean;
}

interface WorkspaceDetail extends AdminWorkspace {
  createdAt: string | null;
  stripeCustomerId: string | null;
  subscription:
    | (AdminPlan & {
        provider: string;
        totalChannels: number;
        createdAt: string;
      })
    | null;
  channelList: Channel[];
  recentPosts: RecentPost[];
  recentErrors: RecentError[];
  team: TeamMember[];
  journey: JourneyEvent[];
}

interface UserDetail extends Omit<AdminUserSummary, 'workspaces'> {
  workspaces: WorkspaceDetail[];
}

const useAdminUser = (id: string) => {
  const fetch = useFetch();
  return useSWR<UserDetail | null>(
    id ? `/admin/users/${id}` : null,
    async (url: string) => {
      const res = await fetch(url);
      if (res.status === 404) {
        return null;
      }
      if (!res.ok) {
        throw new Error('Failed to load the user');
      }
      return res.json();
    }
  );
};

const PLAN_WORDS: Record<string, string> = {
  trialing: 'On a free trial',
  paying: 'Paying customer',
  cancelling: 'Cancelling, the plan stops on its end date',
  lifetime: 'Lifetime deal, no renewals',
  comped: 'Free plan an admin set, nobody pays for it',
  unpaid: 'Has a subscription but it is not paid',
  no_plan: 'No plan yet',
  ended: 'Had a plan, it has ended',
};

const PAYMENT_WORDS: Record<string, string> = {
  active: 'Paid up',
  trialing: 'In the trial, no charge yet',
  past_due: 'Last payment failed, being retried',
  unpaid: 'Unpaid',
  incomplete: 'First payment not finished',
  incomplete_expired: 'First payment never finished',
  paused: 'Paused',
  canceled: 'Cancelled',
};

const CHANNEL_STATUS: Record<Channel['status'], { label: string; className: string }> = {
  connected: { label: 'Connected', className: 'bg-green-500/15 text-green-500' },
  needs_reconnect: {
    label: 'Needs reconnect',
    className: 'bg-red-500/15 text-red-500',
  },
  setup_unfinished: {
    label: 'Setup not finished',
    className: 'bg-orange-500/15 text-orange-500',
  },
  disabled: {
    label: 'Turned off',
    className: 'bg-newBgLineColor text-textItemBlur',
  },
};

const POST_STATE: Record<RecentPost['state'], { label: string; className: string }> = {
  QUEUE: { label: 'Scheduled', className: 'bg-blue-500/15 text-blue-500' },
  PUBLISHED: { label: 'Published', className: 'bg-green-500/15 text-green-500' },
  ERROR: { label: 'Failed', className: 'bg-red-500/15 text-red-500' },
  DRAFT: { label: 'Draft', className: 'bg-newBgLineColor text-textItemBlur' },
};

const ROLES: Record<string, string> = {
  SUPERADMIN: 'Owner',
  ADMIN: 'Admin',
  USER: 'Member',
};

// The milestones of the measurement, in plain words. A kind added later
// shows as its name made readable
const JOURNEY_WORDS: Record<string, string> = {
  signup_request: 'Started signing up',
  acquisition: 'Visit recorded',
  registration: 'Signed up',
  trial_eligible: 'Could start a trial',
  trial_started: 'Started trial',
  channel_connected: 'Connected first channel',
  first_draft: 'Wrote first draft',
  qualifying_schedule: 'Scheduled first post',
  publication: 'Published a post',
  entitlement_applied: 'Plan turned on',
  nonzero_payment: 'Payment received',
};

const journeyLabelOf = (kind: string, firstPayment: boolean) => {
  if (kind === 'nonzero_payment' && firstPayment) {
    return 'First payment';
  }
  if (JOURNEY_WORDS[kind]) {
    return JOURNEY_WORDS[kind];
  }
  const words = kind.replace(/[_-]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const known = (value: string) => !!value && value !== 'unknown';

// The readable part of a stored error (often a serialized error object)
const errorTextOf = (message: string) => {
  try {
    const parsed = JSON.parse(message);
    if (typeof parsed === 'string') return parsed;
    if (typeof parsed?.message === 'string') return parsed.message;
    if (typeof parsed?.error === 'string') return parsed.error;
  } catch {
    // not JSON, shown as stored
  }
  return message;
};

const Section: FC<{ title: string; count?: number; children: ReactNode }> = ({
  title,
  count,
  children,
}) => (
  <div className="flex flex-col gap-[8px]">
    <div className="text-[14px] font-[600]">
      {title}
      {count !== undefined && (
        <span className="ms-[6px] opacity-60 font-[400]">{count}</span>
      )}
    </div>
    {children}
  </div>
);

const Empty: FC<{ children: ReactNode }> = ({ children }) => (
  <div className="text-[13px] text-textItemBlur border border-dashed border-newTableBorder rounded-[8px] px-[12px] py-[10px]">
    {children}
  </div>
);

const List: FC<{ children: ReactNode }> = ({ children }) => (
  <div className="border border-newTableBorder rounded-[8px] overflow-hidden">
    {children}
  </div>
);

const ListRow: FC<{ children: ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <div
    className={clsx(
      'px-[12px] py-[10px] text-[13px] border-b border-newTableBorder last:border-b-0',
      className
    )}
  >
    {children}
  </div>
);

const Detail: FC<{ label: string; children: ReactNode }> = ({
  label,
  children,
}) => (
  <div className="flex flex-col">
    <div className="text-[12px] opacity-60">{label}</div>
    <div className="text-[13px] break-words">{children}</div>
  </div>
);

const DateWithAgo: FC<{ date: string }> = ({ date }) => (
  <span title={fullDate(date)}>
    {shortDate(date)}{' '}
    <span className="text-textItemBlur">({relativeDate(date)})</span>
  </span>
);

const PlanCard: FC<{ workspace: WorkspaceDetail }> = ({ workspace }) => {
  const plan = workspace.subscription || workspace.plan;
  return (
    <div className="border border-newTableBorder rounded-[8px] p-[16px] bg-newBgColorInner flex flex-col gap-[12px]">
      <div className="flex flex-wrap items-center gap-[8px]">
        <div className="text-[16px] font-[600]">
          {PLAN_WORDS[plan.state] || plan.state}
        </div>
        <PlanPill plan={plan} />
      </div>
      <div className="grid grid-cols-3 mobile:grid-cols-1 gap-[12px]">
        {!!tierLabelOf(plan) && (
          <Detail label="Plan">{tierLabelOf(plan)}</Detail>
        )}
        {!!plan.trialEndsAt && (
          <Detail label="Trial ends">
            <DateWithAgo date={plan.trialEndsAt} />
          </Detail>
        )}
        {!!plan.currentPeriodEnd && !plan.cancelAt && plan.state !== 'trialing' && (
          <Detail label="Renews">
            <DateWithAgo date={plan.currentPeriodEnd} />
          </Detail>
        )}
        {!!plan.cancelAt && (
          <Detail label="Stops on">
            <DateWithAgo date={plan.cancelAt} />
          </Detail>
        )}
        {!!workspace.subscription && (
          <Detail label="Payment">
            <span
              className={clsx(
                !!plan.status &&
                  PAYMENT_PROBLEMS.includes(plan.status) &&
                  'text-red-500'
              )}
            >
              {plan.status
                ? PAYMENT_WORDS[plan.status] || plan.status
                : 'No payment status (a code or a plan set by an admin)'}
            </span>
          </Detail>
        )}
        {!!workspace.subscription && (
          <Detail label="Channels allowed">
            {workspace.subscription.totalChannels.toLocaleString()}
          </Detail>
        )}
        {!!workspace.subscription && (
          <Detail label="Plan since">
            <DateWithAgo date={workspace.subscription.createdAt} />
          </Detail>
        )}
        {!!workspace.createdAt && (
          <Detail label="Workspace created">
            <DateWithAgo date={workspace.createdAt} />
          </Detail>
        )}
        {!!workspace.stripeCustomerId && (
          <Detail label="Billing customer id">
            <span className="font-mono text-[12px] select-all">
              {workspace.stripeCustomerId}
            </span>
          </Detail>
        )}
      </div>
    </div>
  );
};

const ChannelPicture: FC<{ picture: string | null; identifier: string }> = ({
  picture,
  identifier,
}) => (
  <span className="relative shrink-0 w-[32px] h-[32px]">
    <ImageWithFallback
      fallbackSrc="/no-picture.jpg"
      src={picture || '/no-picture.jpg'}
      className="rounded-[8px] w-[32px] h-[32px]"
      alt={identifier}
      width={32}
      height={32}
    />
    <img
      src={`/icons/platforms/${identifier}.png`}
      className="absolute -bottom-[3px] -end-[3px] w-[16px] h-[16px] rounded-full"
      alt=""
    />
  </span>
);

const ChannelsList: FC<{ channels: Channel[] }> = ({ channels }) =>
  channels.length === 0 ? (
    <Empty>No channels connected.</Empty>
  ) : (
    <List>
      {channels.map((channel) => {
        const status = CHANNEL_STATUS[channel.status];
        return (
          <ListRow key={channel.id} className="flex gap-[12px] items-start">
            <ChannelPicture
              picture={channel.picture}
              identifier={channel.providerIdentifier}
            />
            <div className="flex-1 min-w-0 flex flex-col gap-[4px]">
              <div className="flex flex-wrap items-center gap-[8px]">
                <span className="font-[600] truncate">{channel.name}</span>
                <span className="text-textItemBlur">
                  {channel.providerIdentifier}
                </span>
                <Pill className={status.className}>{status.label}</Pill>
              </div>
              <div className="flex flex-wrap gap-x-[16px] gap-y-[2px] text-[12px] text-textItemBlur">
                <span>Connected {shortDate(channel.createdAt)}</span>
                <span>
                  {channel.lastPublishedAt
                    ? `Last post ${relativeDate(channel.lastPublishedAt)}`
                    : 'Nothing published yet'}
                </span>
                {!!channel.tokenExpiration && (
                  <span title={fullDate(channel.tokenExpiration)}>
                    Login{' '}
                    {new Date(channel.tokenExpiration) < new Date()
                      ? 'expired'
                      : 'expires'}{' '}
                    {relativeDate(channel.tokenExpiration)}
                  </span>
                )}
              </div>
              {!!channel.lastError && (
                <div className="text-[12px] text-red-500 break-words">
                  Last error
                  {channel.lastErrorAt
                    ? ` ${relativeDate(channel.lastErrorAt)}`
                    : ''}
                  : {errorTextOf(channel.lastError)}
                </div>
              )}
            </div>
          </ListRow>
        );
      })}
    </List>
  );

const PostsList: FC<{ posts: RecentPost[] }> = ({ posts }) =>
  posts.length === 0 ? (
    <Empty>No posts yet.</Empty>
  ) : (
    <List>
      {posts.map((post) => {
        const state = POST_STATE[post.state] || POST_STATE.DRAFT;
        return (
          <ListRow key={post.id} className="flex gap-[12px] items-start">
            <ChannelPicture
              picture={post.channel?.picture}
              identifier={post.channel?.providerIdentifier}
            />
            <div className="flex-1 min-w-0 flex flex-col gap-[4px]">
              <div className="flex flex-wrap items-center gap-[8px]">
                <Pill className={state.className}>{state.label}</Pill>
                <span className="text-textItemBlur text-[12px]">
                  {post.channel?.name} · {post.state === 'QUEUE' ? 'for ' : ''}
                  <span title={fullDate(post.publishDate)}>
                    {shortDate(post.publishDate)}
                  </span>
                </span>
                {!!post.url && (
                  <a
                    href={post.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[12px] underline text-textItemBlur hover:text-textColor"
                  >
                    Open
                  </a>
                )}
              </div>
              <div className="break-words">
                {post.preview || (
                  <span className="text-textItemBlur">No text</span>
                )}
              </div>
              {!!post.error && (
                <div className="text-[12px] text-red-500 break-words">
                  {errorTextOf(post.error)}
                </div>
              )}
            </div>
          </ListRow>
        );
      })}
    </List>
  );

const ErrorsList: FC<{ errors: RecentError[] }> = ({ errors }) =>
  errors.length === 0 ? (
    <Empty>No errors recorded.</Empty>
  ) : (
    <List>
      {errors.map((error) => (
        <ListRow key={error.id} className="flex flex-col gap-[2px]">
          <div className="text-[12px] text-textItemBlur">
            <span title={fullDate(error.createdAt)}>
              {relativeDate(error.createdAt)}
            </span>{' '}
            · {error.platform}
          </div>
          <div className="break-words font-mono text-[12px]">
            {errorTextOf(error.message)}
          </div>
        </ListRow>
      ))}
    </List>
  );

const TeamList: FC<{
  team: TeamMember[];
  userId: string;
  listQuery: string;
}> = ({ team, userId, listQuery }) => (
  <List>
    {team.map((member) => (
      <ListRow
        key={member.userId}
        className="flex flex-wrap items-center gap-[8px] justify-between"
      >
        <div className="min-w-0 flex flex-col">
          {member.userId === userId ? (
            <span className="font-[600] truncate">
              {member.name || member.email} (this user)
            </span>
          ) : (
            <Link
              href={`/admin/users/${member.userId}${
                listQuery ? `?list=${encodeURIComponent(listQuery)}` : ''
              }`}
              className="font-[600] truncate hover:underline"
            >
              {member.name || member.email}
            </Link>
          )}
          {!!member.name && (
            <span className="text-textItemBlur truncate">{member.email}</span>
          )}
        </div>
        <div className="flex flex-wrap gap-[4px]">
          <Tag>{ROLES[member.role] || member.role}</Tag>
          {member.disabled && (
            <Tag className="text-orange-500 border-orange-500/40">
              Access turned off
            </Tag>
          )}
          {!!member.deletedAt && (
            <Tag className="text-red-500 border-red-500/40">Deleted</Tag>
          )}
        </div>
      </ListRow>
    ))}
  </List>
);

const Journey: FC<{ events: JourneyEvent[] }> = ({ events }) => {
  if (events.length === 0) {
    return <Empty>No milestones recorded yet.</Empty>;
  }
  const firstPayment = events.findIndex(
    (event) => event.kind === 'nonzero_payment'
  );
  return (
    <div className="flex flex-col border-s-2 border-newTableBorder ms-[6px]">
      {events.map((event, index) => {
        const from = [event.source, event.medium, event.campaign].filter(
          known
        );
        return (
          <div
            key={`${event.kind}-${event.occurredAt}-${index}`}
            className="relative ps-[16px] pb-[12px] last:pb-0"
          >
            <span className="absolute -start-[6px] top-[5px] w-[10px] h-[10px] rounded-full bg-btnPrimary" />
            <div className="flex flex-wrap items-center gap-[8px] text-[13px]">
              <span className="font-[600]">
                {journeyLabelOf(event.kind, index === firstPayment)}
              </span>
              <span className="text-textItemBlur" title={fullDate(event.occurredAt)}>
                {shortDate(event.occurredAt)}
              </span>
              {event.internalOrTest && <Tag>Test</Tag>}
            </div>
            {!!from.length && (
              <div className="text-[12px] text-textItemBlur">
                From {from.join(' · ')}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const WorkspaceSection: FC<{
  workspace: WorkspaceDetail;
  userId: string;
  canViewAs: boolean;
  listQuery: string;
}> = ({ workspace, userId, canViewAs, listQuery }) => {
  const fetch = useFetch();
  const toaster = useToaster();
  const [opening, setOpening] = useState(false);

  // the same switch as the admin bar, then the app as this user sees it
  const viewAs = useCallback(async () => {
    setOpening(true);
    const res = await fetch(`/user/impersonate`, {
      method: 'POST',
      body: JSON.stringify({
        id: workspace.userOrganizationId,
      }),
    });
    if (!res.ok) {
      setOpening(false);
      toaster.show('Could not switch to this user, please try again', 'warning');
      return;
    }
    window.location.href = '/launches';
  }, [fetch, toaster, workspace.userOrganizationId]);

  return (
    <div className="flex flex-col gap-[16px] border border-newTableBorder rounded-[12px] p-[16px] mobile:p-[12px]">
      <div className="flex flex-wrap items-center justify-between gap-[12px]">
        <div className="flex flex-col gap-[4px] min-w-0">
          <div className="text-[18px] font-[600] break-words">
            {workspace.name}
          </div>
          <div className="flex flex-wrap gap-[4px]">
            <Tag>{ROLES[workspace.role] || workspace.role}</Tag>
            {!!workspace.deletedAt && (
              <Tag className="text-red-500 border-red-500/40">
                Workspace deleted
              </Tag>
            )}
            {workspace.disabled && (
              <Tag className="text-orange-500 border-orange-500/40">
                Access turned off
              </Tag>
            )}
          </div>
        </div>
        {canViewAs && !workspace.deletedAt && (
          <Button onClick={viewAs} loading={opening}>
            View as this user
          </Button>
        )}
      </div>

      <PlanCard workspace={workspace} />

      <div className="grid grid-cols-2 mobile:grid-cols-1 gap-[12px]">
        <div className="border border-newTableBorder rounded-[8px] p-[12px] text-[13px]">
          <div className="text-[12px] opacity-60 mb-[4px]">Channels</div>
          <ChannelsLine channels={workspace.channels} />
        </div>
        <div className="border border-newTableBorder rounded-[8px] p-[12px] text-[13px]">
          <div className="text-[12px] opacity-60 mb-[4px]">Posts</div>
          <PostsLine posts={workspace.posts} />
        </div>
      </div>

      <Section title="Channels" count={workspace.channelList.length}>
        <ChannelsList channels={workspace.channelList} />
      </Section>

      <Section title="Recent posts">
        <PostsList posts={workspace.recentPosts} />
      </Section>

      <Section title="Recent errors">
        <ErrorsList errors={workspace.recentErrors} />
      </Section>

      <div className="grid grid-cols-2 mobile:grid-cols-1 gap-[16px]">
        <Section title="Team" count={workspace.team.length}>
          <TeamList
            team={workspace.team}
            userId={userId}
            listQuery={listQuery}
          />
        </Section>
        <Section title="Journey">
          <Journey events={workspace.journey} />
        </Section>
      </div>
    </div>
  );
};

export const AdminUserDetailComponent: FC = () => {
  const user = useUser();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { data, isLoading, error } = useAdminUser(params?.id || '');

  if (!user?.isSuperAdmin) {
    return (
      <div className="text-textColor p-[20px]">
        You do not have access to this page.
      </div>
    );
  }

  // back to the list as it was: its search, filter and page
  const list = searchParams.get('list');
  const backHref = list ? `/admin/users?${list}` : '/admin/users';
  const back = (
    <Link
      href={backHref}
      className="text-[13px] text-textItemBlur hover:text-textColor w-fit"
    >
      ← All users
    </Link>
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-[16px] text-textColor">
        {back}
        <LoadingComponent />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col gap-[16px] text-textColor">
        {back}
        <div className={error ? 'text-red-400' : 'opacity-70'}>
          {error ? 'Failed to load this user.' : 'This user does not exist.'}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[20px] text-textColor">
      {back}

      <div className="flex flex-col gap-[8px]">
        <div className="text-[22px] font-[600] break-words">
          {data.name || data.email}
        </div>
        {!!data.name && (
          <div className="text-textItemBlur break-all">{data.email}</div>
        )}
        <UserTags user={{ ...data, workspaces: [] }} />
        <div className="flex flex-wrap gap-x-[24px] gap-y-[4px] text-[13px]">
          <span>
            <span className="opacity-60">Signed up </span>
            <DateWithAgo date={data.createdAt} />
          </span>
          <span>
            <span className="opacity-60">Last active </span>
            {data.lastActive ? (
              <DateWithAgo date={data.lastActive} />
            ) : (
              <span className="text-textItemBlur">not seen since signing up</span>
            )}
          </span>
          {!!data.deletedAt && (
            <span className="text-red-500">
              Deleted {shortDate(data.deletedAt)}
            </span>
          )}
        </div>
      </div>

      {data.workspaces.length === 0 ? (
        <Empty>This user is not in any workspace.</Empty>
      ) : (
        data.workspaces.map((workspace) => (
          <WorkspaceSection
            key={workspace.userOrganizationId}
            workspace={workspace}
            userId={data.id}
            canViewAs={!data.deletedAt}
            listQuery={list || ''}
          />
        ))
      )}
    </div>
  );
};
