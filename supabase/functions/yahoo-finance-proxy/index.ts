import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  asRecord,
  fetchJson,
  fetchWithCrumb,
  fetchWithRetry,
  getNumber,
  getRaw,
  getString,
  getYahooSession,
  mapWithConcurrency,
  type YahooSession,
} from "./http.ts";
import { withCache } from "./cache.ts";
import {
  EMPTY_FUNDAMENTALS,
  fetchSecFilings,
  fetchSecFundamentals,
  fetchYahooFundamentals,
  type Fundamentals,
  isSecConfigured,
} from "./fundamentals.ts";
import { fetchSectors } from "./sectors.ts";
import { findPreviousSessionClose, inferDividendFrequency } from "./calc.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const modules = [
  "price", "summaryDetail", "defaultKeyStatistics", "financialData", "assetProfile", "earningsTrend",
  "calendarEvents", "recommendationTrend", "upgradeDowngradeHistory", "earningsHistory",
].join(",");
const peerModules = "price,summaryDetail,defaultKeyStatistics,financialData";
const symbolPattern = /^[A-Z0-9.^=-]{1,15}$/;
const MAX_PEERS = 5;
const MAX_GRADE_UPDATES = 40;

type YahooMetric = {
  value: number | null;
};

type HistoryEntry = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type AnalystEstimate = {
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
};

type AnalystData = {
  recommendationTrend: Array<{
    period: string;
    strongBuy: number;
    buy: number;
    hold: number;
    sell: number;
    strongSell: number;
  }>;
  gradeUpdates: Array<{
    date: string;
    firm: string;
    toGrade: string;
    fromGrade: string;
    action: string;
    priceTargetAction: string | null;
    currentPriceTarget: number | null;
    priorPriceTarget: number | null;
  }>;
  earningsHistory: Array<{
    quarter: string;
    epsActual: number | null;
    epsEstimate: number | null;
    surprisePercent: number | null;
  }>;
  estimates: AnalystEstimate[];
};

type PeerQuote = {
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
};

type YahooQuote = {
  symbol: string;
  name: string | null;
  currency: string | null;
  price: YahooMetric;
  trailingPE: YahooMetric;
  forwardPE: YahooMetric;
  trailingEPS: YahooMetric;
  forwardEPS: YahooMetric;
  beta: YahooMetric;
  lastDividend: YahooMetric;
  marketCap: YahooMetric;
  change: YahooMetric;
  changePercent: YahooMetric;
  volume: YahooMetric;
  averageVolume: YahooMetric;
  dayLow: YahooMetric;
  dayHigh: YahooMetric;
  yearLow: YahooMetric;
  yearHigh: YahooMetric;
  priceAvg50: YahooMetric;
  priceAvg200: YahooMetric;
  open: YahooMetric;
  previousClose: YahooMetric;
  marketTimestamp: number | null;
  marketState: string | null;
  exchange: string | null;
  delayedByMinutes: number | null;
  quoteType: string | null;
  metrics: Record<string, number | null>;
  companyProfile: {
    sector: string | null;
    industry: string | null;
    country: string | null;
    website: string | null;
    description: string | null;
    employees: number | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    phone: string | null;
    ceo: string | null;
  };
  history: HistoryEntry[];
  dividendHistory: Array<{ date: string; amount: number }>;
  fundamentals: Fundamentals;
  analyst: AnalystData;
  peers: PeerQuote[];
  error: string | null;
};

function getMetric(record: Record<string, unknown> | null, key: string): YahooMetric {
  return { value: getRaw(record?.[key]) };
}

function getRawMetrics(value: unknown, prefix = ""): Record<string, number | null> {
  const record = asRecord(value);
  if (!record) return {};
  const result: Record<string, number | null> = {};
  for (const [key, child] of Object.entries(record)) {
    const raw = getNumber(asRecord(child)?.raw);
    if (raw !== null) {
      result[`${prefix}${key}`] = raw;
    }
  }
  return result;
}

function toIsoDate(timestamp: number | null): string | null {
  return timestamp === null ? null : new Date(timestamp * 1000).toISOString().slice(0, 10);
}

const EMPTY_ANALYST: AnalystData = { recommendationTrend: [], gradeUpdates: [], earningsHistory: [], estimates: [] };

function emptyQuote(symbol: string, error: string): YahooQuote {
  const emptyMetric = { value: null };
  return {
    symbol,
    name: null,
    currency: null,
    price: emptyMetric,
    trailingPE: emptyMetric,
    forwardPE: emptyMetric,
    trailingEPS: emptyMetric,
    forwardEPS: emptyMetric,
    beta: emptyMetric,
    lastDividend: emptyMetric,
    marketCap: emptyMetric,
    change: emptyMetric,
    changePercent: emptyMetric,
    volume: emptyMetric,
    averageVolume: emptyMetric,
    dayLow: emptyMetric,
    dayHigh: emptyMetric,
    yearLow: emptyMetric,
    yearHigh: emptyMetric,
    priceAvg50: emptyMetric,
    priceAvg200: emptyMetric,
    open: emptyMetric,
    previousClose: emptyMetric,
    marketTimestamp: null,
    marketState: null,
    exchange: null,
    delayedByMinutes: null,
    quoteType: null,
    metrics: {},
    companyProfile: {
      sector: null,
      industry: null,
      country: null,
      website: null,
      description: null,
      employees: null,
      address: null,
      city: null,
      state: null,
      zip: null,
      phone: null,
      ceo: null,
    },
    history: [],
    dividendHistory: [],
    fundamentals: EMPTY_FUNDAMENTALS,
    analyst: EMPTY_ANALYST,
    peers: [],
    error,
  };
}

