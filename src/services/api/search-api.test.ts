import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Config } from '../../types/config';
import { fetchYahooSearch } from './yahoo-finance-api';
import { searchAssets } from './search-api';

vi.mock('./yahoo-finance-api', () => ({
  fetchYahooSearch: vi.fn(),
}));

vi.mock('../../lib/logger', () => ({
  logger: { error: vi.fn() },
}));

const mockedFetchYahooSearch = vi.mocked(fetchYahooSearch);

describe('searchAssets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns Yahoo-listed equities without restricting symbols to a local allowlist', async () => {
    mockedFetchYahooSearch.mockResolvedValue([
      {
        symbol: 'BRK-B',
        name: 'Berkshire Hathaway Inc.',
        currency: 'USD',
        exchange: 'NYSE',
        exchangeName: 'New York Stock Exchange',
        quoteType: 'EQUITY',
      },
      {
        symbol: '7203.T',
        name: 'Toyota Motor Corporation',
        currency: 'JPY',
        exchange: 'JPX',
        exchangeName: 'Tokyo Stock Exchange',
        quoteType: 'EQUITY',
      },
      {
        symbol: 'SPY',
        name: 'SPDR S&P 500 ETF Trust',
        currency: 'USD',
        exchange: 'NYSE',
        exchangeName: 'NYSE Arca',
        quoteType: 'ETF',
      },
    ]);

    const results = await searchAssets('company', {} as Config);

    expect(results.map(({ symbol }) => symbol)).toEqual(['BRK-B', '7203.T']);
    expect(mockedFetchYahooSearch).toHaveBeenCalledWith('company', 50);
  });

  it('does not send an empty query to Yahoo Finance', async () => {
    await expect(searchAssets('  ', {} as Config)).resolves.toEqual([]);
    expect(mockedFetchYahooSearch).not.toHaveBeenCalled();
  });
});
