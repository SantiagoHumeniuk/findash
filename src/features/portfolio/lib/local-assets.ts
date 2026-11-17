// src/features/portfolio/lib/local-assets.ts

import type { AssetData } from '../../../types/dashboard';
import { isDollarQuotedLocal, isFixedIncome, type LocalMarket } from '../../../services/api/local-market-api';
import type { IolMarket, IolMarketData } from '../../../services/api/iol-market-data-api';
import { ASSET_KIND_LABELS } from './broker-import';
import { findCedearRatio, getCedearTickersForUnderlying } from '../../../data/cedear-ratio-lookup';

const MAX_BOOK_AGE_MS = 5 * 60 * 1000;
const MAX_QUOTE_AGE_MS = 5 * 60 * 1000;
const MAX_IMPLIED_CCL_AGE_MS = 5 * 60 * 1000;
const MAX_IMPLIED_CCL_SKEW_MS = 2 * 60 * 1000;
const MAX_FUTURE_TIMESTAMP_SKEW_MS = 30_000;

/** Portfolio symbols ending in .BA are valued with Buenos Aires prices. */
export const isLocalPortfolioSymbol = (symbol: string) => symbol.toUpperCase().endsWith('.BA');

/** Older imports stored the USD line suffix; use the canonical local ticker for portfolio lookup. */
export function normalizeLegacyPortfolioSymbol(symbol: string): string {
  const match = /^([A-Z0-9]+)\.D$/i.exec(symbol);
  return match ? `${match[1].toUpperCase()}.BA` : symbol;
}

/** Maps Yahoo exchange codes to the markets accepted by IOL's quote API. */
export function getIolMarketForExchange(exchange: string): IolMarket | null {
  const code = exchange.trim().toUpperCase();
  if (['NMS', 'NGM', 'NCM', 'NAS', 'NASDAQ', 'NASDAQGS', 'NASDAQGM', 'NASDAQCM'].includes(code)) {
    return 'NASDAQ';
  }
  if (['NYQ', 'NYS', 'NYSE', 'PCX', 'ASE', 'ARCX', 'NYSEARCA', 'NYSE ARCA'].includes(code)) {
    return 'NYSE';
  }
  return null;
}

/** Uses a tight recent midpoint, then the last close for stale quotes, or a fresh last trade. */
export function getReliableIolPrice(data: IolMarketData): { price: number; timestamp: number } | null {
  const quoteTimestamp = Date.parse(data.quote.lastUpdated);
  if (!Number.isFinite(quoteTimestamp)) return null;

  const { bid, ask, lastUpdated: bookUpdatedAt } = data.topOfBook;
  const bookTimestamp = Date.parse(bookUpdatedAt);
  if (bid && ask && bid.price > 0 && ask.price >= bid.price && bid.size > 0 && ask.size > 0) {
    const midpoint = (bid.price + ask.price) / 2;
    const spread = (ask.price - bid.price) / midpoint;
    const bookAge = Date.now() - bookTimestamp;
    if (
      Number.isFinite(bookTimestamp) &&
      bookAge >= -MAX_FUTURE_TIMESTAMP_SKEW_MS &&
      bookAge <= MAX_BOOK_AGE_MS &&
      spread <= 0.1
    ) {
      return { price: midpoint, timestamp: bookTimestamp };
    }
  }

  const quoteAge = Date.now() - quoteTimestamp;
  if (quoteAge > MAX_QUOTE_AGE_MS) {
    return data.quote.closePrice > 0
      ? { price: data.quote.closePrice, timestamp: quoteTimestamp }
      : null;
  }
  if (
    quoteAge < -MAX_FUTURE_TIMESTAMP_SKEW_MS ||
    !(data.quote.currentPrice > 0)
  ) return null;

  return { price: data.quote.currentPrice, timestamp: quoteTimestamp };
}

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
  const quoteTimestamp = Date.parse(quote.lastUpdated ?? market.fetchedAt);

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
      timestamp: Math.floor(quoteTimestamp / 1000),
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
    localMarket: {
      kind: quote.kind,
      arsPrice: dollarFree(quote.price, ticker, market, ccl),
      ccl,
      fetchedAt: quote.lastUpdated ?? market.fetchedAt,
      source: quote.source,
      lastUpdated: quote.lastUpdated,
      bid: quote.bid,
      ask: quote.ask,
      bookUpdatedAt: quote.bookUpdatedAt,
    },
  } as unknown as AssetData;
}

/**
 * Builds a fallback price for an underlying-share position from its BYMA CEDEAR quote.
 */
