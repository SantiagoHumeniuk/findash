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
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    phone?: string | null;
    ceo?: string | null;
  };
  history: {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }[];
  quoteType: string | null;
  dividendHistory: { date: string; amount: number }[];
  fundamentals: YahooFundamentals;
  analyst: YahooAnalystData;
  peers: YahooPeerQuote[];
  error: string | null;
}

/** One fiscal period of financial statement values keyed by Yahoo field name (e.g. TotalRevenue). */
export interface YahooStatementPeriod {
  date: string;
  currency: string | null;
  values: Record<string, number>;
}

export interface YahooFundamentals {
  source: 'Yahoo Finance' | 'SEC EDGAR' | null;
  /** Annual statements, newest first, in a single reporting currency. */
  annual: YahooStatementPeriod[];
  /** Trailing twelve months for income statement and cash flow fields. */
  trailing: Record<string, number>;
  latestQuarterBalance: YahooStatementPeriod | null;
}

export interface YahooAnalystEstimate {
  period: string;
  endDate: string | null;
  epsAvg: number | null;
  epsLow: number | null;
  epsHigh: number | null;
  epsAnalysts: number | null;
  revenueAvg: number | null;
  revenueLow: number | null;
  revenueHigh: number | null;
  revenueAnalysts: number | null;
}

export interface YahooAnalystData {
  recommendationTrend: {
    period: string;
    strongBuy: number;
    buy: number;
    hold: number;
    sell: number;
    strongSell: number;
  }[];
  gradeUpdates: {
    date: string;
    firm: string;
    toGrade: string;
    fromGrade: string;
    action: string;
    priceTargetAction: string | null;
    currentPriceTarget: number | null;
    priorPriceTarget: number | null;
  }[];
  earningsHistory: {
    quarter: string;
    epsActual: number | null;
    epsEstimate: number | null;
    surprisePercent: number | null;
  }[];
  estimates: YahooAnalystEstimate[];
}

export interface YahooPeerQuote {
  symbol: string;
  name: string | null;
  price: number | null;
  marketCap: number | null;
  enterpriseValue: number | null;
  trailingPE: number | null;
  priceToBook: number | null;
  priceToSales: number | null;
  evToRevenue: number | null;
  evToEbitda: number | null;
  freeCashflow: number | null;
  ebitda: number | null;
  operatingMargins: number | null;
  returnOnEquity: number | null;
  debtToEquity: number | null;
}

/**
 * Yahoo Finance proxy response and server-side fetch time.
 */
export interface YahooFinanceResponse {
  fetchedAt: string;
  quotes: YahooFinanceQuote[];
  /** US 10-year Treasury yield as a fraction; only sent with full quotes. */
  riskFreeRate?: number | null;
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
  frequency: string;
}

export interface YahooSectorSummary {
  key: string;
  name: string;
  symbol: string | null;
  companiesCount: number | null;
  marketCap: number | null;
  marketWeight: number | null;
  dayChangePercent: number | null;
  ytdReturn: number | null;
  oneYearReturn: number | null;
  threeYearReturn: number | null;
  fiveYearReturn: number | null;
  industries: {
    key: string;
    name: string;
    symbol: string;
    marketWeight: number | null;
    dayChangePercent: number | null;
    ytdReturn: number | null;
  }[];
}

export interface YahooHistoryResponse {
  symbol: string;
  name: string | null;
  currency: string | null;
  history: YahooFinanceQuote['history'];
  cachedAt: string | null;
}

export interface SecFiling {
  symbol: string;
  companyName: string;
  form: string;
  filingDate: string;
  items: string;
  description: string;
  url: string;
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
      frequency: getString(record.frequency) ?? '',
    }];
  });
}

function getNumberRecord(value: unknown): Record<string, number> {
  const record = asRecord(value);
  if (!record) return {};
  return Object.fromEntries(
    Object.entries(record).filter((entry): entry is [string, number] => getFiniteNumber(entry[1]) !== null),
  );
}

function parseStatementPeriod(value: unknown): YahooStatementPeriod | null {
  const record = asRecord(value);
  const date = getString(record?.date);
  if (!record || !date || !Number.isFinite(Date.parse(date))) return null;
  return { date, currency: getString(record.currency), values: getNumberRecord(record.values) };
}

const EMPTY_FUNDAMENTALS: YahooFundamentals = { source: null, annual: [], trailing: {}, latestQuarterBalance: null };

function parseFundamentals(value: unknown): YahooFundamentals {
  const record = asRecord(value);
  if (!record) return EMPTY_FUNDAMENTALS;
  const source = record.source === 'Yahoo Finance' || record.source === 'SEC EDGAR' ? record.source : null;
  const annual = Array.isArray(record.annual)
    ? record.annual.flatMap((period) => {
      const parsed = parseStatementPeriod(period);
      return parsed ? [parsed] : [];
    }).sort((left, right) => right.date.localeCompare(left.date))
    : [];
  return {
    source,
    annual,
    trailing: getNumberRecord(record.trailing),
    latestQuarterBalance: parseStatementPeriod(record.latestQuarterBalance),
  };
}

