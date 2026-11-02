'use client';

import { FC, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocalStorage } from '@mantine/hooks';
import { useFireEvents } from '@gitroom/helpers/utils/use.fire.events';
import { hasReferralConsent } from '@gitroom/helpers/affiliate/affiliate.cookie';

// The campaign source of the link the visitor followed
export const getUtmFromQuery = (query: Pick<URLSearchParams, 'get'>) =>
  query.get('utm_source') || query.get('utm') || query.get('ref') || '';

// The campaign source is only saved in the browser once the visitor said yes
// to the referral prompt (AffiliateSaver asks, and saves it on a yes)
const UtmSaver: FC = () => {
  const query = useSearchParams();
  const [value, setValue] = useLocalStorage({ key: 'utm', defaultValue: '' });
  const fireEvents = useFireEvents();

  // the Facebook pixel StartTrial is sent by the backend once Stripe confirms
  // the trial, firing it here as well would count it twice
  useEffect(() => {
    if (query.get('check')) {
      fireEvents('purchase');
    }
  }, []);

  // older versions saved the landing page and the referring page for every
  // visitor, nothing reads them, so they are cleared
  useEffect(() => {
    try {
      localStorage.removeItem('landingUrl');
      localStorage.removeItem('referrer');
    } catch (e) {
      // storage blocked, nothing was saved either
    }
  }, []);

  useEffect(() => {
    const utm = getUtmFromQuery(query);
    if (utm && !value && hasReferralConsent(document.cookie)) {
      setValue(utm);
    }
  }, [query, value]);

  return <></>;
};

// Without a saved source, the one in the current address, for this visit only
export const useUtmUrl = () => {
  const [value] = useLocalStorage({ key: 'utm', defaultValue: '' });
  const query = useSearchParams();
  return value || getUtmFromQuery(query);
};
export default UtmSaver;
