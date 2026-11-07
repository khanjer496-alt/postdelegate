'use client';

import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HttpStatusCode } from 'axios';
import { useRouter } from 'next/navigation';
import { Redirect } from '@gitroom/frontend/components/layout/redirect';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { continueProviderList } from '@gitroom/frontend/components/new-launch/providers/continue-provider/list';
import { IntegrationContext } from '@gitroom/frontend/components/launches/helpers/use.integration';
import { newDayjs } from '@gitroom/frontend/components/layout/set.timezone';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { sameOriginUrl } from '@gitroom/frontend/app/(app)/auth/return.url.component';

interface TwoStepState {
  integrationId: string;
  onboarding: boolean;
  pages: any[];
  returnURL?: string;
}

// The whole screen is one value, so every path ends in something visible
type ConnectState =
  | { status: 'loading' }
  | { status: 'picking'; step: TwoStepState; saveError?: string }
  | { status: 'saving'; step: TwoStepState }
  | { status: 'error'; message?: string }
  | { status: 'done'; message: string };

// The browser extension hands its session cookies to this page through the
// tab's sessionStorage, so they never sit in a URL (history, logs, referrers)
export const extensionCodeKey = (state: string) => `extension-code:${state}`;

const takeExtensionCode = (state?: string) => {
  if (!state || typeof window === 'undefined') {
    return undefined;
  }
  try {
    const code = sessionStorage.getItem(extensionCodeKey(state));
    sessionStorage.removeItem(extensionCodeKey(state));
    return code || undefined;
  } catch (e) {
    return undefined;
  }
};

// The return address is stored with the connect request: an address on this
// app, a partner app (enterprise connect) or the mobile app's own link. Never
// a javascript: or data: URL.
const EXTERNAL_RETURN_PROTOCOLS = ['https:', 'http:', 'postiz:'];
const safeReturnUrl = (url?: string) => {
  if (!url || typeof window === 'undefined') {
    return null;
  }
  const sameOrigin = sameOriginUrl(url);
  if (sameOrigin) {
    return { url: new URL(sameOrigin), external: false };
  }
  try {
    const parsed = new URL(url);
    return EXTERNAL_RETURN_PROTOCOLS.includes(parsed.protocol)
      ? { url: parsed, external: true }
      : null;
  } catch {
    return null;
  }
};

const readMessage = async (response: Response) => {
  const body = await response.json().catch(() => ({} as any));
  const message = body?.message || body?.msg;
  if (Array.isArray(message)) {
    return typeof message[0] === 'string' ? message[0] : undefined;
  }
  return typeof message === 'string' && message ? message : undefined;
};

