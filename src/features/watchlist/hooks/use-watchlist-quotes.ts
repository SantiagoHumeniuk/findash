// src/features/watchlist/hooks/use-watchlist-quotes.ts

import { useQuery } from '@tanstack/react-query';
import { fetchYahooMarketQuotes, type YahooFinanceQuote } from '../../../services/api/yahoo-finance-api';

const BATCH_SIZE = 20;

/** Live quotes of the followed symbols, refreshed every minute while the page is open. */
export function useWatchlistQuotes(symbols: string[]) {
  const sorted = [...new Set(symbols)].sort();
  return useQuery({
    queryKey: ['watchlist-quotes', sorted],
    enabled: sorted.length > 0,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    queryFn: async () => {
      const batches: Promise<{ fetchedAt: string; quotes: YahooFinanceQuote[] }>[] = [];
      for (let index = 0; index < sorted.length; index += BATCH_SIZE) {
        batches.push(fetchYahooMarketQuotes(sorted.slice(index, index + BATCH_SIZE)));
      }
      const responses = await Promise.all(batches);
      return {
        fetchedAt: responses[0]?.fetchedAt ?? new Date().toISOString(),
        quotes: new Map(responses.flatMap((response) => response.quotes).map((quote) => [quote.symbol, quote])),
      };
    },
  });
}
