import { describe, expect, it } from 'vitest';
import type { LocalMarket } from '../../../services/api/local-market-api';
import { buildLocalAsset, isLocalPortfolioSymbol } from './local-assets';

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

  it('returns nothing for instruments not listed today', () => {
    expect(buildLocalAsset('XXXX.BA', market, 1500)).toBeNull();
    expect(isLocalPortfolioSymbol('ggal.ba')).toBe(true);
    expect(isLocalPortfolioSymbol('GGAL')).toBe(false);
  });
});