function parseAnalystData(data: Record<string, unknown>): AnalystData {
  const trendItems = asRecord(data.recommendationTrend)?.trend;
  const historyItems = asRecord(data.upgradeDowngradeHistory)?.history;
  const earningsItems = asRecord(data.earningsHistory)?.history;
  const estimateItems = asRecord(data.earningsTrend)?.trend;
  return {
    recommendationTrend: Array.isArray(trendItems)
      ? trendItems.flatMap((item) => {
        const record = asRecord(item);
        const period = getString(record?.period);
        if (!record || !period) return [];
        return [{
          period,
          strongBuy: getNumber(record.strongBuy) ?? 0,
          buy: getNumber(record.buy) ?? 0,
          hold: getNumber(record.hold) ?? 0,
          sell: getNumber(record.sell) ?? 0,
          strongSell: getNumber(record.strongSell) ?? 0,
        }];
      })
      : [],
    gradeUpdates: Array.isArray(historyItems)
      ? historyItems.slice(0, MAX_GRADE_UPDATES).flatMap((item) => {
        const record = asRecord(item);
        const date = toIsoDate(getNumber(record?.epochGradeDate));
        const firm = getString(record?.firm);
        if (!record || !date || !firm) return [];
        return [{
          date,
          firm,
          toGrade: getString(record.toGrade) ?? "",
          fromGrade: getString(record.fromGrade) ?? "",
          action: getString(record.action) ?? "",
          priceTargetAction: getString(record.priceTargetAction),
          currentPriceTarget: getNumber(record.currentPriceTarget),
          priorPriceTarget: getNumber(record.priorPriceTarget),
        }];
      })
      : [],
    earningsHistory: Array.isArray(earningsItems)
      ? earningsItems.flatMap((item) => {
        const record = asRecord(item);
        const quarter = toIsoDate(getRaw(record?.quarter));
        if (!record || !quarter) return [];
        return [{
          quarter,
          epsActual: getRaw(record.epsActual),
          epsEstimate: getRaw(record.epsEstimate),
          surprisePercent: getRaw(record.surprisePercent),
        }];
      })
      : [],
    estimates: Array.isArray(estimateItems)
      ? estimateItems.flatMap((item) => {
        const record = asRecord(item);
        const period = getString(record?.period);
        if (!record || !period) return [];
        const earnings = asRecord(record.earningsEstimate);
        const revenue = asRecord(record.revenueEstimate);
        return [{
          period,
          endDate: getString(record.endDate),
          epsAvg: getRaw(earnings?.avg),
          epsLow: getRaw(earnings?.low),
          epsHigh: getRaw(earnings?.high),
          epsAnalysts: getRaw(earnings?.numberOfAnalysts),
          revenueAvg: getRaw(revenue?.avg),
          revenueLow: getRaw(revenue?.low),
          revenueHigh: getRaw(revenue?.high),
          revenueAnalysts: getRaw(revenue?.numberOfAnalysts),
        }];
      })
      : [],
  };
}

function findChiefExecutive(profile: Record<string, unknown> | null): string | null {
  const officers = Array.isArray(profile?.companyOfficers) ? profile.companyOfficers : [];
  for (const officer of officers) {
    const record = asRecord(officer);
    const title = getString(record?.title) ?? "";
    if (/chief executive officer|\bceo\b/i.test(title)) return getString(record?.name);
  }
  return null;
}

