'use client';

import { FC, useMemo } from 'react';
import clsx from 'clsx';
import { groupBy, orderBy } from 'lodash';
import { useShallow } from 'zustand/react/shallow';
import { useLaunchStore } from '@gitroom/frontend/components/new-launch/store';
import { useExistingData } from '@gitroom/frontend/components/launches/helpers/use.existing.data';
import { isChannelConnected } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.state';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { ChannelAvatarV2 } from '@gitroom/frontend/components/launches/v2/ui.v2';

// the composer's left column in the v2 layout: the same channel selection
// as PicksSocialsComponent (same store actions), grouped by customer
export const ChannelPickerV2: FC<{
  onSelectCustomer?: (customer: string) => void;
}> = ({ onSelectCustomer }) => {
  const t = useT();
  const existing = useExistingData();
  const { locked, addOrRemoveSelectedIntegration, integrations, selectedIntegrations } =
    useLaunchStore(
      useShallow((state) => ({
        integrations: state.integrations,
        selectedIntegrations: state.selectedIntegrations,
        addOrRemoveSelectedIntegration: state.addOrRemoveSelectedIntegration,
        locked: state.locked,
      }))
    );

  const groups = useMemo(() => {
    const available = integrations.filter((f) =>
      existing.integration
        ? f.id === existing.integration ||
          !!existing.siblings?.some((sibling) => sibling.integration === f.id)
        : isChannelConnected(f)
    );
    return orderBy(
      Object.values(groupBy(available, (i) => i.customer?.id || '')).map((list) => ({
        id: list[0].customer?.id || '',
        name: list[0].customer?.name || '',
        list,
      })),
      [(g) => (g.id ? 0 : 1), 'name']
    );
  }, [integrations, existing]);

  const isSelected = (id: string) =>
    selectedIntegrations.some((p) => p.integration.id === id);

  return (
    <aside
      data-pd-composer-channels=""
      className="w-[272px] shrink-0 border-e border-pdLine bg-pdPanel flex flex-col min-h-0 mobile:hidden"
    >
      <div className="h-[48px] shrink-0 px-[16px] flex items-center justify-between border-b border-pdLine">
        <span className="text-[13px] font-[700]">{t('post_to', 'Post to')}</span>
        <span className="text-[11.5px] text-pdInk3">
          {t('selected_count', '{{count}} selected', { count: selectedIntegrations.length })}
        </span>
      </div>
      <div
        className={clsx(
          'flex-1 overflow-y-auto p-[10px] flex flex-col gap-[14px] scrollbar scrollbar-thumb-pdLine2 scrollbar-track-transparent',
          locked && 'opacity-50 pointer-events-none'
        )}
      >
        {groups.map((group) => (
          <div key={group.id || 'none'} className="flex flex-col gap-[2px]">
            <div className="flex items-center justify-between px-[6px] h-[26px]">
              <span className="text-[11px] uppercase tracking-[0.08em] font-[700] text-pdInk3 truncate">
                {group.name || t('no_customer', 'No customer')}
              </span>
              {!!group.id && !existing.integration && onSelectCustomer && (
                <button
                  type="button"
                  onClick={() => onSelectCustomer(group.id)}
                  className="text-[11px] font-[600] text-[#b39aff] hover:underline"
                >
                  {t('select_only_these', 'Only these')}
                </button>
              )}
            </div>
            {group.list.map((integration) => {
              const selected = isSelected(integration.id);
              return (
                <button
                  key={integration.id}
                  type="button"
                  role="checkbox"
                  aria-checked={selected}
                  disabled={!!existing.integration}
                  onClick={() => addOrRemoveSelectedIntegration(integration, {})}
                  className={clsx(
                    'flex items-center gap-[10px] h-[44px] px-[8px] rounded-[10px] text-start outline-none focus-visible:ring-2 focus-visible:ring-btnPrimary',
                    selected ? 'bg-[#7357ff1f]' : 'hover:bg-boxHover'
                  )}
                >
                  <ChannelAvatarV2
                    picture={integration.picture}
                    identifier={integration.identifier}
                    name={integration.name}
                    size={30}
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-[600] truncate">{integration.name}</span>
                    <span className="block text-[11px] text-pdInk3 truncate capitalize">
                      {integration.identifier.replace(/-/g, ' ')}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={clsx(
                      'w-[18px] h-[18px] rounded-[5px] grid place-items-center border',
                      selected ? 'bg-[#7357ff] border-[#7357ff] text-white' : 'border-pdLine2'
                    )}
                  >
                    {selected && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </aside>
  );
};
