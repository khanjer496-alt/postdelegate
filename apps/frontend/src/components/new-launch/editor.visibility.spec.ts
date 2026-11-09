import '../../../../../test/dom';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
jest.mock('@gitroom/frontend/components/layout/set.timezone', () => ({
  newDayjs: () => require('dayjs')(),
}));
jest.mock('@gitroom/react/translation/get.transation.service.client', () => ({
  useT: () => (_key: string, text: string) => text,
}));
jest.mock('@gitroom/helpers/utils/custom.fetch', () => ({
  useFetch: () => jest.fn(),
}));
jest.mock('@gitroom/react/toaster/toaster', () => ({
  useToaster: () => ({ show: jest.fn() }),
}));
jest.mock(
  '@gitroom/frontend/components/launches/helpers/use.existing.data',
  () => ({ useExistingData: () => ({ integration: 'channel-1' }) })
);
jest.mock('@copilotkit/react-core', () => ({
  useCopilotAction: () => {},
  useCopilotReadable: () => {},
}));
jest.mock('react-dropzone', () => ({
  useDropzone: () => ({ getRootProps: () => ({}), isDragActive: false }),
}));
jest.mock('@gitroom/frontend/components/media/new.uploader', () => ({
  useUppyUploader: () => ({}),
  UploadProcessing: () => null,
}));
jest.mock('@uppy/react', () => ({ Dashboard: () => null }));
jest.mock('emoji-picker-react', () => ({
  __esModule: true,
  default: () => null,
  Theme: {},
}));
jest.mock('@tiptap/react', () => ({
  Extension: { create: () => ({}) },
  Node: { create: () => ({}) },
  mergeAttributes: () => ({}),
  useEditor: (options: any) => ({ options }),
  EditorContent: ({ editor }: any) =>
    React.createElement('div', {}, editor.options.content),
}));
jest.mock('@tiptap/extensions', () => ({
  Placeholder: { configure: () => ({}) },
  Dropcursor: { configure: () => ({}) },
  TrailingNode: {},
}));
jest.mock('@tiptap/pm/model', () => ({}));
jest.mock('@tiptap/extension-list', () => ({ BulletList: {}, ListItem: {} }));
jest.mock('@tiptap/extension-history', () => ({
  History: { configure: () => ({}) },
}));
jest.mock('@tiptap/extension-link', () => ({
  __esModule: true,
  default: { configure: () => ({}) },
}));
jest.mock('@tiptap/extension-document', () => ({
  __esModule: true,
  default: { configure: () => ({}) },
}));
jest.mock('@tiptap/extension-bold', () => ({
  __esModule: true,
  default: { configure: () => ({}) },
}));
jest.mock('@tiptap/extension-text', () => ({
  __esModule: true,
  default: { configure: () => ({}) },
}));
jest.mock('@tiptap/extension-paragraph', () => ({
  __esModule: true,
  default: { configure: () => ({}) },
}));
jest.mock('@tiptap/extension-underline', () => ({
  __esModule: true,
  default: { configure: () => ({}) },
}));
jest.mock('@tiptap/extension-heading', () => ({
  __esModule: true,
  default: { configure: () => ({}) },
}));
jest.mock('@tiptap/extension-mention', () => ({
  __esModule: true,
  default: { configure: () => ({}) },
}));
jest.mock('@gitroom/frontend/components/new-launch/bold.text', () => ({
  BoldText: () => null,
}));
jest.mock('@gitroom/frontend/components/new-launch/u.text', () => ({
  UText: () => null,
}));
jest.mock('@gitroom/frontend/components/signature', () => ({
  SignatureBox: () => null,
}));
jest.mock(
  '@gitroom/frontend/components/new-launch/templates.component',
  () => ({ TemplatesBox: () => null })
);
jest.mock('@gitroom/frontend/components/media/media.component', () => ({
  MultiMediaComponent: () => null,
}));
jest.mock('@gitroom/frontend/components/launches/up.down.arrow', () => ({
  UpDownArrow: () => null,
}));
jest.mock('@gitroom/frontend/components/new-launch/bullets.component', () => ({
  Bullets: () => null,
}));
jest.mock('@gitroom/frontend/components/new-launch/heading.component', () => ({
  HeadingComponent: () => null,
}));
jest.mock('@gitroom/frontend/components/new-launch/a.component', () => ({
  AComponent: () => null,
}));
jest.mock(
  '@gitroom/frontend/components/launches/information.component',
  () => ({ InformationComponent: () => null })
);
jest.mock('@gitroom/frontend/components/new-launch/delay.component', () => ({
  DelayComponent: () => null,
}));
jest.mock('@gitroom/frontend/components/ui/icons', () => ({
  LockIcon: () => null,
  ConnectionLineIcon: () => null,
  ResetIcon: () => null,
  TrashIcon: () => null,
  EmojiIcon: () => null,
  DelayIcon: () => null,
}));
jest.mock('@gitroom/frontend/components/new-launch/mention.component', () => ({
  suggestion: () => ({}),
}));

