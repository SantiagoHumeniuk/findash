import { describe, expect, it } from 'vitest';
import type { YahooAnalystData, YahooFinanceQuote } from './yahoo-finance-api';
import {
  buildAnalystEstimates,
  buildFinDashDcf,
  buildFinDashRating,
  buildGradesConsensus,
  buildGradeUpdates,
  buildPeerValuations,
  buildPriceTarget,
  buildYahooFinancials,
} from './yahoo-fundamentals';

const EMPTY_ANALYST: YahooAnalystData = { recommendationTrend: [], gradeUpdates: [], earningsHistory: [], estimates: [] };

function period(date: string, revenue: number, netIncome: number) {
  return {
    date,
    currency: 'USD',
    values: {
      TotalRevenue: revenue,
      CostOfRevenue: revenue * 0.6,
      GrossProfit: revenue * 0.4,
      OperatingIncome: revenue * 0.2,
      EBIT: revenue * 0.2,
      EBITDA: revenue * 0.25,
      ReconciledDepreciation: revenue * 0.05,
      InterestExpense: 10,
      PretaxIncome: netIncome / 0.8,
      TaxProvision: netIncome / 0.8 - netIncome,
      NetIncome: netIncome,
      DilutedEPS: netIncome / 100,
      DilutedAverageShares: 100,
      OrdinarySharesNumber: 100,
      TotalAssets: 2000,
      CurrentAssets: 600,
      CashAndCashEquivalents: 200,
      CurrentLiabilities: 300,
      TotalLiabilitiesNetMinorityInterest: 1000,
      TotalDebt: 400,
      StockholdersEquity: 1000,
      OperatingCashFlow: netIncome * 1.2,
      CapitalExpenditure: -revenue * 0.05,
      CashDividendsPaid: -netIncome * 0.4,
    },
  };
}

function quote(overrides: Partial<YahooFinanceQuote> = {}): YahooFinanceQuote {
  return {
    symbol: 'ACME',
    currency: 'USD',
    history: [
      { date: '2024-12-27', open: 50, high: 50, low: 50, close: 50, volume: 1 },
      { date: '2025-12-26', open: 60, high: 60, low: 60, close: 60, volume: 1 },
    ],
    fundamentals: {
      source: 'Yahoo Finance',
      annual: [period('2025-12-31', 1100, 165), period('2024-12-31', 1000, 150)],
      trailing: { TotalRevenue: 1150, NetIncome: 170, OperatingCashFlow: 204, CapitalExpenditure: -57.5 },
      latestQuarterBalance: null,
    },
    analyst: EMPTY_ANALYST,
    peers: [],
    ...overrides,
  } as YahooFinanceQuote;
}

describe('buildYahooFinancials', () => {
  it('derives FMP-style annual ratios using the price at each fiscal year end', () => {
    const { ratios, keyMetricsYearly } = buildYahooFinancials('ACME', quote(), 6000);

    expect(ratios.map(({ date }) => date)).toEqual(['2025-12-31', '2024-12-31']);
    const [latest] = ratios;
    expect(latest.grossProfitMargin).toBeCloseTo(0.4);
    expect(latest.netProfitMargin).toBeCloseTo(0.15);
    expect(latest.currentRatio).toBeCloseTo(2);
    expect(latest.debtToEquityRatio).toBeCloseTo(0.4);
    expect(latest.returnOnEquity).toBeCloseTo(0.165);
    // Market cap = 60 (close on 2025-12-26) × 100 shares.
    expect(latest.priceToEarningsRatio).toBeCloseTo(6000 / 165);
    expect(keyMetricsYearly[0].marketCap).toBe(6000);
    expect(keyMetricsYearly[0].enterpriseValue).toBe(6000 + 400 - 200);
    // PEG uses EPS growth between consecutive years (1.65 vs 1.5 = +10%).
    expect(latest.priceToEarningsGrowthRatio).toBeCloseTo((6000 / 165) / 10);
  });

  it('returns null instead of zero for metrics whose inputs are missing', () => {
    const { ratios } = buildYahooFinancials('ACME', quote(), 6000);
    expect(ratios[0].inventoryTurnover).toBeNull();
    expect(ratios[0].debtServiceCoverageRatio).toBeNull();
  });

  it('builds TTM metrics from trailing values and the current market cap', () => {
    const { keyMetricsTTM } = buildYahooFinancials('ACME', quote(), 7000);
    expect(keyMetricsTTM?.earningsYieldTTM).toBeCloseTo(170 / 7000);
    expect(keyMetricsTTM?.freeCashFlowYieldTTM).toBeCloseTo((204 - 57.5) / 7000);
  });

  it('skips market multiples when statements are reported in another currency', () => {
    const foreign = quote();
    foreign.fundamentals.annual = foreign.fundamentals.annual.map((entry) => ({ ...entry, currency: 'ARS' }));
    const { ratios, keyMetricsTTM } = buildYahooFinancials('ACME', foreign, 6000);
    expect(ratios[0].priceToEarningsRatio).toBeNull();
    expect(ratios[0].netProfitMargin).toBeCloseTo(0.15);
    expect(keyMetricsTTM?.earningsYieldTTM).toBeNull();
  });
});

