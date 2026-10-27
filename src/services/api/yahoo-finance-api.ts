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

export interface YahooFinanceSearchResult {
  symbol: string;
  name: string;
  currency: string;
  exchange: string;
  exchangeName: string;
  quoteType: string;
}

export interface YahooFinanceNewsItem {
  title: string;
  url: string;
  publisher: string;
  publishedAt: number | null;
  image: string;
  relatedTickers: string[];
}

export interface YahooFinanceMarketMover {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
}

export interface YahooFinanceDividendEvent {
  symbol: string;
  exDividendDate: string;
  dividendDate: string;
  lastDividendValue: number | null;
  dividendYield: number | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? value as Record<string, unknown>
    : null;
}

function getString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function getFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

async function invokeYahooAction(
  body: Record<string, unknown>,
): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke('yahoo-finance-proxy', { body });
  if (error) {
    console.error('Error fetching Yahoo Finance data:', error);
    throw new Error('No se pudieron consultar datos de Yahoo Finance.');
  }
  if (
    typeof data === 'object' &&
    data !== null &&
    'error' in data &&
    typeof data.error === 'string'
  ) {
    throw new Error(data.error);
  }
  return data;
}

function parseYahooSearchResults(value: unknown): YahooFinanceSearchResult[] {
  const records = asRecord(value);
  if (!Array.isArray(records?.quotes)) {
    throw new Error('Yahoo Finance devolvió una respuesta de búsqueda inválida.');
  }
  return records.quotes.flatMap((item): YahooFinanceSearchResult[] => {
    const record = asRecord(item);
    const symbol = getString(record?.symbol);
    if (!record || !symbol) return [];
    return [{
      symbol,
      name: getString(record.name) ?? symbol,
      currency: getString(record.currency) ?? '',
      exchange: getString(record.exchange) ?? '',
      exchangeName: getString(record.exchangeName) ?? '',
      quoteType: getString(record.quoteType) ?? '',
    }];
  });
}

function parseYahooNews(value: unknown): YahooFinanceNewsItem[] {
  const records = asRecord(value);
  if (!Array.isArray(records?.news)) {
    throw new Error('Yahoo Finance devolvió una respuesta de noticias inválida.');
  }
  return records.news.flatMap((item): YahooFinanceNewsItem[] => {
    const record = asRecord(item);
    const title = getString(record?.title);
    const url = getString(record?.url);
    if (!record || !title || !url) return [];
    const relatedTickers = Array.isArray(record.relatedTickers)
      ? record.relatedTickers.filter((ticker): ticker is string => typeof ticker === 'string')
      : [];
    return [{
      title,
      url,
      publisher: getString(record.publisher) ?? 'Yahoo Finance',
      publishedAt: getFiniteNumber(record.publishedAt),
      image: getString(record.image) ?? '',
      relatedTickers,
    }];
  });
}

function parseYahooMovers(value: unknown): YahooFinanceMarketMover[] {
  const records = asRecord(value);
  if (!Array.isArray(records?.movers)) {
    throw new Error('Yahoo Finance devolvió una respuesta de mercado inválida.');
  }
  return records.movers.flatMap((item): YahooFinanceMarketMover[] => {
    const record = asRecord(item);
    const symbol = getString(record?.symbol);
    const price = getFiniteNumber(record?.price);
    if (!record || !symbol || price === null) return [];
    return [{
      symbol,
      name: getString(record.name) ?? symbol,
      price,
      change: getFiniteNumber(record.change) ?? 0,
      changePercent: getFiniteNumber(record.changePercent) ?? 0,
      volume: getFiniteNumber(record.volume) ?? 0,
    }];
  });
}

