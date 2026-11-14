import '../../../../test/dom';
import React from 'react';
import { render } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Input } from './input';

jest.mock('../translation/translated-label', () => ({
  TranslatedLabel: ({ label }: any) => label,
}));
const config = require('../../../../apps/frontend/tailwind.config.cjs');
const stylesheet = readFileSync(
  resolve(__dirname, '../../../../apps/frontend/src/app/colors.scss'),
  'utf8'
);
const luminance = (hex: string) => {
  const channels = hex
    .slice(1)
    .match(/../g)!
    .map((channel) => {
      const value = parseInt(channel, 16) / 255;
      return value <= 0.04045
        ? value / 12.92
        : Math.pow((value + 0.055) / 1.055, 2.4);
    });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};
const Field = () => {
  const form = useForm();
  return React.createElement(FormProvider, {
    ...form,
    children: React.createElement(Input, { name: 'email', label: 'Email' }),
  });
};

it.each(['dark', 'light'])(
  'gives the input boundary at least 3:1 contrast in %s mode',
  (theme) => {
    const { getByLabelText } = render(React.createElement(Field));
    const wrapper = getByLabelText('Email').parentElement!;
    const borderClass = wrapper.className.match(/\bborder-(new\w+)/)![1];
    const variable =
      config.theme.extend.colors[borderClass].match(/var\(([^)]+)\)/)[1];
    const palette = stylesheet.match(
      new RegExp(`\\.${theme}\\s*\\{([\\s\\S]*?)\\n  \\}`)
    )![1];
    const color = (name: string) =>
      palette.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`))![1];
    const border = luminance(color(variable));
    for (const background of ['--new-bgColor', '--new-bgColorInner']) {
      const fill = luminance(color(background));
      expect(
        (Math.max(border, fill) + 0.05) / (Math.min(border, fill) + 0.05)
      ).toBeGreaterThanOrEqual(3);
    }
  }
);