function parseRecords<T>(value: unknown, parse: (record: Record<string, unknown>) => T | null): T[] {
  return Array.isArray(value)
    ? value.flatMap((item) => {
      const record = asRecord(item);
      const parsed = record ? parse(record) : null;
      return parsed ? [parsed] : [];
    })
    : [];
}

function parseAnalystData(value: unknown): YahooAnalystData {
  const record = asRecord(value);
  return {
    recommendationTrend: parseRecords(record?.recommendationTrend, (item) => {
      const period = getString(item.period);
      return period
        ? {
          period,
          strongBuy: getFiniteNumber(item.strongBuy) ?? 0,
          buy: getFiniteNumber(item.buy) ?? 0,
          hold: getFiniteNumber(item.hold) ?? 0,
          sell: getFiniteNumber(item.sell) ?? 0,
          strongSell: getFiniteNumber(item.strongSell) ?? 0,
        }
        : null;
    }),
    gradeUpdates: parseRecords(record?.gradeUpdates, (item) => {
      const date = getString(item.date);
      const firm = getString(item.firm);
      return date && firm
        ? {
          date,
          firm,
          toGrade: getString(item.toGrade) ?? '',
          fromGrade: getString(item.fromGrade) ?? '',
          action: getString(item.action) ?? '',
          priceTargetAction: getString(item.priceTargetAction),
          currentPriceTarget: getFiniteNumber(item.currentPriceTarget),
          priorPriceTarget: getFiniteNumber(item.priorPriceTarget),
        }
        : null;
    }),
    earningsHistory: parseRecords(record?.earningsHistory, (item) => {
      const quarter = getString(item.quarter);
      return quarter
        ? {
          quarter,
          epsActual: getFiniteNumber(item.epsActual),
          epsEstimate: getFiniteNumber(item.epsEstimate),
          surprisePercent: getFiniteNumber(item.surprisePercent),
        }
        : null;
    }),
    estimates: parseRecords(record?.estimates, (item) => {
      const period = getString(item.period);
      return period
        ? {
          period,
          endDate: getString(item.endDate),
          epsAvg: getFiniteNumber(item.epsAvg),
          epsLow: getFiniteNumber(item.epsLow),
          epsHigh: getFiniteNumber(item.epsHigh),
          epsAnalysts: getFiniteNumber(item.epsAnalysts),
          revenueAvg: getFiniteNumber(item.revenueAvg),
          revenueLow: getFiniteNumber(item.revenueLow),
          revenueHigh: getFiniteNumber(item.revenueHigh),
          revenueAnalysts: getFiniteNumber(item.revenueAnalysts),
        }
        : null;
    }),
  };
}

const PEER_NUMBER_FIELDS = [
  'price', 'marketCap', 'enterpriseValue', 'trailingPE', 'priceToBook', 'priceToSales', 'evToRevenue',
  'evToEbitda', 'freeCashflow', 'ebitda', 'operatingMargins', 'returnOnEquity', 'debtToEquity',
] as const;

function parsePeers(value: unknown): YahooPeerQuote[] {
  return parseRecords(value, (item) => {
    const symbol = getString(item.symbol);
    if (!symbol) return null;
    const numbers = Object.fromEntries(
      PEER_NUMBER_FIELDS.map((field) => [field, getFiniteNumber(item[field])]),
    ) as Record<(typeof PEER_NUMBER_FIELDS)[number], number | null>;
    return { symbol, name: getString(item.name), ...numbers };
  });
}

type YahooFinanceQuoteCore = Omit<YahooFinanceQuote, 'quoteType' | 'dividendHistory' | 'fundamentals' | 'analyst' | 'peers'>;

/**
 * Adds the statement, analyst and peer blocks. They are parsed leniently so the
 * client keeps working against an older deployed proxy that does not send them.
 */
function withQuoteExtras(quote: YahooFinanceQuoteCore): YahooFinanceQuote {
  const record = asRecord(quote);
  return {
    ...quote,
    quoteType: getString(record?.quoteType),
    dividendHistory: parseRecords(record?.dividendHistory, (item) => {
      const date = getString(item.date);
      const amount = getFiniteNumber(item.amount);
      return date && amount !== null ? { date, amount } : null;
    }),
    fundamentals: parseFundamentals(record?.fundamentals),
    analyst: parseAnalystData(record?.analyst),
    peers: parsePeers(record?.peers),
  };
}

