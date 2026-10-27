import { describe, expect, it } from 'vitest';
import type { YahooFinanceQuote } from '../../../services/api/yahoo-finance-api';
import { mapYahooMarketMover, S_AND_P_500_LEADERS } from './market-movers-service';

describe('Yahoo market leaders', () => {
  it('uses fifteen unique S&P 500 leaders in display order', () => {
    expect(S_AND_P_500_LEADERS).toHaveLength(15);
    expect(new Set(S_AND_P_500_LEADERS).size).toBe(15);
    expect(S_AND_P_500_LEADERS.slice(0, 3)).toEqual(['NVDA', 'MSFT', 'AAPL']);
  });

  it('calculates displayed change from price and previous close', () => {
    const quote = {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      price: { value: 105 },
      previousClose: { value: 100 },
      change: { value: 1 },
      changePercent: { value: 1 },
    } as YahooFinanceQuote;

    expect(mapYahooMarketMover(quote)).toEqual({
      symbol: 'AAPL',
      name: 'Apple Inc.',
      price: 105,
      change: 5,
      changesPercentage: 5,
    });
  });

  it('omits quotes without a valid previous close', () => {
    const quote = {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      price: { value: 105 },
      previousClose: { value: null },
    } as YahooFinanceQuote;

    expect(mapYahooMarketMover(quote)).toBeNull();
  });
});
