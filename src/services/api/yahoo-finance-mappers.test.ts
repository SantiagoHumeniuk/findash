import { describe, expect, it } from 'vitest';
import { mapYahooDailyChange, mapYahooHistory, mapYahooPercentChange, mapYahooPeriodChange } from './yahoo-finance-mappers';

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

  it('calculates daily change from the live price and previous close', () => {
    expect(mapYahooDailyChange(105, 100)).toEqual({ change: 5, changePercent: 5 });
    expect(mapYahooDailyChange(95, 100)).toEqual({ change: -5, changePercent: -5 });
    expect(mapYahooDailyChange(105, null)).toBeNull();
    expect(mapYahooDailyChange(0, 100)).toBeNull();
  });

  it('calculates monthly and yearly changes from the closest historical closes', () => {
    const history = [
      { date: '2025-01-01', open: 90, high: 90, low: 90, close: 100, volume: 1 },
      { date: '2025-11-30', open: 95, high: 95, low: 95, close: 100, volume: 1 },
      { date: '2025-12-07', open: 100, high: 100, low: 100, close: 110, volume: 1 },
      { date: '2026-01-04', open: 110, high: 110, low: 110, close: 120, volume: 1 },
    ];

    expect(mapYahooPeriodChange(history, 1)).toBeCloseTo(20);
    expect(mapYahooPeriodChange(history, 12)).toBeCloseTo(20);
    expect(mapYahooPeriodChange(history.slice(-1), 1)).toBeNull();
  });
});