function normalizeQuote(symbol: string, payload: unknown): YahooQuote {
  const root = asRecord(payload);
  const quoteSummary = asRecord(root?.quoteSummary);
  const summaryError = asRecord(quoteSummary?.error);
  if (summaryError) {
    const message = getString(summaryError.description) ?? "Yahoo Finance rechazó la consulta";
    return emptyQuote(symbol, message);
  }

  const result = Array.isArray(quoteSummary?.result) ? quoteSummary.result[0] : null;
  const data = asRecord(result);
  if (!data) {
    return emptyQuote(symbol, "Yahoo Finance no devolvió datos para este símbolo");
  }

  const price = asRecord(data.price);
  const summaryDetail = asRecord(data.summaryDetail);
  const keyStatistics = asRecord(data.defaultKeyStatistics);
  const financialData = asRecord(data.financialData);
  const companyProfile = asRecord(data.assetProfile);
  const trend = asRecord(data.earningsTrend);
  const trendMetrics = Array.isArray(trend?.trend)
    ? trend.trend.flatMap((item) => {
      const itemRecord = asRecord(item);
      const period = getString(itemRecord?.period);
      const earningsEstimate = asRecord(itemRecord?.earningsEstimate);
      const revenueEstimate = asRecord(itemRecord?.revenueEstimate);
      if (!period) return [];
      const earnings = getRawMetrics(earningsEstimate, `earningsTrend.${period}.`);
      const revenue = getRawMetrics(revenueEstimate, `earningsTrend.${period}.revenue.`);
      return [{ ...earnings, ...revenue }];
    })
    : [];
  const marketPrice = getMetric(price, "regularMarketPrice").value;
  const previousClose = getMetric(price, "regularMarketPreviousClose").value;
  const dailyChange = marketPrice !== null && previousClose !== null && previousClose > 0
    ? {
      change: marketPrice - previousClose,
      changePercent: ((marketPrice - previousClose) / previousClose) * 100,
    }
    : null;

  return {
    ...emptyQuote(symbol, ""),
    name: getString(price?.longName) ?? getString(price?.shortName),
    currency: getString(price?.currency),
    price: getMetric(price, "regularMarketPrice"),
    trailingPE: getMetric(summaryDetail, "trailingPE"),
    forwardPE: getMetric(summaryDetail, "forwardPE").value !== null
      ? getMetric(summaryDetail, "forwardPE")
      : getMetric(keyStatistics, "forwardPE"),
    trailingEPS: getMetric(keyStatistics, "trailingEps"),
    forwardEPS: getMetric(keyStatistics, "forwardEps"),
    beta: getMetric(summaryDetail, "beta"),
    lastDividend: getMetric(summaryDetail, "dividendRate"),
    marketCap: getMetric(price, "marketCap"),
    change: dailyChange ? { value: dailyChange.change } : getMetric(price, "regularMarketChange"),
    changePercent: dailyChange ? { value: dailyChange.changePercent } : getMetric(price, "regularMarketChangePercent"),
    volume: getMetric(price, "regularMarketVolume"),
    averageVolume: getMetric(summaryDetail, "averageVolume"),
    dayLow: getMetric(price, "regularMarketDayLow"),
    dayHigh: getMetric(price, "regularMarketDayHigh"),
    yearLow: getMetric(summaryDetail, "fiftyTwoWeekLow"),
    yearHigh: getMetric(summaryDetail, "fiftyTwoWeekHigh"),
    priceAvg50: getMetric(summaryDetail, "fiftyDayAverage"),
    priceAvg200: getMetric(summaryDetail, "twoHundredDayAverage"),
    open: getMetric(price, "regularMarketOpen"),
    previousClose: getMetric(price, "regularMarketPreviousClose"),
    marketTimestamp: getNumber(price?.regularMarketTime),
    marketState: getString(price?.marketState),
    exchange: getString(price?.exchangeName) ?? getString(price?.exchange),
    delayedByMinutes: getNumber(price?.exchangeDataDelayedBy),
    quoteType: getString(price?.quoteType),
    metrics: {
      ...getRawMetrics(price, "price."),
      ...getRawMetrics(summaryDetail, "summaryDetail."),
      ...getRawMetrics(keyStatistics, "keyStatistics."),
      ...getRawMetrics(financialData, "financialData."),
      ...getRawMetrics(companyProfile, "assetProfile."),
      ...getRawMetrics(asRecord(data.calendarEvents), "calendarEvents."),
      ...Object.assign({}, ...trendMetrics),
    },
    companyProfile: {
      sector: getString(companyProfile?.sector),
      industry: getString(companyProfile?.industry),
      country: getString(companyProfile?.country),
      website: getString(companyProfile?.website),
      description: getString(companyProfile?.longBusinessSummary),
      employees: getNumber(companyProfile?.fullTimeEmployees),
      address: getString(companyProfile?.address1),
      city: getString(companyProfile?.city),
      state: getString(companyProfile?.state),
      zip: getString(companyProfile?.zip),
      phone: getString(companyProfile?.phone),
      ceo: findChiefExecutive(companyProfile),
    },
    analyst: parseAnalystData(data),
    error: null,
  };
}

type ParsedChart = {
  meta: Record<string, unknown>;
  candles: Array<HistoryEntry & { timestamp: number }>;
  dividends: Array<{ date: string; amount: number }>;
};

function parseChart(payload: unknown): ParsedChart | null {
  const chart = asRecord(asRecord(payload)?.chart);
  const result = Array.isArray(chart?.result) ? asRecord(chart.result[0]) : null;
  const meta = asRecord(result?.meta);
  if (!result || !meta) return null;
  const timestamps = Array.isArray(result.timestamp) ? result.timestamp : [];
  const indicators = asRecord(result.indicators);
  const quote = Array.isArray(indicators?.quote) ? asRecord(indicators.quote[0]) : null;
  const column = (key: string): unknown[] => Array.isArray(quote?.[key]) ? quote[key] as unknown[] : [];
  const [opens, highs, lows, closes, volumes] = ["open", "high", "low", "close", "volume"].map(column);

  const candles = timestamps.flatMap((timestamp, index) => {
    const close = getNumber(closes[index]);
    if (typeof timestamp !== "number" || close === null) return [];
    return [{
      timestamp,
      date: new Date(timestamp * 1000).toISOString().slice(0, 10),
      open: getNumber(opens[index]) ?? close,
      high: getNumber(highs[index]) ?? close,
      low: getNumber(lows[index]) ?? close,
      close,
      volume: getNumber(volumes[index]) ?? 0,
    }];
  });
  const dividendEvents = asRecord(asRecord(result.events)?.dividends);
  const dividends = Object.values(dividendEvents ?? {}).flatMap((event) => {
    const record = asRecord(event);
    const amount = getNumber(record?.amount);
    const date = toIsoDate(getNumber(record?.date));
    return amount !== null && date ? [{ date, amount }] : [];
  }).sort((left, right) => left.date.localeCompare(right.date));
  return { meta, candles, dividends };
}

