import { describe, expect, it } from 'vitest';
import { mapYahooHistory, mapYahooPercentChange } from './yahoo-finance-mappers';

describe('Yahoo Finance mappers', () => {
  it('orders history chronologically and calculates change against the prior close', () => {
    const mapped = mapYahooHistory('ACME', [
      { date: '2025-01-10', open: 12, high: 13, low: 11, close: 12, volume: 100 },
      { date: '2025-01-03', open: 10, high: 11, low: 9, close: 10, volume: 90 },
    ]);

    expect(mapped.map(({ date }) => date)).toEqual(['2025-01-03', '2025-01-10']);
    expect(mapped[0].change).toBe(0);
    expect(mapped[1].change).toBe(2);
    expect(mapped[1].changePercent).toBe(20);
  });

  it("does not multiply Yahoo's already-percent change value by 100", () => {
    expect(mapYahooPercentChange(1.25)).toBe(1.25);
    expect(mapYahooPercentChange(null)).toBe(0);
  });
});
