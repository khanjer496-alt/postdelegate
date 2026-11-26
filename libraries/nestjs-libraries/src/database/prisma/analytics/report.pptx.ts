import { zip } from './zip.writer';

// PowerPoint export of the analytics report (PD_FF_REPORT_TEMPLATES): a
// 16:9 deck in the report's brand colors and template, built from the same
// data as the printable PDF report. Plain OOXML, no dependency.

export type ReportTemplate = 'classic' | 'bold' | 'minimal';

export const REPORT_TEMPLATES: ReportTemplate[] = [
  'classic',
  'bold',
  'minimal',
];

export const normalizeHexColor = (value?: string | null) => {
  const match = /^#?([0-9a-f]{6})$/i.exec((value || '').trim());
  return match ? `#${match[1].toLowerCase()}` : null;
};

export const normalizeTemplate = (value?: string | null) =>
  REPORT_TEMPLATES.includes(value as ReportTemplate)
    ? (value as ReportTemplate)
    : null;

export interface ReportPptxInput {
  brand: {
    name: string;
    color?: string | null; // #RRGGBB
    accent?: string | null;
    template?: ReportTemplate | null;
  };
  from: string;
  to: string;
  comparison: Array<{
    key: 'followers' | 'published' | 'engagement' | 'views';
    current: number | null;
    previous: number | null;
    change: number | null;
  }>;
  topPosts: Array<{
    channel: { name: string };
    title: string | null;
    url: string | null;
    publishedAt: string;
    views: number | null;
    likes: number | null;
    comments: number | null;
    engagement: number | null;
  }>;
  bestTimes: {
    basis: 'engagement' | 'publish_count';
    bestDays: Array<{ weekday: number; score: number; posts: number }>;
    bestHours: Array<{ hour: number; score: number; posts: number }>;
  };
  insights: {
    posts: number;
    contentTypes: Array<{
      key: string;
      label: string;
      posts: number;
      score: number | null;
    }>;
    hashtags: Array<{
      key: string;
      label: string;
      posts: number;
      score: number | null;
    }>;
  };
  channels: Array<{
    name: string;
    current: number | null;
    gained: number | null;
  }>;
}

const EMU = 12700; // per point
const W = 12192000;
const H = 6858000;
const DEFAULT_COLOR = '7357FF';
const DEFAULT_ACCENT = 'C8FF4D';
const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
const LABELS: Record<ReportPptxInput['comparison'][number]['key'], string> = {
  followers: 'Followers gained',
  published: 'Posts published',
  engagement: 'Engagement',
  views: 'Views',
};

export const hexColor = (
  value: string | null | undefined,
  fallback: string
) => {
  const match = /^#?([0-9a-f]{6})$/i.exec((value || '').trim());
  return match ? match[1].toUpperCase() : fallback;
};

// black or white text, whichever reads better on the color
export const textOn = (hex: string) => {
  const [r, g, b] = [0, 2, 4].map(
    (i) => parseInt(hex.slice(i, i + 2), 16) / 255
  );
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.6 ? '111118' : 'FFFFFF';
};

export const escapeXml = (value: string) =>
  value
    // characters XML 1.0 does not allow
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const num = (value: number | null | undefined) =>
  value === null || value === undefined
    ? '–'
    : new Intl.NumberFormat('en-US').format(value);

const NS =
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

interface Box {
  x: number; // points from the top left of a 960x540 slide
  y: number;
  w: number;
  h: number;
  fill?: string;
  line?: string;
  round?: boolean;
  text?: string | string[];
  size?: number;
  bold?: boolean;
  color?: string;
  align?: 'l' | 'ctr' | 'r';
  anchor?: 't' | 'ctr' | 'b';
}

class Slide {
  private shapes: string[] = [];
  private nextId = 2;
  constructor(private background: string) {}

