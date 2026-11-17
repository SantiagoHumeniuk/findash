import { describe, expect, it } from 'vitest';
import type { LocalMarket } from '../../../services/api/local-market-api';
import bymaCedearRatios from '../../../data/cedear-ratios.json';
import {
  buildCedearUnderlyingAsset,
  buildLocalAsset,
  getIolMarketForExchange,
  getReliableIolPrice,
  isLocalPortfolioSymbol,
  mergeCedearQuote,
  normalizeLegacyPortfolioSymbol,
} from './local-assets';

const market: LocalMarket = {
  fetchedAt: '2026-11-15T15:00:00Z',
  quotes: new Map([
    ['GGAL', { symbol: 'GGAL', price: 6000, changePercent: 2, kind: 'stock' }],
    ['AL30', { symbol: 'AL30', price: 85_000, changePercent: 0, kind: 'bond' }],
    ['AL30D', { symbol: 'AL30D', price: 57, changePercent: 0, kind: 'bond' }],
  ]),
};

describe('buildLocalAsset', () => {
  it('prices a local stock per share in dollars at CCL', () => {
    const asset = buildLocalAsset('GGAL.BA', market, 1500)!;
    expect(asset.quote.price).toBeCloseTo(4);
    expect(asset.localMarket?.arsPrice).toBe(6000);
    expect(asset.quote.changePercentage).toBe(2);
  });

  it('prices bonds per nominal unit, and dollar lines without converting', () => {
    expect(buildLocalAsset('AL30.BA', market, 1500)!.quote.price).toBeCloseTo(850 / 1500);
    expect(buildLocalAsset('AL30D.BA', market, 1500)!.quote.price).toBeCloseTo(0.57);
  });

  it('values underlying-share positions from direct BYMA CEDEAR quotes', () => {
    const cedearMarket: LocalMarket = {
      ...market,
      quotes: new Map([
        ...market.quotes,
        ['NVDA', { symbol: 'NVDA', price: 13_000, changePercent: 1, kind: 'cedear' }],
        ['GOGL', { symbol: 'GOGL', price: 4_700, changePercent: 0, kind: 'cedear' }],
      ]),
    };

    expect(buildCedearUnderlyingAsset('NVDA', cedearMarket, 1500, bymaCedearRatios)!.quote.price)
      .toBeCloseTo(13_000 * bymaCedearRatios.NVDA / 1500);
    expect(buildCedearUnderlyingAsset('GOOGL', cedearMarket, 1500, bymaCedearRatios)!.localMarket?.arsPrice)
      .toBe(4_700);
  });

  it('uses the BYMA price while retaining the Yahoo company logo', () => {
    const cedearAsset = buildCedearUnderlyingAsset(
      'NVDA',
      {
        ...market,
        quotes: new Map([['NVDA', { symbol: 'NVDA', price: 13_000, changePercent: 0, kind: 'cedear' }]]),
      },
      1500,
      bymaCedearRatios,
    )!;
    const yahooAsset = {
      ...cedearAsset,
      profile: { ...cedearAsset.profile, image: 'https://example.test/nvda.png' },
      quote: { ...cedearAsset.quote, price: 999 },
    };

    const merged = mergeCedearQuote(yahooAsset, cedearAsset);
    expect(merged.quote.price).toBe(999);
    expect(merged.profile.image).toBe('https://example.test/nvda.png');
    expect(merged.localMarket?.impliedCcl)
      .toBeCloseTo(13_000 * bymaCedearRatios.NVDA / 999);
  });

  it('returns nothing for instruments not listed today', () => {
    expect(buildLocalAsset('XXXX.BA', market, 1500)).toBeNull();
    expect(isLocalPortfolioSymbol('ggal.ba')).toBe(true);
    expect(isLocalPortfolioSymbol('GGAL')).toBe(false);
  });

  it('normalizes legacy dollar-line symbols to their local ticker', () => {
    expect(normalizeLegacyPortfolioSymbol('BMA.D')).toBe('BMA.BA');
    expect(normalizeLegacyPortfolioSymbol('NVDAD')).toBe('NVDAD');
  });
});

