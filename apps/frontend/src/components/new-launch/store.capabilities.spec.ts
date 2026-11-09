jest.mock('@gitroom/frontend/components/layout/set.timezone', () => ({ newDayjs: () => require('dayjs')() }));
import { useLaunchStore } from './store';

const entries = [
  { id: 'saved-root', content: 'Original post', delay: 0, media: [{ id: 'image-1', path: 'https://example.test/original.jpg' }] },
  { id: 'saved-reply', content: 'Original reply', delay: 120, media: [{ id: 'image-2', path: 'https://example.test/reply.jpg' }] },
];
beforeEach(() => useLaunchStore.setState({
  current: 'channel-1', comments: true,
  selectedIntegrations: [{ integration: { id: 'channel-1', commentsAvailable: false }, settings: {} }] as any,
  global: [], internal: [{ integration: { id: 'channel-1' }, integrationValue: structuredClone(entries) }] as any,
}));
it('preserves every saved entry, media, ID and delay when replies become unavailable', () => {
  const before = structuredClone(useLaunchStore.getState().internal);
  useLaunchStore.getState().setComments(true);
  expect(useLaunchStore.getState().comments).toBe(true);
  expect((useLaunchStore.getState() as any).canAddComments).toBe(false);
  expect(useLaunchStore.getState().internal).toEqual(before);
});
it('does not offer new replies on a single-entry unavailable channel', () => {
  useLaunchStore.setState({ internal: [{ integration: { id: 'channel-1' }, integrationValue: [entries[0]] }] as any });
  useLaunchStore.getState().setComments(true);
  expect(useLaunchStore.getState().comments).toBe(false);
  expect((useLaunchStore.getState() as any).canAddComments).toBe(false);
});
it('keeps global saved content visible while blocking new replies for an unavailable selection', () => {
  useLaunchStore.setState({ current: 'global', global: structuredClone(entries) });
  useLaunchStore.getState().setComments(true);
  expect(useLaunchStore.getState().comments).toBe(true);
  expect((useLaunchStore.getState() as any).canAddComments).toBe(false);
  expect(useLaunchStore.getState().global).toEqual(entries);
});
it('restores ordinary reply creation for an available channel', () => {
  useLaunchStore.setState({ selectedIntegrations: [{ integration: { id: 'channel-1', commentsAvailable: true }, settings: {} }] as any });
  useLaunchStore.getState().setComments('no-media');
  expect(useLaunchStore.getState().comments).toBe('no-media');
  expect((useLaunchStore.getState() as any).canAddComments).toBe(true);
});

it.each([true, false])('does not reinterpret a provider with no native replies as a thread when flag availability is %s', commentsAvailable => {
  useLaunchStore.setState({ selectedIntegrations: [{ integration: { id: 'channel-1', commentsAvailable }, settings: {} }] as any });
  const before = structuredClone(useLaunchStore.getState().internal);
  useLaunchStore.getState().setComments(false);
  expect(useLaunchStore.getState().comments).toBe(false);
  expect(useLaunchStore.getState().canAddComments).toBe(false);
  expect(useLaunchStore.getState().internal).toEqual(before);
});

it('preserves a reply-capable provider no-media restriction when optional reply availability is off', () => {
  useLaunchStore.getState().setComments('no-media');
  expect(useLaunchStore.getState().comments).toBe('no-media');
  expect(useLaunchStore.getState().canAddComments).toBe(false);
  expect(useLaunchStore.getState().internal[0].integrationValue).toEqual(entries);
});
