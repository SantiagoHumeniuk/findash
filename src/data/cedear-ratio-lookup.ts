import { CEDEAR_UNDERLYING_TICKERS } from './cedear-underlying-tickers';

/**
 * Finds a CEDEAR ratio by its ticker, punctuation variant, or USD ticker ending in D.
 */
export function findCedearRatio(symbol: string, ratios: Record<string, number>): number | null {
  const ticker = symbol.trim().toUpperCase();
  const withoutMarket = ticker.replace(/\.BA$/, '');
  const direct = getRatioForTicker(ticker, ratios) ?? getRatioForTicker(withoutMarket, ratios);
  if (direct !== null) return direct;

  if (withoutMarket.endsWith('D')) {
    const dollarBase = withoutMarket.slice(0, -1);
    const dollarRatio = getRatioForTicker(dollarBase, ratios);
    if (dollarRatio !== null) return dollarRatio;
  }

  if (!/[^A-Z0-9]/.test(withoutMarket)) return null;
  const normalized = withoutMarket.replace(/[^A-Z0-9]/g, '');
  for (const [candidate, ratio] of Object.entries(ratios)) {
    const candidateTicker = candidate.toUpperCase().replace(/\.BA$/, '').replace(/[^A-Z0-9]/g, '');
    if (candidateTicker === normalized && Number.isFinite(ratio) && ratio > 0) return ratio;
  }

  return null;
}

/**
 * Returns the underlying ticker for a USD-denominated CEDEAR ticker ending in D.
 */
export function getDollarCedearBaseTicker(symbol: string, ratios: Record<string, number>): string | null {
  const ticker = symbol.trim().toUpperCase().replace(/\.BA$/, '');
  if (!ticker.endsWith('D')) return null;

  const baseTicker = ticker.slice(0, -1);
  return getRatioForTicker(baseTicker, ratios) === null
    ? null
    : CEDEAR_UNDERLYING_TICKERS[baseTicker] ?? baseTicker;
}

/**
 * Converts a CEDEAR ticker to its underlying Yahoo Finance ticker.
 */
export function getCedearUnderlyingTicker(symbol: string, ratios: Record<string, number>): string {
  const ticker = symbol.trim().toUpperCase().replace(/\.BA$/, '');
  const dollarBase = getDollarCedearBaseTicker(ticker, ratios);
  if (dollarBase) return dollarBase;
  if (CEDEAR_UNDERLYING_TICKERS[ticker]) return CEDEAR_UNDERLYING_TICKERS[ticker];

  if (/[^A-Z0-9]/.test(ticker)) {
    const normalized = ticker.replace(/[^A-Z0-9]/g, '');
    for (const [candidate, underlying] of Object.entries(CEDEAR_UNDERLYING_TICKERS)) {
      const normalizedCandidate = candidate.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (normalizedCandidate === normalized && findCedearRatio(candidate, ratios) !== null) return underlying;
    }
  }

  return ticker;
}

/**
 * Lists BYMA tickers that represent a persisted US-market ticker.
 */
export function getCedearTickersForUnderlying(symbol: string, ratios: Record<string, number>): string[] {
  const underlying = symbol.trim().toUpperCase().replace(/\.BA$/, '');
  const aliases = Object.entries(CEDEAR_UNDERLYING_TICKERS)
    .filter(([, mappedUnderlying]) => mappedUnderlying.toUpperCase() === underlying)
    .map(([cedearTicker]) => cedearTicker);
  return [...new Set([underlying, ...aliases])]
    .filter((ticker) => findCedearRatio(ticker, ratios) !== null);
}

function getRatioForTicker(ticker: string, ratios: Record<string, number>): number | null {
  const direct = ratios[ticker];
  if (Number.isFinite(direct) && direct > 0) return direct;

  const underlying = CEDEAR_UNDERLYING_TICKERS[ticker];
  const aliased = underlying ? ratios[underlying] : undefined;
  return aliased !== undefined && Number.isFinite(aliased) && aliased > 0 ? aliased : null;
}
