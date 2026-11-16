'use client';

import { FC, useCallback } from 'react';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { setUiLayoutCookie } from './ui.flag.client';

// The way back from the classic layout to the new one (the new sidebar has
// "Switch to classic layout"). The server layout only renders this when
// PD_UI_V2 is optin or on, so the cookie it sets is honoured.
export const switchToNewLayout = () => {
  setUiLayoutCookie('v2');
  window.location.reload();
};

export const TryNewLayoutButton: FC<{ onSwitch?: () => void }> = ({
  onSwitch = switchToNewLayout,
}) => {
  const t = useT();
  const label = t('try_new_layout', 'Try the new layout');
  const click = useCallback(() => onSwitch(), [onSwitch]);

  return (
    <button
      type="button"
      onClick={click}
      data-try-new-layout=""
      className="flex items-center gap-[6px] shrink-0 h-[32px] px-[10px] rounded-[8px] text-[13px] font-[500] whitespace-nowrap ring-1 ring-newBorder hover:text-newTextColor hover:bg-boxFocused"
    >
      <svg
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <line x1="9" y1="4" x2="9" y2="20" />
      </svg>
      <span>{label}</span>
    </button>
  );
};
