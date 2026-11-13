import { describe, expect, it } from 'vitest';
import type { AssetData } from '../../../types/dashboard';
import {
  calculateBlendedFairValue,
  calculateContextualRatingScores,
  classifyBusinessProfile,
  fadingGrowthMultiple,
} from './valuation-models';
import { generateAdvisory } from '../../portfolio/lib/advisory-engine';
import { toInsightItem } from '../../insights/lib/helpers';

interface AssetOptions {
  sector?: string;
  industry?: string;
  country?: string;
  beta?: number;
  metrics?: Record<string, number | null>;
  dcfValue?: number | null;
  target?: number;
  dataVersion?: number;
}

/** A US software company at $100 whose every view lands close to its price. */
function makeAsset(options: AssetOptions = {}): AssetData {
  const dcfValue = options.dcfValue === undefined ? 105 : options.dcfValue;
  return {
    symbol: 'TECH',
    yahooDataVersion: options.dataVersion ?? 4,
    profile: {
      symbol: 'TECH', companyName: 'Technology Co', sector: options.sector ?? 'Technology',
      industry: options.industry ?? 'Software', country: options.country ?? 'United States',
      currency: 'USD', beta: options.beta ?? 1, marketCap: 50_000_000_000,
    },
    quote: { symbol: 'TECH', name: 'Technology Co', price: 100, marketCap: 50_000_000_000 },
    keyMetrics: { symbol: 'TECH', returnOnEquityTTM: 0.25, netDebtToEBITDATTM: 1, freeCashFlowYieldTTM: 0.045 },
    ratios: [{ symbol: 'TECH', date: '2026-06-30', reportedCurrency: 'USD', priceToBookRatio: 4 }],
    dcf: dcfValue === null ? [] : [{ year: '2027', equityValuePerShare: dcfValue, wacc: 9.2 }],
    priceTargetConsensus: { symbol: 'TECH', targetHigh: 0, targetLow: 0, targetConsensus: options.target ?? 108, targetMedian: 0 },
    valuationInputs: {
      riskFreeRate: 0.045,
      sector: { sector: 'Technology', count: 60, forwardPe: 22, growth: 0.12, priceToBook: 5 },
    },
    yahooMetrics: {
      'summaryDetail.forwardPE': 22,
      'summaryDetail.trailingPE': 24.6,
      'keyStatistics.forwardEps': 100 / 22,
      'summaryDetail.marketCap': 50_000_000_000,
      'financialData.totalRevenue': 10_000_000_000,
      'financialData.returnOnEquity': 0.25,
      'financialData.numberOfAnalystOpinions': 20,
      'earningsTrend.+1y.growth': 0.12,
      'earningsTrend.+1y.revenue.growth': 0.1,
      ...options.metrics,
    },
  } as unknown as AssetData;
}

const model = (asset: AssetData, name: string) =>
  calculateBlendedFairValue(asset).modelsUsed.find((item) => item.name === name);

describe('fadingGrowthMultiple', () => {
  it('equals a growing perpetuity when growth never changes', () => {
    expect(fadingGrowthMultiple(0.03, 0.09, 0.03, { baseIsTrailing: false })).toBeCloseTo(1 / (0.09 - 0.03), 6);
  });

  it('keeps four points between the discount rate and long-term growth', () => {
    const bounded = fadingGrowthMultiple(0.02, 0.06, 0.04, { baseIsTrailing: false });
    expect(bounded).toBeCloseTo(fadingGrowthMultiple(0.02, 0.06, 0.02, { baseIsTrailing: false })!, 6);
    expect(fadingGrowthMultiple(0.02, 0.04, 0.03, { baseIsTrailing: false })).toBeNull();
  });

  it('is worth more with faster growth and less when earnings must be reinvested', () => {
    const slow = fadingGrowthMultiple(0.04, 0.09, 0.03, { baseIsTrailing: false })!;
    const fast = fadingGrowthMultiple(0.15, 0.09, 0.03, { baseIsTrailing: false })!;
    const reinvesting = fadingGrowthMultiple(0.15, 0.09, 0.03, { baseIsTrailing: false, payout: () => 0.5 })!;
    expect(fast).toBeGreaterThan(slow);
    expect(reinvesting).toBeCloseTo(fast / 2, 6);
  });
});

