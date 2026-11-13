/** @jest-environment node */
import React from 'react';
jest.mock('canvas', () => null);
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<html><body></body></html>', { url: 'https://example.test' });
Object.defineProperties(globalThis, {
  window: { configurable: true, value: dom.window }, document: { configurable: true, value: dom.window.document },
  navigator: { configurable: true, value: dom.window.navigator }, HTMLElement: { configurable: true, value: dom.window.HTMLElement },
});
const { render, cleanup } = require('@testing-library/react');
jest.mock('@gitroom/react/translation/get.transation.service.client', () => ({ useT: () => (_key: string, text: string) => text }));
jest.mock('@gitroom/frontend/components/layout/set.timezone', () => ({ newDayjs: () => require('dayjs')() }));
import { CompositionCapabilityNotice } from './composition.capability.notice';
import { AddPostButton } from './add.post.button';
import { useLaunchStore } from './store';
import { PostComment } from './providers/post-comment.enum';
afterEach(() => cleanup());
afterAll(() => dom.window.close());
it('shows a clear unavailable-feature notice without saying saved content is lost', () => {
  const view = render(React.createElement(CompositionCapabilityNotice, { commentsUnavailable: true, analyticsUnavailable: true }));
  expect(view.getByRole('status').textContent).toContain('Analytics are off');
  expect(view.getByRole('status').textContent).toContain('saved entries remain editable');
});
it('does not show a feature warning when the selection supports it', () => {
  const view = render(React.createElement(CompositionCapabilityNotice, { commentsUnavailable: false, analyticsUnavailable: false }));
  expect(view.queryByRole('status')).toBe(null);
});
it('hides new reply creation while saved entries remain present', () => {
  useLaunchStore.setState({ comments: true, canAddComments: false });
  const view = render(React.createElement(AddPostButton, { onClick: jest.fn(), num: 1, postComment: PostComment.COMMENT }));
  expect(view.queryByText('Add comment')).toBe(null);
});
it('offers reply creation again when permission is available', () => {
  useLaunchStore.setState({ comments: true, canAddComments: true });
  const view = render(React.createElement(AddPostButton, { onClick: jest.fn(), num: 1, postComment: PostComment.COMMENT }));
  expect(view.getByText('Add comment')).toBeTruthy();
});
