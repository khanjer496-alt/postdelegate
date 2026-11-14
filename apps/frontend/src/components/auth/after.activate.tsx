'use client';

import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import useCookie from 'react-use-cookie';
export const AfterActivate = () => {
  const fetch = useFetch();
  const params = useParams();
  const [showLoader, setShowLoader] = useState(true);
  const [reason, setReason] = useState<string>();
  const [signedInElsewhere, setSignedInElsewhere] = useState(false);
  const run = useRef(false);
  const t = useT();
  const [datafast_visitor_id] = useCookie('datafast_visitor_id');

  useEffect(() => {
    if (!run.current) {
      run.current = true;
      loadCode();
    }
  }, []);
  const loadCode = useCallback(async () => {
    if (params.code) {
      const response = await fetch(`/auth/activate`, {
        method: 'POST',
        body: JSON.stringify({
          code: params.code,
          datafast_visitor_id,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (response.headers.get('onboarding')) {
        return;
      }
      // an unreadable answer shows the "not valid" text, never a loader forever
      const { can, reason, signedInElsewhere } = await response
        .json()
        .catch(() => ({ can: false, reason: undefined, signedInElsewhere: false }));
      if (can && signedInElsewhere) {
        // activated, but this browser is signed in to a different account
        setSignedInElsewhere(true);
        setShowLoader(false);
        return;
      }
      if (!can) {
        setReason(reason);
        setShowLoader(false);
      }
    }
  }, []);
  return (
    <>
      {showLoader ? (
        <LoadingComponent />
      ) : (
        <>
          {signedInElsewhere ? (
            <>
              {t(
                'activated_signed_in_elsewhere',
                'Your account is activated, but this browser is signed in to a different account. Sign out, then sign in with your new account.'
              )}{' '}
              <a href="/auth/logout" className="underline">
                {t('logout', 'Sign out')}
              </a>
            </>
          ) : reason === 'activated' ? (
            t('user_already_activated', 'This user is already activated.')
          ) : reason === 'expired' ? (
            <>
              {t(
                'activation_link_expired',
                'This activation link has expired.'
              )}{' '}
              <Link href="/auth/activate" className="underline">
                {t('resend_activation_email', 'Resend Activation Email')}
              </Link>
            </>
          ) : (
            <>
              {t(
                'activation_link_invalid',
                'This activation link is not valid.'
              )}{' '}
              <Link href="/auth/activate" className="underline">
                {t('resend_activation_email', 'Resend Activation Email')}
              </Link>
            </>
          )}
          <br />
          <Link href="/auth/login" className="underline">
            {t(
              'click_here_to_go_back_to_login',
              'Click here to go back to login'
            )}
          </Link>
        </>
      )}
    </>
  );
};