function isMetric(value: unknown): value is YahooFinanceMetric {
  if (typeof value !== 'object' || value === null || !('value' in value)) return false;
  const metricValue = value.value;
  return metricValue === null || (typeof metricValue === 'number' && Number.isFinite(metricValue));
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isYahooHistory(value: unknown): value is YahooFinanceQuoteCore['history'] {
  return Array.isArray(value) && value.every((item) => {
    if (typeof item !== 'object' || item === null) return false;
    return 'date' in item && typeof item.date === 'string' &&
      Number.isFinite(Date.parse(item.date)) &&
      ['open', 'high', 'low', 'close', 'volume'].every((key) =>
        key in item && typeof item[key] === 'number' && Number.isFinite(item[key])
      );
  });
}

function isYahooFinanceQuote(value: unknown): value is YahooFinanceQuoteCore {
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

function isYahooFinanceResponse(
  value: unknown,
): value is { fetchedAt: string; quotes: YahooFinanceQuoteCore[] } {
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
  return {
    fetchedAt: data.fetchedAt,
    quotes: data.quotes.map(withQuoteExtras),
    riskFreeRate: getFiniteNumber(asRecord(data)?.riskFreeRate),
  };
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
 * @param symbols - Symbols for the ticker bar (maximum 20)
 * @returns Validated quote snapshots and their fetch time
 * @throws Error when the Supabase function fails or returns an invalid response
 */
export async function fetchYahooMarketQuotes(
  symbols: string[],
): Promise<YahooFinanceResponse> {
  if (symbols.length === 0 || symbols.length > 20) {
    throw new Error('La consulta de cotizaciones de mercado admite entre 1 y 20 símbolos.');
  }
  // Batches of 10 stay within the limit of the previously deployed proxy (15 symbols).
  const batches: string[][] = [];
  for (let index = 0; index < symbols.length; index += 10) {
    batches.push(symbols.slice(index, index + 10));
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

/**
 * Fetches Yahoo's sector taxonomy with each sector's and industry's own index symbol.
 */
export async function fetchYahooSectors(): Promise<YahooSectorSummary[]> {
  const records = asRecord(await invokeYahooAction({ action: 'sectors' }));
  if (!Array.isArray(records?.sectors)) {
    throw new Error('Yahoo Finance devolvió una respuesta de sectores inválida.');
  }
  return parseRecords(records.sectors, (sector) => {
    const key = getString(sector.key);
    if (!key) return null;
    return {
      key,
      name: getString(sector.name) ?? key,
      symbol: getString(sector.symbol),
      companiesCount: getFiniteNumber(sector.companiesCount),
      marketCap: getFiniteNumber(sector.marketCap),
      marketWeight: getFiniteNumber(sector.marketWeight),
      dayChangePercent: getFiniteNumber(sector.dayChangePercent),
      ytdReturn: getFiniteNumber(sector.ytdReturn),
      oneYearReturn: getFiniteNumber(sector.oneYearReturn),
      threeYearReturn: getFiniteNumber(sector.threeYearReturn),
      fiveYearReturn: getFiniteNumber(sector.fiveYearReturn),
      industries: parseRecords(sector.industries, (industry) => {
        const industryKey = getString(industry.key);
        const symbol = getString(industry.symbol);
        return industryKey && symbol
          ? {
            key: industryKey,
            name: getString(industry.name) ?? industryKey,
            symbol,
            marketWeight: getFiniteNumber(industry.marketWeight),
            dayChangePercent: getFiniteNumber(industry.dayChangePercent),
            ytdReturn: getFiniteNumber(industry.ytdReturn),
          }
          : null;
      }),
    };
  });
}

/**
 * Fetches OHLC history for any Yahoo symbol, including sector and industry indexes (^YH...).
 */
export async function fetchYahooHistory(
  symbol: string,
  range: '1mo' | '3mo' | '6mo' | 'ytd' | '1y' | '2y' | '5y' | '10y' | 'max' = '1y',
  interval: '1d' | '1wk' | '1mo' = '1d',
): Promise<YahooHistoryResponse> {
  const normalizedSymbol = symbol.trim().toUpperCase();
  if (!/^[A-Z0-9.^=-]{1,15}$/.test(normalizedSymbol)) {
    throw new Error('El símbolo solicitado no es válido.');
  }
  const record = asRecord(await invokeYahooAction({ action: 'history', symbol: normalizedSymbol, range, interval }));
  if (!record || !isYahooHistory(record.history)) {
    throw new Error('Yahoo Finance devolvió un historial inválido.');
  }
  return {
    symbol: getString(record.symbol) ?? normalizedSymbol,
    name: getString(record.name),
    currency: getString(record.currency),
    history: record.history,
    cachedAt: getString(record.cachedAt),
  };
}

/**
 * Fetches recent SEC filings (8-K, 10-K, 10-Q) for a US-listed issuer.
 */
export async function fetchSecFilings(symbol: string, count = 20): Promise<SecFiling[]> {
  const records = asRecord(await invokeYahooAction({
    action: 'filings',
    symbol: symbol.trim().toUpperCase(),
    count: Math.floor(count),
  }));
  if (!Array.isArray(records?.filings)) {
    throw new Error('La SEC devolvió una respuesta de presentaciones inválida.');
  }
  return parseRecords(records.filings, (filing) => {
    const form = getString(filing.form);
    const url = getString(filing.url);
    const filingDate = getString(filing.filingDate);
    if (!form || !url || !filingDate) return null;
    return {
      symbol: getString(filing.symbol) ?? symbol,
      companyName: getString(filing.companyName) ?? symbol,
      form,
      filingDate,
      items: getString(filing.items) ?? '',
      description: getString(filing.description) ?? form,
      url,
    };
  });
}