export const ContinueIntegration: FC<{
  provider: string;
  searchParams: any;
  logged: boolean;
}> = (props) => {
  const { provider, searchParams, logged } = props;
  const { push } = useRouter();
  const t = useT();
  const fetch = useFetch();
  const { extensionId, backendUrl } = useVariables();
  const [state, setState] = useState<ConnectState>({ status: 'loading' });
  // the OAuth code can be exchanged only once, even if the effect runs twice
  const started = useRef(false);

  // Redirects to the return address, or to the calendar when logged in,
  // otherwise shows the result on this page
  const navigateOrShow = useCallback(
    (
      params: Record<string, string>,
      returnURL: string | undefined,
      message: string,
      kind: 'success' | 'error'
    ) => {
      const target = safeReturnUrl(returnURL);
      if (target) {
        Object.entries(params).forEach(([key, value]) =>
          target.url.searchParams.set(key, value)
        );
        if (target.external) {
          window.location.href = target.url.toString();
        } else {
          push(target.url.pathname + target.url.search + target.url.hash);
        }
        return;
      }
      if (logged) {
        push(`/launches?${new URLSearchParams(params).toString()}`);
        return;
      }
      setState(
        kind === 'success'
          ? { status: 'done', message }
          : { status: 'error', message }
      );
    },
    [logged, push]
  );
  const modifiedParams = useMemo(() => {
    if (provider === 'mewe') {
      return {
        state: searchParams.state || '',
        code: searchParams.loginRequestToken || '',
        refresh: searchParams.refresh || '',
      };
    }
    if (provider === 'x') {
      return {
        state: searchParams.oauth_token || '',
        code: searchParams.oauth_verifier || '',
        refresh: searchParams.refresh || '',
      };
    }

    if (provider === 'tiktok-business') {
      // The TikTok Business API redirects back with `auth_code` instead of `code`
      return {
        state: searchParams.state || '',
        code: searchParams.auth_code || searchParams.code || '',
        refresh: searchParams.refresh || '',
      };
    }

    if (provider === 'vk') {
      return {
        ...searchParams,
        state: searchParams.state || '',
        code: searchParams.code + '&&&&' + searchParams.device_id,
      };
    }

    if (provider === 'mewe') {
      const hash =
        typeof window !== 'undefined' ? window.location.hash.substring(1) : '';
      const hashParams = new URLSearchParams(hash);
      return {
        state: hashParams.get('state') || searchParams.state || '',
        code: hashParams.get('loginRequestToken') || '',
        refresh: searchParams.refresh || '',
      };
    }

    return searchParams;
  }, []);

  const Provider = useMemo(() => {
    return (
      continueProviderList[provider as keyof typeof continueProviderList] ||
      null
    );
  }, [provider]);

  const connect = useCallback(async () => {
    const timezone = String(newDayjs().utcOffset());
    const extensionCode = takeExtensionCode(modifiedParams.state);
    const body = JSON.stringify({
      ...modifiedParams,
      ...(extensionCode ? { code: extensionCode } : {}),
      timezone,
    });

    // Try public endpoint first (handles both public and fallback scenarios)
    let data = await fetch(`/integrations/social-connect/${provider}`, {
      method: 'POST',
      body,
    });

    // If public endpoint fails with specific errors, try authenticated endpoint
    if (data.status === HttpStatusCode.BadRequest) {
      const errorData = await data
        .clone()
        .json()
        .catch(() => ({}));
      // "Invalid connection type" means this wasn't started as a public flow
      if (
        errorData.message?.includes('Invalid connection type') ||
        errorData.message?.includes('Invalid or expired state')
      ) {
        data = await fetch(`/integrations/social-connect/${provider}`, {
          method: 'POST',
          body,
        });
      }
    }

    if (data.status === HttpStatusCode.PreconditionFailed) {
      const { returnURL } = await data.json().catch(() => ({}));
      navigateOrShow(
        { precondition: 'true' },
        returnURL,
        'Precondition failed',
        'error'
      );
      return;
    }

    if (data.status === HttpStatusCode.NotAcceptable) {
      const { msg, returnURL } = await data.json().catch(() => ({}));
      const message =
        typeof msg === 'string' && msg
          ? msg
          : t('could_not_add_provider', 'Could not add provider');
      navigateOrShow(
        { msg: message, msgType: 'error' },
        returnURL,
        message,
        'error'
      );
      return;
    }

    if (!data.ok) {
      setState({ status: 'error', message: await readMessage(data) });
      return;
    }

    const {
      inBetweenSteps,
      id,
      onboarding: resOnboarding,
      pages,
      returnURL,
      extensionToken,
    } = await data.json();
    const onboarding = resOnboarding || searchParams.onboarding === 'true';

    // Store refresh token in extension for background cookie refresh
    if (
      extensionToken &&
      extensionId &&
      typeof chrome !== 'undefined' &&
      chrome?.runtime?.sendMessage
    ) {
      try {
        chrome.runtime.sendMessage(
          extensionId,
          {
            type: 'STORE_REFRESH_TOKEN',
            provider,
            integrationId: id,
            jwt: extensionToken,
            backendUrl,
          },
          () => {
            if (chrome.runtime.lastError) {
              return;
            }
          }
        );
      } catch {
        // Silently ignore — extension may not be available
      }
    }

    // If it's a two-step provider, show the selection UI inline
    if (inBetweenSteps && !searchParams.refresh) {
      if (!Provider) {
        setState({ status: 'error' });
        return;
      }
      setState({
        status: 'picking',
        step: {
          integrationId: id,
          onboarding,
          pages: pages || [],
          returnURL,
        },
      });
      return;
    }

    navigateOrShow(
      {
        added: provider,
        msg: 'Channel Updated',
        msgType: 'success',
        ...(onboarding ? { onboarding: 'true' } : {}),
      },
      returnURL,
      'Channel Updated',
      'success'
    );
  }, [modifiedParams, provider, Provider, navigateOrShow]);

  useEffect(() => {
    if (started.current) {
      return;
    }
    started.current = true;
    connect().catch(() => {
      setState({ status: 'error' });
    });
  }, []);

  const onSave = useCallback(
    async (data: any) => {
      if (state.status !== 'picking') return;
      const { step } = state;

      setState({ status: 'saving', step });

      try {
        // Use public or authenticated endpoint based on the flow
        const endpoint = logged
          ? `/integrations/provider/${step.integrationId}/connect`
          : `/integrations/public/provider/${step.integrationId}/connect`;

        // The OAuth code was already exchanged; saving the page only needs the
        // state (which finds the organization of a public flow), so a retry
        // never sends the one-time code again
        const response = await fetch(endpoint, {
          method: 'POST',
          body: JSON.stringify({ state: modifiedParams.state, ...data }),
        });

        if (!response.ok) {
          setState({
            status: 'picking',
            step,
            saveError:
              (await readMessage(response)) ||
              t('error_occurred', 'An error occurred. Please try again.'),
          });
          return;
        }

        navigateOrShow(
          {
            added: provider,
            msg: 'Channel Added',
            msgType: 'success',
            ...(step.onboarding ? { onboarding: 'true' } : {}),
          },
          step.returnURL,
          'Channel Added',
          'success'
        );
      } catch (e) {
        setState({
          status: 'picking',
          step,
          saveError: t('error_occurred', 'An error occurred. Please try again.'),
        });
      }
    },
    [state, fetch, logged, modifiedParams, provider, navigateOrShow, t]
  );

  const providerDisplayName = useMemo(() => {
    const names: Record<string, string> = {
      facebook: 'Facebook',
      instagram: 'Instagram',
      'linkedin-page': 'LinkedIn',
      youtube: 'YouTube',
      gmb: 'Google Business',
      tumblr: 'Tumblr',
      'tiktok-business': 'TikTok Business',
    };
    return names[provider] || provider;
  }, [provider]);

  // Success state for non-logged users without returnURL
  if (state.status === 'done') {
    return (
      <div className="flex flex-1 items-center justify-center text-white relative overflow-hidden">
        {/* Background gradient decoration */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-[20%] left-[10%] w-[300px] h-[300px] bg-btnPrimary rounded-full blur-[120px]" />
          <div className="absolute bottom-[20%] right-[10%] w-[250px] h-[250px] bg-[#FC69FF] rounded-full blur-[120px]" />
        </div>

        <div className="relative z-10 text-center">
          <div className="w-[80px] h-[80px] mx-auto mb-[24px] rounded-full bg-green-500/20 flex items-center justify-center">
            <svg
              className="w-[40px] h-[40px] text-green-500"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="text-[28px] font-semibold mb-[12px]">
            {t('channel_connected', 'Channel Connected!')}
          </div>
          <div className="text-[16px] text-gray-400 max-w-[400px]">
            {state.message ||
              t(
                'channel_connected_description',
                `Your ${providerDisplayName} channel has been successfully connected. You can close this window now.`
              )}
          </div>
        </div>
      </div>
    );
  }

  // Show the two-step selection UI
  if ((state.status === 'picking' || state.status === 'saving') && Provider) {
    return (
      <div className="flex flex-1 items-center justify-center text-white relative overflow-hidden">
        {/* Background gradient decoration */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-[20%] left-[10%] w-[300px] h-[300px] bg-btnPrimary rounded-full blur-[120px]" />
          <div className="absolute bottom-[20%] right-[10%] w-[250px] h-[250px] bg-[#FC69FF] rounded-full blur-[120px]" />
        </div>

        {/* Content */}
        <div className="relative z-10 w-full max-w-[550px] mx-auto px-[20px]">
          <div className="bg-[#11141C] ring-1 ring-[#262B37] rounded-[16px] p-[32px] flex flex-col gap-[24px]">
            <div className="flex flex-col gap-[8px] text-center">
              <h1 className="text-[24px] font-semibold">
                {t('configure_your_channel', 'Configure Your Channel')}
              </h1>
              <p className="text-[14px] text-gray-400">
                {t(
                  'select_the_page_or_account',
                  `Select the ${providerDisplayName} page or account you want to connect.`
                )}
              </p>
            </div>

            {state.status === 'picking' && !!state.saveError && (
              <div
                role="alert"
                className="rounded-[8px] bg-red-500/10 ring-1 ring-red-500/40 text-red-400 text-[14px] px-[16px] py-[12px] text-center"
              >
                {state.saveError}
              </div>
            )}

            <IntegrationContext.Provider
              value={{
                date: newDayjs(),
                value: [],
                allIntegrations: [],
                integration: {
                  editor: 'normal',
                  additionalSettings: '',
                  display: '',
                  time: [{ time: 0 }],
                  id: state.step.integrationId,
                  type: '',
                  name: '',
                  picture: '',
                  inBetweenSteps: true,
                  changeNickName: false,
                  changeProfilePicture: false,
                  identifier: provider,
                },
              }}
            >
              <Provider
                onSave={onSave}
                existingId={[]}
                initialData={state.step.pages}
                isSaving={state.status === 'saving'}
              />
            </IntegrationContext.Provider>
          </div>
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="flex flex-1 items-center justify-center text-white relative overflow-hidden">
        {/* Background gradient decoration */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-[20%] left-[10%] w-[300px] h-[300px] bg-btnPrimary rounded-full blur-[120px]" />
          <div className="absolute bottom-[20%] right-[10%] w-[250px] h-[250px] bg-[#FC69FF] rounded-full blur-[120px]" />
        </div>

        <div className="relative z-10 text-center">
          <div className="w-[80px] h-[80px] mx-auto mb-[24px] rounded-full bg-red-500/20 flex items-center justify-center">
            <svg
              className="w-[40px] h-[40px] text-red-500"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="text-[28px] font-semibold mb-[12px]">
            {t('could_not_add_provider', 'Could not add provider')}
          </div>
          <div className="text-[16px] text-gray-400 max-w-[400px]">
            {state.message ||
              (logged
                ? t(
                    'you_are_being_redirected_back',
                    'You are being redirected back'
                  )
                : t('error_occurred', 'An error occurred. Please try again.'))}
          </div>
          {logged && <Redirect url="/launches" delay={3000} />}
        </div>
      </div>
    );
  }

  // Loading state
  return (
    <div className="flex flex-1 items-center justify-center text-white relative overflow-hidden">
      {/* Background gradient decoration */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-[20%] left-[10%] w-[300px] h-[300px] bg-btnPrimary rounded-full blur-[120px]" />
        <div className="absolute bottom-[20%] right-[10%] w-[250px] h-[250px] bg-[#FC69FF] rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 text-center">
        <div className="text-[28px] font-semibold mb-[12px]">
          {t('adding_channel', 'Adding Channel')}
        </div>
        <div className="text-[16px] text-gray-400">
          {t('please_wait', 'Please wait while we connect your account...')}
        </div>
        {/* Loading spinner */}
        <div className="mt-[32px] flex justify-center">
          <div className="w-[48px] h-[48px] border-[3px] border-btnPrimary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    </div>
  );
};
