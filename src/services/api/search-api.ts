import { logger } from '../../lib/logger';
import type { Config } from '../../types/config';
import { fetchYahooSearch } from './yahoo-finance-api';

/**
 * Unified asset search result used by the ticker picker.
 */
export interface SearchResult {
  symbol: string;
  name: string;
  currency: string;
  stockExchange: string;
  exchangeShortName: string;
}

/**
 * Searches listed assets through Yahoo Finance.
 */
export async function searchAssets(
  query: string,
  _config: Config,
  limit = 50,
): Promise<SearchResult[]> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [];

  try {
    const results = await fetchYahooSearch(normalizedQuery, Math.min(Math.max(limit, 1), 50));
    return results
      .filter((result) => result.quoteType === 'EQUITY')
      .map((result) => ({
        symbol: result.symbol,
        name: result.name,
        currency: result.currency,
        stockExchange: result.exchangeName,
        exchangeShortName: result.exchange,
      }));
  } catch (error) {
    void logger.error('YAHOO_SEARCH_FAILED', error instanceof Error ? error.message : String(error));
    throw error;
  }
}
