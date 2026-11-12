'use client';
import { FC, useEffect } from 'react';
import { useTranslationSettings } from '@gitroom/react/translation/get.transation.service.client';
import { normalizeLanguage } from '@gitroom/react/translation/i18n.config';

export const HtmlComponent: FC = () => {
  const settings = useTranslationSettings();
  useEffect(() => {
    const updateLanguage = () => {
      const html = document.documentElement;
      const language = normalizeLanguage(
        settings.resolvedLanguage || settings.language || html.lang
      );
      html.setAttribute('lang', language);
      html.setAttribute('dir', settings.dir(language));
    };
    updateLanguage();
    settings.on('languageChanged', updateLanguage);
    settings.on('initialized', updateLanguage);
    return () => {
      settings.off('languageChanged', updateLanguage);
      settings.off('initialized', updateLanguage);
    };
  }, [settings]);

  // text fields show the focus ring only while the keyboard is in use (global.scss)
  useEffect(() => {
    const html = document.documentElement;
    const keyboard = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        html.setAttribute('data-keyboard', '');
      }
    };
    const pointer = () => html.removeAttribute('data-keyboard');
    document.addEventListener('keydown', keyboard, true);
    document.addEventListener('pointerdown', pointer, true);
    return () => {
      document.removeEventListener('keydown', keyboard, true);
      document.removeEventListener('pointerdown', pointer, true);
    };
  }, []);

  return null;
};