describe('analyst builders', () => {
  const analyst: YahooAnalystData = {
    recommendationTrend: [{ period: '0m', strongBuy: 2, buy: 3, hold: 4, sell: 1, strongSell: 0 }],
    gradeUpdates: [
      {
        date: '2026-10-20', firm: 'Firm A', toGrade: 'Buy', fromGrade: 'Hold', action: 'up',
        priceTargetAction: 'Raises', currentPriceTarget: 120, priorPriceTarget: 100,
      },
      {
        date: '2026-06-01', firm: 'Firm B', toGrade: 'Hold', fromGrade: 'Hold', action: 'main',
        priceTargetAction: null, currentPriceTarget: 90, priorPriceTarget: null,
      },
    ],
    earningsHistory: [],
    estimates: [
      { period: '0q', endDate: '2026-12-31', epsAvg: 1, epsLow: 1, epsHigh: 1, epsAnalysts: 5, revenueAvg: 10, revenueLow: 9, revenueHigh: 11, revenueAnalysts: 5 },
      { period: '+1y', endDate: '2027-12-31', epsAvg: 2.2, epsLow: 2, epsHigh: 2.5, epsAnalysts: 20, revenueAvg: 1300, revenueLow: 1200, revenueHigh: 1400, revenueAnalysts: 18 },
    ],
  };

  it('keeps only annual estimates, newest first', () => {
    const estimates = buildAnalystEstimates('ACME', analyst);
    expect(estimates).toHaveLength(1);
    expect(estimates[0]).toMatchObject({ date: '2027-12-31', epsAvg: 2.2, numAnalystsEps: 20, ebitdaAvg: null });
  });

  it('maps Yahoo grade actions to the labels the ratings tab understands', () => {
    const updates = buildGradeUpdates('ACME', analyst);
    expect(updates[0]).toMatchObject({ gradingCompany: 'Firm A', previousGrade: 'Hold', newGrade: 'Buy', action: 'upgrade' });
    expect(updates[1].action).toBe('maintain');
  });

  it('summarises recommendation counts and price-target windows', () => {
    expect(buildGradesConsensus('ACME', analyst, null)).toMatchObject({ buy: 3, hold: 4, consensus: 'Buy' });
    const targets = buildPriceTarget('ACME', analyst, Date.parse('2026-10-27'));
    expect(targets.lastMonthCount).toBe(1);
    expect(targets.lastMonthAvgPriceTarget).toBe(120);
    expect(targets.lastYearCount).toBe(2);
    expect(targets.lastYearAvgPriceTarget).toBe(105);
    expect(targets.publishers).toEqual(['Firm A', 'Firm B']);
  });

  it("converts Yahoo's percentage debt-to-equity for peers", () => {
    const [peer] = buildPeerValuations([{
      symbol: 'PEER', name: 'Peer Inc.', price: 10, marketCap: 1000, enterpriseValue: 1100, trailingPE: 15,
      priceToBook: 2, priceToSales: 3, evToRevenue: 3.3, evToEbitda: 11, freeCashflow: 50, ebitda: 100,
      operatingMargins: 0.2, returnOnEquity: 0.18, debtToEquity: 150,
    }]);
    expect(peer.debtToEquity).toBeCloseTo(1.5);
    expect(peer.priceToFreeCashFlowRatio).toBeCloseTo(20);
    expect(peer.evToEBIT).toBeNull();
  });
});

describe('buildFinDashDcf and buildFinDashRating', () => {
  it('projects five years and values the equity per diluted share', () => {
    const yahoo = quote();
    const financials = buildYahooFinancials('ACME', yahoo, 6000);
    const { dcf, dcfLevered } = buildFinDashDcf({
      symbol: 'ACME', price: 60, beta: 1, riskFreeRate: 0.045, financials, quote: yahoo,
    });

    expect(dcf.map(({ year }) => year)).toEqual(['2026', '2027', '2028', '2029', '2030']);
    expect(dcf[0].wacc).toBeGreaterThan(4.5);
    expect(dcf[0].riskFreeRate).toBeCloseTo(4.5);
    expect(dcf[0].equityValuePerShare).toBeGreaterThan(0);
    expect(dcf[0].equityValuePerShare).toBeCloseTo(dcf[0].equityValue / 100);
    expect(dcfLevered.dcf).toBeGreaterThan(0);
  });

  it('does not value companies whose statements use another currency', () => {
    const yahoo = quote({ currency: 'EUR' });
    const financials = buildYahooFinancials('ACME', yahoo, 6000);
    expect(buildFinDashDcf({ symbol: 'ACME', price: 60, beta: 1, riskFreeRate: 0.045, financials, quote: yahoo }).dcf)
      .toEqual([]);
  });

  it('scores the six FMP factors and leaves the rating empty without enough inputs', () => {
    const { ratios } = buildYahooFinancials('ACME', quote(), 6000);
    const rating = buildFinDashRating('ACME', ratios[0], 90, 60);
    expect(rating.discountedCashFlowScore).toBe(5);
    expect(rating.returnOnEquityScore).toBe(4);
    expect(rating.debtToEquityScore).toBe(4);
    expect(rating.overallScore).toBeGreaterThan(0);
    expect(rating.rating).not.toBe('');

    expect(buildFinDashRating('ACME', undefined, null, 60)).toMatchObject({ rating: '', overallScore: 0 });
  });
});
