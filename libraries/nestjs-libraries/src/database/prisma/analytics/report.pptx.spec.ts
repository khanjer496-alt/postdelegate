import { inflateRawSync } from 'zlib';
import {
  buildReportPptx,
  escapeXml,
  hexColor,
  normalizeHexColor,
  normalizeTemplate,
  ReportPptxInput,
  textOn,
} from './report.pptx';
import { crc32 } from './zip.writer';

// reads the entries of a zip made by zip.writer (central directory)
const unzip = (buffer: Buffer) => {
  const end = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16);
  const files: Record<string, string> = {};
  for (let i = 0; i < count; i++) {
    const crc = buffer.readUInt32LE(offset + 16);
    const size = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const local = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);
    const localNameLength = buffer.readUInt16LE(local + 26);
    const start = local + 30 + localNameLength;
    const data = inflateRawSync(buffer.subarray(start, start + size));
    expect(crc32(data)).toBe(crc);
    files[name] = data.toString('utf8');
    offset += 46 + nameLength;
  }
  return files;
};

const input = (overrides: Partial<ReportPptxInput> = {}): ReportPptxInput => ({
  brand: {
    name: 'Acme & <Co>',
    color: '#0e7c66',
    accent: null,
    template: 'bold',
  },
  from: '2026-10-01T00:00:00.000Z',
  to: '2026-10-31T23:59:59.999Z',
  comparison: [
    { key: 'followers', current: 12, previous: 10, change: 20 },
    { key: 'published', current: 4, previous: 0, change: null },
  ],
  topPosts: [
    {
      channel: { name: 'Acme on LinkedIn' },
      title: 'Launch day',
      url: null,
      publishedAt: '2026-10-03T09:00:00.000Z',
      views: 1200,
      likes: 30,
      comments: 4,
      engagement: 40,
    },
  ],
  bestTimes: { basis: 'publish_count', bestDays: [], bestHours: [] },
  insights: { posts: 4, contentTypes: [], hashtags: [] },
  channels: [],
  ...overrides,
});

describe('report pptx', () => {
  it('is a zip with the parts PowerPoint needs, one slide each', () => {
    const files = unzip(buildReportPptx(input()));
    expect(Object.keys(files)).toEqual(
      expect.arrayContaining([
        '[Content_Types].xml',
        '_rels/.rels',
        'ppt/presentation.xml',
        'ppt/slideMasters/slideMaster1.xml',
        'ppt/slideLayouts/slideLayout1.xml',
        'ppt/theme/theme1.xml',
        'ppt/slides/slide1.xml',
        'ppt/slides/slide4.xml',
      ])
    );
    expect(files['ppt/presentation.xml'].match(/<p:sldId /g)).toHaveLength(4);
    expect(files['[Content_Types].xml']).toContain('/ppt/slides/slide4.xml');
  });

  it('uses the brand colors and escapes text', () => {
    const files = unzip(buildReportPptx(input()));
    expect(files['ppt/slides/slide1.xml']).toContain('val="0E7C66"');
    expect(files['ppt/slides/slide1.xml']).toContain('Acme &amp; &lt;Co&gt;');
    expect(files['ppt/theme/theme1.xml']).toContain(
      '<a:accent1><a:srgbClr val="0E7C66"/>'
    );
    // no stats to rank by: says so instead of inventing a best time
    expect(files['ppt/slides/slide4.xml']).toContain(
      'Not enough posts with stats yet'
    );
  });

  it('is the same bytes for the same input', () => {
    expect(buildReportPptx(input()).equals(buildReportPptx(input()))).toBe(
      true
    );
  });

  it('checks colors and templates', () => {
    expect(hexColor('#abcdef', '000000')).toBe('ABCDEF');
    expect(hexColor('red', '000000')).toBe('000000');
    expect(textOn('FFFFFF')).toBe('111118');
    expect(textOn('111118')).toBe('FFFFFF');
    expect(escapeXml('a\u0001b')).toBe('ab');
    expect(normalizeHexColor('ABCDEF')).toBe('#abcdef');
    expect(normalizeHexColor('javascript:')).toBeNull();
    expect(normalizeTemplate('bold')).toBe('bold');
    expect(normalizeTemplate('fancy')).toBeNull();
  });
});