describe('calculateBlendedFairValue', () => {
  it('blends cash flows, earnings, the sector and analysts into one value with a range', () => {
    const result = calculateBlendedFairValue(makeAsset());

    expect(result.modelsUsed.map((item) => item.name)).toEqual([
      'DCF a 10 años', 'Ganancias con crecimiento', 'P/E frente al sector', 'Consenso de analistas',
    ]);
    const values = result.modelsUsed.map((item) => item.value);
    expect(result.fairValue).toBeGreaterThanOrEqual(Math.min(...values));
    expect(result.fairValue).toBeLessThanOrEqual(Math.max(...values));
    expect(result.fairValueRange!.low).toBeLessThanOrEqual(result.fairValueRange!.high);
    expect(result.spread).toBeCloseTo(result.fairValue! - 100);
  });

  it('values faster expected growth higher', () => {
    const slow = model(makeAsset({ metrics: { 'earningsTrend.+1y.growth': 0.03, 'earningsTrend.+1y.revenue.growth': 0.03 } }), 'Ganancias con crecimiento')!;
    const fast = model(makeAsset({ metrics: { 'earningsTrend.+1y.growth': 0.2, 'earningsTrend.+1y.revenue.growth': 0.18 } }), 'Ganancias con crecimiento')!;
    expect(fast.value).toBeGreaterThan(slow.value * 1.2);
  });

  it('anchors growth on sales, so a one-year earnings rebound adds at most five points', () => {
    const result = calculateBlendedFairValue(makeAsset({
      metrics: { 'earningsTrend.+1y.growth': 0.9, 'earningsTrend.+1y.revenue.growth': 0.04 },
    }));
    expect(result.context.stageGrowthPct).toBeCloseTo(9);
    expect(result.context.forwardEpsGrowthPct).toBeCloseTo(90);
  });

  it('charges the dataset country premium: minimal for a US company, large for an Argentine one', () => {
    const local = calculateBlendedFairValue(makeAsset());
    const argentine = calculateBlendedFairValue(makeAsset({ country: 'Argentina' }));

    expect(local.context.countryRiskPremiumPct).toBeLessThan(0.5);
    expect(argentine.context.countryRiskPremiumPct).toBeGreaterThan(3);
    expect(argentine.context.adjustedCostOfEquityPct).toBeGreaterThan(local.context.adjustedCostOfEquityPct + 3);
    expect(argentine.fairValue!).toBeLessThan(local.fairValue!);
  });

  it('prefers a risk table passed by the caller', () => {
    const result = calculateBlendedFairValue(makeAsset({ country: 'BR' }), [{
      country: 'Brazil', continent: 'South America', countryRiskPremium: 6.5, totalEquityRiskPremium: 11.2,
    }]);

    expect(result.context.country).toBe('Brazil');
    expect(result.context.countryRiskPremiumPct).toBeCloseTo(6.5);
  });

  it('keeps an extreme model at the edge of the band instead of dropping it', () => {
    const earnings = model(makeAsset({ metrics: { 'summaryDetail.forwardPE': 300, 'keyStatistics.forwardEps': 100 / 300 } }), 'Ganancias con crecimiento')!;
    expect(earnings.value).toBeCloseTo(40);
    expect(earnings.capped).toBe(true);
  });

  it('discards results that can only come from broken data', () => {
    expect(model(makeAsset({ target: 900 }), 'Consenso de analistas')).toBeUndefined();
    expect(model(makeAsset({ dcfValue: 5_400 }), 'DCF a 10 años')).toBeUndefined();
  });

  it('ignores statement-based models when amounts are in another currency, and tempers growth', () => {
    // Forward EPS reported in pesos: price ÷ (P/E × EPS) is far from one although the labels say USD.
    const result = calculateBlendedFairValue(makeAsset({
      country: 'Argentina',
      metrics: { 'keyStatistics.forwardEps': 4_500, 'earningsTrend.+1y.revenue.growth': 0.6, 'earningsTrend.+1y.growth': 0.6 },
    }));

    expect(result.modelsUsed.some((item) => item.name === 'DCF a 10 años')).toBe(false);
    expect(result.modelsUsed.some((item) => item.name === 'Ganancias con crecimiento')).toBe(true);
    expect(result.modelsUsed.find((item) => item.name === 'Ganancias con crecimiento')!.description).toContain('crecimiento inicial 10.0%');
  });

  it('falls back to normalized free cash flow when there is no DCF', () => {
    const result = calculateBlendedFairValue(makeAsset({ dcfValue: null }));
    expect(result.modelsUsed.some((item) => item.name === 'Flujo de caja libre con crecimiento')).toBe(true);
    expect(calculateBlendedFairValue(makeAsset()).modelsUsed.some((item) => item.name === 'Flujo de caja libre con crecimiento')).toBe(false);
  });

  it('does not use a DCF saved before the ten-year model', () => {
    expect(model(makeAsset({ dataVersion: 3 }), 'DCF a 10 años')).toBeUndefined();
  });

  it('values banks without cash flow models and real estate on dividends', () => {
    const bank = calculateBlendedFairValue(makeAsset({ sector: 'Financial Services', industry: 'Banks - Diversified' }));
    expect(bank.modelsUsed.map((item) => item.name)).toEqual([
      'Ganancias con crecimiento', 'P/E frente al sector', 'Consenso de analistas',
    ]);

    const reit = calculateBlendedFairValue(makeAsset({
      sector: 'Real Estate', industry: 'REIT - Retail', metrics: { 'summaryDetail.dividendYield': 0.05 },
    }));
    expect(reit.modelsUsed.some((item) => item.name === 'Dividendos con crecimiento')).toBe(true);
    expect(reit.modelsUsed.some((item) => item.name === 'Ganancias con crecimiento')).toBe(false);
  });

  it('calls it fairly priced inside the band and names the direction outside it', () => {
    const fair = calculateBlendedFairValue(makeAsset());
    expect(Math.abs(fair.spread!)).toBeLessThan(10);
    expect(fair.verdict).toBe('en-precio');

    const cheap = calculateBlendedFairValue(makeAsset({
      dcfValue: 170, target: 160, metrics: { 'summaryDetail.forwardPE': 10, 'keyStatistics.forwardEps': 10 },
    }));
    expect(cheap.verdict).toBe('infravalorada');

    const expensive = calculateBlendedFairValue(makeAsset({
      dcfValue: 55, target: 80, metrics: { 'summaryDetail.forwardPE': 60, 'keyStatistics.forwardEps': 100 / 60 },
    }));
    expect(expensive.verdict).toBe('sobrevalorada');
  });

  it('reports high confidence when the views agree and low when they contradict each other', () => {
    expect(calculateBlendedFairValue(makeAsset()).confidence).toBe('alta');
    expect(calculateBlendedFairValue(makeAsset({ dcfValue: 30, target: 190 })).confidence).toBe('baja');
  });

  it('gives no value from a single view', () => {
    const result = calculateBlendedFairValue(makeAsset({
      dcfValue: null,
      metrics: { 'summaryDetail.forwardPE': null, 'keyStatistics.forwardPE': null },
    }));
    // Without a P/E only analysts and free cash flow remain; removing the latter leaves one view.
    expect(result.modelsUsed.length).toBe(2);

    const single = makeAsset({ dcfValue: null, metrics: { 'summaryDetail.forwardPE': null, 'keyStatistics.forwardPE': null } });
    single.keyMetrics.freeCashFlowYieldTTM = 0;
    single.yahooMetrics!['financialData.totalRevenue'] = null;
    const alone = calculateBlendedFairValue(single);
    expect(alone.fairValue).toBeNull();
    expect(alone.verdict).toBeNull();
  });

  it('still works on assets saved without sector figures', () => {
    const asset = makeAsset();
    delete asset.valuationInputs;
    const result = calculateBlendedFairValue(asset);
    expect(result.modelsUsed.some((item) => item.name === 'P/E frente al sector')).toBe(false);
    expect(result.fairValue).not.toBeNull();
  });
});

