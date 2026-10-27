// Yahoo's sector and industry taxonomy. Each sector and industry has its own
// Yahoo index (^YH311, ^YH31130020, ...) whose chart is the real aggregate of
// the category, replacing FMP's sector/industry performance endpoints.

import { asRecord, fetchWithCrumb, getRaw, getString, mapWithConcurrency, type YahooSession } from "./http.ts";

export const SECTOR_KEYS = [
  "basic-materials", "communication-services", "consumer-cyclical", "consumer-defensive", "energy",
  "financial-services", "healthcare", "industrials", "real-estate", "technology", "utilities",
] as const;

export type SectorSummary = {
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
  industries: Array<{
    key: string;
    name: string;
    symbol: string;
    marketWeight: number | null;
    dayChangePercent: number | null;
    ytdReturn: number | null;
  }>;
};

async function fetchSector(key: string, session: YahooSession): Promise<SectorSummary | null> {
  const { payload } = await fetchWithCrumb((crumb) => {
    const url = new URL(`https://query1.finance.yahoo.com/v1/finance/sectors/${key}`);
    url.searchParams.set("formatted", "true");
    url.searchParams.set("withReturns", "true");
    url.searchParams.set("lang", "en-US");
    url.searchParams.set("region", "US");
    url.searchParams.set("crumb", crumb);
    return url;
  }, session);
  const data = asRecord(asRecord(payload)?.data);
  if (!data) return null;
  const overview = asRecord(data.overview);
  const performance = asRecord(data.performance);
  const industries = Array.isArray(data.industries) ? data.industries : [];
  return {
    key,
    name: getString(data.name) ?? key,
    symbol: getString(data.symbol),
    companiesCount: getRaw(overview?.companiesCount),
    marketCap: getRaw(overview?.marketCap),
    marketWeight: getRaw(overview?.marketWeight),
    dayChangePercent: getRaw(performance?.regMarketChangePercent),
    ytdReturn: getRaw(performance?.ytdChangePercent),
    oneYearReturn: getRaw(performance?.oneYearChangePercent),
    threeYearReturn: getRaw(performance?.threeYearChangePercent),
    fiveYearReturn: getRaw(performance?.fiveYearChangePercent),
    industries: industries.flatMap((item) => {
      const industry = asRecord(item);
      const industryKey = getString(industry?.key);
      const symbol = getString(industry?.symbol);
      // The first row is the "All Industries" total and has no key or symbol.
      if (!industry || !industryKey || !symbol) return [];
      return [{
        key: industryKey,
        name: getString(industry.name) ?? industryKey,
        symbol,
        marketWeight: getRaw(industry.marketWeight),
        dayChangePercent: getRaw(industry.regMarketChangePercent),
        ytdReturn: getRaw(industry.ytdReturn),
      }];
    }),
  };
}

export async function fetchSectors(session: YahooSession): Promise<SectorSummary[]> {
  const sectors = await mapWithConcurrency(SECTOR_KEYS, 4, async (key) => {
    try {
      return await fetchSector(key, session);
    } catch (error) {
      console.error(`Yahoo sector request failed for ${key}:`, error);
      return null;
    }
  });
  return sectors.filter((sector): sector is SectorSummary => sector !== null);
}
