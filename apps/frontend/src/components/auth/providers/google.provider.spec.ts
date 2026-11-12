import '../../../../../../test/dom';
import React from 'react';
import { render } from '@testing-library/react';
import { GoogleProvider } from './google.provider';

jest.mock('@gitroom/helpers/utils/custom.fetch', () => ({
  useFetch: () => jest.fn(),
}));
jest.mock('@gitroom/react/toaster/toaster', () => ({
  useToaster: () => ({ show: jest.fn() }),
}));
jest.mock('@gitroom/react/translation/get.transation.service.client', () => ({
  useT: () => (_key: string, text: string) => text,
}));

it('keeps the complete visible Google action at every breakpoint', () => {
  const { getByRole } = render(React.createElement(GoogleProvider));
  const button = getByRole('button', { name: 'Continue with Google' });
  expect(button.textContent).toBe('Continue with Google');
  for (const element of [button, ...button.querySelectorAll('*')]) {
    expect(element.getAttribute('class') || '').not.toMatch(
      /(?:^|\s)(?:[\w-]+:)?hidden(?:\s|$)/
    );
  }
});
