jest.mock('chart.js/auto', () => jest.fn());
jest.mock('react-use-cookie', () => jest.fn(() => ['dark']));

import { mergeDataPoints } from './chart-social';

const days = (values: Array<number | string>) =>
  values.map((total, i) => ({
    total: total as any,
    date: `2026-10-${String(i + 1).padStart(2, '0')}`,
  }));

describe('mergeDataPoints', () => {
  it('sums string totals instead of joining their digits (30-day window)', () => {
    const merged = mergeDataPoints(
      days(Array.from({ length: 30 }, (_, i) => String([1, 2, 3, 4, 1][i % 5]))),
      7
    );
    expect(merged.length).toBeGreaterThan(1);
    expect(merged.slice(0, 3).map((p) => p.total)).toEqual([11, 11, 11]);
    merged.forEach((p) => expect(typeof p.total).toBe('number'));
  });

  it('still sums numeric totals', () => {
    expect(mergeDataPoints(days(Array(10).fill(2)), 5).map((p) => p.total)).toEqual([
      4, 4, 4, 4, 4,
    ]);
  });

  it('counts a non-numeric total as 0 instead of poisoning the sum', () => {
    expect(mergeDataPoints(days(['3', 'bad', 4, 1]), 2).map((p) => p.total)).toEqual([3, 5]);
  });
});