  box(b: Box) {
    const id = this.nextId++;
    const paragraphs = (
      Array.isArray(b.text) ? b.text : b.text !== undefined ? [b.text] : []
    )
      .map(
        (line) =>
          `<a:p><a:pPr algn="${
            b.align || 'l'
          }"/><a:r><a:rPr lang="en-US" sz="${Math.round(
            (b.size || 14) * 100
          )}"${b.bold ? ' b="1"' : ''} dirty="0"><a:solidFill><a:srgbClr val="${
            b.color || '111118'
          }"/></a:solidFill><a:latin typeface="Arial"/><a:cs typeface="Arial"/></a:rPr><a:t>${escapeXml(
            line
          )}</a:t></a:r></a:p>`
      )
      .join('');
    this.shapes.push(
      `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Shape ${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>` +
        `<p:spPr><a:xfrm><a:off x="${Math.round(b.x * EMU)}" y="${Math.round(
          b.y * EMU
        )}"/><a:ext cx="${Math.round(b.w * EMU)}" cy="${Math.round(
          b.h * EMU
        )}"/></a:xfrm><a:prstGeom prst="${
          b.round ? 'roundRect' : 'rect'
        }"><a:avLst/></a:prstGeom>` +
        (b.fill
          ? `<a:solidFill><a:srgbClr val="${b.fill}"/></a:solidFill>`
          : '<a:noFill/>') +
        (b.line
          ? `<a:ln w="9525"><a:solidFill><a:srgbClr val="${b.line}"/></a:solidFill></a:ln>`
          : '<a:ln><a:noFill/></a:ln>') +
        `</p:spPr><p:txBody><a:bodyPr wrap="square" lIns="91440" tIns="45720" rIns="91440" bIns="45720" anchor="${
          b.anchor || 't'
        }"><a:normAutofit/></a:bodyPr><a:lstStyle/>${
          paragraphs || '<a:p><a:endParaRPr lang="en-US"/></a:p>'
        }</p:txBody></p:sp>`
    );
    return this;
  }

  xml() {
    return (
      XML +
      `<p:sld ${NS}><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="${this.background}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>` +
      '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>' +
      this.shapes.join('') +
      '</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>'
    );
  }
}

const theme = (color: string, accent: string) =>
  XML +
  `<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="PostDelegate report"><a:themeElements>` +
  `<a:clrScheme name="Report"><a:dk1><a:srgbClr val="111118"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="2B2B33"/></a:dk2><a:lt2><a:srgbClr val="F3F2F8"/></a:lt2>` +
  `<a:accent1><a:srgbClr val="${color}"/></a:accent1><a:accent2><a:srgbClr val="${accent}"/></a:accent2><a:accent3><a:srgbClr val="3DDC97"/></a:accent3><a:accent4><a:srgbClr val="FFB547"/></a:accent4><a:accent5><a:srgbClr val="FF5A5F"/></a:accent5><a:accent6><a:srgbClr val="6B6B78"/></a:accent6>` +
  `<a:hlink><a:srgbClr val="${color}"/></a:hlink><a:folHlink><a:srgbClr val="${color}"/></a:folHlink></a:clrScheme>` +
  `<a:fontScheme name="Report"><a:majorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>` +
  `<a:fmtScheme name="Report"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>` +
  `<a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>` +
  `<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>` +
  `<a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme>` +
  `</a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>`;

const EMPTY_TREE =
  '<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree>';

const rels = (items: Array<[string, string, string]>) =>
  XML +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  items
    .map(
      ([id, type, target]) =>
        `<Relationship Id="${id}" Type="${type}" Target="${target}"/>`
    )
    .join('') +
  '</Relationships>';

const REL =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

const date = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });

