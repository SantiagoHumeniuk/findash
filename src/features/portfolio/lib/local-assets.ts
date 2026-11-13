// src/features/portfolio/lib/local-assets.ts

import type { AssetData } from '../../../types/dashboard';
import { isDollarQuotedLocal, isFixedIncome, type LocalMarket } from '../../../services/api/local-market-api';
import { ASSET_KIND_LABELS } from './broker-import';

/** Portfolio symbols ending in .BA are valued with Buenos Aires prices. */
export const isLocalPortfolioSymbol = (symbol: string) => symbol.toUpperCase().endsWith('.BA');

/**
 * A minimal asset for a local stock, bond, ON or letter, priced in dollars per unit (per share, or
 * per nominal unit for fixed income) by converting the peso price at CCL. The rest of the portfolio
 * works in dollars, so this is all it needs to value, chart and total the position.
 */
export function buildLocalAsset(symbol: string, market: LocalMarket, ccl: number): AssetData | null {
  const ticker = symbol.toUpperCase().replace(/\.BA$/, '');
  const quote = market.quotes.get(ticker);
  if (!quote || !(ccl > 0)) return null;
  const fixedIncome = isFixedIncome(quote.kind);
  const perUnit = fixedIncome ? quote.price / 100 : quote.price;
  const price = isDollarQuotedLocal(ticker, market.quotes) ? perUnit : perUnit / ccl;
  const changePercentage = quote.changePercent ?? 0;
  const change = price - price / (1 + changePercentage / 100);
  const label = fixedIncome ? ASSET_KIND_LABELS.bond : ASSET_KIND_LABELS['ar-stock'];

  return {
    symbol,
    profile: {
      symbol,
      companyName: ticker,
      price,
      currency: 'USD',
      exchange: 'BYMA',
      exchangeShortName: 'BYMA',
      sector: fixedIncome ? 'Renta fija' : '',
      industry: label,
      country: 'AR',
      beta: 0,
      marketCap: 0,
      image: '',
      changePercentage,
      change,
    },
    quote: {
      symbol,
      name: ticker,
      price,
      change,
      changePercentage,
      previousClose: price - change,
      timestamp: Math.floor(Date.parse(market.fetchedAt) / 1000),
    },
    keyMetrics: {},
    historicalReturns: [],
    priceTarget: {},
    dcf: [],
    rating: {},
    priceTargetConsensus: {},
    keyMetricsYearly: [],
    dcfLevered: {},
    stockPriceChange: {},
    ratios: [],
    analystEstimates: [],
    gradesConsensus: {},
    localMarket: { kind: quote.kind, arsPrice: dollarFree(quote.price, ticker, market, ccl), ccl, fetchedAt: market.fetchedAt },
  } as unknown as AssetData;
}

/** Price in pesos, as the broker shows it. */
function dollarFree(price: number, ticker: string, market: LocalMarket, ccl: number): number {
  return isDollarQuotedLocal(ticker, market.quotes) ? price * ccl : price;
}
