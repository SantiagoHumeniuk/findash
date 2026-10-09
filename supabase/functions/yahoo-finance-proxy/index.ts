import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const yahooUserAgent = "Mozilla/5.0 (compatible; Financytics/1.0)";
const modules = "price,summaryDetail,defaultKeyStatistics,financialData,assetProfile,earningsTrend";

type YahooMetric = {
  value: number | null;
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
  metrics: Record<string, number | null>;
  companyProfile: {
    sector: string | null;
    industry: string | null;
    country: string | null;
    website: string | null;
    description: string | null;
    employees: number | null;
  };
  history: Array<{
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
  error: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : null;
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function getNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getMetric(record: Record<string, unknown> | null, key: string): YahooMetric {
  const metric = asRecord(record?.[key]);
  return { value: getNumber(metric?.raw) };
}

function getRawMetrics(value: unknown, prefix = ''): Record<string, number | null> {
  const record = asRecord(value);
  if (!record) return {};
  const result: Record<string, number | null> = {};
  for (const [key, child] of Object.entries(record)) {
    const entry = asRecord(child);
    const raw = getNumber(entry?.raw);
    if (raw !== null) {
      result[`${prefix}${key}`] = raw;
    }
  }
  return result;
}

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
    metrics: {},
    companyProfile: {
      sector: null,
      industry: null,
      country: null,
      website: null,
      description: null,
      employees: null,
    },
    history: [],
    error,
  };
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
      const revenue = getRawMetrics(revenueEstimate, `earningsTrend.${period}.`);
      return [{ ...earnings, ...revenue }];
    })
    : [];

  return {
    symbol,
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
    change: getMetric(price, "regularMarketChange"),
    changePercent: getMetric(price, "regularMarketChangePercent"),
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
    metrics: {
      ...getRawMetrics(price, "price."),
      ...getRawMetrics(summaryDetail, "summaryDetail."),
      ...getRawMetrics(keyStatistics, "keyStatistics."),
      ...getRawMetrics(financialData, "financialData."),
      ...getRawMetrics(companyProfile, "assetProfile."),
      ...Object.assign({}, ...trendMetrics),
    },
    companyProfile: {
      sector: getString(companyProfile?.sector),
      industry: getString(companyProfile?.industry),
      country: getString(companyProfile?.country),
      website: getString(companyProfile?.website),
      description: getString(companyProfile?.longBusinessSummary),
      employees: getNumber(companyProfile?.fullTimeEmployees),
    },
    history: [],
    error: null,
  };
}