export const buildReportSlides = (input: ReportPptxInput) => {
  const color = hexColor(input.brand.color, DEFAULT_COLOR);
  const accent = hexColor(input.brand.accent, DEFAULT_ACCENT);
  const template: ReportTemplate = input.brand.template || 'classic';
  const onColor = textOn(color);
  const period = `${date(input.from)} – ${date(input.to)}`;
  const brand = input.brand.name || 'Social media report';
  const slides: Slide[] = [];

  // the header every content slide gets, per template
  const content = (title: string) => {
    const slide = new Slide('FFFFFF');
    if (template === 'bold') {
      slide.box({ x: 0, y: 0, w: 960, h: 72, fill: color });
      slide.box({
        x: 40,
        y: 14,
        w: 700,
        h: 44,
        text: title,
        size: 24,
        bold: true,
        color: onColor,
        anchor: 'ctr',
      });
      slide.box({
        x: 640,
        y: 14,
        w: 280,
        h: 44,
        text: brand,
        size: 11,
        color: onColor,
        align: 'r',
        anchor: 'ctr',
      });
    } else {
      slide.box({
        x: 40,
        y: 28,
        w: 700,
        h: 44,
        text: title,
        size: 24,
        bold: true,
        color: '111118',
        anchor: 'ctr',
      });
      slide.box({
        x: 640,
        y: 28,
        w: 280,
        h: 44,
        text: brand,
        size: 11,
        color: '6B6B78',
        align: 'r',
        anchor: 'ctr',
      });
      slide.box({
        x: 40,
        y: 76,
        w: template === 'minimal' ? 880 : 64,
        h: template === 'minimal' ? 1 : 4,
        fill: template === 'minimal' ? 'E7E5EF' : color,
      });
    }
    slide.box({
      x: 40,
      y: 506,
      w: 880,
      h: 22,
      text: period,
      size: 9,
      color: '9A9AA5',
    });
    slides.push(slide);
    return slide;
  };

  // 1. cover
  const cover = new Slide(template === 'minimal' ? 'FFFFFF' : color);
  const coverText = template === 'minimal' ? '111118' : onColor;
  if (template === 'minimal') {
    cover.box({ x: 60, y: 120, w: 8, h: 230, fill: color });
  } else {
    cover.box({ x: 60, y: 380, w: 120, h: 6, fill: accent });
  }
  cover.box({
    x: 84,
    y: 150,
    w: 800,
    h: 70,
    text: brand,
    size: 40,
    bold: true,
    color: coverText,
  });
  cover.box({
    x: 84,
    y: 225,
    w: 800,
    h: 40,
    text: 'Social media performance report',
    size: 20,
    color: coverText,
  });
  cover.box({
    x: 84,
    y: 280,
    w: 800,
    h: 30,
    text: period,
    size: 14,
    color: coverText,
  });
  slides.push(cover);

  // 2. highlights
  const highlights = content('Highlights');
  input.comparison.slice(0, 4).forEach((item, index) => {
    const x = 40 + index * 224;
    const change =
      item.change === null || item.change === undefined
        ? 'No earlier period to compare'
        : `${item.change > 0 ? '▲' : item.change < 0 ? '▼' : '•'} ${Math.abs(
            Math.round(item.change)
          )}% vs ${num(item.previous)}`;
    highlights.box({
      x,
      y: 120,
      w: 208,
      h: 150,
      fill: template === 'minimal' ? 'FFFFFF' : 'F6F5FB',
      line: 'E7E5EF',
      round: true,
    });
    highlights.box({
      x: x + 10,
      y: 132,
      w: 188,
      h: 24,
      text: LABELS[item.key],
      size: 12,
      color: '6B6B78',
    });
    highlights.box({
      x: x + 10,
      y: 160,
      w: 188,
      h: 56,
      text:
        item.current === null
          ? '–'
          : `${item.key === 'followers' && item.current > 0 ? '+' : ''}${num(
              item.current
            )}`,
      size: 30,
      bold: true,
      color: index === 0 ? color : '111118',
    });
    highlights.box({
      x: x + 10,
      y: 222,
      w: 188,
      h: 36,
      text: change,
      size: 10,
      color:
        item.change && item.change > 0
          ? '2F7A00'
          : item.change && item.change < 0
          ? 'B42318'
          : '6B6B78',
    });
  });
  if (input.channels.length) {
    highlights.box({
      x: 40,
      y: 300,
      w: 880,
      h: 24,
      text: 'Followers by channel',
      size: 13,
      bold: true,
    });
    input.channels.slice(0, 6).forEach((channel, index) => {
      const y = 330 + index * 26;
      highlights.box({
        x: 40,
        y,
        w: 560,
        h: 24,
        text: channel.name,
        size: 11,
        color: '111118',
      });
      highlights.box({
        x: 600,
        y,
        w: 150,
        h: 24,
        text: num(channel.current),
        size: 11,
        align: 'r',
      });
      highlights.box({
        x: 760,
        y,
        w: 160,
        h: 24,
        text:
          channel.gained === null
            ? '–'
            : `${channel.gained > 0 ? '+' : ''}${num(channel.gained)}`,
        size: 11,
        align: 'r',
        color: channel.gained && channel.gained > 0 ? '2F7A00' : '6B6B78',
      });
    });
  }

  // 3. top posts
  const top = content('Top posts');
  const headers: Array<[string, number, number, 'l' | 'r']> = [
    ['Post', 40, 430, 'l'],
    ['Channel', 470, 170, 'l'],
    ['Views', 640, 90, 'r'],
    ['Likes', 730, 90, 'r'],
    ['Engagement', 820, 100, 'r'],
  ];
  headers.forEach(([label, x, w, align]) =>
    top.box({
      x,
      y: 100,
      w,
      h: 24,
      text: label,
      size: 10,
      bold: true,
      color: '6B6B78',
      align,
    })
  );
  top.box({ x: 40, y: 124, w: 880, h: 1, fill: 'E7E5EF' });
  if (!input.topPosts.length) {
    top.box({
      x: 40,
      y: 140,
      w: 880,
      h: 30,
      text: 'No posts with stats in this period yet.',
      size: 12,
      color: '6B6B78',
    });
  }
  input.topPosts.slice(0, 8).forEach((post, index) => {
    const y = 130 + index * 44;
    const title = (post.title || '').replace(/\s+/g, ' ').trim();
    top.box({
      x: 40,
      y,
      w: 430,
      h: 40,
      text: [
        title.length > 70 ? `${title.slice(0, 69)}…` : title || '(no text)',
        date(post.publishedAt),
      ],
      size: 10,
    });
    top.box({
      x: 470,
      y,
      w: 170,
      h: 40,
      text: post.channel.name,
      size: 10,
      color: '6B6B78',
    });
    top.box({
      x: 640,
      y,
      w: 90,
      h: 40,
      text: num(post.views),
      size: 11,
      align: 'r',
    });
    top.box({
      x: 730,
      y,
      w: 90,
      h: 40,
      text: num(post.likes),
      size: 11,
      align: 'r',
    });
    top.box({
      x: 820,
      y,
      w: 100,
      h: 40,
      text: num(post.engagement),
      size: 11,
      bold: true,
      align: 'r',
      color,
    });
  });

  // 4. best times and what works
  const works = content('When and what works');
  works.box({
    x: 40,
    y: 100,
    w: 420,
    h: 24,
    text: 'Best days and hours',
    size: 13,
    bold: true,
  });
  if (input.bestTimes.basis !== 'engagement') {
    works.box({
      x: 40,
      y: 128,
      w: 420,
      h: 60,
      text: 'Not enough posts with stats yet to rank days and hours.',
      size: 11,
      color: '6B6B78',
    });
  } else {
    const lines = [
      ...input.bestTimes.bestDays
        .slice(0, 3)
        .map(
          (d) =>
            `${WEEKDAYS[d.weekday]} · ${d.score.toFixed(1)}x a typical post`
        ),
      ...input.bestTimes.bestHours
        .slice(0, 3)
        .map(
          (h) =>
            `${String(h.hour).padStart(2, '0')}:00 · ${h.score.toFixed(
              1
            )}x a typical post`
        ),
    ];
    works.box({
      x: 40,
      y: 128,
      w: 420,
      h: 220,
      text: lines.length ? lines : ['No clear winner yet.'],
      size: 12,
    });
  }
  works.box({
    x: 500,
    y: 100,
    w: 420,
    h: 24,
    text: 'Formats and hashtags',
    size: 13,
    bold: true,
  });
  const groups = [
    ...input.insights.contentTypes
      .filter((g) => g.score !== null && g.posts >= 2)
      .slice(0, 4)
      .map((g) => `${g.label} · ${g.score!.toFixed(1)}x (${g.posts} posts)`),
    ...input.insights.hashtags
      .filter((g) => g.score !== null && g.posts >= 2)
      .slice(0, 4)
      .map((g) => `#${g.label} · ${g.score!.toFixed(1)}x (${g.posts} posts)`),
  ];
  works.box({
    x: 500,
    y: 128,
    w: 420,
    h: 220,
    text: groups.length ? groups : ['Not enough posts with stats yet.'],
    size: 12,
  });
  works.box({
    x: 40,
    y: 400,
    w: 880,
    h: 40,
    text: 'Scores compare each post with a typical post on the same channel (1.0x = typical), so channels of any size count fairly.',
    size: 10,
    color: '6B6B78',
  });

  return { slides, color, accent };
};

