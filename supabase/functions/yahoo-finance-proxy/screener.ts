// Custom stock screener and sector heatmap on top of Yahoo's screener endpoint.
// Filter fields are an allowlist: clients choose from names defined here, never raw Yahoo fields.

import { asRecord, fetchWithRetry, getNumber, getString, mapWithConcurrency, type YahooSession } from "./http.ts";

/** App filter name → Yahoo field. Percent fields use Yahoo's scale (15 = 15%). */
export const SCREENER_FIELDS: Record<string, string> = {
  marketCap: "intradaymarketcap",
  pe: "peratio.lasttwelvemonths",
  peg: "pegratio_5y",
  priceToBook: "pricebookratio.quarterly",
  roe: "returnonequity.lasttwelvemonths",
  dividendYield: "forward_dividend_yield",
  revenueGrowth: "quarterlyrevenuegrowth.quarterly",
  epsGrowth: "epsgrowth.lasttwelvemonths",
  debtToEquity: "totaldebtequity.lasttwelvemonths",
  changePercent: "percentchange",
  yearChange: "fiftytwowkpercentchange",
  beta: "beta",
  averageVolume: "avgdailyvol3m",
};

export const SCREENER_SECTORS = [
  "Technology", "Financial Services", "Healthcare", "Consumer Cyclical", "Communication Services", "Industrials",
  "Consumer Defensive", "Energy", "Basic Materials", "Real Estate", "Utilities",
];

export type ScreenerRequest = {
  region: "us" | "ar";
  sector: string | null;
  filters: Array<{ field: string; min: number | null; max: number | null }>;
  sortField: string;
  sortDescending: boolean;
  offset: number;
  size: number;
};

/** Returns a safe request, or null when anything is outside the allowlist. */
export function parseScreenerRequest(value: unknown): ScreenerRequest | null {
  const body = asRecord(value);
  if (!body) return null;
  const region = body.region === "ar" ? "ar" : "us";
  const sector = getString(body.sector);
  if (sector && !SCREENER_SECTORS.includes(sector)) return null;
  const sortField = getString(body.sortField) ?? "marketCap";
  if (!SCREENER_FIELDS[sortField]) return null;
  const offset = getNumber(body.offset) ?? 0;
  const size = getNumber(body.size) ?? 25;
  if (!Number.isInteger(offset) || offset < 0 || offset > 1000 || !Number.isInteger(size) || size < 1 || size > 50) {
    return null;
  }
  const rawFilters = Array.isArray(body.filters) ? body.filters : [];
  if (rawFilters.length > 12) return null;
  const filters: ScreenerRequest["filters"] = [];
  for (const raw of rawFilters) {
    const record = asRecord(raw);
    const field = getString(record?.field);
    if (!field || !SCREENER_FIELDS[field]) return null;
    const min = getNumber(record?.min);
    const max = getNumber(record?.max);
    if (min !== null || max !== null) filters.push({ field, min, max });
  }
  return { region, sector: sector ?? null, filters, sortField, sortDescending: body.sortDescending !== false, offset, size };
}

export function buildScreenerQuery(request: ScreenerRequest): Record<string, unknown> {
  const operands: unknown[] = [{ operator: "eq", operands: ["region", request.region] }];
  if (request.sector) operands.push({ operator: "eq", operands: ["sector", request.sector] });
  for (const { field, min, max } of request.filters) {
    const yahooField = SCREENER_FIELDS[field];
    if (min !== null) operands.push({ operator: "gte", operands: [yahooField, min] });
    if (max !== null) operands.push({ operator: "lte", operands: [yahooField, max] });
  }
  return {
    size: request.size,
    offset: request.offset,
    sortField: SCREENER_FIELDS[request.sortField],
    sortType: request.sortDescending ? "DESC" : "ASC",
    quoteType: "EQUITY",
    query: { operator: "and", operands },
    userId: "",
    userIdType: "guid",
  };
}

function normalizeRow(value: unknown): Record<string, unknown> | null {
  const quote = asRecord(value);
  const symbol = getString(quote?.symbol);
  if (!quote || !symbol) return null;
  return {
    symbol,
    name: getString(quote.longName) ?? getString(quote.shortName) ?? symbol,
    currency: getString(quote.currency) ?? "USD",
    price: getNumber(quote.regularMarketPrice),
    changePercent: getNumber(quote.regularMarketChangePercent),
    marketCap: getNumber(quote.marketCap),
    trailingPE: getNumber(quote.trailingPE),
    forwardPE: getNumber(quote.forwardPE),
    priceToBook: getNumber(quote.priceToBook),
    dividendYield: getNumber(quote.dividendYield),
    yearChangePercent: getNumber(quote.fiftyTwoWeekChangePercent),
    analystRating: getString(quote.averageAnalystRating),
  };
}