function attachHistory(quote: YahooQuote, history: YahooQuote["history"]): YahooQuote {
  quote.history = history;
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

async function fetchHistory(symbol: string): Promise<YahooQuote["history"]> {
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`);
  url.searchParams.set("range", "5y");
  url.searchParams.set("interval", "1wk");
  const response = await fetch(url, { headers: { "User-Agent": yahooUserAgent } });
  if (!response.ok) return [];

  const payload: unknown = await response.json();
  const chart = asRecord(asRecord(payload)?.chart);
  const result = Array.isArray(chart?.result) ? asRecord(chart.result[0]) : null;
  if (!result) return [];
  const timestamps = Array.isArray(result.timestamp) ? result.timestamp : [];
  const indicators = asRecord(result.indicators);
  const quote = Array.isArray(indicators?.quote) ? asRecord(indicators.quote[0]) : null;
  const closes = Array.isArray(quote?.close) ? quote.close : [];
  const opens = Array.isArray(quote?.open) ? quote.open : [];
  const highs = Array.isArray(quote?.high) ? quote.high : [];
  const lows = Array.isArray(quote?.low) ? quote.low : [];
  const volumes = Array.isArray(quote?.volume) ? quote.volume : [];

  return timestamps.flatMap((timestamp, index) => {
    if (typeof timestamp !== "number" || typeof closes[index] !== "number") return [];
    return [{
      date: new Date(timestamp * 1000).toISOString().slice(0, 10),
      open: getNumber(opens[index]) ?? 0,
      high: getNumber(highs[index]) ?? 0,
      low: getNumber(lows[index]) ?? 0,
      close: closes[index] as number,
      volume: getNumber(volumes[index]) ?? 0,
    }];
  });
}

async function getYahooSession(): Promise<{ cookie: string; crumb: string }> {
  const cookieResponse = await fetch("https://fc.yahoo.com", {
    headers: { "User-Agent": yahooUserAgent },
  });
  const cookies = cookieResponse.headers.getSetCookie()
    .map((header) => header.split(";")[0])
    .filter(Boolean);
  if (cookies.length === 0) {
    throw new Error(`Yahoo no entregó cookies para iniciar la sesión (HTTP ${cookieResponse.status})`);
  }

  const cookie = cookies.join("; ");
  const crumbResponse = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
    headers: { Cookie: cookie, "User-Agent": yahooUserAgent },
  });
  if (!crumbResponse.ok) {
    throw new Error(`Yahoo no permitió obtener el crumb (HTTP ${crumbResponse.status})`);
  }

  const crumb = (await crumbResponse.text()).trim();
  if (!crumb || crumb.includes("\n")) {
    throw new Error("Yahoo devolvió un crumb inválido");
  }
  return { cookie, crumb };
}

async function fetchQuote(symbol: string, cookie: string, crumb: string): Promise<YahooQuote> {
  const url = new URL(`https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}`);
  url.searchParams.set("modules", modules);
  url.searchParams.set("crumb", crumb);

  const response = await fetch(url, {
    headers: { Cookie: cookie, "User-Agent": yahooUserAgent },
  });
  if (!response.ok) {
    return attachHistory(
      emptyQuote(symbol, `Yahoo Finance respondió HTTP ${response.status}`),
      await fetchHistory(symbol),
    );
  }

  const payload: unknown = await response.json();
  const quote = normalizeQuote(symbol, payload);
  return attachHistory(quote, await fetchHistory(symbol));
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return Response.json({ error: "Método no permitido" }, { status: 405, headers: corsHeaders });
  }

  try {
    const body: unknown = await request.json();
    const symbols = asRecord(body)?.symbols;
    if (
      !Array.isArray(symbols) ||
      symbols.length === 0 ||
      symbols.length > 8 ||
      symbols.some((symbol) =>
        typeof symbol !== "string" || !/^[A-Z0-9.^=-]{1,15}$/.test(symbol)
      )
    ) {
      return Response.json(
        { error: "Envía entre 1 y 8 símbolos bursátiles válidos en mayúsculas" },
        { status: 400, headers: corsHeaders },
      );
    }

    const normalizedSymbols = [...new Set(symbols.map((symbol) => symbol.toUpperCase()))];
    let session: { cookie: string; crumb: string } | null = null;
    let sessionError: string | null = null;
    try {
      session = await getYahooSession();
    } catch (error) {
      sessionError = error instanceof Error ? error.message : "No se pudo iniciar una sesión de Yahoo Finance";
      console.error("Yahoo Finance quote session error:", sessionError);
    }

    const quotes = await Promise.all(normalizedSymbols.map(async (symbol) => {
      if (session) return fetchQuote(symbol, session.cookie, session.crumb);
      return attachHistory(
        emptyQuote(symbol, sessionError ?? "No se pudo iniciar una sesión de Yahoo Finance"),
        await fetchHistory(symbol),
      );
    }));

    return Response.json(
      { fetchedAt: new Date().toISOString(), quotes },
      { headers: { ...corsHeaders, "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    console.error("Yahoo Finance proxy error:", message);
    return Response.json(
      { error: `No se pudieron obtener datos de Yahoo Finance: ${message}` },
      { status: 502, headers: corsHeaders },
    );
  }
});
