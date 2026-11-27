// Report templates (PD_FF_REPORT_TEMPLATES): the look of the printable PDF
// report and the PowerPoint download.
export type ReportTemplateId = 'classic' | 'bold' | 'minimal';

export const REPORT_TEMPLATE_OPTIONS: Array<{
  id: ReportTemplateId;
  label: string;
  hint: string;
}> = [
  { id: 'classic', label: 'Classic', hint: 'White pages, brand color accents' },
  { id: 'bold', label: 'Bold', hint: 'Brand color headers on every page' },
  { id: 'minimal', label: 'Minimal', hint: 'Plain pages, a thin brand line' },
];

const HEX = /^#?([0-9a-f]{6})$/i;

export const reportColors = (brand?: {
  color?: string | null;
  accent?: string | null;
  template?: string | null;
}) => {
  const color = HEX.exec(brand?.color || '')?.[1];
  const accent = HEX.exec(brand?.accent || '')?.[1];
  const template: ReportTemplateId = REPORT_TEMPLATE_OPTIONS.some(
    (option) => option.id === brand?.template
  )
    ? (brand!.template as ReportTemplateId)
    : 'classic';
  return {
    // null: the report keeps its default look
    color: color ? `#${color.toLowerCase()}` : null,
    accent: accent ? `#${accent.toLowerCase()}` : null,
    template,
    textOnColor: color ? textOn(color) : '#ffffff',
  };
};

// black or white text, whichever reads better on the color
export const textOn = (hex: string) => {
  const clean = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map(
    (i) => parseInt(clean.slice(i, i + 2), 16) / 255
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6 ? '#111118' : '#ffffff';
};
