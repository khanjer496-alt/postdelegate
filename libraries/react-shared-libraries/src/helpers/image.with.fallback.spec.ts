import '../../../../test/dom';
import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import ImageWithFallback from './image.with.fallback';

it('replaces a failed channel avatar with the fallback image', () => {
  const { getByAltText, rerender } = render(
    React.createElement(ImageWithFallback, {
      src: '/missing-avatar.png',
      fallbackSrc: '/no-picture.jpg',
      alt: 'nostr',
      width: 36,
      height: 36,
    })
  );
  const image = getByAltText('nostr');
  fireEvent.error(image);
  expect(image.getAttribute('src')).toBe('/no-picture.jpg');
  rerender(
    React.createElement(ImageWithFallback, {
      src: '/new-avatar.png',
      fallbackSrc: '/no-picture.jpg',
      alt: 'nostr',
      width: 36,
      height: 36,
    })
  );
  expect(image.getAttribute('src')).toBe('/new-avatar.png');
});
