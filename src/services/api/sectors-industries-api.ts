import { fetchYahooHistory, fetchYahooSectors, type YahooSectorSummary } from './yahoo-finance-api';
import type {
  Industry,
  Sector,
  HistoricalIndustryPerformance,
  HistoricalSectorPerformance,
} from '../../features/sectors-industries/types';

// Yahoo publishes one index per sector (^YH311 = Technology) and per industry
// (^YH31130020 = Semiconductors), built from the companies it classifies there.
// Their history is the aggregate performance of the category, like FMP's endpoints.

let sectorsRequest: Promise<YahooSectorSummary[]> | null = null;

function loadSectors(): Promise<YahooSectorSummary[]> {
  sectorsRequest ??= fetchYahooSectors().catch((error: unknown) => {
    sectorsRequest = null;
    throw error;
  });
  return sectorsRequest;
}

async function findIndexSymbol(kind: 'sector' | 'industry', name: string): Promise<string> {
  const sectors = await loadSectors();
  const symbol = kind === 'sector'
    ? sectors.find((sector) => sector.name === name)?.symbol
    : sectors.flatMap((sector) => sector.industries).find((industry) => industry.name === name)?.symbol;
  if (!symbol) {
    throw new Error(`Yahoo Finance no publica un índice para ${kind === 'sector' ? 'el sector' : 'la industria'} ${name}.`);
  }
  return symbol;
}

async function fetchIndexPerformance(
  symbol: string,
): Promise<{ date: string; exchange: string; averageChange: number }[]> {
  const { history } = await fetchYahooHistory(symbol, '5y', '1wk');
  if (history.length === 0) {
    throw new Error(`Yahoo Finance no devolvió historial para el índice ${symbol}.`);
  }
  const sorted = [...history].sort((left, right) => left.date.localeCompare(right.date));
  return sorted.map((entry, index) => {
    const previousClose = sorted[index - 1]?.close;
    return {
      date: entry.date,
      exchange: `Índice Yahoo Finance ${symbol}`,
      averageChange: previousClose ? ((entry.close - previousClose) / previousClose) * 100 : 0,
    };
  });
}

/**
 * Lists the eleven sectors of Yahoo's classification.
 */
export async function fetchAvailableSectors(): Promise<Sector[]> {
  const sectors = await loadSectors();
  return sectors
    .map((sector) => ({ sector: sector.name }))
    .sort((left, right) => left.sector.localeCompare(right.sector));
}

/**
 * Lists every industry of Yahoo's classification that has its own index.
 */
export async function fetchAvailableIndustries(): Promise<Industry[]> {
  const sectors = await loadSectors();
  const names = new Set(sectors.flatMap((sector) => sector.industries.map((industry) => industry.name)));
  return [...names].sort((left, right) => left.localeCompare(right)).map((industry) => ({ industry }));
}

/**
 * Weekly performance of the requested industry's Yahoo index.
 */
export async function fetchIndustryPerformance(
  industry: string,
): Promise<HistoricalIndustryPerformance[]> {
  const performance = await fetchIndexPerformance(await findIndexSymbol('industry', industry));
  return performance.map((item) => ({ ...item, industry }));
}

/**
 * Weekly performance of the requested sector's Yahoo index.
 */
export async function fetchSectorPerformance(
  sector: string,
): Promise<HistoricalSectorPerformance[]> {
  const performance = await fetchIndexPerformance(await findIndexSymbol('sector', sector));
  return performance.map((item) => ({ ...item, sector }));
}
