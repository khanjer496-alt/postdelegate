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
jest.mock('@gitroom/react/helpers/image.with.fallback', () => () => null);
jest.mock('@gitroom/react/toaster/toaster', () => ({
  useToaster: () => ({ show: () => undefined }),
}));
jest.mock(
  '@gitroom/frontend/components/platform-analytics/analytics.top.posts',
  () => ({ TopPostsTable: () => null })
);

import { ChannelFollowerTrend } from './analytics.trends';
import { ViewsSection } from './analytics.views';

const mockFetch = jest.fn();
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

async function show(node: React.ReactElement) {
  await act(async () => {
    root.render(
      React.createElement(
        SWRConfig,
        { value: { provider: () => new Map(), dedupingInterval: 0 } },
        node
      )
    );
  });
  await act(async () => {
    await Promise.resolve();
  });
}

it('keeps the first-snapshot follower sentence when no daily snapshot exists', async () => {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      collecting: true,
      from: '2026-11-03',
      to: '2026-11-09',
      firstSnapshot: null,
      comparison: [],
      followers: { dates: [], total: [], channels: [] },
    }),
  });
  await show(React.createElement(ChannelFollowerTrend, { days: 7, integration: 'synthetic-id' }));
  expect(container.textContent).toContain('Collecting data from today');
  expect(container.textContent).toContain(
    'follower history starts with its first daily snapshot'
  );
  expect(container.textContent).toContain('Check back tomorrow.');
  expect(container.textContent).not.toContain('SYNTHETIC_TOKEN');
});

it('keeps the collecting sentence for a channel with no view snapshot yet', async () => {
  mockFetch.mockImplementation(async (path: string) => ({
    ok: true,
    json: async () =>
      String(path).includes('/posts')
        ? { days: 7, posts: [], unavailable: 0, partial: false }
        : {
            days: 7,
            from: '2026-11-03',
            to: '2026-11-09',
            dates: [],
            total: [],
            totalViews: null,
            bestDay: null,
            partial: false,
            channels: [
              {
                id: 'channel-1',
                name: 'Example',
                picture: null,
                identifier: 'instagram-standalone',
                status: 'collecting',
                source: null,
                points: [],
                total: null,
                bestDay: null,
              },
            ],
          },
  }));
  await show(React.createElement(ViewsSection, { days: 7 }));
  expect(container.textContent).toContain(
    'Collecting: gains show after two daily snapshots of its posts.'
  );
  expect(container.textContent).not.toContain('SYNTHETIC_TOKEN');
});
