import '../../../../../../test/dom';
import React from 'react';
import { fireEvent, render } from '@testing-library/react';

jest.mock('@gitroom/react/translation/get.transation.service.client', () => ({
  useT: () => (_key: string, fallback: string) => fallback,
}));
const mockIsUiV2Request = jest.fn();
jest.mock('@gitroom/frontend/components/new-layout/v2/ui.flag.server', () => ({
  isUiV2Request: () => mockIsUiV2Request(),
}));
jest.mock('@gitroom/frontend/components/new-layout/layout.component', () => ({
  LayoutComponent: () => null,
}));
jest.mock(
  '@gitroom/frontend/components/new-layout/v2/layout.v2.component',
  () => ({ LayoutComponentV2: () => null })
);
jest.mock('@gitroom/frontend/components/features/feature.flags.server', () => ({
  readFeatureFlags: async () => ({ smartlinks: true }),
}));

import { switchToNewLayout, TryNewLayoutButton } from './try.new.layout';
import { LayoutComponent } from '@gitroom/frontend/components/new-layout/layout.component';
import { LayoutComponentV2 } from '@gitroom/frontend/components/new-layout/v2/layout.v2.component';
import { FeatureFlagsProvider } from '@gitroom/frontend/components/features/feature.flags.client';
import Layout from '../../../app/(app)/(site)/layout';

describe('TryNewLayoutButton', () => {
  it('shows the label and switches on click', () => {
    const onSwitch = jest.fn();
    const { getByRole } = render(
      React.createElement(TryNewLayoutButton, { onSwitch })
    );
    const button = getByRole('button', { name: 'Try the new layout' });
    expect(button.textContent).not.toMatch(/postiz/i);
    fireEvent.click(button);
    expect(onSwitch).toHaveBeenCalledTimes(1);
  });

  it('sets pd_ui=v2 and reloads', () => {
    const reload = jest.fn();
    const realWindow = globalThis.window;
    (globalThis as any).window = { location: { reload } };
    try {
      switchToNewLayout();
    } finally {
      (globalThis as any).window = realWindow;
    }
    expect(document.cookie).toContain('pd_ui=v2');
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe('site layout passes canTryNewLayout to the classic layout', () => {
  const previous = process.env.PD_UI_V2;
  afterEach(() => {
    if (previous === undefined) delete process.env.PD_UI_V2;
    else process.env.PD_UI_V2 = previous;
  });

  it.each([
    [undefined, false],
    ['off', false],
    ['optin', true],
    ['on', true],
  ])('PD_UI_V2=%s -> %s', async (mode, expected) => {
    if (mode === undefined) delete process.env.PD_UI_V2;
    else process.env.PD_UI_V2 = mode;
    mockIsUiV2Request.mockResolvedValue(false);
    const el = (await Layout({ children: 'x' })) as React.ReactElement<any>;
    expect(el.type).toBe(LayoutComponent);
    expect(el.props).toEqual({ canTryNewLayout: expected, children: 'x' });
  });

  it('renders the new layout without the prop when v2 applies', async () => {
    process.env.PD_UI_V2 = 'on';
    mockIsUiV2Request.mockResolvedValue(true);
    const el = (await Layout({ children: 'x' })) as React.ReactElement<any>;
    // the parity feature flags wrap the new layout only
    expect(el.type).toBe(FeatureFlagsProvider);
    expect(el.props.flags).toEqual({ smartlinks: true });
    const shell = el.props.children as React.ReactElement<any>;
    expect(shell.type).toBe(LayoutComponentV2);
    expect(shell.props).toEqual({ children: 'x' });
  });
});