async function postScreener(
  body: Record<string, unknown>,
  session: YahooSession,
): Promise<{ total: number; rows: Record<string, unknown>[] }> {
  const response = await fetchWithRetry(
    `https://query1.finance.yahoo.com/v1/finance/screener?crumb=${encodeURIComponent(session.crumb)}&formatted=false&lang=en-US&region=US`,
    {
      method: "POST",
      headers: { Cookie: session.cookie, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Yahoo Finance respondió HTTP ${response.status} al screener`);
  }
  const finance = asRecord(asRecord(await response.json())?.finance);
  const result = Array.isArray(finance?.result) ? asRecord(finance.result[0]) : null;
  const quotes = Array.isArray(result?.quotes) ? result.quotes : [];
  return {
    total: getNumber(result?.total) ?? quotes.length,
    rows: quotes.flatMap((quote) => {
      const row = normalizeRow(quote);
      return row ? [row] : [];
    }),
  };
}

export async function runScreener(request: ScreenerRequest, session: YahooSession) {
  return await postScreener(buildScreenerQuery(request), session);
}

export type SectorStats = {
  sector: string;
  count: number;
  forwardPe: number | null;
  growth: number | null;
  priceToBook: number | null;
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

const isUsableMultiple = (value: number | null): value is number => value !== null && value > 2 && value < 150;

/**
 * Sector multiples the way index providers publish them: total market value over total
 * earnings, so each company weighs by its size and one distorted year barely moves them.
 */
export function summarizeSector(sector: string, rows: Record<string, unknown>[]): SectorStats {
  let count = 0;
  let forwardValue = 0;
  let forwardEarnings = 0;
  let bothValue = 0;
  let bothForwardEarnings = 0;
  let bothTrailingEarnings = 0;
  const priceToBook: number[] = [];
  for (const row of rows) {
    const marketCap = getNumber(row.marketCap);
    const forwardPe = getNumber(row.forwardPE);
    const trailingPe = getNumber(row.trailingPE);
    const book = getNumber(row.priceToBook);
    if (book !== null && book > 0.1 && book < 60) priceToBook.push(book);
    if (marketCap === null || marketCap <= 0 || !isUsableMultiple(forwardPe)) continue;
    count += 1;
    forwardValue += marketCap;
    forwardEarnings += marketCap / forwardPe;
    if (isUsableMultiple(trailingPe)) {
      bothValue += marketCap;
      bothForwardEarnings += marketCap / forwardPe;
      bothTrailingEarnings += marketCap / trailingPe;
    }
  }
  return {
    sector,
    count,
    forwardPe: forwardEarnings > 0 ? forwardValue / forwardEarnings : null,
    // Forward over trailing earnings of the same companies: the growth the market expects.
    growth: bothValue > 0 && bothTrailingEarnings > 0
      ? Math.min(Math.max(bothForwardEarnings / bothTrailingEarnings - 1, -0.1), 0.4)
      : null,
    priceToBook: median(priceToBook),
  };
}

const SECTOR_STATS_COMPANIES = 100;

/** Valuation medians of the largest US companies of one sector. */
export async function fetchSectorStats(sector: string, session: YahooSession): Promise<SectorStats> {
  const { rows } = await runScreener({
    region: "us",
    sector,
    filters: [],
    sortField: "marketCap",
    sortDescending: true,
    offset: 0,
    size: SECTOR_STATS_COMPANIES,
  }, session);
  return summarizeSector(sector, rows);
}

const HEATMAP_COMPANIES_PER_SECTOR = 12;

/** Largest US companies of each sector, for the market map. */
export async function fetchHeatmap(session: YahooSession) {
  const sectors = await mapWithConcurrency(SCREENER_SECTORS, 4, async (sector) => {
    try {
      const { rows } = await runScreener({
        region: "us",
        sector,
        filters: [],
        sortField: "marketCap",
        sortDescending: true,
        offset: 0,
        size: HEATMAP_COMPANIES_PER_SECTOR,
      }, session);
      return { sector, companies: rows };
    } catch (error) {
      console.warn(`Heatmap request failed for ${sector}:`, error);
      return { sector, companies: [] };
    }
  });
  return sectors.filter(({ companies }) => companies.length > 0);
}
