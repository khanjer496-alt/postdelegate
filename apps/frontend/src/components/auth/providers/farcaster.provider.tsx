'use client';

import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { timer } from '@gitroom/helpers/utils/timer';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { Button } from '@gitroom/react/form/button';
import copy from 'copy-to-clipboard';
import Loading from '@gitroom/frontend/components/layout/loading';
import { handoffAuthCode } from '../auth.code';
export const FarcasterProvider = () => {
  const modal = useModals();
  const t = useT();
  const toaster = useToaster();
  const gotoLogin = useCallback(
    async (code: string, state?: string) => {
      if (
        !/^fcp_[a-f0-9]{64}$/.test(code || '') ||
        !/^[a-f0-9]{64}$/.test(state || '')
      ) {
        toaster.show(
          'Could not complete Farcaster sign-in. Start again.',
          'warning'
        );
        return;
      }
      const target = handoffAuthCode('FARCASTER', state!, code);
      if (!target) {
        toaster.show(
          'Could not prepare a secure sign-in. Enable session storage and start again.',
          'warning'
        );
        return;
      }
      window.location.href = target;
    },
    [toaster]
  );
  const open = useCallback(() => {
    modal.openModal({
      title: t('farcaster', 'Farcaster'),
      withCloseButton: true,
      classNames: {
        modal: 'bg-transparent text-textColor',
      },
      children: (close) => (
        <FarcasterApproval authentication login={gotoLogin} onFail={close} />
      ),
    });
  }, []);
  return (
    <button
      type="button"
      onClick={open}
      aria-label={t('farcaster', 'Farcaster')}
      className={`cursor-pointer bg-white h-[52px] flex-1 rounded-[10px] flex justify-center items-center text-[#0E0E0E] gap-[5px]`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
      >
        <g clipPath="url(#clip0_2026_31786)">
          <path
            d="M18.75 0H5.25C2.35051 0 0 2.35051 0 5.25V18.75C0 21.6495 2.35051 24 5.25 24H18.75C21.6495 24 24 21.6495 24 18.75V5.25C24 2.35051 21.6495 0 18.75 0Z"
            fill="#7C65C1"
          />
          <path
            d="M17.2139 6.64138H19.9174L19.5312 8.76552H18.8553V16.8759L18.8851 16.8766C19.1912 16.8921 19.4346 17.1452 19.4346 17.4552V17.9379L19.4644 17.9387C19.7705 17.9541 20.0139 18.2073 20.0139 18.5172V19H14.607V18.5172C14.607 18.2073 14.8504 17.9541 15.1566 17.9387L15.1863 17.9379V17.4552C15.1863 17.1452 15.4297 16.8921 15.7359 16.8766L15.7657 16.8759V12.9172C15.7657 10.8376 14.0798 9.15172 12.0001 9.15172C9.92051 9.15172 8.2346 10.8376 8.2346 12.9172V16.8759L8.2644 16.8766C8.5705 16.8921 8.81391 17.1452 8.81391 17.4552V17.9379L8.84371 17.9387C9.14981 17.9541 9.39324 18.2073 9.39324 18.5172V19H3.98633V18.5172C3.98633 18.2073 4.22974 17.9541 4.53584 17.9387L4.56564 17.9379V17.4552C4.56564 17.1452 4.80905 16.8921 5.11515 16.8766L5.14495 16.8759V8.76552H4.46909L4.08288 6.64138H6.78633V5H17.2139V6.64138Z"
            fill="white"
          />
        </g>
        <defs>
          <clipPath id="clip0_2026_31786">
            <rect width="24" height="24" fill="white" />
          </clipPath>
        </defs>
      </svg>
      <div className="block xs:hidden">{t('farcaster', 'Farcaster')}</div>
    </button>
  );
};
export const FarcasterApproval: FC<{
  login: (code: string, state?: string) => void;
  authentication?: boolean;
  onFail: () => void;
}> = (props) => {
  const { login, onFail, authentication = false } = props;
  const fetch = useFetch();
  const toaster = useToaster();
  const t = useT();
  const activeSigner = useRef('');
  const mounted = useRef(false);
  const started = useRef(false);
  const [approvalUrl, setApprovalUrl] = useState('');
  const [qrCode, setQrCode] = useState('');

  async function* load(flow: string) {
    while (true) {
      try {
        yield await (
          await fetch(
            authentication
              ? '/auth/farcaster/login/status'
              : `/auth/farcaster/signer?signerUuid=${encodeURIComponent(flow)}`,
            authentication
              ? { method: 'POST', body: JSON.stringify({ state: flow }) }
              : undefined
          )
        ).json();
      } catch {
        yield {};
      }
    }
  }

  const poll = async (signerUuid: string) => {
    activeSigner.current = signerUuid;
    const startedAt = Date.now();
    const generator = load(signerUuid);
    for await (const data of generator) {
      if (!mounted.current || activeSigner.current !== signerUuid) {
        return;
      }
      if (authentication && (data.error || data.message)) {
        toaster.show(
          'Could not verify Farcaster sign-in. Start again.',
          'warning'
        );
        onFail();
        return;
      }
      if (data.status === 'approved') {
        if (authentication) login(data.code, data.state);
        else login(data.code);
        return;
      }
      if (data.status === 'revoked') {
        toaster.show(
          t(
            'farcaster_signer_revoked',
            'The Farcaster approval was revoked, please try again'
          ),
          'warning'
        );
        onFail();
        return;
      }
      if (Date.now() - startedAt > 10 * 60 * 1000) {
        toaster.show(
          t(
            'farcaster_approval_timeout',
            'Farcaster approval timed out, please try again'
          ),
          'warning'
        );
        onFail();
        return;
      }
      await timer(2000);
    }
  };

  const start = async () => {
    try {
      const data = await (
        await fetch(
          authentication
            ? '/auth/farcaster/login/start'
            : '/auth/farcaster/signer',
          { method: 'POST', ...(authentication ? { body: '{}' } : {}) }
        )
      ).json();
      if (!mounted.current) return;
      if (!data.approvalUrl) {
        toaster.show(
          data.error ||
            t(
              'farcaster_signer_failed',
              'Failed to start the Farcaster connection'
            ),
          'warning'
        );
        onFail();
        return;
      }
      setApprovalUrl(data.approvalUrl);
      setQrCode(data.qrCode);
      poll(authentication ? data.state : data.signerUuid);
    } catch (err) {
      if (!mounted.current) return;
      toaster.show(
        t(
          'farcaster_signer_failed',
          'Failed to start the Farcaster connection'
        ),
        'warning'
      );
      onFail();
    }
  };

  const copyLink = useCallback(() => {
    copy(approvalUrl);
    toaster.show(
      t('link_copied_to_clipboard', 'Link copied to clipboard'),
      'success'
    );
  }, [approvalUrl]);

  useEffect(() => {
    mounted.current = true;
    if (!started.current) {
      started.current = true;
      void start();
    }
    return () => {
      mounted.current = false;
      activeSigner.current = '';
    };
  }, []);

  if (!approvalUrl) {
    return (
      <div className="flex justify-center py-[20px]">
        <Loading width={40} height={40} />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-[12px] py-[20px] text-center">
      <img
        src={qrCode}
        alt=""
        className="w-[200px] h-[200px] rounded-[8px] bg-white"
      />
      <div className="max-w-[400px]">
        {t(
          'farcaster_scan_instructions',
          'Scan the QR code with your phone, or copy the link and open it on your phone, then approve PostDelegate in the Farcaster app.'
        )}
      </div>
      <Button onClick={copyLink}>
        {t('farcaster_copy_link', 'Copy Farcaster link')}
      </Button>
      <div className="flex items-center gap-[8px] text-sm opacity-70">
        <Loading width={20} height={20} />
        {t('farcaster_waiting_for_approval', 'Waiting for your approval...')}
      </div>
    </div>
  );
};