async function fetchChart(
  symbol: string,
  range: string,
  interval: string,
  includeDividends = false,
): Promise<ParsedChart | null> {
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  url.searchParams.set("range", range);
  url.searchParams.set("interval", interval);
  if (includeDividends) url.searchParams.set("events", "div");
  const response = await fetchWithRetry(url);
  if (!response.ok) {
    await response.body?.cancel();
    return null;
  }
  return parseChart(await response.json());
}

type YahooMarketSnapshot = {
  name: string | null;
  currency: string | null;
  exchange: string | null;
  quoteType: string | null;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  volume: number | null;
  dayLow: number | null;
  dayHigh: number | null;
  yearLow: number | null;
  yearHigh: number | null;
  open: number | null;
  previousClose: number | null;
  marketTimestamp: number | null;
  priceAvg50: number | null;
  priceAvg200: number | null;
};

async function fetchMarketSnapshot(symbol: string): Promise<YahooMarketSnapshot | null> {
  const chart = await fetchChart(symbol, "1y", "1d");
  if (!chart) return null;
  const { meta, candles } = chart;
  const closes = candles.map((candle) => candle.close);
  const average = (count: number) => closes.length >= count
    ? closes.slice(-count).reduce((sum, value) => sum + value, 0) / count
    : null;
  const marketTimestamp = getNumber(meta.regularMarketTime);
  const price = getNumber(meta.regularMarketPrice) ?? closes.at(-1) ?? null;
  const previousClose = findPreviousSessionClose(candles, marketTimestamp) ?? getNumber(meta.previousClose);

  return {
    name: getString(meta.longName) ?? getString(meta.shortName),
    currency: getString(meta.currency),
    exchange: getString(meta.fullExchangeName) ?? getString(meta.exchangeName),
    quoteType: getString(meta.instrumentType),
    price,
    change: price !== null && previousClose !== null ? price - previousClose : null,
    changePercent: price !== null && previousClose !== null && previousClose > 0
      ? ((price - previousClose) / previousClose) * 100
      : null,
    volume: getNumber(meta.regularMarketVolume),
    dayLow: getNumber(meta.regularMarketDayLow),
    dayHigh: getNumber(meta.regularMarketDayHigh),
    yearLow: getNumber(meta.fiftyTwoWeekLow),
    yearHigh: getNumber(meta.fiftyTwoWeekHigh),
    open: getNumber(meta.regularMarketOpen),
    previousClose,
    marketTimestamp,
    priceAvg50: average(50),
    priceAvg200: average(200),
  };
}

function applyMarketSnapshot(quote: YahooQuote, snapshot: YahooMarketSnapshot | null): YahooQuote {
  if (!snapshot) return quote;
  const snapshotIsNewer = snapshot.marketTimestamp !== null &&
    (quote.marketTimestamp === null || snapshot.marketTimestamp >= quote.marketTimestamp);
  if (snapshotIsNewer || quote.price.value === null) {
    quote.name = snapshot.name ?? quote.name;
    quote.currency = snapshot.currency ?? quote.currency;
    quote.exchange = snapshot.exchange ?? quote.exchange;
    quote.price = { value: snapshot.price };
    quote.change = { value: snapshot.change };
    quote.changePercent = { value: snapshot.changePercent };
    quote.volume = { value: snapshot.volume };
    quote.dayLow = { value: snapshot.dayLow };
    quote.dayHigh = { value: snapshot.dayHigh };
    quote.open = { value: snapshot.open };
    quote.previousClose = { value: snapshot.previousClose };
    quote.marketTimestamp = snapshot.marketTimestamp;
  }
  quote.quoteType ??= snapshot.quoteType;
  quote.yearLow = { value: quote.yearLow.value ?? snapshot.yearLow };
  quote.yearHigh = { value: quote.yearHigh.value ?? snapshot.yearHigh };
  quote.priceAvg50 = { value: quote.priceAvg50.value ?? snapshot.priceAvg50 };
  quote.priceAvg200 = { value: quote.priceAvg200.value ?? snapshot.priceAvg200 };
  return quote;
}

function attachHistory(quote: YahooQuote, chart: ParsedChart | null): YahooQuote {
  const history = (chart?.candles ?? []).map(({ timestamp: _timestamp, ...entry }) => entry);
  quote.history = history;
  quote.dividendHistory = chart?.dividends ?? [];
  const latest = history[history.length - 1];
  const hasValidPrice = quote.price.value !== null && Number.isFinite(quote.price.value) && quote.price.value > 0;
  if (!latest || hasValidPrice) return quote;

  const previous = history[history.length - 2];
  const change = previous ? latest.close - previous.close : null;
  quote.price = { value: latest.close };
  quote.open = { value: latest.open };
  quote.dayLow = { value: latest.low };
  quote.dayHigh = { value: latest.high };
  quote.volume = { value: latest.volume };
  quote.previousClose = { value: previous?.close ?? null };
  quote.change = { value: change };
  quote.changePercent = {
    value: previous && previous.close > 0 && change !== null
      ? (change / previous.close) * 100
      : null,
  };
  quote.marketTimestamp = Math.floor(Date.parse(`${latest.date}T00:00:00Z`) / 1000);
  return quote;
}