export function buildCedearUnderlyingAsset(
  symbol: string,
  market: LocalMarket,
  ccl: number,
  ratios: Record<string, number>,
): AssetData | null {
  if (!(ccl > 0)) return null;
  const cedearTicker = getCedearTickersForUnderlying(symbol, ratios)
    .find((ticker) => market.quotes.get(ticker)?.kind === 'cedear');
  if (!cedearTicker) return null;

  const quote = market.quotes.get(cedearTicker);
  const ratio = findCedearRatio(cedearTicker, ratios);
  if (!quote || !ratio) return null;

  const price = quote.price * ratio / ccl;
  const changePercentage = quote.changePercent ?? 0;
  const change = changePercentage > -100 ? price - price / (1 + changePercentage / 100) : 0;
  const quoteTimestamp = Date.parse(quote.lastUpdated ?? market.fetchedAt);

  return {
    symbol,
    profile: {
      symbol,
      companyName: symbol,
      price,
      currency: 'USD',
      exchange: 'BYMA',
      exchangeShortName: 'BYMA',
      sector: '',
      industry: 'CEDEAR',
      country: 'AR',
      beta: 0,
      marketCap: 0,
      image: '',
      changePercentage,
      change,
    },
    quote: {
      symbol,
      name: symbol,
      price,
      change,
      changePercentage,
      previousClose: price - change,
      timestamp: Math.floor(quoteTimestamp / 1000),
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
    localMarket: {
      kind: 'cedear',
      arsPrice: quote.price,
      ccl,
      cedearRatio: ratio,
      fetchedAt: quote.lastUpdated ?? market.fetchedAt,
      source: quote.source,
      lastUpdated: quote.lastUpdated,
      bid: quote.bid,
      ask: quote.ask,
      bookUpdatedAt: quote.bookUpdatedAt,
    },
  } as unknown as AssetData;
}

/**
 * Keeps Yahoo's USD quote and company data, and derives this CEDEAR's implied CCL.
 */
export function mergeCedearQuote(
  asset: AssetData,
  localAsset: AssetData,
  underlyingIolData?: IolMarketData,
): AssetData {
  const localMarket = localAsset.localMarket;
  const iolPrice = underlyingIolData?.quote.currency === 'USD'
    ? getReliableIolPrice(underlyingIolData)
    : null;
  const useIolPrice = iolPrice !== null &&
    (asset.quote.timestamp <= 0 || iolPrice.timestamp >= asset.quote.timestamp * 1000);
  const quote = useIolPrice && iolPrice && underlyingIolData
    ? {
      ...asset.quote,
      price: iolPrice.price,
      changePercentage: underlyingIolData.quote.changePercent,
      change: underlyingIolData.quote.changePercent > -100
        ? iolPrice.price - iolPrice.price / (1 + underlyingIolData.quote.changePercent / 100)
        : asset.quote.change,
      previousClose: underlyingIolData.quote.changePercent > -100
        ? iolPrice.price / (1 + underlyingIolData.quote.changePercent / 100)
        : asset.quote.previousClose,
      timestamp: Math.floor(iolPrice.timestamp / 1000),
    }
    : asset.quote.price > 0 ? asset.quote : localAsset.quote;
  const localTimestamp = localMarket?.lastUpdated
    ? Date.parse(localMarket.lastUpdated)
    : Number.NaN;
  const underlyingTimestamp = iolPrice?.timestamp ?? asset.quote.timestamp * 1000;
  const now = Date.now();
  const localAge = now - localTimestamp;
  const underlyingAge = now - underlyingTimestamp;
  const pricesAreSynchronized = Number.isFinite(localTimestamp) &&
    Number.isFinite(underlyingTimestamp) &&
    Math.abs(localTimestamp - underlyingTimestamp) <= MAX_IMPLIED_CCL_SKEW_MS &&
    localAge >= -MAX_FUTURE_TIMESTAMP_SKEW_MS &&
    localAge <= MAX_IMPLIED_CCL_AGE_MS &&
    underlyingAge >= -MAX_FUTURE_TIMESTAMP_SKEW_MS &&
    underlyingAge <= MAX_IMPLIED_CCL_AGE_MS;
  const impliedCcl = localMarket?.source === 'IOL'
    ? localMarket.cedearRatio && pricesAreSynchronized && quote.price > 0
      ? localMarket.arsPrice * localMarket.cedearRatio / (iolPrice?.price ?? quote.price)
      : undefined
    : localMarket?.cedearRatio && asset.quote.price > 0
    ? localMarket.arsPrice * localMarket.cedearRatio / asset.quote.price
    : undefined;

  return {
    ...asset,
    profile: {
      ...asset.profile,
      price: quote.price,
      currency: 'USD',
      change: quote.change,
      changePercentage: quote.changePercentage,
    },
    quote,
    localMarket: localMarket ? { ...localMarket, impliedCcl } : undefined,
  };
}

/** Price in pesos, as the broker shows it. */
function dollarFree(price: number, ticker: string, market: LocalMarket, ccl: number): number {
  return isDollarQuotedLocal(ticker, market.quotes) ? price * ccl : price;
}
