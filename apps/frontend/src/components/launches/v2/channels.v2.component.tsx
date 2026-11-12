'use client';

import { FC, useCallback, useMemo, useState } from 'react';
import clsx from 'clsx';
import dayjs from 'dayjs';
import Link from 'next/link';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { fromUtc, newDayjs } from '@gitroom/frontend/components/layout/set.timezone';
import { Menu } from '@gitroom/frontend/components/launches/menu/menu';
import { useAddProvider } from '@gitroom/frontend/components/launches/add.provider.component';
import { AddEditModal } from '@gitroom/frontend/components/new-launch/add.edit.modal';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useChannelsV2 } from './use.channels.v2';
import { ChannelAvatarV2, Pill, ghostButton } from './ui.v2';
import { TimeTable } from '@gitroom/frontend/components/launches/time.table';
import { Icon } from '@gitroom/frontend/components/new-layout/v2/icons.v2';

const GROUP_COLORS = ['#8a5a2b', '#1f7a8c', '#5b3fd6', '#2d6a4f', '#9d4edd', '#b5651d'];
const groupColor = (seed: string) =>
  GROUP_COLORS[Array.from(seed).reduce((sum, c) => sum + c.charCodeAt(0), 0) % GROUP_COLORS.length];
const initialsOf = (name: string) =>
  name
    .replace(/[()@#]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';

const networkName = (identifier: string) =>
  ({
    youtube: 'YouTube',
    linkedin: 'LinkedIn',
    'linkedin-page': 'LinkedIn Page',
    bluesky: 'Bluesky',
    mastodon: 'Mastodon',
    discord: 'Discord',
    telegram: 'Telegram',
    slack: 'Slack',
    medium: 'Medium',
  }[identifier] ||
  identifier.charAt(0).toUpperCase() + identifier.slice(1).replace(/-/g, ' '));

// networks the workspace is waiting on, shown so nobody hunts for them
const COMING_SOON = [
  ['facebook', 'Facebook'],
  ['instagram', 'Instagram'],
  ['threads', 'Threads'],
  ['tiktok', 'TikTok'],
  ['pinterest', 'Pinterest'],
  ['linkedin-page', 'LinkedIn Pages'],
] as const;

const slotTimes = (integration: any) =>
  (integration.time || [])
    .map((slot: { time: number }) =>
      newDayjs(dayjs.utc().startOf('day').add(slot.time, 'minute').toDate())
    )
    .sort((a: dayjs.Dayjs, b: dayjs.Dayjs) => a.hour() * 60 + a.minute() - (b.hour() * 60 + b.minute()))
    .map((d: dayjs.Dayjs) => d.format('HH:mm'));

export const ChannelsComponentV2: FC = () => {
  const t = useT();
  const user = useUser();
  const modal = useModals();
  const fetch = useFetch();
  const {
    isLoading,
    reload,
    integrations,
    mutate,
    menuIntegrations,
    update,
    refreshChannel,
    totalNonDisabledChannels,
  } = useChannelsV2();
  const add = useAddProvider(() => update(true));
  const invite = useAddProvider(() => update(true), true);
  const [tab, setTab] = useState<string>('all');
  const [query, setQuery] = useState('');

  // the composer with this channel already ticked
  const createPost = useCallback(
    (integration: any) => async () => {
      const date = (await (await fetch('/posts/find-slot')).json()).date;
      modal.openModal({
        id: 'add-edit-modal',
        closeOnClickOutside: false,
        removeLayout: true,
        closeOnEscape: false,
        withCloseButton: false,
        askClose: true,
        fullScreen: true,
        classNames: { modal: 'w-[100%] max-w-[1400px] text-textColor' },
        children: (
          <AddEditModal
            allIntegrations={integrations.map((p) => ({ ...p }))}
            reopenModal={() => ({})}
            mutate={() => mutate()}
            integrations={integrations}
            selectedChannels={[integration.id]}
            date={date ? fromUtc(date) : newDayjs().add(1, 'hour')}
          />
        ),
        size: '80%',
        title: ``,
      });
    },
    [integrations, fetch, modal, mutate]
  );

  // the same time-slot editor the channel menu opens
  const editSlots = useCallback(
    (integration: any) => () => {
      modal.openModal({
        withCloseButton: true,
        closeOnEscape: false,
        closeOnClickOutside: false,
        askClose: true,
        title: t('time_table_slots', 'Time Table Slots'),
        children: <TimeTable integration={integration} mutate={mutate} />,
      });
    },
    [modal, mutate, t]
  );

  const attention = (i: any) => i.refreshNeeded || i.inBetweenSteps;
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return menuIntegrations
      .map((group) => ({
        ...group,
        values: group.values.filter(
          (i: any) =>
            (tab === 'all' ||
              (tab === 'attention' ? attention(i) : (group.id || 'none') === tab)) &&
            (!q ||
              i.name?.toLowerCase().includes(q) ||
              i.identifier?.toLowerCase().includes(q) ||
              group.name?.toLowerCase().includes(q))
        ),
      }))
      .filter((group) => group.values.length);
  }, [menuIntegrations, tab, query]);

  if (isLoading || reload) {
    return (
      <div className="bg-newBgColorInner flex flex-1 items-center justify-center">
        <LoadingComponent />
      </div>
    );
  }

  const attentionCount = integrations.filter(attention).length;
  const tabs = [
    { key: 'all', label: t('all', 'All'), count: integrations.length },
    ...menuIntegrations.map((g) => ({
      key: g.id || 'none',
      label: g.name || t('no_customer', 'No customer'),
      count: g.values.length,
    })),
    ...(attentionCount
      ? [{ key: 'attention', label: t('needs_attention', 'Needs attention'), count: attentionCount }]
      : []),
  ];
  const total = user?.totalChannels || 0;

  return (
    <div className="flex flex-1 min-h-0 min-w-0 bg-newBgColorInner">
      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        <div className="h-[48px] shrink-0 flex items-end gap-[20px] px-[24px] border-b border-pdLine overflow-x-auto scrollbar-none mobile:px-[12px]">
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={tab === item.key}
              onClick={() => setTab(item.key)}
              className={clsx(
                'h-[40px] -mb-px border-b-2 text-[12.5px] font-[600] whitespace-nowrap',
                tab === item.key
                  ? 'border-[#7357ff] text-newTextColor'
                  : 'border-transparent text-textItemBlur hover:text-newTextColor'
              )}
            >
              {item.label}{' '}
              <span className={item.key === 'attention' ? 'text-[#ff5a5f]' : 'text-pdInk3'}>{item.count}</span>
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-[24px] mobile:p-[12px] scrollbar scrollbar-thumb-pdLine2 scrollbar-track-transparent">
          <div className="flex flex-wrap items-center gap-[8px] mb-[20px]">
            <label className="flex items-center gap-[8px] h-[32px] px-[10px] w-[260px] mobile:w-full rounded-[9px] bg-pdSurface border border-pdLine text-textItemBlur focus-within:border-[#7357ff]">
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('filter_channels', 'Filter channels')}
                aria-label={t('filter_channels', 'Filter channels')}
                className="bg-transparent outline-none flex-1 min-w-0 text-[12.5px] text-newTextColor placeholder:text-pdInk3"
              />
            </label>
            <button type="button" className={ghostButton} onClick={invite}>
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></svg>
              {t('send_connect_link', 'Send connect link')}
            </button>
            <button
              type="button"
              onClick={add}
              className="ms-auto inline-flex items-center gap-[6px] h-[32px] px-[14px] rounded-[9px] bg-[#c8ff4d] text-[#0a0a0b] text-[13px] font-[700] hover:brightness-95"
            >
              <span aria-hidden="true" className="text-[16px] leading-none">+</span>
              {t('pd_add_channel', 'Add channel')}
            </button>
          </div>
          {!groups.length && (
            <div className="text-center text-textItemBlur py-[60px] text-[14px]">
              {integrations.length
                ? t('no_channels_match', 'No channels match')
                : t('no_channels_yet', 'No channels yet. Add your first one.')}
            </div>
          )}
          {groups.map((group) => (
            <section key={group.id || 'none'} className="mb-[24px]">
              <div className="flex items-center gap-[10px] mb-[10px]">
                <span
                  className="w-[22px] h-[22px] rounded-[6px] grid place-items-center text-[10px] font-[800] text-white"
                  style={{ background: groupColor(group.name || '?') }}
                >
                  {initialsOf(group.name || '?')}
                </span>
                <h2 className="text-[14px] font-[700]">{group.name || t('no_customer', 'No customer')}</h2>
                <span className="text-[12px] text-pdInk3">
                  {t('n_channels', '{{count}} channels', { count: group.values.length })}
                </span>
              </div>
              <div className="grid grid-cols-3 tablet:grid-cols-2 mobile:!grid-cols-1 gap-[12px]">
                {group.values.map((integration: any) => {
                  const needsReconnect = attention(integration);
                  const slots = slotTimes(integration);
                  return (
                    <div
                      key={integration.id}
                      className={clsx(
                        'rounded-[14px] border bg-pdSurface p-[14px] flex flex-col gap-[12px]',
                        needsReconnect ? 'border-[#ff5a5f66]' : 'border-pdLine',
                        integration.disabled && 'opacity-70'
                      )}
                    >
                      <div className="flex items-start gap-[12px]">
                        <ChannelAvatarV2
                          picture={integration.picture}
                          identifier={integration.identifier}
                          name={integration.name}
                          size={40}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-[14px] font-[700] truncate">{integration.name}</div>
                          <div className="text-[12px] text-pdInk3 truncate">
                            {networkName(integration.identifier)}
                            {group.name ? ` · ${group.name}` : ''}
                          </div>
                        </div>
                        <div className="-me-[6px] -mt-[4px]">
                          <Menu
                            canChangeProfilePicture={integration.changeProfilePicture}
                            canChangeNickName={integration.changeNickName}
                            refreshChannel={refreshChannel}
                            mutate={mutate}
                            onChange={update}
                            id={integration.id}
                            canEnable={
                              (user?.totalChannels || 0) > totalNonDisabledChannels &&
                              integration.disabled
                            }
                            canDisable={!integration.disabled}
                          />
                        </div>
                      </div>
                      <div>
                        {integration.disabled ? (
                          <Pill className="bg-pdSurface2 text-textItemBlur">{t('turned_off', 'Turned off')}</Pill>
                        ) : needsReconnect ? (
                          <Pill className="bg-[#ff5a5f26] text-[#ff5a5f]">{t('reconnect_needed', 'Reconnect needed')}</Pill>
                        ) : (
                          <Pill className="bg-[#3ddc9726] text-[#3ddc97]">
                            <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6 9 17l-5-5" /></svg>
                            {t('pd_connected', 'Connected')}
                          </Pill>
                        )}
                      </div>
                      <div className="flex items-center gap-[6px] text-[12px] text-textItemBlur border-t border-pdLine pt-[10px]">
                        <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                        {slots.length ? slots.join(' · ') : t('no_slots', 'No slots')}
                      </div>
                      <div className="flex gap-[8px]">
                        {needsReconnect ? (
                          <button
                            type="button"
                            onClick={refreshChannel(integration)}
                            className="flex-1 h-[32px] rounded-[9px] bg-[#ff5a5f26] text-[#ff5a5f] text-[12.5px] font-[700]"
                          >
                            <span className="inline-flex items-center gap-[6px]">
                              <Icon name="refresh-cw" size={13} />
                              {t('reconnect', 'Reconnect')}
                            </span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={integration.disabled}
                            onClick={createPost(integration)}
                            className={clsx(ghostButton, 'flex-1 justify-center disabled:opacity-40')}
                          >
                            <Icon name="square-pen" size={14} />
                            {t('create_post', 'Create post')}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={editSlots(integration)}
                          className={clsx(ghostButton, 'flex-1 justify-center')}
                        >
                          <Icon name="clock" size={14} />
                          {t('pd_time_slots', 'Time slots')}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
      <aside className="w-[300px] shrink-0 border-s border-pdLine bg-pdPanel p-[16px] flex flex-col gap-[16px] overflow-y-auto tablet:hidden">
        <div>
          <div className="text-[13px] font-[700] mb-[10px]">{t('plan_usage', 'Plan usage')}</div>
          <div className="rounded-[12px] bg-pdSurface border border-pdLine p-[12px]">
            <div className="flex items-baseline gap-[6px]">
              <span className="text-[22px] font-[800]">{totalNonDisabledChannels}</span>
              <span className="text-[12px] text-textItemBlur">
                {t('of_total_channels', 'of {{total}} channels', { total })}
              </span>
              <Link href="/billing" className="ms-auto text-[12px] font-[600] text-[#b39aff] hover:underline">
                {t('upgrade', 'Upgrade')}
              </Link>
            </div>
            <div className="h-[6px] rounded-full bg-pdSurface2 mt-[10px] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#7357ff]"
                style={{ width: `${total ? Math.min(100, (totalNonDisabledChannels / total) * 100) : 0}%` }}
              />
            </div>
          </div>
        </div>
        <div>
          <div className="text-[13px] font-[700] mb-[10px]">{t('coming_soon', 'Coming soon')}</div>
          <div className="flex flex-col gap-[8px]">
            {COMING_SOON.map(([id, name]) => (
              <div key={id} className="flex items-center gap-[10px] h-[40px] px-[10px] rounded-[10px] bg-pdSurface border border-pdLine">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/icons/platforms/${id}.png`} alt="" className="w-[20px] h-[20px] rounded-full" />
                <span className="text-[12.5px] font-[600] flex-1">{name}</span>
                <span className="text-[10.5px] px-[7px] py-[2px] rounded-full bg-pdSurface2 text-textItemBlur whitespace-nowrap">
                  {t('awaiting_approval', 'Awaiting approval')}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[11.5px] text-pdInk3 mt-[10px] leading-[1.45]">
            {t('coming_soon_hint', 'These networks unlock as soon as each platform approves us.')}
          </p>
        </div>
      </aside>
    </div>
  );
};