async function fetchHistoryChart(symbol: string): Promise<ParsedChart | null> {
  return await fetchChart(symbol, "5y", "1wk", true);
}

async function fetchMarketQuote(symbol: string): Promise<YahooQuote> {
  const snapshot = await fetchMarketSnapshot(symbol);
  if (!snapshot || snapshot.price === null || snapshot.price <= 0) {
    return emptyQuote(symbol, "Yahoo Finance no devolvió una cotización válida");
  }
  return applyMarketSnapshot(emptyQuote(symbol, ""), snapshot);
}

async function fetchFundamentals(symbol: string, quoteType: string | null): Promise<Fundamentals> {
  if (quoteType && quoteType !== "EQUITY") return EMPTY_FUNDAMENTALS;
  try {
    const yahoo = await fetchYahooFundamentals(symbol);
    if (yahoo.annual.length >= 2 || !isSecConfigured()) return yahoo;
    const sec = await fetchSecFundamentals(symbol);
    return sec.annual.length > yahoo.annual.length
      ? { ...sec, trailing: yahoo.trailing, latestQuarterBalance: yahoo.latestQuarterBalance }
      : yahoo;
  } catch (error) {
    console.error(`Fundamentals request failed for ${symbol}:`, error);
    return EMPTY_FUNDAMENTALS;
  }
}

function parsePeerQuote(symbol: string, payload: unknown): PeerQuote | null {
  const result = asRecord(asRecord(payload)?.quoteSummary)?.result;
  const data = Array.isArray(result) ? asRecord(result[0]) : null;
  if (!data) return null;
  const price = asRecord(data.price);
  const summary = asRecord(data.summaryDetail);
  const statistics = asRecord(data.defaultKeyStatistics);
  const financial = asRecord(data.financialData);
  return {
    symbol,
    name: getString(price?.longName) ?? getString(price?.shortName),
    price: getRaw(price?.regularMarketPrice),
    marketCap: getRaw(price?.marketCap),
    enterpriseValue: getRaw(statistics?.enterpriseValue),
    trailingPE: getRaw(summary?.trailingPE),
    priceToBook: getRaw(statistics?.priceToBook),
    priceToSales: getRaw(summary?.priceToSalesTrailing12Months),
    evToRevenue: getRaw(statistics?.enterpriseToRevenue),
    evToEbitda: getRaw(statistics?.enterpriseToEbitda),
    freeCashflow: getRaw(financial?.freeCashflow),
    ebitda: getRaw(financial?.ebitda),
    operatingMargins: getRaw(financial?.operatingMargins),
    returnOnEquity: getRaw(financial?.returnOnEquity),
    debtToEquity: getRaw(financial?.debtToEquity),
  };
}

/** Yahoo's "similar symbols" plus their valuation multiples, used as comparables. */
async function fetchPeers(symbol: string, session: YahooSession): Promise<PeerQuote[]> {
  try {
    const payload = await fetchJson(
      `https://query2.finance.yahoo.com/v6/finance/recommendationsbysymbol/${encodeURIComponent(symbol)}`,
    );
    const result = asRecord(payload)?.finance;
    const first = Array.isArray(asRecord(result)?.result) ? asRecord((asRecord(result)?.result as unknown[])[0]) : null;
    const symbols = (Array.isArray(first?.recommendedSymbols) ? first.recommendedSymbols : [])
      .map((item) => getString(asRecord(item)?.symbol))
      .filter((peer): peer is string => peer !== null && peer !== symbol && symbolPattern.test(peer))
      .slice(0, MAX_PEERS);
    const peers = await mapWithConcurrency(symbols, 3, async (peer) => {
      try {
        const { payload: peerPayload } = await fetchWithCrumb((crumb) => {
          const url = new URL(`https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(peer)}`);
          url.searchParams.set("modules", peerModules);
          url.searchParams.set("crumb", crumb);
          return url;
        }, session);
        return parsePeerQuote(peer, peerPayload);
      } catch (error) {
        console.warn(`Peer request failed for ${peer}:`, error);
        return null;
      }
    });
    return peers.filter((peer): peer is PeerQuote => peer !== null && peer.price !== null);
  } catch (error) {
    console.warn(`Peer list request failed for ${symbol}:`, error);
    return [];
  }
}