jest.mock('@gitroom/react/helpers/delete.dialog', () => ({
  deleteDialog: jest.fn(),
}));
import { EditorWrapper } from './editor';
import { useLaunchStore } from './store';
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: window.localStorage,
});
const entries = [
  { id: 'root', content: 'First post', media: [], delay: 0 },
  {
    id: 'reply',
    content: 'Saved second post',
    media: [{ id: 'image', path: 'https://example.test/image.jpg' }],
    delay: 120,
  },
];
beforeEach(() =>
  useLaunchStore.setState({
    loaded: true,
    current: 'channel-1',
    editor: 'none',
    isCreateSet: false,
    selectedIntegrations: [
      {
        integration: { id: 'channel-1', commentsAvailable: true },
        settings: {},
      },
    ] as any,
    internal: [
      {
        integration: { id: 'channel-1' },
        integrationValue: structuredClone(entries),
      },
    ] as any,
    global: structuredClone(entries),
  })
);
afterEach(() => cleanup());
function cards(container: HTMLElement) {
  const root = container.firstElementChild!;
  return Array.from(container.querySelectorAll('.flat-editor')).map(
    (editor) => {
      let card = editor;
      while (card.parentElement && card.parentElement !== root)
        card = card.parentElement;
      return card;
    }
  );
}
it.each([true, false])(
  'keeps native non-reply channels on their first entry when optional availability is %s',
  (commentsAvailable) => {
    useLaunchStore.setState({
      selectedIntegrations: [
        { integration: { id: 'channel-1', commentsAvailable }, settings: {} },
      ] as any,
    });
    useLaunchStore.getState().setComments(false);
    const view = render(
      React.createElement(EditorWrapper, { totalPosts: 2, value: '' })
    );
    const rows = cards(view.container);
    expect(rows).toHaveLength(2);
    expect(rows[0].classList.contains('hidden')).toBe(false);
    expect(rows[1].classList.contains('hidden')).toBe(true);
    expect(useLaunchStore.getState().internal[0].integrationValue).toEqual(
      entries
    );
  }
);
it('keeps saved replies editable when a reply-capable channel only loses optional availability', () => {
  useLaunchStore.setState({
    selectedIntegrations: [
      {
        integration: { id: 'channel-1', commentsAvailable: false },
        settings: {},
      },
    ] as any,
  });
  useLaunchStore.getState().setComments(true);
  const view = render(
    React.createElement(EditorWrapper, { totalPosts: 2, value: '' })
  );
  expect(
    cards(view.container).every((row) => !row.classList.contains('hidden'))
  ).toBe(true);
  expect(view.getByRole('status').textContent).toContain(
    'saved entries remain editable'
  );
  expect(view.queryByText('Add comment or post')).toBeNull();
  expect(useLaunchStore.getState().internal[0].integrationValue).toEqual(
    entries
  );
});
it('shows only one inherited entry behind the customize overlay', () => {
  useLaunchStore.setState({ internal: [] });
  useLaunchStore.getState().setComments(true);
  const view = render(
    React.createElement(EditorWrapper, { totalPosts: 2, value: '' })
  );
  expect(view.getByText('Edit content')).toBeTruthy();
  expect(cards(view.container)[1].classList.contains('hidden')).toBe(true);
  expect(useLaunchStore.getState().global).toEqual(entries);
});
it('keeps every global entry visible for shared editing', () => {
  useLaunchStore.setState({ current: 'global', internal: [] });
  useLaunchStore.getState().setComments(true);
  const view = render(
    React.createElement(EditorWrapper, { totalPosts: 2, value: '' })
  );
  expect(
    cards(view.container).every((row) => !row.classList.contains('hidden'))
  ).toBe(true);
});
