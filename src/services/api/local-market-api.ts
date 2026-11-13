// src/services/api/local-market-api.ts

import { supabase } from '../../lib/supabase';

export type LocalInstrumentKind = 'stock' | 'bond' | 'corp' | 'note' | 'cedear';

/** Last price of an instrument listed in Buenos Aires, in the currency it trades in. */
export interface LocalQuote {
  symbol: string;
  price: number;
  changePercent: number | null;
  kind: LocalInstrumentKind;
}

export interface LocalMarket {
  fetchedAt: string;
  quotes: Map<string, LocalQuote>;
}

/** Bonds, ONs and letters are quoted per 100 nominal units. */
export const isFixedIncome = (kind: LocalInstrumentKind): boolean => kind === 'bond' || kind === 'corp' || kind === 'note';

/**
 * Bond tickers ending in D (MEP) or C (cable) are the dollar line of a peso bond, e.g. AL30D.
 * Their price is in dollars.
 */
export function isDollarQuotedLocal(symbol: string, quotes: Map<string, LocalQuote>): boolean {
  const quote = quotes.get(symbol);
  if (!quote || !isFixedIncome(quote.kind) || !/[DC]$/.test(symbol)) return false;
  return quotes.has(symbol.slice(0, -1));
}

/** Local stocks, CEDEARs, bonds, ONs and letters from DATA912 (cached for a minute on the server). */
export async function fetchLocalMarket(): Promise<LocalMarket> {
  const { data, error } = await supabase.functions.invoke('data912-fixed-income-proxy', { body: { market: 'local' } });
  if (error) throw new Error('No se pudieron consultar las cotizaciones del mercado argentino.');
  const payload = data as { fetchedAt?: unknown; quotes?: unknown; error?: unknown } | null;
  if (typeof payload?.error === 'string') throw new Error(payload.error);
  if (!payload || !Array.isArray(payload.quotes)) throw new Error('La respuesta del mercado argentino no es válida.');
  const quotes = new Map<string, LocalQuote>();
  for (const item of payload.quotes as LocalQuote[]) {
    if (typeof item?.symbol === 'string' && typeof item.price === 'number' && item.price > 0) {
      // A symbol can appear as a stock and a CEDEAR; the local stock is the more specific match.
      if (!quotes.has(item.symbol) || item.kind === 'stock') quotes.set(item.symbol, item);
    }
  }
  return { fetchedAt: typeof payload.fetchedAt === 'string' ? payload.fetchedAt : new Date().toISOString(), quotes };
}
