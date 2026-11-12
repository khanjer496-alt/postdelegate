'use client';

// PostDelegate layout v2 shell (labeled, grouped sidebar + slim top bar).
// Same providers, data loading and top-bar components as the classic
// layout.component.tsx; only the frame differs. Keep the provider part in
// sync with the classic file until the classic layout is removed.

import React, {
  FC,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { jakartaSans } from '@gitroom/frontend/fonts/plus-jakarta-sans/plus.jakarta.sans.font';
const ModeComponent = dynamic(
  () => import('@gitroom/frontend/components/layout/mode.component'),
  {
    ssr: false,
  }
);

import clsx from 'clsx';
import dynamic from 'next/dynamic';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { usePathname, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { CheckPayment } from '@gitroom/frontend/components/layout/check.payment';
import { ToolTip } from '@gitroom/frontend/components/layout/top.tip';
import { ShowMediaBoxModal } from '@gitroom/frontend/components/media/media.component';
import { ShowLinkedinCompany } from '@gitroom/frontend/components/launches/helpers/linkedin.component';
import { MediaSettingsLayout } from '@gitroom/frontend/components/launches/helpers/media.settings.component';
import { Toaster } from '@gitroom/react/toaster/toaster';
import { ShowPostSelector } from '@gitroom/frontend/components/post-url-selector/post.url.selector';
import { Support } from '@gitroom/frontend/components/layout/support';
import { ReviewPrompt } from '@gitroom/frontend/components/reviews/review.prompt';
import { ContinueProvider } from '@gitroom/frontend/components/layout/continue.provider';
import { InviteError } from '@gitroom/frontend/components/layout/invite.error';
import { ContextWrapper } from '@gitroom/frontend/components/layout/user.context';
import { CopilotKit } from '@copilotkit/react-core';
import { MantineWrapper } from '@gitroom/react/helpers/mantine.wrapper';
import { Impersonate } from '@gitroom/frontend/components/layout/impersonate';
import { AnnouncementBanner } from '@gitroom/frontend/components/layout/announcement.banner';
import { Title } from '@gitroom/frontend/components/layout/title';
import { SidebarV2 } from '@gitroom/frontend/components/new-layout/v2/sidebar.v2';
import { LanguageComponent } from '@gitroom/frontend/components/layout/language.component';
import NotificationComponent from '@gitroom/frontend/components/notifications/notification.component';
import { OrganizationSelector } from '@gitroom/frontend/components/layout/organization.selector';
import { InvoicesComponent } from '@gitroom/frontend/components/layout/invoices.component';
import { StreakComponent } from '@gitroom/frontend/components/layout/streak.component';
import { PreConditionComponent } from '@gitroom/frontend/components/layout/pre-condition.component';
import { AttachToFeedbackIcon } from '@gitroom/frontend/components/new-layout/sentry.feedback.component';
import { FirstBillingComponent } from '@gitroom/frontend/components/billing/first.billing.component';
import { TrialCountdown } from '@gitroom/frontend/components/billing/trial.banner';
import { TrialTracker } from '@gitroom/frontend/components/layout/gtm.component';
import { setSentryUser } from '@gitroom/react/sentry/initialize.sentry.client';
import { setUserTimezone } from '@gitroom/frontend/components/layout/set.timezone';
import { CommandPalette } from '@gitroom/frontend/components/layout/command.palette';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useClickOutside } from '@mantine/hooks';
import { useHasOpenModal } from '@gitroom/frontend/components/layout/new-modal';

// On phones and tablets the secondary top bar icons fold into a "more" menu,
// on desktop the wrappers are display: contents and the icons sit inline
const SIDEBAR_KEY = 'pd_sidebar_collapsed';

const TopBarMore: FC<{ children: ReactNode }> = ({ children }) => {
  const t = useT();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false));
  const buttonRef = useRef<HTMLButtonElement>(null);

  // close on navigation (state adjusted during render, not in an effect)
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  return (
    <div
      ref={ref}
      className="contents mobile:flex mobile:relative"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          setOpen(false);
          buttonRef.current?.focus();
        }
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className="hidden mobile:flex items-center justify-center w-[40px] h-[40px] rounded-[8px] hover:text-newTextColor hover:bg-boxFocused"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={t('more_options', 'More options')}
      >
        <svg
          aria-hidden="true"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      <div
        className={clsx(
          'contents',
          'mobile:absolute mobile:top-[calc(100%+8px)] mobile:end-0 mobile:z-[300] mobile:flex mobile:items-center mobile:gap-[4px] mobile:p-[6px] mobile:rounded-[12px] mobile:bg-newBgColorInner mobile:ring-1 mobile:ring-newBorder mobile:shadow-menu',
          !open && 'mobile:hidden'
        )}
      >
        {children}
      </div>
    </div>
  );
};

