// Pure calculations used by the proxy, kept apart from index.ts (which starts
// the server on import) so they can be unit-tested with `deno test`.

/**
 * Previous session close from daily candles. `chartPreviousClose` is the close
 * before the start of the requested range (a year ago for range=1y), so it must
 * not be used for the daily change.
 */
export function findPreviousSessionClose(
  candles: Array<{ timestamp: number; close: number }>,
  marketTimestamp: number | null,
): number | null {
  if (candles.length === 0) return null;
  let currentIndex = candles.length - 1;
  if (marketTimestamp !== null) {
    while (currentIndex >= 0 && candles[currentIndex].timestamp > marketTimestamp) currentIndex -= 1;
  }
  const previous = currentIndex > 0 ? candles[currentIndex - 1] : null;
  return previous && previous.close > 0 ? previous.close : null;
}

/** Infers payment frequency from the dividends paid in the year before the latest one. */
export function inferDividendFrequency(events: Array<{ date: string }>): string {
  if (events.length < 2) return events.length === 1 ? "annual" : "";
  const latest = Date.parse(events[events.length - 1].date);
  const count = events.filter((event) => latest - Date.parse(event.date) < 360 * 24 * 60 * 60 * 1000).length;
  if (count >= 11) return "monthly";
  if (count >= 4) return "quarterly";
  if (count >= 2) return "semi-annual";
  return "annual";
}
