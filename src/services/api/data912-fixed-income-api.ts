import { supabase } from '@/lib/supabase';

/**
 * One quote level returned by the DATA912 live market endpoints.
 */
export interface Data912BondQuote {
  symbol: string;
  q_bid: number;
  px_bid: number;
  px_ask: number;
  q_ask: number;
  v: number;
  q_op: number;
  c: number;
  pct_change: number;
}

/**
 * Live sovereign and corporate quotes, with independent errors for partial failures.
 */
export interface Data912FixedIncomeResponse {
  fetchedAt: string;
  sovereign: Data912BondQuote[];
  corporate: Data912BondQuote[];
  errors: {
    sovereign: string | null;
    corporate: string | null;
  };
}

function isQuote(value: unknown): value is Data912BondQuote {
  if (typeof value !== 'object' || value === null || !('symbol' in value) || typeof value.symbol !== 'string') {
    return false;
  }
  return ['q_bid', 'px_bid', 'px_ask', 'q_ask', 'v', 'q_op', 'c', 'pct_change'].every((key) =>
    key in value && typeof value[key] === 'number' && Number.isFinite(value[key])
  );
}

/**
 * Fetches live sovereign and corporate fixed-income quotes from the DATA912 proxy.
 *
 * @returns Both market lists and the timestamp at which the proxy fetched them
 * @throws Error if either upstream market fails or the response is malformed
 */
export async function fetchData912FixedIncome(): Promise<Data912FixedIncomeResponse> {
  const { data, error } = await supabase.functions.invoke('data912-fixed-income-proxy');
  if (error) {
    console.error('Error fetching DATA912 fixed income:', error);
    throw new Error(`No se pudieron consultar los bonos DATA912: ${error.message}`);
  }
  if (typeof data !== 'object' || data === null) {
    throw new Error('DATA912 devolvió una respuesta inválida');
  }
  if ('error' in data && typeof data.error === 'string') throw new Error(data.error);
  if (
    !('fetchedAt' in data) ||
    typeof data.fetchedAt !== 'string' ||
    !('sovereign' in data) ||
    !Array.isArray(data.sovereign) ||
    !data.sovereign.every(isQuote) ||
    !('corporate' in data) ||
    !Array.isArray(data.corporate) ||
    !data.corporate.every(isQuote) ||
    !('errors' in data) ||
    typeof data.errors !== 'object' ||
    data.errors === null ||
    !('sovereign' in data.errors) ||
    !(data.errors.sovereign === null || typeof data.errors.sovereign === 'string') ||
    !('corporate' in data.errors) ||
    !(data.errors.corporate === null || typeof data.errors.corporate === 'string')
  ) {
    throw new Error('DATA912 devolvió datos incompletos o con formato desconocido');
  }
  return data as Data912FixedIncomeResponse;
}