describe('IOL portfolio pricing', () => {
  it('maps supported Yahoo exchange codes to IOL markets', () => {
    expect(getIolMarketForExchange('NMS')).toBe('NASDAQ');
    expect(getIolMarketForExchange('NYQ')).toBe('NYSE');
    expect(getIolMarketForExchange('PCX')).toBe('NYSE');
    expect(getIolMarketForExchange('LSE')).toBeNull();
  });

  it('uses a fresh, narrow midpoint instead of the last trade', () => {
    const updatedAt = new Date().toISOString();
    const price = getReliableIolPrice({
      request: { symbol: 'NVDA', market: 'NASDAQ', term: 'T1' },
      quote: {
        currency: 'USD',
        currentPrice: 99,
        closePrice: 98,
        changePercent: 1,
        lastUpdated: updatedAt,
      },
      topOfBook: {
        bid: { price: 100, size: 2 },
        ask: { price: 102, size: 3 },
        lastUpdated: updatedAt,
      },
    });

    expect(price?.price).toBe(101);
  });

  it('uses the latest market close instead of a stale IOL last trade', () => {
    const updatedAt = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const price = getReliableIolPrice({
      request: { symbol: 'BMA', market: 'BCBA', term: 'T0' },
      quote: {
        currency: 'ARS',
        currentPrice: 100,
        closePrice: 98,
        changePercent: 1,
        lastUpdated: updatedAt,
      },
      topOfBook: { bid: null, ask: null, lastUpdated: updatedAt },
    });

    expect(price).toEqual({ price: 98, timestamp: Date.parse(updatedAt) });
  });

  it('calculates implied CCL only from synchronized IOL quotes', () => {
    const localUpdatedAt = Date.now();
    const localTimestamp = new Date(localUpdatedAt).toISOString();
    const localAsset = buildCedearUnderlyingAsset(
      'NVDA',
      {
        ...market,
        fetchedAt: localTimestamp,
        quotes: new Map([[
          'NVDA',
          {
            symbol: 'NVDA',
            price: 13_000,
            changePercent: 0,
            kind: 'cedear',
            source: 'IOL',
            lastUpdated: localTimestamp,
            bid: 12_999,
            ask: 13_001,
            bookUpdatedAt: localTimestamp,
          },
        ]]),
      },
      1500,
      bymaCedearRatios,
    )!;
    const underlyingTimestamp = new Date(localUpdatedAt + 10_000).toISOString();
    const yahooAsset = {
      ...localAsset,
      quote: { ...localAsset.quote, price: 99, timestamp: Math.floor((localUpdatedAt - 60_000) / 1000) },
    };
    const underlyingIol = {
      request: { symbol: 'NVDA', market: 'NASDAQ' as const, term: 'T1' as const },
      quote: {
        currency: 'USD',
        currentPrice: 99,
        closePrice: 98,
        changePercent: 0,
        lastUpdated: underlyingTimestamp,
      },
      topOfBook: {
        bid: { price: 100, size: 2 },
        ask: { price: 102, size: 3 },
        lastUpdated: underlyingTimestamp,
      },
    };

    const merged = mergeCedearQuote(yahooAsset, localAsset, underlyingIol);
    expect(merged.quote.price).toBe(101);
    expect(merged.localMarket?.impliedCcl)
      .toBeCloseTo(13_000 * bymaCedearRatios.NVDA / 101);
  });

  it('does not present an implied CCL from stale, unsynchronized markets', () => {
    const localTimestamp = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const localAsset = buildCedearUnderlyingAsset(
      'NVDA',
      {
        ...market,
        fetchedAt: localTimestamp,
        quotes: new Map([[
          'NVDA',
          {
            symbol: 'NVDA',
            price: 13_000,
            changePercent: 0,
            kind: 'cedear',
            source: 'IOL',
            lastUpdated: localTimestamp,
          },
        ]]),
      },
      1500,
      bymaCedearRatios,
    )!;
    const underlyingIol = {
      request: { symbol: 'NVDA', market: 'NASDAQ' as const, term: 'T1' as const },
      quote: {
        currency: 'USD',
        currentPrice: 100,
        closePrice: 100,
        changePercent: 0,
        lastUpdated: new Date().toISOString(),
      },
      topOfBook: { bid: null, ask: null, lastUpdated: new Date().toISOString() },
    };

    const merged = mergeCedearQuote(localAsset, localAsset, underlyingIol);
    expect(merged.localMarket?.impliedCcl).toBeUndefined();
  });

  it('does not present an implied CCL from future-dated market data', () => {
    const futureTimestamp = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const localAsset = buildCedearUnderlyingAsset(
      'NVDA',
      {
        ...market,
        fetchedAt: futureTimestamp,
        quotes: new Map([[
          'NVDA',
          {
            symbol: 'NVDA',
            price: 13_000,
            changePercent: 0,
            kind: 'cedear',
            source: 'IOL',
            lastUpdated: futureTimestamp,
          },
        ]]),
      },
      1500,
      bymaCedearRatios,
    )!;
    const underlyingIol = {
      request: { symbol: 'NVDA', market: 'NASDAQ' as const, term: 'T1' as const },
      quote: {
        currency: 'USD',
        currentPrice: 100,
        closePrice: 100,
        changePercent: 0,
        lastUpdated: futureTimestamp,
      },
      topOfBook: { bid: null, ask: null, lastUpdated: futureTimestamp },
    };

    const merged = mergeCedearQuote(localAsset, localAsset, underlyingIol);
    expect(merged.localMarket?.impliedCcl).toBeUndefined();
  });
});
