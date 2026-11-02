import { describe, expect, it } from 'vitest';
import type { AssetData } from '../../../types/dashboard';
import { buildAgenda, buildBriefNews, buildMovers, buildPortfolioSummary, buildUnifiedTotal } from './daily-brief';

const NOW = new Date('2026-11-02T15:00:00');

function asset(symbol: string, overrides: Record<string, unknown> = {}): AssetData {
  return {
    symbol,
    profile: { symbol, companyName: `${symbol} Inc.`, image: '', currency: 'USD' },
    quote: { price: 100, change: 2, changePercentage: 2 },
    ...overrides,
  } as unknown as AssetData;
}

describe('buildPortfolioSummary', () => {
  it('reports today per currency without mixing currencies', () => {
    const ars = asset('GGAL.BA', {
      profile: { currency: 'ARS' },
      quote: { price: 1000, change: -50, changePercentage: -4.76 },
    });
    const summary = buildPortfolioSummary([
      { quantity: 10, assetData: asset('AAPL') },
      { quantity: 5, assetData: asset('KO') },
      { quantity: 2, assetData: ars },
    ]);
    expect(summary).toHaveLength(2);
    expect(summary[0]).toMatchObject({ currency: 'USD', value: 1500, dayChange: 30 });
    expect(summary[0].dayChangePercent).toBeCloseTo((30 / 1470) * 100);
    expect(summary[1]).toMatchObject({ currency: 'ARS', value: 2000, dayChange: -100 });
  });

  it('skips closed positions and assets without a price', () => {
    expect(buildPortfolioSummary([
      { quantity: 0, assetData: asset('AAPL') },
      { quantity: 3, assetData: asset('KO', { quote: { price: 0, change: 0 } }) },
      { quantity: 3 },
    ])).toEqual([]);
  });
});

describe('buildUnifiedTotal', () => {
  const line = (currency: string, value: number) => ({ currency, value, dayChange: 0, dayChangePercent: 0 });

  it('adds pesos and dollars at the CCL rate', () => {
    expect(buildUnifiedTotal([line('USD', 1000), line('ARS', 1_500_000)], 1500)).toEqual({ usd: 2000, ars: 3_000_000 });
  });

  it('returns nothing it cannot convert honestly', () => {
    expect(buildUnifiedTotal([line('USD', 1000)], 1500)).toBeNull();
    expect(buildUnifiedTotal([line('USD', 1000), line('ARS', 1)], null)).toBeNull();
    expect(buildUnifiedTotal([line('USD', 1000), line('EUR', 1)], 1500)).toBeNull();
  });
});

describe('buildMovers', () => {
  it('sorts by the size of the move, up or down', () => {
    const movers = buildMovers([
      asset('A', { quote: { price: 1, changePercentage: 1 } }),
      asset('B', { quote: { price: 1, changePercentage: -5 } }),
      asset('C', { quote: { price: 1, changePercentage: 3 } }),
      asset('D', { quote: { price: 0, changePercentage: 9 } }),
    ], 2);
    expect(movers.map(({ symbol }) => symbol)).toEqual(['B', 'C']);
  });
});

describe('buildAgenda', () => {
  it('keeps events from today through two weeks, soonest first', () => {
    const agenda = buildAgenda([
      asset('AAPL', { yahooInsights: { nextEarnings: { date: '2026-11-10', isEstimate: true, exDividendDate: '2026-11-02', dividendDate: '2026-12-20' } } }),
      asset('KO', { yahooInsights: { nextEarnings: { date: '2026-10-30', isEstimate: false, exDividendDate: null, dividendDate: '2026-11-05' } } }),
    ], NOW);
    expect(agenda.map(({ symbol, kind }) => `${symbol}:${kind}`)).toEqual([
      'AAPL:ex-dividend',
      'KO:dividend-payment',
      'AAPL:earnings',
    ]);
    expect(agenda[2].isEstimate).toBe(true);
  });
});

describe('buildBriefNews', () => {
  it('shows real changes only and ignores old items and reiterations', () => {
    const news = buildBriefNews([
      asset('AAPL', {
        analystGradeUpdates: [
          { date: '2026-11-01', gradingCompany: 'Firm A', previousGrade: 'Hold', newGrade: 'Buy', action: 'upgrade' },
          { date: '2026-11-01', gradingCompany: 'Firm B', previousGrade: 'Buy', newGrade: 'Buy', action: 'maintain' },
          { date: '2026-09-01', gradingCompany: 'Firm C', previousGrade: 'Buy', newGrade: 'Hold', action: 'downgrade' },
        ],
        yahooInsights: {
          ownership: {
            insiderTransactions: [
              { name: 'Jane Doe', relation: 'Officer', date: '2026-10-30', text: 'Sale at price 300 per share.', value: 1000 },
              { name: 'John Roe', relation: 'Director', date: '2026-10-29', text: 'Stock Gift', value: 0 },
            ],
          },
        },
      }),
    ], NOW);
    expect(news.map(({ kind }) => kind)).toEqual(['upgrade', 'insider-sell']);
    expect(news[0]).toMatchObject({ title: 'Firm A mejoró su recomendación', detail: 'Hold → Buy' });
  });
});