describe('consumers of the fair value', () => {
  it('keeps Insights aligned with the blended value', () => {
    const asset = makeAsset();
    const valuation = calculateBlendedFairValue(asset);
    const insight = toInsightItem(asset);

    expect(insight!.dcf).toBe(valuation.fairValue);
    expect(insight!.mispricingPct).toBe(valuation.spread);
  });

  it('passes the model confidence to portfolio recommendations', () => {
    const asset = makeAsset({ dcfValue: 30, target: 190 });
    const recommendation = generateAdvisory('TECH', { TECH: asset }, []);
    expect(recommendation.valuation.confidence).toBe('baja');
  });

  it('scores the DCF and P/E stars from the models and skips debt for financials', () => {
    const scores = calculateContextualRatingScores(makeAsset({ dcfValue: 150 }));
    expect(scores.discountedCashFlow).toBe(5);
    expect(scores.priceToEarnings).toBeGreaterThanOrEqual(1);

    const bank = calculateContextualRatingScores(makeAsset({ sector: 'Financial Services', industry: 'Banks - Diversified' }));
    expect(bank.discountedCashFlow).toBeNull();
    expect(bank.debtToEquity).toBeNull();
  });
});

describe('classifyBusinessProfile', () => {
  it('classifies a profitable large company as consolidated and low risk when indicators support it', () => {
    const asset = makeAsset({ beta: 0.8, metrics: { 'earningsTrend.+1y.growth': 0.08 } });
    const profile = classifyBusinessProfile(asset, calculateBlendedFairValue(asset).context);

    expect(profile.typeLabel).toBe('Empresa consolidada y rentable');
    expect(profile.riskLevel).toBe('bajo');
  });

  it('classifies fast-growing financial companies as high risk when volatility and country risk agree', () => {
    const asset = makeAsset({
      sector: 'Financial Services', industry: 'Credit Services', country: 'Brazil', beta: 2.1,
      metrics: { 'earningsTrend.+1y.growth': 0.6 },
    });
    const profile = classifyBusinessProfile(asset, calculateBlendedFairValue(asset).context);

    expect(profile.typeLabel).toBe('Financiera de alto crecimiento');
    expect(profile.riskLevel).toBe('alto');
    expect(profile.riskFactors).toContain('volatilidad de mercado elevada (beta 2.10)');
  });

  it('identifies cyclical sectors and does not infer low risk without supporting data', () => {
    const asset = makeAsset({ sector: 'Energy', industry: 'Oil & Gas Integrated', beta: 1.3 });
    const profile = classifyBusinessProfile(asset, calculateBlendedFairValue(asset).context);

    expect(profile.typeLabel).toBe('Negocio cíclico');
    expect(profile.riskLevel).toBe('moderado');
  });
});
