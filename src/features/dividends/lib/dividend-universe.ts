// src/features/dividends/lib/dividend-universe.ts

/**
 * US dividend payers queried for the calendar in addition to the plan's
 * free-tier symbols: the S&P 500 Dividend Aristocrats plus large, widely held
 * payers (banks, telecoms, utilities, energy and REITs). Yahoo has no
 * market-wide dividend calendar, so the universe is explicit and reviewed by hand.
 */
export const DIVIDEND_UNIVERSE: readonly string[] = [
  // S&P 500 Dividend Aristocrats
  'ABBV', 'ABT', 'ADM', 'ADP', 'AFL', 'ALB', 'AMCR', 'AOS', 'APD', 'ATO', 'BDX', 'BEN', 'BF-B', 'BRO', 'CAH',
  'CAT', 'CB', 'CHD', 'CHRW', 'CINF', 'CL', 'CLX', 'CTAS', 'CVX', 'DOV', 'ECL', 'ED', 'EMR', 'ES', 'ESS',
  'EXPD', 'FAST', 'FDS', 'FRT', 'GD', 'GPC', 'GWW', 'HRL', 'IBM', 'ITW', 'JNJ', 'KMB', 'KO', 'LIN', 'LOW',
  'MCD', 'MDT', 'MKC', 'NDSN', 'NEE', 'NUE', 'O', 'PEP', 'PG', 'PNR', 'PPG', 'ROP', 'SHW', 'SJM', 'SPGI',
  'SWK', 'SYY', 'TGT', 'TROW', 'WMT', 'WST', 'XOM',
  // Large payers outside the Aristocrats list
  'AAPL', 'MSFT', 'AVGO', 'JPM', 'BAC', 'WFC', 'C', 'GS', 'MS', 'HD', 'UNH', 'TXN', 'QCOM', 'CSCO', 'ORCL',
  'VZ', 'T', 'MO', 'PM', 'PFE', 'MRK', 'BMY', 'GILD', 'AMGN', 'CVS', 'UPS', 'LMT', 'RTX', 'HON', 'MMM',
  'DUK', 'SO', 'D', 'AEP', 'KMI', 'OKE', 'COP', 'PSX', 'MPC', 'PLD', 'AMT', 'SPG', 'VICI', 'BLK', 'V', 'MA',
  'COST', 'SBUX', 'NKE', 'DE',
];

/** Merges the plan symbols with the universe, without duplicates, in a stable order. */
export function buildDividendSymbols(planSymbols: readonly string[]): string[] {
  return [...new Set([...planSymbols, ...DIVIDEND_UNIVERSE].map((symbol) => symbol.trim().toUpperCase()))]
    .filter((symbol) => /^[A-Z0-9.^=-]{1,15}$/.test(symbol));
}