export const buildReportPptx = (input: ReportPptxInput) => {
  const { slides, color, accent } = buildReportSlides(input);
  const files: Array<{ name: string; data: string }> = [];
  files.push({
    name: '[Content_Types].xml',
    data:
      XML +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>' +
      '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>' +
      '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>' +
      '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>' +
      slides
        .map(
          (_, i) =>
            `<Override PartName="/ppt/slides/slide${
              i + 1
            }.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`
        )
        .join('') +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
      '</Types>',
  });
  files.push({
    name: '_rels/.rels',
    data: rels([
      ['rId1', `${REL}/officeDocument`, 'ppt/presentation.xml'],
      [
        'rId2',
        'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties',
        'docProps/core.xml',
      ],
      ['rId3', `${REL}/extended-properties`, 'docProps/app.xml'],
    ]),
  });
  files.push({
    name: 'docProps/core.xml',
    data:
      XML +
      '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
      `<dc:title>${escapeXml(
        `${input.brand.name || 'Social media'} report`
      )}</dc:title><dc:creator>PostDelegate</dc:creator>` +
      '</cp:coreProperties>',
  });
  files.push({
    name: 'docProps/app.xml',
    data:
      XML +
      `<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>PostDelegate</Application><Slides>${slides.length}</Slides></Properties>`,
  });
  files.push({
    name: 'ppt/presentation.xml',
    data:
      XML +
      `<p:presentation ${NS} saveSubsetFonts="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>` +
      slides
        .map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 3}"/>`)
        .join('') +
      `</p:sldIdLst><p:sldSz cx="${W}" cy="${H}"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`,
  });
  files.push({
    name: 'ppt/_rels/presentation.xml.rels',
    data: rels([
      ['rId1', `${REL}/slideMaster`, 'slideMasters/slideMaster1.xml'],
      ['rId2', `${REL}/theme`, 'theme/theme1.xml'],
      ...slides.map(
        (_, i) =>
          [`rId${i + 3}`, `${REL}/slide`, `slides/slide${i + 1}.xml`] as [
            string,
            string,
            string
          ]
      ),
    ]),
  });
  files.push({
    name: 'ppt/slideMasters/slideMaster1.xml',
    data:
      XML +
      `<p:sldMaster ${NS}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg>${EMPTY_TREE}</p:cSld>` +
      '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>' +
      '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>',
  });
  files.push({
    name: 'ppt/slideMasters/_rels/slideMaster1.xml.rels',
    data: rels([
      ['rId1', `${REL}/slideLayout`, '../slideLayouts/slideLayout1.xml'],
      ['rId2', `${REL}/theme`, '../theme/theme1.xml'],
    ]),
  });
  files.push({
    name: 'ppt/slideLayouts/slideLayout1.xml',
    data:
      XML +
      `<p:sldLayout ${NS} type="blank" preserve="1"><p:cSld name="Blank">${EMPTY_TREE}</p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`,
  });
  files.push({
    name: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels',
    data: rels([
      ['rId1', `${REL}/slideMaster`, '../slideMasters/slideMaster1.xml'],
    ]),
  });
  files.push({ name: 'ppt/theme/theme1.xml', data: theme(color, accent) });
  slides.forEach((slide, i) => {
    files.push({ name: `ppt/slides/slide${i + 1}.xml`, data: slide.xml() });
    files.push({
      name: `ppt/slides/_rels/slide${i + 1}.xml.rels`,
      data: rels([
        ['rId1', `${REL}/slideLayout`, '../slideLayouts/slideLayout1.xml'],
      ]),
    });
  });
  return zip(files);
};
