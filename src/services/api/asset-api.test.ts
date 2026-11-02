import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '../../types/auth';
import type { Config } from '../../types/config';
import type { AssetData } from '../../types/dashboard';
import { queryClient } from '../../lib/react-query';
import { fetchYahooFinanceQuotes, fetchYahooMarketQuotes } from './yahoo-finance-api';
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
  fetchYahooFinanceQuotes: vi.fn(),
  fetchYahooMarketQuotes: vi.fn(),
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
    let resolveQuote: (value: unknown) => void = () => undefined;
    vi.mocked(fetchYahooMarketQuotes).mockReturnValue(new Promise((resolve) => { resolveQuote = resolve; }) as never);
    queryClient.setQueryData(['assetData', 'AAPL', 'u1'], cachedAsset());

    const asset = await load();
    expect(asset.quote.price).toBe(100);

    resolveQuote({
      fetchedAt: new Date().toISOString(),
      quotes: [{
        symbol: 'AAPL',
        price: { value: 110 },
        previousClose: { value: 100 },
        change: { value: 10 },
        changePercent: { value: 10 },
        volume: { value: 1 },
        dayLow: { value: 99 },
        dayHigh: { value: 111 },
        open: { value: 100 },
        marketTimestamp: 1,
        error: null,
      }],
    });

    await vi.waitFor(() => {
      expect(queryClient.getQueryData<AssetData>(['assetData', 'AAPL', 'u1'])?.quote.price).toBe(110);
    });
    // The value already handed to the screen is not mutated by the refresh.
    expect(asset.quote.price).toBe(100);
    expect(cacheState.upsert).toHaveBeenCalled();
  });

  it('shows expired data from the last day while it rebuilds in the background', async () => {
    cacheState.row = { data: cachedAsset(), last_updated_at: new Date(Date.now() - 5 * HOUR).toISOString() };
    vi.mocked(fetchYahooFinanceQuotes).mockReturnValue(new Promise(() => undefined) as never);

    const asset = await load();

    expect(asset.quote.price).toBe(100);
    await vi.waitFor(() => expect(fetchYahooFinanceQuotes).toHaveBeenCalledOnce());
  });

  it('waits for a rebuild when the saved data is too old or has an old format', async () => {
    vi.mocked(fetchYahooFinanceQuotes).mockRejectedValue(new Error('offline'));

    cacheState.row = { data: cachedAsset(), last_updated_at: new Date(Date.now() - 30 * HOUR).toISOString() };
    await expect(load()).resolves.toMatchObject({ symbol: 'AAPL' });
    expect(fetchYahooFinanceQuotes).toHaveBeenCalledOnce();

    vi.mocked(fetchYahooFinanceQuotes).mockClear();
    cacheState.row = {
      data: cachedAsset({ yahooDataVersion: 1 }),
      last_updated_at: new Date(Date.now() - 5 * HOUR).toISOString(),
    };
    await load();
    expect(fetchYahooFinanceQuotes).toHaveBeenCalledOnce();
  });
});
