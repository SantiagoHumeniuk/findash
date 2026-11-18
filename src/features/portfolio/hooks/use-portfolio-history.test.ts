import { describe, expect, it } from 'vitest';
import type { AssetData, AssetHistorical } from '../../../types/dashboard';
import type { Holding } from '../../../types/portfolio';
import { buildPortfolioHistory, type LocalHistoryBySymbol } from './use-portfolio-history';
import { calculatePerformanceMetrics } from '../../../utils/performance-metrics';

function point(date: string, close: number): AssetHistorical {
  return { symbol: 'TEST', date, open: close, high: close, low: close, close, volume: 0, change: 0, changePercent: 0, vwap: close };
}

function holding(
  symbol: string,
  price: number,
  historicalReturns: AssetHistorical[],
  localMarket?: AssetData['localMarket'],
): Holding {
  return {
    symbol,
    quantity: 1,
    totalCost: price,
    avgPurchasePrice: price,
    assetData: {
      quote: { price },
      historicalReturns,
      localMarket,
    } as AssetData,
  };
}

describe('buildPortfolioHistory', () => {
  it('simulates current holdings across available histories and reports portfolio coverage', () => {
    const holdings = [
      holding('NVDA', 100, [
        point('2024-01-05', 100),
        point('2024-12-27', 80),
        point('2025-01-03', 80),
        point('2025-12-26', 100),
      ]),
      holding('BMA.BA', 100, [], { kind: 'stock', ccl: 100 } as AssetData['localMarket']),
    ];
    const localHistory: LocalHistoryBySymbol = {
      'BMA.BA': {
        currency: 'ARS',
        history: [
          point('2024-01-12', 10_000),
          point('2024-12-20', 8_000),
          point('2025-01-10', 8_000),
          point('2025-12-19', 9_000),
        ],
      },
    };

    const result = buildPortfolioHistory(holdings, localHistory);
    const metrics = calculatePerformanceMetrics(result.portfolioHistory);

    expect(result.historyCoveragePercent).toBe(100);
    expect(result.historyUnavailableSymbols).toEqual([]);
    expect(result.portfolioHistory[0]).toMatchObject({ date: '2024-01-12', close: 200 });
    expect(metrics.worstYear).toMatchObject({ year: 2024, return: -0.2 });
    expect(metrics.bestYear).toMatchObject({ year: 2025, return: 0.1875 });
  });

  it('reports partial coverage instead of treating available histories as the entire portfolio', () => {
    const holdings = [
      holding('NVDA', 100, [point('2024-01-05', 100), point('2024-12-27', 110)]),
      holding('NO-HISTORY', 100, []),
    ];

    const result = buildPortfolioHistory(holdings);

    expect(result.historyCoveragePercent).toBe(50);
    expect(result.historyUnavailableSymbols).toEqual(['NO-HISTORY']);
    expect(result.portfolioHistory).toHaveLength(2);
  });
});
