import {
  fetchYahooFinanceQuotes,
} from './yahoo-finance-api';
import type {
  Industry,
  Sector,
  HistoricalIndustryPerformance,
  HistoricalSectorPerformance,
} from '../../features/sectors-industries/types';

const SECTOR_ETFS: Record<string, string> = {
  'Communication Services': 'XLC',
  'Consumer Cyclical': 'XLY',
  'Consumer Defensive': 'XLP',
  Energy: 'XLE',
  'Financial Services': 'XLF',
  Healthcare: 'XLV',
  Industrials: 'XLI',
  'Basic Materials': 'XLB',
  'Real Estate': 'XLRE',
  Technology: 'XLK',
  Utilities: 'XLU',
};

const INDUSTRY_ETFS: Record<string, string> = {
  'Aerospace & Defense': 'ITA',
  Banks: 'KBE',
  Biotechnology: 'XBI',
  'Medical Devices': 'IHI',
  'Oil & Gas Exploration & Production': 'XOP',
  Retail: 'XRT',
  Semiconductors: 'SOXX',
  Software: 'IGV',
};

/**
 * Lists sectors with Yahoo Finance ETF proxies.
 */
export function fetchAvailableSectors(): Promise<Sector[]> {
  return Promise.resolve(Object.keys(SECTOR_ETFS).sort().map((sector) => ({ sector })));
}

/**
 * Lists industries with Yahoo Finance ETF proxies.
 */
export function fetchAvailableIndustries(): Promise<Industry[]> {
  return Promise.resolve(Object.keys(INDUSTRY_ETFS).sort().map((industry) => ({ industry })));
}

async function fetchEtfPerformance(
  symbol: string | undefined,
): Promise<{ date: string; exchange: string; averageChange: number }[]> {
  if (!symbol) {
    throw new Error('Yahoo Finance no tiene un ETF de referencia configurado para esta categoría.');
  }
  const response = await fetchYahooFinanceQuotes([symbol]);
  const quote = response.quotes.find((item) => item.symbol === symbol);
  if (!quote || quote.history.length === 0) {
    throw new Error(`Yahoo Finance no devolvió historial para el ETF ${symbol}`);
  }

  const history = [...quote.history].sort((left, right) => left.date.localeCompare(right.date));
  return history.map((entry, index) => {
    const previousClose = history[index - 1]?.close;
    const averageChange = previousClose && previousClose !== 0
      ? ((entry.close - previousClose) / previousClose) * 100
      : 0;
    return {
      date: entry.date,
      exchange: `Yahoo Finance ETF ${symbol}`,
      averageChange,
    };
  });
}

/**
 * Returns historical ETF performance as a proxy for the requested industry.
 */
export async function fetchIndustryPerformance(
  industry: string,
): Promise<HistoricalIndustryPerformance[]> {
  const performance = await fetchEtfPerformance(INDUSTRY_ETFS[industry]);
  return performance.map((item) => ({ ...item, industry }));
}

/**
 * Returns historical ETF performance as a proxy for the requested sector.
 */
export async function fetchSectorPerformance(
  sector: string,
): Promise<HistoricalSectorPerformance[]> {
  const performance = await fetchEtfPerformance(SECTOR_ETFS[sector]);
  return performance.map((item) => ({ ...item, sector }));
}
