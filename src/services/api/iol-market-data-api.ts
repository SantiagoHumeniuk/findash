import { supabase } from '../../lib/supabase';

export type IolMarket = 'BCBA' | 'NYSE' | 'NASDAQ';
export type IolSettlementTerm = 'T0' | 'T1';

export interface IolMarketDataRequest {
  symbol: string;
  market: IolMarket;
  term: IolSettlementTerm;
}

export interface IolBookSide {
  price: number;
  size: number;
}

export interface IolMarketData {
  request: IolMarketDataRequest;
  quote: {
    currency: string;
    currentPrice: number;
    closePrice: number;
    changePercent: number;
    lastUpdated: string;
  };
  topOfBook: {
    bid: IolBookSide | null;
    ask: IolBookSide | null;
    lastUpdated: string;
  };
}

export type IolMarketDataResult =
  | IolMarketData
  | { request: IolMarketDataRequest; error: string };

const IOL_BATCH_SIZE = 40;

export function getIolMarketDataRequestKey(request: IolMarketDataRequest): string {
  return `${request.symbol.toUpperCase()}|${request.market}|${request.term}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseBookSide(value: unknown): IolBookSide | null {
  if (value === null) return null;
  if (
    !isRecord(value) ||
    typeof value.price !== 'number' ||
    !Number.isFinite(value.price) ||
    typeof value.size !== 'number' ||
    !Number.isFinite(value.size)
  ) {
    throw new Error('IOL devolvió una punta de mercado inválida.');
  }
  return { price: value.price, size: value.size };
}

function parseMarketData(value: unknown): IolMarketDataResult {
  if (!isRecord(value) || !isRecord(value.request)) {
    throw new Error('IOL devolvió una respuesta de cotización inválida.');
  }
  const { symbol, market, term } = value.request;
  if (
    typeof symbol !== 'string' ||
    (market !== 'BCBA' && market !== 'NYSE' && market !== 'NASDAQ') ||
    (term !== 'T0' && term !== 'T1')
  ) {
    throw new Error('IOL devolvió una referencia de instrumento inválida.');
  }
  const request: IolMarketDataRequest = { symbol, market, term };

  if (typeof value.error === 'string') {
    return { request, error: value.error };
  }
  if (!isRecord(value.quote) || !isRecord(value.quote.prices) ||
    !isRecord(value.quote.change) || !isRecord(value.topOfBook)) {
    throw new Error('IOL devolvió datos de mercado incompletos.');
  }
  const currentPrice = value.quote.prices.current;
  const closePrice = value.quote.prices.close;
  const changePercent = value.quote.change.percent;
  const lastUpdated = value.quote.last_updated;
  const bookUpdatedAt = value.topOfBook.lastUpdated;
  const currency = value.quote.currency;
  if (
    typeof currentPrice !== 'number' ||
    !Number.isFinite(currentPrice) ||
    typeof closePrice !== 'number' ||
    !Number.isFinite(closePrice) ||
    typeof changePercent !== 'number' ||
    !Number.isFinite(changePercent) ||
    typeof lastUpdated !== 'string' ||
    typeof bookUpdatedAt !== 'string' ||
    typeof currency !== 'string'
  ) {
    throw new Error('IOL devolvió una cotización con campos inválidos.');
  }

  return {
    request,
    quote: { currency, currentPrice, closePrice, changePercent, lastUpdated },
    topOfBook: {
      bid: parseBookSide(value.topOfBook.bid),
      ask: parseBookSide(value.topOfBook.ask),
      lastUpdated: bookUpdatedAt,
    },
  };
}

/** Fetches timestamped IOL quotes and top-of-book data for up to 40 instruments per request. */
export async function fetchIolMarketData(
  requests: IolMarketDataRequest[],
): Promise<IolMarketDataResult[]> {
  const results: IolMarketDataResult[] = [];
  for (let offset = 0; offset < requests.length; offset += IOL_BATCH_SIZE) {
    const batch = requests.slice(offset, offset + IOL_BATCH_SIZE);
    const { data, error } = await supabase.functions.invoke('iol-market-data-proxy', {
      body: { action: 'batch', requests: batch },
    });
    if (error) {
      throw new Error(`No se pudieron consultar las cotizaciones IOL: ${error.message}`);
    }
    if (!isRecord(data) || !Array.isArray(data.results)) {
      throw new Error('La respuesta de cotizaciones IOL no es válida.');
    }
    results.push(...data.results.map(parseMarketData));
  }
  return results;
}
