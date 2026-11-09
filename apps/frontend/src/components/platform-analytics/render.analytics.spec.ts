import '../../../../../test/dom';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { SWRConfig } from 'swr';

jest.mock('@gitroom/helpers/utils/custom.fetch', () => ({
  useFetch: () => mockFetch,
}));
jest.mock('@gitroom/react/translation/get.transation.service.client', () => ({
  useT: () => (_key: string, text: string) => text,
}));
jest.mock('@gitroom/frontend/components/analytics/chart-social', () => ({
  ChartSocial: () => null,
}));
jest.mock('@gitroom/frontend/components/layout/loading', () => ({
  LoadingComponent: () => 'Loading',
}));
jest.mock(
  '@gitroom/frontend/components/platform-analytics/recent.posts',
  () => ({ RecentPosts: () => null })
);

import { RenderAnalytics } from './render.analytics';

const mockFetch = jest.fn();
const integration = {
  id: 'synthetic-id',
  identifier: 'instagram-standalone',
} as any;
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  mockFetch.mockReset();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function render() {
  await act(async () => {
    root.render(
      React.createElement(
        SWRConfig,
        {
          value: {
            provider: () => new Map(),
            shouldRetryOnError: false,
            dedupingInterval: 0,
          },
        },
        React.createElement(RenderAnalytics, { integration, date: 7 })
      )
    );
  });
}

it.each(['http', 'network', 'malformed', 'json'])(
  'shows a curated unavailable state for %s failure, never empty-data or raw text',
  async (failure) => {
    if (failure === 'network')
      mockFetch.mockRejectedValue(new Error('SYNTHETIC_SECRET'));
    else
      mockFetch.mockResolvedValue({
        ok: failure !== 'http',
        json: async () => {
          if (failure === 'json') throw new Error('SYNTHETIC_SECRET');
          return { message: 'SYNTHETIC_SECRET' };
        },
      });
    await render();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      'Analytics are temporarily unavailable. Try again later.'
    );
    expect(container.textContent).not.toContain('SYNTHETIC_SECRET');
    expect(container.textContent).not.toContain('Refresh Channel');
    expect(container.textContent).not.toContain('Loading');
  }
);

it('renders successful partial metric data', async () => {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => [
      { label: 'Likes', data: [{ total: 2, date: '2026-11-09' }] },
    ],
  });
  await render();
  expect(container.textContent).toContain('Likes');
  expect(container.textContent).toContain('2');
  expect(container.querySelector('[role="alert"]')).toBeNull();
});

it('keeps the existing successful empty-data state', async () => {
  mockFetch.mockResolvedValue({ ok: true, json: async () => [] });
  await render();
  expect(container.textContent).toContain('Refresh Channel');
  expect(container.querySelector('[role="alert"]')).toBeNull();
});