function parseYahooDividendEvents(value: unknown): YahooFinanceDividendEvent[] {
  const records = asRecord(value);
  if (!Array.isArray(records?.dividends)) {
    throw new Error('Yahoo Finance devolvió una respuesta de dividendos inválida.');
  }
  return records.dividends.flatMap((item): YahooFinanceDividendEvent[] => {
    const record = asRecord(item);
    const symbol = getString(record?.symbol);
    const exDividendDate = getString(record?.exDividendDate);
    const dividendDate = getString(record?.dividendDate);
    if (!record || !symbol || (!exDividendDate && !dividendDate)) return [];
    return [{
      symbol,
      exDividendDate: exDividendDate ?? '',
      dividendDate: dividendDate ?? '',
      lastDividendValue: getFiniteNumber(record.lastDividendValue),
      dividendYield: getFiniteNumber(record.dividendYield),
    }];
  });
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
async function fetchYahooQuotes(
  symbols: string[],
  marketDataOnly: boolean,
): Promise<YahooFinanceResponse> {
  const { data, error } = await supabase.functions.invoke('yahoo-finance-proxy', {
    body: { symbols, marketDataOnly },
  });

  if (error) {
    console.error('Error fetching Yahoo Finance quotes:', error);
    throw new Error('No se pudieron consultar los datos del activo.');
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
    throw new Error('La respuesta de cotizaciones está incompleta.');
  }
  return data;
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
  if (symbols.length === 0 || symbols.length > 8) {
    throw new Error('La consulta completa a Yahoo Finance admite entre 1 y 8 símbolos.');
  }
  return fetchYahooQuotes(symbols, false);
}

/**
 * Requests only current market snapshots, avoiding history and fundamentals calls.
 *
 * @param symbols - Symbols for the known-index ticker bar (maximum 15)
 * @returns Validated quote snapshots and their fetch time
 * @throws Error when the Supabase function fails or returns an invalid response
 */
export async function fetchYahooMarketQuotes(
  symbols: string[],
): Promise<YahooFinanceResponse> {
  if (symbols.length === 0 || symbols.length > 15) {
    throw new Error('La consulta de cotizaciones de mercado admite entre 1 y 15 símbolos.');
  }
  const batches: string[][] = [];
  for (let index = 0; index < symbols.length; index += 8) {
    batches.push(symbols.slice(index, index + 8));
  }
  const responses = await Promise.all(batches.map((batch) => fetchYahooQuotes(batch, true)));
  return {
    fetchedAt: responses.reduce(
      (latest, response) => response.fetchedAt > latest ? response.fetchedAt : latest,
      responses[0].fetchedAt,
    ),
    quotes: responses.flatMap((response) => response.quotes),
  };
}

/**
 * Searches symbols and listed assets through Yahoo Finance.
 */
export async function fetchYahooSearch(
  query: string,
  count = 30,
): Promise<YahooFinanceSearchResult[]> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery || normalizedQuery.length > 80 || count < 1 || count > 50) {
    throw new Error('La búsqueda debe incluir un texto válido y hasta 50 resultados.');
  }
  return parseYahooSearchResults(await invokeYahooAction({
    action: 'search',
    query: normalizedQuery,
    count: Math.floor(count),
  }));
}

/**
 * Fetches news available from Yahoo Finance search.
 */
export async function fetchYahooNews(
  query: string,
  count = 20,
): Promise<YahooFinanceNewsItem[]> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery || normalizedQuery.length > 120 || count < 1 || count > 50) {
    throw new Error('La búsqueda de noticias debe incluir un texto válido y hasta 50 resultados.');
  }
  return parseYahooNews(await invokeYahooAction({
    action: 'news',
    query: normalizedQuery,
    count: Math.floor(count),
  }));
}

/**
 * Fetches Yahoo Finance's predefined daily market screeners.
 */
export async function fetchYahooMarketScreener(
  screenId: 'day_gainers' | 'day_losers' | 'most_actives',
  count = 25,
): Promise<YahooFinanceMarketMover[]> {
  if (count < 1 || count > 50) {
    throw new Error('El screener debe solicitar entre 1 y 50 activos.');
  }
  return parseYahooMovers(await invokeYahooAction({
    action: 'screener',
    screenId,
    count: Math.floor(count),
  }));
}

/**
 * Fetches dividend dates for a bounded set of symbols from Yahoo Finance.
 */
export async function fetchYahooDividendCalendar(
  symbols: string[],
): Promise<YahooFinanceDividendEvent[]> {
  if (symbols.length === 0 || symbols.length > 50) {
    throw new Error('El calendario de dividendos admite entre 1 y 50 símbolos.');
  }
  const normalizedSymbols = symbols.map((symbol) => symbol.trim().toUpperCase());
  if (normalizedSymbols.some((symbol) => !/^[A-Z0-9.^=-]{1,15}$/.test(symbol))) {
    throw new Error('El calendario de dividendos contiene símbolos inválidos.');
  }
  return parseYahooDividendEvents(await invokeYahooAction({
    action: 'dividends',
    symbols: normalizedSymbols,
  }));
}
