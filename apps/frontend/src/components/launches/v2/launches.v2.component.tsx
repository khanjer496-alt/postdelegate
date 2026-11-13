'use client';

import { FC, ReactNode, useState } from 'react';
import { useClickOutside } from '@mantine/hooks';
import {
  CalendarWeekProvider,
  useCalendar,
} from '@gitroom/frontend/components/launches/calendar.context';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { DNDProvider } from '@gitroom/frontend/components/launches/helpers/dnd.provider';
import { GeneratorComponent } from '@gitroom/frontend/components/launches/generator/generator';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { ImportPostsButton } from '@gitroom/frontend/components/launches/import/import.posts.button';
import { BulkVideosButton } from '@gitroom/frontend/components/launches/import/bulk.videos.button';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { Onboarding } from '@gitroom/frontend/components/onboarding/onboarding';
import { ChannelsAfterPayment } from '@gitroom/frontend/components/layout/check.payment';
import { NeedsAttention } from '@gitroom/frontend/components/activation/needs.attention';
import { FirstRunChecklist } from '@gitroom/frontend/components/activation/first.run.checklist';
import { OnboardingCardV2 } from '@gitroom/frontend/components/features/onboarding/onboarding.card.v2';
import { useFeature } from '@gitroom/frontend/components/features/feature.flags.client';
import { useChannelsV2 } from './use.channels.v2';
import { ToolbarV2 } from './toolbar.v2';
import { ChannelStripV2 } from './channel.strip.v2';
import { CalendarV2 } from './views.v2';
import { WeekPanelV2 } from './week.panel.v2';

// import, bulk videos and the generator: the classic channel column's tools
const ToolsMenu: FC = () => {
  const t = useT();
  const user = useUser();
  const { billingEnabled } = useVariables();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-label={t('more_tools', 'More tools')}
        title={t('more_tools', 'More tools')}
        onClick={() => setOpen(!open)}
        className="w-[32px] h-[32px] mobile:w-[44px] mobile:h-[44px] grid place-items-center rounded-[9px] bg-pdSurface2 border border-pdLine2 text-textItemBlur hover:text-newTextColor"
      >
        <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
      </button>
      {/* kept mounted so a modal the tools open survives the menu closing */}
      <div
        className={
          open
            ? 'absolute top-[calc(100%+6px)] end-0 z-[60] w-[240px] flex flex-col gap-[8px] p-[10px] rounded-[12px] bg-newBgColorInner ring-1 ring-newBorder shadow-menu'
            : 'hidden'
        }
      >
        <ImportPostsButton />
        <BulkVideosButton />
        {user?.aiAvailable && billingEnabled && <GeneratorComponent />}
      </div>
    </div>
  );
};

// in the strip on narrow screens and in the month and list views, where
// the side panel (their usual home) is not shown
const ToolsSlot: FC<{ children: ReactNode }> = ({ children }) => {
  const { display } = useCalendar();
  return (
    <div className={display === 'list' || display === 'month' ? '' : 'hidden tablet:block'}>
      {children}
    </div>
  );
};

export const LaunchesComponentV2: FC = () => {
  // the 4-step v2 card replaces the classic checklist (PD_FF_ONBOARDING_V2)
  const onboardingV2 = useFeature('onboarding_v2');
  const {
    isLoading,
    reload,
    integrations,
    mutate,
    sortedIntegrations,
    menuIntegrations,
    update,
    continueIntegration,
    refreshChannel,
    totalNonDisabledChannels,
  } = useChannelsV2({ handleConnectResult: true });

  if (isLoading || reload) {
    return (
      <div className="bg-newBgColorInner p-[20px] flex flex-1 flex-col items-center justify-center">
        <LoadingComponent />
      </div>
    );
  }

  return (
    <DNDProvider>
      <Onboarding />
      <ChannelsAfterPayment integrations={integrations} reload={mutate} />
      <CalendarWeekProvider integrations={sortedIntegrations}>
        <div className="flex flex-1 min-h-0 min-w-0 bg-newBgColorInner">
          <div className="flex-1 flex flex-col min-w-0 min-h-0">
            <ToolbarV2 />
            <ChannelStripV2
              groups={menuIntegrations}
              refreshChannel={refreshChannel}
              mutate={mutate}
              update={update}
              totalNonDisabledChannels={totalNonDisabledChannels}
              tools={
                sortedIntegrations.length > 0 ? (
                  // the side panel holds them on wide screens
                  <ToolsSlot>
                    <ToolsMenu />
                  </ToolsSlot>
                ) : null
              }
            />
            <div className="empty:hidden px-[20px] [&>*]:mt-[12px] mobile:px-[12px]">
              <NeedsAttention
                refreshChannel={refreshChannel}
                continueIntegration={continueIntegration}
              />
              {onboardingV2 ? <OnboardingCardV2 /> : <FirstRunChecklist />}
            </div>
            <CalendarV2 />
          </div>
          <WeekPanelV2
            refreshChannel={refreshChannel}
            tools={sortedIntegrations.length > 0 ? <ToolsMenu /> : null}
          />
        </div>
      </CalendarWeekProvider>
    </DNDProvider>
  );
};