async function fetchQuote(symbol: string, session: YahooSession): Promise<YahooQuote> {
  const [summaryResult, historyResult, snapshotResult, peersResult] = await Promise.allSettled([
    fetchWithCrumb((crumb) => {
      const url = new URL(`https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}`);
      url.searchParams.set("modules", modules);
      url.searchParams.set("crumb", crumb);
      return url;
    }, session),
    fetchHistoryChart(symbol),
    fetchMarketSnapshot(symbol),
    fetchPeers(symbol, session),
  ]);
  const history = historyResult.status === "fulfilled" ? historyResult.value : null;
  const marketSnapshot = snapshotResult.status === "fulfilled" ? snapshotResult.value : null;
  if (historyResult.status === "rejected") {
    console.error(`Yahoo history request failed for ${symbol}:`, historyResult.reason);
  }
  if (snapshotResult.status === "rejected") {
    console.error(`Yahoo chart quote request failed for ${symbol}:`, snapshotResult.reason);
  }

  const quote = summaryResult.status === "fulfilled" && summaryResult.value.payload !== null
    ? normalizeQuote(symbol, summaryResult.value.payload)
    : emptyQuote(
      symbol,
      summaryResult.status === "rejected"
        ? "Yahoo Finance no pudo consultar las métricas fundamentales; se usa la cotización pública del gráfico"
        : "Yahoo Finance devolvió una respuesta no JSON; se usa la cotización pública del gráfico",
    );
  const enriched = attachHistory(applyMarketSnapshot(quote, marketSnapshot), history);
  enriched.peers = peersResult.status === "fulfilled" ? peersResult.value : [];
  enriched.fundamentals = await fetchFundamentals(symbol, enriched.quoteType);
  return enriched;
}

async function fetchPublicYahooData(symbol: string, error: string): Promise<YahooQuote> {
  const [historyResult, snapshotResult] = await Promise.allSettled([
    fetchHistoryChart(symbol),
    fetchMarketSnapshot(symbol),
  ]);
  const history = historyResult.status === "fulfilled" ? historyResult.value : null;
  const snapshot = snapshotResult.status === "fulfilled" ? snapshotResult.value : null;
  if (historyResult.status === "rejected") {
    console.error(`Yahoo history request failed for ${symbol}:`, historyResult.reason);
  }
  if (snapshotResult.status === "rejected") {
    console.error(`Yahoo chart quote request failed for ${symbol}:`, snapshotResult.reason);
  }
  const quote = attachHistory(applyMarketSnapshot(emptyQuote(symbol, error), snapshot), history);
  quote.fundamentals = await fetchFundamentals(symbol, quote.quoteType);
  return quote;
}

/** US 10-year Treasury yield (^TNX) as a fraction, shared across requests for six hours. */
async function fetchRiskFreeRate(): Promise<number | null> {
  try {
    const { data } = await withCache("yahoo:risk-free-rate", 6 * 60 * 60 * 1000, async () => {
      const snapshot = await fetchMarketSnapshot("^TNX");
      if (snapshot?.price === null || snapshot?.price === undefined || snapshot.price <= 0) {
        throw new Error("Yahoo Finance no devolvió el rendimiento del bono a 10 años");
      }
      return snapshot.price / 100;
    });
    return data;
  } catch (error) {
    console.warn("Risk-free rate request failed:", error);
    return null;
  }
}

async function fetchSearch(query: string, count: number): Promise<unknown[]> {
  const url = new URL("https://query1.finance.yahoo.com/v1/finance/search");
  url.searchParams.set("q", query);
  url.searchParams.set("quotesCount", String(count));
  url.searchParams.set("newsCount", "0");
  const payload = asRecord(await fetchJson(url));
  return Array.isArray(payload?.quotes) ? payload.quotes : [];
}

async function fetchNews(query: string, count: number): Promise<unknown[]> {
  const url = new URL("https://query1.finance.yahoo.com/v1/finance/search");
  url.searchParams.set("q", query);
  url.searchParams.set("quotesCount", "0");
  url.searchParams.set("newsCount", String(count));
  const payload = asRecord(await fetchJson(url));
  return Array.isArray(payload?.news) ? payload.news : [];
}

async function fetchScreener(
  screenId: "day_gainers" | "day_losers" | "most_actives",
  count: number,
): Promise<unknown[]> {
  const url = new URL("https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved");
  url.searchParams.set("scrIds", screenId);
  url.searchParams.set("count", String(count));
  url.searchParams.set("formatted", "false");
  const payload = asRecord(await fetchJson(url));
  const finance = asRecord(payload?.finance);
  const result = Array.isArray(finance?.result) ? asRecord(finance.result[0]) : null;
  return Array.isArray(result?.quotes) ? result.quotes : [];
}

function normalizeSearchResult(value: unknown): Record<string, unknown> | null {
  const quote = asRecord(value);
  const symbol = getString(quote?.symbol);
  if (!quote || !symbol) return null;
  return {
    symbol,
    name: getString(quote.longname) ?? getString(quote.shortname) ?? symbol,
    currency: getString(quote.currency) ?? "",
    exchange: getString(quote.exchange) ?? "",
    exchangeName: getString(quote.exchDisp) ?? getString(quote.exchange) ?? "",
    quoteType: getString(quote.quoteType) ?? "",
  };
}

function normalizeNewsResult(value: unknown): Record<string, unknown> | null {
  const article = asRecord(value);
  const title = getString(article?.title);
  const url = getString(article?.link);
  if (!article || !title || !url) return null;
  const thumbnail = asRecord(article.thumbnail);
  const resolutions = Array.isArray(thumbnail?.resolutions) ? thumbnail.resolutions : [];
  const image = resolutions
    .map((resolution) => getString(asRecord(resolution)?.url))
    .find((candidate): candidate is string => candidate !== null) ?? "";
  const relatedTickers = Array.isArray(article.relatedTickers)
    ? article.relatedTickers.flatMap((ticker) => {
      const symbol = typeof ticker === "string" ? ticker : getString(asRecord(ticker)?.symbol);
      return symbol ? [symbol] : [];
    })
    : [];
  return {
    title,
    url,
    publisher: getString(article.publisher) ?? "Yahoo Finance",
    publishedAt: getNumber(article.providerPublishTime),
    image,
    relatedTickers,
  };
}

