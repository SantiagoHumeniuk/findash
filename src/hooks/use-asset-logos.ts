// src/hooks/use-asset-logos.ts

import { useQuery } from '@tanstack/react-query';
import { fetchYahooLogos } from '../services/api/yahoo-finance-api';

/**
 * Logo URLs for a list of tickers, stored once in Supabase Storage by the Yahoo
 * proxy. Missing logos map to null so callers can show the ticker badge.
 */
export function useAssetLogos(symbols: readonly string[]): Record<string, string | null> {
  const key = [...new Set(symbols.map((symbol) => symbol.toUpperCase()))].sort();
  const { data } = useQuery({
    queryKey: ['asset-logos', key],
    queryFn: () => fetchYahooLogos(key),
    enabled: key.length > 0,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: false,
  });
  return data ?? {};
}
