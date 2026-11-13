'use client';

import { FC, ReactNode, Ref, useMemo } from 'react';
import clsx from 'clsx';
import { useDrag } from 'react-dnd';
import { useCalendar } from '@gitroom/frontend/components/launches/calendar.context';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { Menu } from '@gitroom/frontend/components/launches/menu/menu';
import { useAddProvider } from '@gitroom/frontend/components/launches/add.provider.component';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { NetworkBadge } from './ui.v2';

type Group = { name: string; id: string; values: any[] };

// one channel: click shows or hides its posts (the calendar's channel
// filter), drag onto a slot like the classic list, dots open its menu
const ChannelChip: FC<{
  integration: any;
  hidden: boolean;
  onToggle: () => void;
  menuProps: {
    refreshChannel: (integration: any) => () => void;
    mutate: () => void;
    update: (shouldReload: boolean) => void;
    totalNonDisabledChannels: number;
  };
}> = ({ integration, hidden, onToggle, menuProps }) => {
  const user = useUser();
  const [, drag] = useDrag(() => ({ type: 'menu', item: { id: integration.id } }));
  return (
    <span
      className={clsx(
        'group/chip relative flex items-center',
        (hidden || integration.disabled) && 'opacity-40'
      )}
    >
      <button
        ref={drag as unknown as Ref<HTMLButtonElement>}
        type="button"
        onClick={integration.refreshNeeded ? menuProps.refreshChannel(integration) : onToggle}
        aria-pressed={!hidden}
        title={`${integration.name} · ${integration.identifier}`}
        className="relative rounded-full outline-none focus-visible:ring-2 focus-visible:ring-btnPrimary mobile:p-[11px]"
      >
        <NetworkBadge identifier={integration.identifier} size={22} />
        {(integration.refreshNeeded || integration.inBetweenSteps) && (
          <span className="absolute -top-[3px] -end-[3px] mobile:top-[7px] mobile:end-[7px] w-[9px] h-[9px] rounded-full bg-[#ff5a5f] ring-2 ring-pdSurface" />
        )}
      </button>
      <span className="hidden group-hover/chip:flex group-focus-within/chip:flex mobile:!hidden absolute top-full start-1/2 -translate-x-1/2 rtl:translate-x-1/2 z-[70] pt-[4px]">
        <span className="rounded-[8px] bg-newBgColorInner ring-1 ring-newBorder shadow-menu px-[4px]">
          <Menu
            canChangeProfilePicture={integration.changeProfilePicture}
            canChangeNickName={integration.changeNickName}
            refreshChannel={menuProps.refreshChannel}
            mutate={menuProps.mutate}
            onChange={menuProps.update}
            id={integration.id}
            canEnable={
              (user?.totalChannels || 0) > menuProps.totalNonDisabledChannels &&
              integration.disabled
            }
            canDisable={!integration.disabled}
          />
        </span>
      </span>
    </span>
  );
};

export const ChannelStripV2: FC<{
  groups: Group[];
  refreshChannel: (integration: any) => () => void;
  mutate: () => void;
  update: (shouldReload: boolean) => void;
  totalNonDisabledChannels: number;
  tools?: ReactNode;
}> = ({ groups, refreshChannel, mutate, update, totalNonDisabledChannels, tools }) => {
  const t = useT();
  const { selectedChannels, setSelectedChannels, integrations } = useCalendar();
  const allIds = useMemo(() => integrations.map((i) => i.id), [integrations]);
  const visible = selectedChannels || allIds;
  const toggle = (id: string) => {
    const next = visible.includes(id)
      ? visible.filter((v) => v !== id)
      : [...visible, id];
    // every channel shown is the same as no filter
    setSelectedChannels(next.length === allIds.length ? null : next);
  };
  const menuProps = { refreshChannel, mutate, update, totalNonDisabledChannels };
  const add = useAddProvider(() => update(true));

  return (
    <div className="min-h-[52px] shrink-0 flex flex-wrap items-center gap-[8px] px-[20px] py-[8px] border-b border-pdLine mobile:px-[12px] mobile:flex-nowrap mobile:overflow-x-auto mobile:scrollbar-none">
      <span className="text-[11px] uppercase tracking-[0.08em] font-[700] text-pdInk3 me-[4px] shrink-0 mobile:hidden">
        {t('channels', 'Channels')}
      </span>
      {groups.map((group) => (
        <span
          key={group.id || 'none'}
          className="flex items-center gap-[8px] h-[36px] mobile:h-[44px] ps-[12px] pe-[6px] mobile:pe-0 rounded-[12px] border border-pdLine2 bg-pdSurface text-[12px] mobile:text-[13px] font-[600] whitespace-nowrap shrink-0"
        >
          {group.name || t('no_customer', 'No customer')}
          <span className="flex gap-[6px] mobile:gap-0 ms-[4px] mobile:ms-0">
            {group.values.map((integration) => (
              <ChannelChip
                key={integration.id}
                integration={integration}
                hidden={!visible.includes(integration.id)}
                onToggle={() => toggle(integration.id)}
                menuProps={menuProps}
              />
            ))}
          </span>
        </span>
      ))}
      <button
        type="button"
        onClick={add}
        className="ms-auto shrink-0 inline-flex items-center gap-[6px] h-[32px] mobile:h-[44px] px-[12px] rounded-full border border-dashed border-pdLine2 text-[12px] font-[600] text-textItemBlur hover:text-newTextColor hover:border-textItemBlur/50"
      >
        <span aria-hidden="true" className="text-[15px] leading-none">+</span>
        {t('pd_add_channel', 'Add channel')}
      </button>
      {tools}
    </div>
  );
};
