import { describe, expect, it } from 'vitest';
import { normalizeHistoricalPerformance } from './historical-performance';

describe('normalizeHistoricalPerformance', () => {
  it('uses the same percentage scale with a zero return baseline for every series', () => {
    const rows = [
      { day: 'Jan 1', originalDate: '2025-01-01', PORTFOLIO: 1000, SPY: 500 },
      { day: 'Jan 2', originalDate: '2025-01-02', PORTFOLIO: 1100, SPY: 525 },
    ];

    const normalized = normalizeHistoricalPerformance(rows, ['PORTFOLIO', 'SPY']);
    expect(normalized[0].PORTFOLIO).toBe(0);
    expect(normalized[0].SPY).toBe(0);
    expect(normalized[1].PORTFOLIO).toBeCloseTo(10);
    expect(normalized[1].SPY).toBeCloseTo(5);
  });

  it('preserves missing points instead of fabricating values', () => {
    const rows = [
      { day: 'Jan 1', originalDate: '2025-01-01', SPY: null },
      { day: 'Jan 2', originalDate: '2025-01-02', SPY: 500 },
    ];

    expect(normalizeHistoricalPerformance(rows, ['SPY']).map((row) => row.SPY)).toEqual([null, 0]);
  });
});