export const LayoutComponentV2 = ({ children }: { children: ReactNode }) => {
  const fetch = useFetch();
  const t = useT();

  const { backendUrl, billingEnabled, isGeneral } = useVariables();

  // Feedback icon component attaches Sentry feedback to a top-bar icon when DSN is present
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  // desktop only: the sidebar can shrink to icons, remembered per browser
  // the frame only renders on the client (it waits for /user/self), so
  // reading localStorage while initialising state is safe
  const [collapsed, setCollapsed] = useState(
    () =>
      typeof window !== 'undefined' &&
      localStorage.getItem(SIDEBAR_KEY) === '1'
  );
  const toggleCollapsed = useCallback(() => {
    setCollapsed((value) => {
      localStorage.setItem(SIDEBAR_KEY, value ? '0' : '1');
      return !value;
    });
  }, []);
  const modalOpen = useHasOpenModal();
  const modalOpenRef = useRef(modalOpen);
  useEffect(() => {
    modalOpenRef.current = modalOpen;
  }, [modalOpen]);
  const [lastMenuPath, setLastMenuPath] = useState(pathname);
  if (lastMenuPath !== pathname) {
    setLastMenuPath(pathname);
    setMenuOpen(false);
  }
  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    // the drawer takes the focus on phones, the menu button gets it back
    document
      .querySelector<HTMLElement>('#main-menu a, #main-menu button')
      ?.focus({ preventScroll: true });
    const close = (e: KeyboardEvent) => {
      // a modal on top of the drawer handles its own Escape
      if (e.key === 'Escape' && !modalOpenRef.current) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('keydown', close);
      const toggle = document.getElementById('main-menu-toggle');
      if (toggle && toggle.getClientRects().length) {
        toggle.focus({ preventScroll: true });
      }
    };
  }, [menuOpen]);
  const load = useCallback(async (path: string) => {
    return await (await fetch(path)).json();
  }, []);
  const { data: user, mutate } = useSWR('/user/self', load, {
    // set before anything renders a date in the user's timezone
    onSuccess: (data) => setUserTimezone(data?.timezoneName),
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    refreshWhenOffline: false,
    refreshWhenHidden: false,
  });

  useEffect(() => {
    setSentryUser(
      user ? { id: user.id, email: user.email, orgId: user.orgId } : null
    );
  }, [user]);

  if (!user) return null;

  return (
    <ContextWrapper user={user}>
      <CopilotKit
        credentials="include"
        runtimeUrl={backendUrl + '/copilot/chat'}
        useSingleEndpoint={true}
        showDevConsole={false}
      >
        <MantineWrapper>
          <ToolTip />
          <Toaster />
          <TrialTracker />
          {/* checks a payment the page was opened with (?check=), counts a
              confirmed paid plan as a purchase, then takes the param off */}
          <CheckPayment check={searchParams.get('check') || ''} mutate={mutate}>
            <ShowMediaBoxModal />
            <ShowLinkedinCompany />
            <MediaSettingsLayout />
            <ShowPostSelector />
            <PreConditionComponent />
            <ContinueProvider />
            <InviteError />
            <div
              className={clsx(
                'flex flex-col min-h-screen min-w-screen text-newTextColor bg-newBgColor mobile:pb-[80px]',
                jakartaSans.className
              )}
            >
              <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:top-[12px] focus:start-[12px] focus:z-[1000] focus:px-[16px] focus:py-[10px] focus:rounded-[8px] focus:bg-btnCta focus:text-btnCtaText focus:font-[600]"
              >
                {t('skip_to_content', 'Skip to content')}
              </a>
              <div>{user?.admin ? <Impersonate /> : <div />}</div>
              {user.tier === 'FREE' && isGeneral && billingEnabled ? (
                <FirstBillingComponent />
              ) : (
                <>
                  <AnnouncementBanner />
                  <div className="flex-1 flex">
                    <Support />
                    <ReviewPrompt />
                    {menuOpen && (
                      <div
                        className="hidden mobile:block fixed inset-0 bg-newBackdrop opacity-60 z-[490]"
                        onClick={() => setMenuOpen(false)}
                      />
                    )}
                    {/* flush sidebar: sticky on desktop, a drawer on phones and tablets */}
                    <nav
                      id="main-menu"
                      aria-label={t('main_menu', 'Main menu')}
                      className={clsx(
                        'shrink-0 bg-pdSide border-e border-newBorder transition-[width] duration-150',
                        'sticky top-0 h-screen',
                        collapsed ? 'w-[72px]' : 'w-[248px]',
                        'mobile:fixed mobile:top-0 mobile:bottom-0 mobile:start-0 mobile:z-[491] mobile:w-[280px] mobile:h-auto',
                        !menuOpen && 'mobile:hidden'
                      )}
                      onClick={(e) => {
                        // links close the drawer, the collapse and user buttons do not
                        if ((e.target as HTMLElement).closest('a')) {
                          setMenuOpen(false);
                        }
                      }}
                    >
                      <SidebarV2 collapsed={collapsed} onToggle={toggleCollapsed} />
                    </nav>
                    <div className="flex-1 min-w-0 bg-newBgLineColor overflow-hidden flex flex-col gap-[1px] blurMe">
                      {/* relative: the notifications popup spans this bar on phones */}
                      <header className="relative flex bg-newBgColor h-[60px] mobile:h-[64px] px-[24px] mobile:px-[12px] gap-[16px] mobile:gap-[8px] items-center [@media(max-width:480px)]:[&:has([data-trial-countdown])_h1]:hidden">
                        <button
                          type="button"
                          className="hidden mobile:flex shrink-0 items-center justify-center w-[44px] h-[44px] -ms-[10px] rounded-[8px] text-textItemBlur hover:text-newTextColor hover:bg-boxFocused"
                          id="main-menu-toggle"
                          onClick={() => setMenuOpen(true)}
                          aria-label={t('open_menu', 'Open menu')}
                          aria-controls="main-menu"
                          aria-expanded={menuOpen}
                        >
                          <svg
                            aria-hidden="true"
                            xmlns="http://www.w3.org/2000/svg"
                            width="22"
                            height="22"
                            viewBox="0 0 24 24"
                            fill="none"
                          >
                            <path
                              d="M3 6H21M3 12H21M3 18H21"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                            />
                          </svg>
                        </button>
                        <div className="text-[17px] mobile:text-[18px] font-[700] tracking-[-0.01em] flex min-w-0 w-[220px] tablet:w-auto tablet:flex-1">
                          <Title />
                        </div>
                        {/* wide centered search on desktop, the same quick menu button */}
                        <div className="flex-1 flex justify-center tablet:flex-none [&>button]:w-[420px] [&>button]:max-w-full tablet:[&>button]:w-auto [&>button]:h-[36px] [&>button]:my-0 [&>button]:border [&>button]:border-newBorder [&>button]:bg-newBgColorInner [&>button>kbd]:ms-auto">
                          <CommandPalette />
                        </div>
                        <div className="flex gap-[14px] mobile:gap-[4px] items-center text-textItemBlur">
                          <TrialCountdown />
                          <TopBarMore>
                            <StreakComponent />
                            <div className="w-[1px] h-[20px] bg-blockSeparator mobile:hidden" />
                            <OrganizationSelector />
                            <InvoicesComponent />
                            <div className="hover:text-newTextColor">
                              <ModeComponent />
                            </div>
                            <div className="w-[1px] h-[20px] bg-blockSeparator mobile:hidden" />
                            <LanguageComponent />
                            <div className="w-[1px] h-[20px] bg-blockSeparator mobile:hidden" />
                            <AttachToFeedbackIcon />
                          </TopBarMore>
                          <NotificationComponent />
                        </div>
                      </header>
                      <main
                        id="main-content"
                        tabIndex={-1}
                        className="flex flex-1 min-w-0 gap-[1px] mobile:flex-col"
                      >
                        {children}
                      </main>
                    </div>
                  </div>
                </>
              )}
            </div>
          </CheckPayment>
        </MantineWrapper>
      </CopilotKit>
    </ContextWrapper>
  );
};
