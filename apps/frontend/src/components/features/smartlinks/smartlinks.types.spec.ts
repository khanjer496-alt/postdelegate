import { accentOf, hostOf, slugify, textOnAccent } from './smartlinks.types';

describe('smartlinks helpers', () => {
  it('slugifies a page address', () => {
    expect(slugify('  My Studio!! ')).toBe('my-studio');
    expect(slugify('a--b')).toBe('a-b');
  });
  it('falls back to the default accent', () => {
    expect(accentOf('#0e7c66')).toBe('#0e7c66');
    expect(accentOf('red')).toBe('#7357ff');
    expect(accentOf(null)).toBe('#7357ff');
  });
  it('picks readable button text', () => {
    expect(textOnAccent('#c8ff4d')).toBe('#111118');
    expect(textOnAccent('#7357ff')).toBe('#ffffff');
  });
  it('shows a link host', () => {
    expect(hostOf('https://www.acme.com/shop')).toBe('acme.com');
    expect(hostOf('nope')).toBe('nope');
  });
});
