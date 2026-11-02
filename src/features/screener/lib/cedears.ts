// src/features/screener/lib/cedears.ts

export interface CedearMarketQuote {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  volume: number;
  changePercent: number;
}

export interface CedearRow {
  symbol: string;
  /** Underlying ticker in the US market. */
  usSymbol: string;
  ratio: number;
  priceArs: number;
  priceUsd: number | null;
  volumeArs: number;
  changePercent: number;
  /** ARS price ÷ USD price of this same CEDEAR. */
  impliedCcl: number | null;
  /** US share price ÷ ratio: what one CEDEAR should cost in dollars. */
  fairPriceUsd: number | null;
  /** Dollar price of the CEDEAR at the reference CCL against its fair price, in percent. */
  premiumPercent: number | null;
}

/** Local tickers that differ from the US one. */
const US_SYMBOL_OVERRIDES: Record<string, string> = {
  BRKB: 'BRK-B',
  DISN: 'DIS',
};

/** Larger gaps come from a stale ratio or thin trading, not from a real opportunity. */
export const MAX_CREDIBLE_PREMIUM = 15;

export function toUsSymbol(symbol: string): string {
  return US_SYMBOL_OVERRIDES[symbol] ?? symbol;
}

/** Mid price when both sides are quoted, otherwise the last trade. */
export function cedearPrice(quote: CedearMarketQuote): number | null {
  if (quote.bid > 0 && quote.ask > 0) return (quote.bid + quote.ask) / 2;
  return quote.last > 0 ? quote.last : null;
}

/** Joins the ARS line, its dollar line (ticker + "D") and the ratio, most traded first. */
export function buildCedearRows(quotes: CedearMarketQuote[], ratios: Record<string, number>): CedearRow[] {
  const bySymbol = new Map(quotes.map((quote) => [quote.symbol, quote]));
  return quotes.flatMap((quote): CedearRow[] => {
    const ratio = ratios[quote.symbol];
    const priceArs = cedearPrice(quote);
    if (!ratio || ratio <= 0 || priceArs === null) return [];
    const dollarLine = bySymbol.get(`${quote.symbol}D`);
    const priceUsd = dollarLine ? cedearPrice(dollarLine) : null;
    return [{
      symbol: quote.symbol,
      usSymbol: toUsSymbol(quote.symbol),
      ratio,
      priceArs,
      priceUsd,
      volumeArs: quote.volume * priceArs,
      changePercent: quote.changePercent,
      impliedCcl: priceUsd ? priceArs / priceUsd : null,
      fairPriceUsd: null,
      premiumPercent: null,
    }];
  }).sort((left, right) => right.volumeArs - left.volumeArs);
}

/** Adds the comparison against the US price. Implausible gaps stay blank rather than misleading. */
export function withPremiums(rows: CedearRow[], usPrices: Map<string, number>, ccl: number | null): CedearRow[] {
  return rows.map((row) => {
    const usPrice = usPrices.get(row.usSymbol);
    if (!usPrice || usPrice <= 0) return row;
    const fairPriceUsd = usPrice / row.ratio;
    if (!ccl || ccl <= 0) return { ...row, fairPriceUsd };
    const premium = ((row.priceArs / ccl) / fairPriceUsd - 1) * 100;
    return { ...row, fairPriceUsd, premiumPercent: Math.abs(premium) <= MAX_CREDIBLE_PREMIUM ? premium : null };
  });
}
