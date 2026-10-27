import { describe, expect, it } from 'vitest';
import { calculateStats, formatDate } from './format-utils';

describe('sector and industry performance formatting', () => {
  it('uses the newest date for the latest performance value even when the API order differs', () => {
    const stats = calculateStats([
      { date: '2026-10-12', averageChange: 1.2 },
      { date: '2026-10-14', averageChange: -0.8 },
      { date: '2026-10-13', averageChange: 0.4 },
    ]);

    expect(stats.latest).toBe(-0.8);
    expect(stats.latestDate).toBe('2026-10-14');
  });

  it('returns the input when a date cannot be parsed', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });
});
