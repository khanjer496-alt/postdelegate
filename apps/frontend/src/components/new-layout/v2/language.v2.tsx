'use client';

import { FC, useCallback, useRef, useState } from 'react';
import clsx from 'clsx';
import i18next from 'i18next';
import useCookie from 'react-use-cookie';
import { useClickOutside } from '@mantine/hooks';
import {
  cookieName,
  fallbackLng,
  languages,
  normalizeLanguage,
} from '@gitroom/react/translation/i18n.config';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { Icon } from './icons.v2';

// each language named in its own script
const nativeName = (code: string) => {
  try {
    const name = new Intl.DisplayNames([code], { type: 'language' }).of(code) || code;
    return name.charAt(0).toLocaleUpperCase(code) + name.slice(1);
  } catch {
    return code;
  }
};

// A text language menu for the v2 top bar. Switches the language the same
// way as the classic picker: the i18next cookie, i18next and the page
// direction.
export const LanguageMenuV2: FC = () => {
  const t = useT();
  const current = normalizeLanguage(i18next.resolvedLanguage);
  const [, setCookie] = useCookie(cookieName, current || fallbackLng);
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false));

  const change = useCallback(
    (language: string) => {
      const next = normalizeLanguage(language);
      setCookie(next);
      i18next.changeLanguage(next);
      document.documentElement.setAttribute('dir', next === 'ar' ? 'rtl' : 'ltr');
      setOpen(false);
      buttonRef.current?.focus();
    },
    [setCookie]
  );

  return (
    <div
      ref={ref}
      className="relative"
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
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`${t('change_language', 'Change Language')}: ${nativeName(current)}`}
        title={t('change_language', 'Change Language')}
        className="flex items-center gap-[5px] h-[32px] px-[8px] rounded-[8px] text-textItemBlur hover:text-newTextColor hover:bg-pdSurface2 outline-none focus-visible:ring-2 focus-visible:ring-btnPrimary"
      >
        <Icon name="languages" size={18} />
        <span className="text-[11.5px] font-[700] uppercase tracking-[0.04em]">{current}</span>
      </button>
      {open && (
        <div
          role="menu"
          aria-label={t('change_language', 'Change Language')}
          className="absolute top-[calc(100%+6px)] end-0 z-[400] w-[200px] max-h-[360px] overflow-y-auto p-[6px] rounded-[12px] bg-newBgColorInner ring-1 ring-pdLine2 shadow-menu"
        >
          {languages.map((language) => (
            <button
              key={language}
              type="button"
              role="menuitemradio"
              aria-checked={language === current}
              lang={language}
              onClick={() => change(language)}
              className={clsx(
                'flex items-center w-full h-[34px] px-[10px] rounded-[8px] text-[13px] text-start hover:bg-pdSurface2',
                language === current && 'text-newTextColor font-[600]'
              )}
            >
              <span className="flex-1 truncate">{nativeName(language)}</span>
              <span className="text-[10.5px] uppercase text-pdInk3 me-[6px]">{language}</span>
              <span className={clsx('w-[14px]', language === current ? 'text-[#b39aff]' : 'invisible')}>
                <Icon name="check" size={14} />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