async function fetchYahooDividendEvent(
  symbol: string,
  session: YahooSession,
): Promise<Record<string, unknown> | null> {
  const [summaryResult, chartResult] = await Promise.allSettled([
    fetchWithCrumb((crumb) => {
      const url = new URL(`https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}`);
      url.searchParams.set("modules", "calendarEvents,summaryDetail");
      url.searchParams.set("crumb", crumb);
      return url;
    }, session),
    fetchChart(symbol, "2y", "1mo", true),
  ]);
  if (summaryResult.status === "rejected") throw summaryResult.reason;
  const root = asRecord(summaryResult.value.payload);
  const summary = asRecord(root?.quoteSummary);
  const results = Array.isArray(summary?.result) ? asRecord(summary.result[0]) : null;
  const calendarEvents = asRecord(results?.calendarEvents);
  const summaryDetail = asRecord(results?.summaryDetail);
  if (!calendarEvents || !summaryDetail) return null;

  const exDividendDate = getMetric(calendarEvents, "exDividendDate").value;
  const dividendDate = getMetric(calendarEvents, "dividendDate").value;
  if (exDividendDate === null && dividendDate === null) return null;

  const dividends = chartResult.status === "fulfilled" ? chartResult.value?.dividends ?? [] : [];
  return {
    symbol,
    exDividendDate: toIsoDate(exDividendDate) ?? "",
    dividendDate: toIsoDate(dividendDate) ?? "",
    lastDividendValue: getMetric(summaryDetail, "lastDividendValue").value ??
      dividends.at(-1)?.amount ?? null,
    dividendYield: getMetric(summaryDetail, "dividendYield").value,
    frequency: inferDividendFrequency(dividends),
  };
}

const HISTORY_RANGES = new Set(["1mo", "3mo", "6mo", "ytd", "1y", "2y", "5y", "10y", "max"]);
const HISTORY_INTERVALS = new Set(["1d", "1wk", "1mo"]);

function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { ...corsHeaders, ...extraHeaders } });
}

function badRequest(message: string): Response {
  return jsonResponse({ error: message }, 400);
}

