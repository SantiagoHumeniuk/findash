/**
 * One chart row with display date metadata and a value for each price series.
 */
export interface HistoricalPerformanceRow {
  day: string;
  originalDate: string;
  [symbol: string]: string | number | null;
}

/**
 * Converts price series to percentage returns from each series' first visible price.
 * Missing observations remain null and are never replaced with synthetic values.
 */
export function normalizeHistoricalPerformance(
  rows: HistoricalPerformanceRow[],
  symbols: string[],
): HistoricalPerformanceRow[] {
  const baselines = new Map<string, number>();
  for (const symbol of symbols) {
    const firstPrice = rows.find((row) => {
      const value = row[symbol];
      return typeof value === 'number' && Number.isFinite(value) && value > 0;
    })?.[symbol];
    if (typeof firstPrice === 'number') baselines.set(symbol, firstPrice);
  }

  return rows.map((row) => {
    const normalized: HistoricalPerformanceRow = { ...row };
    for (const symbol of symbols) {
      const value = row[symbol];
      const baseline = baselines.get(symbol);
      normalized[symbol] = typeof value === 'number' && baseline !== undefined
        ? ((value / baseline) - 1) * 100
        : null;
    }
    return normalized;
  });
}
