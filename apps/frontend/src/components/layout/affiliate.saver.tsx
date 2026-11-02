'use client';

import { FC, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocalStorage } from '@mantine/hooks';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { getCookieUrlFromDomain } from '@gitroom/helpers/subdomain/subdomain.management';
import { getUtmFromQuery } from '@gitroom/helpers/utils/utm.saver';
import {
  AFFILIATE_COOKIE_NAME,
  buildAffiliateCookieValue,
  DEFAULT_AFFILIATE_COOKIE_DAYS,
  parseAffiliateCookieValue,
  parseReferralCode,
  parseReferralConsent,
  readCookieValue,
  ReferralConsent,
  REFERRAL_CONSENT_COOKIE_NAME,
  REFERRAL_CONSENT_DAYS,
} from '@gitroom/helpers/affiliate/affiliate.cookie';

const PRIVACY_COOKIES_URL = '/legal/privacy/#cookies';

// both answers look the same: saying no is as easy as saying yes
const answerButton =
  'h-[36px] px-[16px] rounded-[8px] border border-newBorder bg-btnSimple font-[600] hover:opacity-80 transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-btnPrimary';

const secure = () =>
  window.location.protocol === 'https:' ? '; secure' : '';

// the marketing site and the app share pd_consent, and the site's pd_ref
const sharedDomain = (frontEndUrl?: string) => {
  const domain = frontEndUrl ? getCookieUrlFromDomain(frontEndUrl) : '';
  return domain.startsWith('.') ? `; domain=${domain}` : '';
};

const forgetReferral = (frontEndUrl?: string) => {
  document.cookie = `${AFFILIATE_COOKIE_NAME}=; max-age=0; path=/`;
  document.cookie = `${AFFILIATE_COOKIE_NAME}=; max-age=0; path=/${sharedDomain(
    frontEndUrl
  )}`;
};

// A visitor who followed a referral or campaign link is asked before anything
// is stored. On a yes the first-party pd_ref cookie (read by the backend when
// the account is registered, first touch wins) and the campaign source are
// saved. On a no, or no answer, nothing is stored: the sign-up form sends the
// ?ref= code of the current address instead, for this visit only.
export const AffiliateSaver: FC = () => {
  const t = useT();
  const query = useSearchParams();
  const { affiliateCookieDays, frontEndUrl } = useVariables();
  const [savedUtm, setUtm, removeUtm] = useLocalStorage({
    key: 'utm',
    defaultValue: '',
  });
  const [ask, setAsk] = useState(false);
  const ref = parseReferralCode(query.get('ref'));
  const utm = getUtmFromQuery(query);

  const saveReferral = useCallback(() => {
    if (!ref) {
      return;
    }

    const days = affiliateCookieDays || DEFAULT_AFFILIATE_COOKIE_DAYS;
    if (
      parseAffiliateCookieValue(
        readCookieValue(document.cookie, AFFILIATE_COOKIE_NAME),
        days
      )
    ) {
      return;
    }

    document.cookie = `${AFFILIATE_COOKIE_NAME}=${buildAffiliateCookieValue(
      ref
    )}; max-age=${days * 24 * 60 * 60}; path=/; samesite=lax${secure()}`;
  }, [ref, affiliateCookieDays]);

  // a "no", also one given later in the site's cookie settings, removes the
  // referral and campaign source this app remembered earlier
  useEffect(() => {
    if (
      parseReferralConsent(
        readCookieValue(document.cookie, REFERRAL_CONSENT_COOKIE_NAME)
      ) === 'no'
    ) {
      forgetReferral(frontEndUrl);
      removeUtm();
    }
  }, []);

  useEffect(() => {
    if (!ref && !utm) {
      return;
    }

    const consent = parseReferralConsent(
      readCookieValue(document.cookie, REFERRAL_CONSENT_COOKIE_NAME)
    );
    if (consent === 'yes') {
      saveReferral();
      return;
    }

    setAsk(!consent);
  }, [ref, utm, saveReferral]);

  const answer = useCallback(
    (consent: ReferralConsent) => {
      document.cookie = `${REFERRAL_CONSENT_COOKIE_NAME}=${consent}; max-age=${
        REFERRAL_CONSENT_DAYS * 24 * 60 * 60
      }; path=/; samesite=lax${secure()}${sharedDomain(frontEndUrl)}`;

      if (consent === 'yes') {
        saveReferral();
        if (utm && !savedUtm) {
          setUtm(utm);
        }
      } else {
        forgetReferral(frontEndUrl);
        removeUtm();
      }

      setAsk(false);
    },
    [frontEndUrl, saveReferral, utm, savedUtm]
  );

  useEffect(() => {
    if (!ask) {
      return;
    }
    // Escape hides it for this page without answering, nothing is stored
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAsk(false);
      }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [ask]);

  if (!ask) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label={t('referral_consent_label', 'Referral cookie')}
      data-referral-consent=""
      className="fixed z-[800] bottom-[16px] start-[16px] end-[16px] ms-auto max-w-[400px] flex flex-col gap-[14px] p-[16px] rounded-[12px] border border-newBorder bg-newBgColorInner text-newTextColor shadow-lg text-[14px] leading-[1.5]"
    >
      <p>
        {ref
          ? t(
              'referral_consent_text',
              'Allow a cookie to remember who referred you, so they get credit if you sign up?'
            )
          : t(
              'referral_consent_text_campaign',
              'Allow us to remember which link brought you here, so we know where you heard about us?'
            )}{' '}
        <a
          href={PRIVACY_COOKIES_URL}
          target="_blank"
          rel="noopener"
          className="underline underline-offset-2 hover:opacity-80"
        >
          {t('referral_consent_learn_more', 'Learn more')}
        </a>
      </p>
      <div className="flex gap-[8px] justify-end">
        <button
          type="button"
          onClick={() => answer('no')}
          className={answerButton}
        >
          {t('referral_consent_decline', 'No thanks')}
        </button>
        <button
          type="button"
          onClick={() => answer('yes')}
          className={answerButton}
        >
          {t('referral_consent_accept', 'Accept')}
        </button>
      </div>
    </div>
  );
};