function isValidSymbolList(value: unknown, max: number): value is string[] {
  return Array.isArray(value) &&
    value.length > 0 &&
    value.length <= max &&
    value.every((symbol) => typeof symbol === "string" && symbolPattern.test(symbol));
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Método no permitido" }, 405);
  }

  try {
    const body: unknown = await request.json();
    const requestBody = asRecord(body);
    const action = requestBody?.action;

    if (action === "dividends") {
      const symbols = requestBody?.symbols;
      if (!isValidSymbolList(symbols, 50)) {
        return badRequest("Envía entre 1 y 50 símbolos bursátiles válidos en mayúsculas");
      }
      const normalizedSymbols = [...new Set(symbols.map((symbol) => symbol.toUpperCase()))].sort();
      const cacheKey = `yahoo:dividends:${normalizedSymbols.join(",").slice(0, 400)}`;
      const { data, cachedAt } = await withCache(cacheKey, 12 * 60 * 60 * 1000, async () => {
        const session = await getYahooSession();
        const dividends = await mapWithConcurrency(normalizedSymbols, 5, async (symbol) => {
          try {
            return await fetchYahooDividendEvent(symbol, session);
          } catch (error) {
            console.warn(`Dividend request failed for ${symbol}:`, error);
            return null;
          }
        });
        return dividends.filter((dividend): dividend is Record<string, unknown> => dividend !== null);
      });
      return jsonResponse({ dividends: data, cachedAt });
    }

    if (action === "sectors") {
      const { data, cachedAt } = await withCache("yahoo:sectors", 6 * 60 * 60 * 1000, async () => {
        const sectors = await fetchSectors(await getYahooSession());
        if (sectors.length === 0) throw new Error("Yahoo Finance no devolvió sectores");
        return sectors;
      });
      return jsonResponse({ sectors: data, cachedAt });
    }

    if (action === "history") {
      const symbol = getString(requestBody?.symbol)?.toUpperCase() ?? "";
      const range = getString(requestBody?.range) ?? "1y";
      const interval = getString(requestBody?.interval) ?? "1d";
      if (!symbolPattern.test(symbol) || !HISTORY_RANGES.has(range) || !HISTORY_INTERVALS.has(interval)) {
        return badRequest("Símbolo, rango o intervalo de historial no permitido");
      }
      const { data, cachedAt } = await withCache(`yahoo:history:${symbol}:${range}:${interval}`, 60 * 60 * 1000, async () => {
        const chart = await fetchChart(symbol, range, interval);
        if (!chart || chart.candles.length === 0) throw new Error(`Yahoo Finance no devolvió historial para ${symbol}`);
        return {
          symbol,
          name: getString(chart.meta.longName) ?? getString(chart.meta.shortName),
          currency: getString(chart.meta.currency),
          history: chart.candles.map(({ timestamp: _timestamp, ...entry }) => entry),
        };
      });
      return jsonResponse({ ...data, cachedAt });
    }

    if (action === "filings") {
      const symbol = getString(requestBody?.symbol)?.toUpperCase() ?? "";
      const count = getNumber(requestBody?.count) ?? 20;
      if (!symbolPattern.test(symbol) || !Number.isInteger(count) || count < 1 || count > 50) {
        return badRequest("Símbolo o cantidad de presentaciones no permitidos");
      }
      if (!isSecConfigured()) {
        return jsonResponse({ error: "Las presentaciones de la SEC no están configuradas en este entorno" }, 503);
      }
      const { data, cachedAt } = await withCache(`yahoo:sec:filings:${symbol}:${count}`, 6 * 60 * 60 * 1000, () =>
        fetchSecFilings(symbol, count));
      return jsonResponse({ filings: data, cachedAt });
    }

    if (action === "search" || action === "news" || action === "screener") {
      const query = typeof requestBody?.query === "string" ? requestBody.query.trim() : "";
      const count = getNumber(requestBody?.count) ?? 20;
      if (!Number.isInteger(count) || count < 1 || count > 50) {
        return badRequest("La cantidad solicitada debe estar entre 1 y 50");
      }

      if (action === "search") {
        if (query.length < 1 || query.length > 80) {
          return badRequest("La búsqueda debe tener entre 1 y 80 caracteres");
        }
        const { data } = await withCache(`yahoo:search:${query.toLowerCase()}:${count}`, 24 * 60 * 60 * 1000, async () =>
          (await fetchSearch(query, count)).flatMap((item) => {
            const normalized = normalizeSearchResult(item);
            return normalized ? [normalized] : [];
          }));
        return jsonResponse({ quotes: data });
      }

      if (action === "news") {
        if (query.length < 1 || query.length > 120) {
          return badRequest("La búsqueda de noticias debe tener entre 1 y 120 caracteres");
        }
        const { data, cachedAt } = await withCache(`yahoo:news:${query.toLowerCase()}:${count}`, 15 * 60 * 1000, async () =>
          (await fetchNews(query, count)).flatMap((item) => {
            const normalized = normalizeNewsResult(item);
            return normalized ? [normalized] : [];
          }));
        return jsonResponse({ news: data, cachedAt });
      }

      const screenId = requestBody?.screenId;
      if (screenId !== "day_gainers" && screenId !== "day_losers" && screenId !== "most_actives") {
        return badRequest("Tipo de screener de Yahoo Finance no permitido");
      }
      const { data, cachedAt } = await withCache(`yahoo:screener:${screenId}:${count}`, 5 * 60 * 1000, async () =>
        (await fetchScreener(screenId, count)).flatMap((item) => {
          const quote = asRecord(item);
          const symbol = getString(quote?.symbol);
          const price = getNumber(quote?.regularMarketPrice);
          if (!quote || !symbol || price === null) return [];
          return [{
            symbol,
            name: getString(quote.longName) ?? getString(quote.shortName) ?? symbol,
            price,
            change: getNumber(quote.regularMarketChange) ?? 0,
            changePercent: getNumber(quote.regularMarketChangePercent) ?? 0,
            volume: getNumber(quote.regularMarketVolume) ?? 0,
          }];
        }));
      return jsonResponse({ movers: data, cachedAt });
    }

    const symbols = requestBody?.symbols;
    const marketDataOnly = requestBody?.marketDataOnly === true;
    if (
      !isValidSymbolList(symbols, marketDataOnly ? 20 : 8) ||
      ("marketDataOnly" in (requestBody ?? {}) && typeof requestBody?.marketDataOnly !== "boolean")
    ) {
      return badRequest(
        marketDataOnly
          ? "Envía entre 1 y 20 símbolos bursátiles válidos en mayúsculas"
          : "Envía entre 1 y 8 símbolos bursátiles válidos en mayúsculas",
      );
    }

    const normalizedSymbols = [...new Set(symbols.map((symbol) => symbol.toUpperCase()))];
    if (marketDataOnly) {
      const quotes = await mapWithConcurrency(normalizedSymbols, 5, fetchMarketQuote);
      return jsonResponse(
        { fetchedAt: new Date().toISOString(), quotes },
        200,
        { "Cache-Control": "no-store" },
      );
    }

    let session: YahooSession | null = null;
    let sessionError: string | null = null;
    try {
      session = await getYahooSession();
    } catch (error) {
      sessionError = error instanceof Error ? error.message : "No se pudo iniciar una sesión de Yahoo Finance";
      console.error("Yahoo Finance quote session error:", sessionError);
    }

    const [quotes, riskFreeRate] = await Promise.all([
      mapWithConcurrency(normalizedSymbols, 3, async (symbol) => {
        if (session) return await fetchQuote(symbol, session);
        return await fetchPublicYahooData(
          symbol,
          sessionError ?? "No se pudo iniciar una sesión de Yahoo Finance",
        );
      }),
      fetchRiskFreeRate(),
    ]);

    return jsonResponse(
      { fetchedAt: new Date().toISOString(), quotes, riskFreeRate },
      200,
      { "Cache-Control": "no-store" },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    console.error("Yahoo Finance proxy error:", message);
    return jsonResponse({ error: `No se pudieron obtener datos de Yahoo Finance: ${message}` }, 502);
  }
});
