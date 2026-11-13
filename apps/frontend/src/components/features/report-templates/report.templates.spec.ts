import { reportColors, textOn } from './report.templates';

describe('report templates', () => {
  it('keeps the default look without saved colors', () => {
    expect(reportColors(undefined)).toEqual({
      color: null,
      accent: null,
      template: 'classic',
      textOnColor: '#ffffff',
    });
  });

  it('reads saved colors and templates, ignoring bad values', () => {
    expect(
      reportColors({ color: '#0E7C66', accent: 'bad', template: 'bold' })
    ).toEqual({
      color: '#0e7c66',
      accent: null,
      template: 'bold',
      textOnColor: '#ffffff',
    });
    expect(reportColors({ template: 'fancy' }).template).toBe('classic');
  });

  it('picks readable text', () => {
    expect(textOn('#ffffff')).toBe('#111118');
    expect(textOn('#c8ff4d')).toBe('#111118');
    expect(textOn('#7357ff')).toBe('#ffffff');
  });
});
