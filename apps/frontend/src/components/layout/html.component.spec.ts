import '../../../../../test/dom';
import React from 'react';
import { act, render } from '@testing-library/react';
import { HtmlComponent } from './html.component';

const mockListeners = new Set<() => void>();
const mockSettings = {
  resolvedLanguage: undefined as string | undefined,
  language: undefined as string | undefined,
  dir: (language = mockSettings.resolvedLanguage || 'en') =>
    language.startsWith('ar') ? 'rtl' : 'ltr',
  on: (_event: string, callback: () => void) => mockListeners.add(callback),
  off: (_event: string, callback: () => void) => mockListeners.delete(callback),
};
jest.mock('@gitroom/react/translation/get.transation.service.client', () => ({
  useTranslationSettings: () => mockSettings,
}));

beforeEach(() => {
  document.documentElement.removeAttribute('lang');
  document.documentElement.removeAttribute('dir');
  mockSettings.resolvedLanguage = undefined;
  mockSettings.language = undefined;
  mockListeners.clear();
});

it.each([
  ['en', 'en', 'ltr'],
  ['ar-SA', 'ar', 'rtl'],
  ['fr', 'fr', 'ltr'],
  [undefined, 'en', 'ltr'],
])('sets lang and direction for %s', (language, lang, dir) => {
  mockSettings.resolvedLanguage = language;
  const { unmount } = render(React.createElement(HtmlComponent));
  expect(document.documentElement.lang).toBe(lang);
  expect(document.documentElement.dir).toBe(dir);
  unmount();
  expect(mockListeners.size).toBe(0);
});

it('updates both attributes when i18next changes language', () => {
  mockSettings.resolvedLanguage = 'en';
  const { unmount } = render(React.createElement(HtmlComponent));
  act(() => {
    mockSettings.resolvedLanguage = 'ar';
    mockListeners.forEach((callback) => callback());
  });
  expect(document.documentElement.lang).toBe('ar');
  expect(document.documentElement.dir).toBe('rtl');
  act(() => {
    mockSettings.resolvedLanguage = 'fr';
    mockListeners.forEach((callback) => callback());
  });
  expect(document.documentElement.lang).toBe('fr');
  expect(document.documentElement.dir).toBe('ltr');
  unmount();
});
