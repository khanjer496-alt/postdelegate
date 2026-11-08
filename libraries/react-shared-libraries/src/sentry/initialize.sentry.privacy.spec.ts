jest.mock('@sentry/nextjs', () => ({
  defaultStackParser: () => [],
  init: jest.fn(),
  getClient: () => undefined,
  getReplay: jest.fn(() => ({ stop: jest.fn(async () => {}) })),
  consoleLoggingIntegration: () => ({}),
  browserTracingIntegration: () => ({}),
  browserProfilingIntegration: () => ({}),
  replayIntegration: jest.fn(() => ({})),
  feedbackIntegration: () => ({}),
}));
import * as Sentry from '@sentry/nextjs';
import { initializeSentryBasic } from './initialize.sentry.next.basic';
import { initializeSentryClient } from './initialize.sentry.client';

const raw =
  'https://app.postdelegate.test/integrations/social/nostr?code=EXAMPLE-secret&state=nonce#access_token=EXAMPLE-secret';
const clean = 'https://app.postdelegate.test/integrations/social/nostr';
const options = () => {
  initializeSentryBasic('test', 'https://public@example.test/1', {});
  return (Sentry.init as jest.Mock).mock.calls.slice(-1)[0][0];
};
afterEach(() => jest.clearAllMocks());
it('scrubs error URLs, breadcrumbs, nested context and POST credentials without changing the original event', () => {
  const event = {
    request: {
      url: raw,
      query_string: 'code=EXAMPLE-secret',
      data: { code: 'EXAMPLE-secret' },
      headers: { Cookie: 'EXAMPLE-secret', Referer: raw },
    },
    breadcrumbs: [
      {
        data: {
          from: raw,
          to: '/integrations/social/nostr?code=EXAMPLE-secret',
        },
      },
    ],
    extra: {
      code: 'EXAMPLE-secret',
      password: 'EXAMPLE-secret',
      safe: 'still useful',
    },
    exception: { values: [{ value: `Failed request ${raw}` }] },
  };
  const result = options().beforeSend(event, {});
  expect(JSON.stringify(result)).not.toContain('EXAMPLE-secret');
  expect(result.request.url).toBe(clean);
  expect(result.extra.safe).toBe('still useful');
  expect(event.request.url).toBe(raw);
});
it('scrubs performance transactions, spans, logs and navigation breadcrumbs independently of beforeSend', () => {
  const init = options();
  for (const hook of [
    'beforeSendTransaction',
    'beforeSendSpan',
    'beforeSendLog',
    'beforeBreadcrumb',
  ]) {
    expect(init[hook]).toEqual(expect.any(Function));
    const result = init[hook]({
      name: raw,
      data: { url: raw },
      attributes: {
        'url.full': raw,
        'url.query': 'code=EXAMPLE-secret',
        'url.fragment': 'token=EXAMPLE-secret',
      },
      message: raw,
    });
    expect(JSON.stringify(result)).not.toContain('EXAMPLE-secret');
  }
});
it('scrubs replay custom navigation/network events and explicitly disables request-body capture', () => {
  initializeSentryClient('test', 'https://public@example.test/1');
  const replay = (Sentry.replayIntegration as jest.Mock).mock.calls[0][0];
  expect(replay.networkCaptureBodies).toBe(false);
  expect(replay.beforeAddRecordingEvent).toEqual(expect.any(Function));
  expect(
    JSON.stringify(
      replay.beforeAddRecordingEvent({
        data: {
          payload: {
            description: raw,
            data: { url: raw, request: { body: 'EXAMPLE-secret' } },
          },
        },
      })
    )
  ).not.toContain('EXAMPLE-secret');
});

it('does not initialize telemetry on callback/auth pages and discards any existing replay buffer', () => {
  const replay = { stop: jest.fn(async () => {}) };
  (Sentry.getReplay as jest.Mock).mockReturnValue(replay);
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { location: { pathname: '/integrations/social/nostr' } },
  });
  try {
    initializeSentryClient('test', 'https://public@example.test/1');
    expect(Sentry.init).not.toHaveBeenCalled();
    expect(replay.stop).toHaveBeenCalledWith({ flush: false });
  } finally {
    delete (globalThis as any).window;
  }
});
