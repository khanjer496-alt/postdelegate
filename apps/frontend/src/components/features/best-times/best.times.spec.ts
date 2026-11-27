import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import {
  BestTimesData,
  nextBestTime,
  nextPostingSlot,
  pickBestSlots,
} from './best.times';

dayjs.extend(utc);

const grid = (fill = 0) =>
  Array.from({ length: 7 }, () => Array<number>(24).fill(fill));

const data = (patch: Partial<BestTimesData> = {}): BestTimesData => ({
  timezone: 'UTC',
  basis: 'engagement',
  posts: 40,
  required: 10,
  bestDays: [],
  bestHours: [],
  heatmap: grid(),
  counts: grid(),
  ...patch,
});

describe('best time slots', () => {
  it('shows nothing without enough scored posts', () => {
    const heatmap = grid();
    const counts = grid();
    heatmap[2][9] = 3;
    counts[2][9] = 5;
    expect(pickBestSlots(data({ basis: 'publish_count', heatmap, counts }))).toEqual([]);
    expect(pickBestSlots(undefined)).toEqual([]);
  });

  it('keeps buckets above a typical post with enough posts, best first', () => {
    const heatmap = grid();
    const counts = grid();
    heatmap[2][9] = 1.8; counts[2][9] = 4; // Tue 09
    heatmap[4][17] = 2.4; counts[4][17] = 3; // Thu 17
    heatmap[1][12] = 5; counts[1][12] = 1; // too few posts
    heatmap[5][8] = 0.7; counts[5][8] = 9; // below typical
    const slots = pickBestSlots(data({ heatmap, counts }));
    expect(slots.map((s) => [s.weekday, s.hour])).toEqual([
      [4, 17],
      [2, 9],
    ]);
  });

  it('caps the number of slots', () => {
    const heatmap = grid(2);
    const counts = grid(3);
    expect(pickBestSlots(data({ heatmap, counts }), 4)).toHaveLength(4);
  });

  it('finds the next best slot after now and skips taken hours', () => {
    // Monday 2026-11-16 10:30 UTC
    const now = dayjs.utc('2026-11-16T10:30:00Z');
    const slots = [
      { weekday: 1, hour: 9, score: 2, posts: 3 }, // Mon 09, already past
      { weekday: 2, hour: 9, score: 2, posts: 3 }, // Tue 09
    ];
    expect(nextBestTime(now, slots)?.format('YYYY-MM-DD HH:mm')).toBe(
      '2026-11-17 09:00'
    );
    const taken = new Set(['2026-11-17-09']);
    expect(nextBestTime(now, slots, taken)?.format('YYYY-MM-DD HH:mm')).toBe(
      '2026-11-23 09:00'
    );
    expect(nextBestTime(now, [])).toBeNull();
  });

  it('falls back to the next channel posting slot', () => {
    const now = dayjs.utc('2026-11-16T10:30:00Z');
    const toLocal = (d: Date) => dayjs.utc(d);
    // 09:00 and 14:15 UTC
    expect(
      nextPostingSlot(now, [540, 855], toLocal)?.format('YYYY-MM-DD HH:mm')
    ).toBe('2026-11-16 14:15');
    expect(
      nextPostingSlot(now, [540], toLocal)?.format('YYYY-MM-DD HH:mm')
    ).toBe('2026-11-17 09:00');
    expect(nextPostingSlot(now, [], toLocal)).toBeNull();
  });
});
