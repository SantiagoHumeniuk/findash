import { supabase } from '@/lib/supabase';

/**
 * One numeric field returned by the Yahoo Finance proxy.
 */
export interface YahooFinanceMetric {
  value: number | null;
}

/**
 * Quote, valuation fields, and market timestamp for one ticker.
 */
export interface YahooFinanceQuote {
  symbol: string;
  name: string | null;
  currency: string | null;
  price: YahooFinanceMetric;
  trailingPE: YahooFinanceMetric;
  forwardPE: YahooFinanceMetric;
  trailingEPS: YahooFinanceMetric;
  forwardEPS: YahooFinanceMetric;
  beta: YahooFinanceMetric;
  lastDividend: YahooFinanceMetric;
  marketCap: YahooFinanceMetric;
  change: YahooFinanceMetric;
  changePercent: YahooFinanceMetric;
  volume: YahooFinanceMetric;
  averageVolume: YahooFinanceMetric;
  dayLow: YahooFinanceMetric;
  dayHigh: YahooFinanceMetric;
  yearLow: YahooFinanceMetric;
  yearHigh: YahooFinanceMetric;
  priceAvg50: YahooFinanceMetric;
  priceAvg200: YahooFinanceMetric;
  open: YahooFinanceMetric;
  previousClose: YahooFinanceMetric;
  marketTimestamp: number | null;
  marketState: string | null;
  exchange: string | null;
  delayedByMinutes: number | null;
  metrics: Record<string, number | null>;
  companyProfile: {
    sector: string | null;
    industry: string | null;
    country: string | null;
    website: string | null;
    description: string | null;
    employees: number | null;
  };
  history: {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }[];
  error: string | null;
}

/**
 * Yahoo Finance proxy response and server-side fetch time.
 */
export interface YahooFinanceResponse {
  fetchedAt: string;
  quotes: YahooFinanceQuote[];
}

function isMetric(value: unknown): value is YahooFinanceMetric {
  if (typeof value !== 'object' || value === null || !('value' in value)) return false;
  const metricValue = value.value;
  return metricValue === null || (typeof metricValue === 'number' && Number.isFinite(metricValue));
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isYahooHistory(value: unknown): value is YahooFinanceQuote['history'] {
  return Array.isArray(value) && value.every((item) => {
    if (typeof item !== 'object' || item === null) return false;
    return 'date' in item && typeof item.date === 'string' &&
      Number.isFinite(Date.parse(item.date)) &&
      ['open', 'high', 'low', 'close', 'volume'].every((key) =>
        key in item && typeof item[key] === 'number' && Number.isFinite(item[key])
      );
  });
}

function isYahooFinanceQuote(value: unknown): value is YahooFinanceQuote {
  if (typeof value !== 'object' || value === null) return false;
  const companyProfile = 'companyProfile' in value && typeof value.companyProfile === 'object' && value.companyProfile !== null
    ? value.companyProfile
    : null;
  const metrics = 'metrics' in value && typeof value.metrics === 'object' && value.metrics !== null
    ? value.metrics
    : null;
  return (
    'symbol' in value &&
    typeof value.symbol === 'string' &&
    'name' in value &&
    isNullableString(value.name) &&
    'currency' in value &&
    isNullableString(value.currency) &&
    'price' in value &&
    isMetric(value.price) &&
    'trailingPE' in value &&
    isMetric(value.trailingPE) &&
    'forwardPE' in value &&
    isMetric(value.forwardPE) &&
    'trailingEPS' in value &&
    isMetric(value.trailingEPS) &&
    'forwardEPS' in value &&
    isMetric(value.forwardEPS) &&
    'beta' in value &&
    isMetric(value.beta) &&
    'lastDividend' in value &&
    isMetric(value.lastDividend) &&
    'marketCap' in value &&
    isMetric(value.marketCap) &&
    'change' in value &&
    isMetric(value.change) &&
    'changePercent' in value &&
    isMetric(value.changePercent) &&
    'volume' in value &&
    isMetric(value.volume) &&
    'averageVolume' in value &&
    isMetric(value.averageVolume) &&
    'dayLow' in value &&
    isMetric(value.dayLow) &&
    'dayHigh' in value &&
    isMetric(value.dayHigh) &&
    'yearLow' in value &&
    isMetric(value.yearLow) &&
    'yearHigh' in value &&
    isMetric(value.yearHigh) &&
    'priceAvg50' in value &&
    isMetric(value.priceAvg50) &&
    'priceAvg200' in value &&
    isMetric(value.priceAvg200) &&
    'open' in value &&
    isMetric(value.open) &&
    'previousClose' in value &&
    isMetric(value.previousClose) &&
    'marketTimestamp' in value &&
    (value.marketTimestamp === null || (typeof value.marketTimestamp === 'number' && Number.isFinite(value.marketTimestamp))) &&
    'marketState' in value &&
    isNullableString(value.marketState) &&
    'exchange' in value &&
    isNullableString(value.exchange) &&
    'delayedByMinutes' in value &&
    (value.delayedByMinutes === null || (typeof value.delayedByMinutes === 'number' && Number.isFinite(value.delayedByMinutes))) &&
    metrics !== null &&
    Object.values(metrics).every((metric) => metric === null || (typeof metric === 'number' && Number.isFinite(metric))) &&
    companyProfile !== null &&
    'sector' in companyProfile &&
    isNullableString(companyProfile.sector) &&
    'industry' in companyProfile &&
    isNullableString(companyProfile.industry) &&
    'country' in companyProfile &&
    isNullableString(companyProfile.country) &&
    'website' in companyProfile &&
    isNullableString(companyProfile.website) &&
    'description' in companyProfile &&
    isNullableString(companyProfile.description) &&
    'employees' in companyProfile &&
    (companyProfile.employees === null || (typeof companyProfile.employees === 'number' && Number.isFinite(companyProfile.employees))) &&
    'history' in value &&
    isYahooHistory(value.history) &&
    'error' in value &&
    isNullableString(value.error)
  );
}

function isYahooFinanceResponse(value: unknown): value is YahooFinanceResponse {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'fetchedAt' in value &&
    typeof value.fetchedAt === 'string' &&
    'quotes' in value &&
    Array.isArray(value.quotes) &&
    value.quotes.every(isYahooFinanceQuote)
  );
}

/**
 * Requests quote and valuation data from Yahoo Finance through Supabase.
 *
 * @param symbols - Uppercase ticker symbols to request (maximum 8)
 * @returns Yahoo Finance quote data and the time the proxy fetched it
 * @throws Error when the Supabase function fails or returns an invalid response
 */
export async function fetchYahooFinanceQuotes(
  symbols: string[],
): Promise<YahooFinanceResponse> {
  const { data, error } = await supabase.functions.invoke('yahoo-finance-proxy', {
    body: { symbols },
  });

  if (error) {
    console.error('Error fetching Yahoo Finance quotes:', error);
    throw new Error(`No se pudieron consultar los datos de Yahoo Finance: ${error.message}`);
  }
  if (
    typeof data === 'object' &&
    data !== null &&
    'error' in data &&
    typeof data.error === 'string'
  ) {
    throw new Error(data.error);
  }
  if (!isYahooFinanceResponse(data)) {
    throw new Error('Yahoo Finance devolvió datos incompletos');
  }
  return data;
}
