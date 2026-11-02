import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '../../types/auth';
import type { Config } from '../../types/config';
import type { AssetData } from '../../types/dashboard';
import { queryClient } from '../../lib/react-query';
import { fetchYahooAsset, fetchYahooMarketQuotes, refreshYahooAssetQuote } from './yahoo-finance-api';
import { fetchTickerData, YAHOO_DATA_VERSION } from './asset-api';

const cacheState = vi.hoisted(() => ({
  row: null as { data: unknown; last_updated_at: string } | null,
  upsert: vi.fn(() => Promise.resolve({ error: null })),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: cacheState.row, error: null }),
        }),
      }),
      upsert: cacheState.upsert,
    }),
  },
}));
vi.mock('../../lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('./apiLimiter', () => ({
  hasApiCallsAvailable: vi.fn(() => Promise.resolve(true)),
  incrementApiCallCounter: vi.fn(() => Promise.resolve()),
}));
vi.mock('./yahoo-finance-api', () => ({
  fetchYahooAsset: vi.fn(),
  fetchYahooMarketQuotes: vi.fn(),
  refreshYahooAssetQuote: vi.fn(),
}));

const HOUR = 60 * 60 * 1000;

function cachedAsset(overrides: Partial<AssetData> = {}): AssetData {
  const longAgo = new Date(Date.now() - HOUR).toISOString();
  return {
    symbol: 'AAPL',
    profile: { symbol: 'AAPL', companyName: 'Apple' },
    quote: { symbol: 'AAPL', price: 100, change: 0, changePercentage: 0 },
    stockPriceChange: {},
    historicalReturns: [],
    dataSource: 'Yahoo Finance',
    yahooDataVersion: YAHOO_DATA_VERSION,
    yahooMetrics: { 'price.regularMarketPrice': 100 },
    yahooError: null,
    yahooAttemptedAt: longAgo,
    yahooQuoteAttemptedAt: longAgo,
    ...overrides,
  } as unknown as AssetData;
}

const load = () => fetchTickerData({
  queryKey: ['assetData', 'AAPL', {} as Config, { id: 'u1' } as User, { id: 'u1' } as Profile],
});

describe('fetchTickerData with saved data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it('returns fresh saved data without waiting for the quote and publishes it afterwards', async () => {
    cacheState.row = { data: cachedAsset(), last_updated_at: new Date(Date.now() - HOUR).toISOString() };
    let resolveQuote: (value: AssetData) => void = () => undefined;
    vi.mocked(refreshYahooAssetQuote).mockReturnValue(new Promise((resolve) => { resolveQuote = resolve; }));
    queryClient.setQueryData(['assetData', 'AAPL', 'u1'], cachedAsset());

    const asset = await load();
    expect(asset.quote.price).toBe(100);

    resolveQuote(cachedAsset({ quote: { symbol: 'AAPL', price: 110 } as AssetData['quote'] }));

    await vi.waitFor(() => {
      expect(queryClient.getQueryData<AssetData>(['assetData', 'AAPL', 'u1'])?.quote.price).toBe(110);
    });
    // The value already handed to the screen is not mutated by the refresh.
    expect(asset.quote.price).toBe(100);
    expect(refreshYahooAssetQuote).toHaveBeenCalledWith('AAPL');
  });

  it('shows expired data from the last day while it rebuilds in the background', async () => {
    cacheState.row = { data: cachedAsset(), last_updated_at: new Date(Date.now() - 5 * HOUR).toISOString() };
    vi.mocked(fetchYahooAsset).mockReturnValue(new Promise(() => undefined) as never);

    const asset = await load();

    expect(asset.quote.price).toBe(100);
    await vi.waitFor(() => expect(fetchYahooAsset).toHaveBeenCalledOnce());
  });

  it('waits for a rebuild when the saved data is too old or has an old format', async () => {
    vi.mocked(fetchYahooAsset).mockRejectedValue(new Error('offline'));

    cacheState.row = { data: cachedAsset(), last_updated_at: new Date(Date.now() - 30 * HOUR).toISOString() };
    await expect(load()).resolves.toMatchObject({ symbol: 'AAPL' });
    expect(fetchYahooAsset).toHaveBeenCalledOnce();

    vi.mocked(fetchYahooAsset).mockClear();
    cacheState.row = {
      data: cachedAsset({ yahooDataVersion: 1 }),
      last_updated_at: new Date(Date.now() - 5 * HOUR).toISOString(),
    };
    await load();
    expect(fetchYahooAsset).toHaveBeenCalledOnce();
  });

  it('never writes the shared cache from the browser', async () => {
    vi.mocked(fetchYahooAsset).mockResolvedValue(cachedAsset());
    cacheState.row = { data: cachedAsset({ yahooDataVersion: 1 }), last_updated_at: new Date(Date.now() - 5 * HOUR).toISOString() };
    await load();
    expect(cacheState.upsert).not.toHaveBeenCalled();
  });

  it('keeps a visitor\'s fresh quote in the browser and refuses uncached assets', async () => {
    const visit = () => fetchTickerData({ queryKey: ['assetData', 'MSFT', {} as Config, null, null] });
    vi.mocked(fetchYahooMarketQuotes).mockResolvedValue({ fetchedAt: new Date().toISOString(), quotes: [] });
    cacheState.row = { data: cachedAsset(), last_updated_at: new Date().toISOString() };
    await expect(visit()).resolves.toMatchObject({ symbol: 'AAPL' });
    await vi.waitFor(() => expect(fetchYahooMarketQuotes).toHaveBeenCalled());
    expect(refreshYahooAssetQuote).not.toHaveBeenCalled();

    cacheState.row = null;
    await expect(visit()).rejects.toThrow('Creá tu cuenta gratis');
    expect(fetchYahooAsset).not.toHaveBeenCalled();
  });
});
