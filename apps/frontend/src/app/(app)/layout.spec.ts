import AppLayout from './layout';

let mockLanguage: string | undefined;
jest.mock('next/headers', () => ({
  cookies: async () => ({ get: () => ({ value: mockLanguage }) }),
}));
jest.mock('../global.scss', () => ({}));
jest.mock('react-tooltip/dist/react-tooltip.css', () => ({}));
jest.mock('@copilotkit/react-ui/styles.css', () => ({}));
jest.mock(
  '@gitroom/frontend/fonts/plus-jakarta-sans/plus.jakarta.sans.font',
  () => ({ jakartaSans: { className: '', variable: '' } })
);
jest.mock('@gitroom/frontend/components/layout/sentry.component', () => ({
  SentryComponent: () => null,
}));
jest.mock('@gitroom/frontend/components/layout/layout.context', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@gitroom/react/helpers/variable.context', () => ({
  VariableContextComponent: () => null,
}));
jest.mock('@gitroom/helpers/utils/utm.saver', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@gitroom/frontend/components/layout/affiliate.saver', () => ({
  AffiliateSaver: () => null,
}));
jest.mock('@gitroom/frontend/components/layout/dubAnalytics', () => ({
  DubAnalytics: () => null,
}));
jest.mock('@gitroom/frontend/components/layout/facebook.component', () => ({
  FacebookComponent: () => null,
}));
jest.mock('@gitroom/frontend/components/layout/gtm.component', () => ({
  GoogleTagManagerComponent: () => null,
}));
jest.mock('@gitroom/frontend/components/layout/analytics.scripts', () => ({
  ConsentPlausible: () => null,
  DataFastScript: () => null,
}));
jest.mock('@gitroom/frontend/components/layout/cookie.consent', () => ({
  CookieConsent: () => null,
}));
jest.mock('@gitroom/frontend/components/layout/html.component', () => ({
  HtmlComponent: () => null,
}));
jest.mock(
  '@gitroom/frontend/components/layout/service.worker.component',
  () => ({ ServiceWorkerComponent: () => null })
);
jest.mock('@gitroom/frontend/components/new-layout/change.dir.client', () => ({
  ChangeDirClient: () => null,
}));

it.each([
  [undefined, 'en', 'ltr'],
  ['ar-SA', 'ar', 'rtl'],
  ['fr', 'fr', 'ltr'],
  ['invalid', 'en', 'ltr'],
])(
  'sets server HTML attributes from i18next cookie %s',
  async (cookie, language, direction) => {
    mockLanguage = cookie;
    const html = await AppLayout({ children: null });
    expect(html.type).toBe('html');
    expect(html.props.lang).toBe(language);
    expect(html.props.dir).toBe(direction);
  }
);
