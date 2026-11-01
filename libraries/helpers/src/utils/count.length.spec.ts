import { countLength, textSlicer } from '@gitroom/helpers/utils/count.length';

describe('countLength', () => {
  const text = 'Read https://example.com/a/very/long/path/that/x/shortens 🎉';

  it('counts a variant of X the way X does', () => {
    expect(countLength('x-own-key', text)).toBe(countLength('x', text));
    expect(countLength('x', text)).not.toBe(text.length);
  });

  it('slices a variant of X on the X weights', () => {
    const long = 'é'.repeat(300);
    expect(textSlicer('x-own-key', 280, long)).toEqual(
      textSlicer('x', 280, long)
    );
  });

  it('keeps plain length for other networks', () => {
    expect(countLength('linkedin-page', text)).toBe(text.length);
  });
});

describe('countLength on Bluesky', () => {
  // Bluesky's 300 limit is in graphemes, not UTF-16 units
  it('counts an emoji with modifiers or a flag as one', () => {
    expect(countLength('bluesky', '👍🏽')).toBe(1);
    expect(countLength('bluesky', '🇫🇷')).toBe(1);
    expect(countLength('bluesky', '👨‍👩‍👧')).toBe(1);
    expect(countLength('bluesky', 'é')).toBe(1);
  });

  it('lets 300 emoji through', () => {
    expect(countLength('bluesky', '🎉'.repeat(300))).toBe(300);
    expect('🎉'.repeat(300).length).toBe(600);
  });
});
