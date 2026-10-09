import { describe, expect, it } from 'vitest';
import type { AssetData } from '../../../types/dashboard';
import type { Holding } from '../../../types/portfolio';
import { calculateBlendedFairValue, calculateContextualRatingScores, classifyBusinessProfile } from './valuation-models';
import { generateAdvisory } from '../../portfolio/lib/advisory-engine';
import { toInsightItem } from '../../insights/lib/helpers';

function makeFintechAsset(forwardEps: number): AssetData {
  return {
    symbol: 'NU',
    profile: {
      symbol: 'NU', companyName: 'Nu Holdings', sector: 'Financial Services', industry: 'Credit Services',
      country: 'KY', currency: 'USD', beta: 1.2, marketCap: 100_000_000_000,
    },
    quote: { symbol: 'NU', name: 'Nu Holdings', price: 100 },
    keyMetrics: {
      symbol: 'NU', evToEBITDATTM: 0, returnOnEquityTTM: 0.3,
      earningsYieldTTM: 0.04, freeCashFlowYieldTTM: 0,
    },
    ratios: [{
      symbol: 'NU', date: '2026-06-30', priceToEarningsRatio: 25,
      netIncomePerShare: 4, priceToBookRatio: 5, dividendYield: 0,
    }],
    analystEstimates: [{
      symbol: 'NU', date: '2027-12-31', epsAvg: forwardEps, numAnalystsEps: 8,
      revenueAvg: 20_000_000_000, numAnalystsRevenue: 8,
    }],
  } as unknown as AssetData;
}

describe('growth-aware financial valuation', () => {
  it('uses forward EPS growth to value a high-growth financial company', () => {
    const highGrowth = calculateBlendedFairValue(makeFintechAsset(6.4));
    const lowGrowth = calculateBlendedFairValue(makeFintechAsset(4.2));
    const highGrowthPe = highGrowth.modelsUsed.find((model) => model.name === 'P/E por EPS estimado');
    const lowGrowthPe = lowGrowth.modelsUsed.find((model) => model.name === 'P/E por EPS estimado');

    expect(highGrowthPe).toBeDefined();
    expect(lowGrowthPe).toBeDefined();
    expect(highGrowthPe!.value).toBeGreaterThan(lowGrowthPe!.value * 1.5);
    expect(highGrowth.context.forwardEpsGrowthPct).toBeCloseTo(60);
    expect(highGrowth.fairValueRange?.high).toBeGreaterThan(highGrowth.fairValueRange!.low);
  });

  it('does not treat historical earnings-yield changes as forward EPS growth', () => {
    const asset = makeFintechAsset(6.4);
    asset.analystEstimates = [];
    asset.keyMetricsYearly = [
      { symbol: 'NU', date: '2024-12-31', earningsYield: 0.02 },
      { symbol: 'NU', date: '2025-12-31', earningsYield: 0.04 },
    ] as AssetData['keyMetricsYearly'];

    const result = calculateBlendedFairValue(asset);

    expect('confidence' in result).toBe(false);
    expect(result.modelsUsed.some((model) => model.name === 'PEG de Peter Lynch')).toBe(false);
  });

  it('reduces a financial fair multiple when forward EPS is expected to contract', () => {
    const noGrowth = calculateBlendedFairValue(makeFintechAsset(4));
    const declining = calculateBlendedFairValue(makeFintechAsset(2.8));
    const noGrowthPe = noGrowth.modelsUsed.find((model) => model.name === 'P/E por EPS estimado');
    const decliningPe = declining.modelsUsed.find((model) => model.name === 'P/E por EPS estimado');

    expect(decliningPe!.value).toBeLessThan(noGrowthPe!.value);
  });

  it('keeps the signal neutral when positive growth still falls short of the valuation threshold', () => {
    const asset = makeFintechAsset(6.4);
    const recommendation = generateAdvisory('NU', { NU: asset }, []);

    expect(recommendation.status).toBe('HOLD');
    expect(recommendation.reasons.some((reason) => reason.text.includes('umbral mínimo de ±20%'))).toBe(true);
    expect(recommendation.reasons.some((reason) => reason.text.toLowerCase().includes('crecimiento'))).toBe(true);
    expect(recommendation.reasons.some((reason) => reason.text.toLowerCase().includes('depósitos'))).toBe(true);
  });

  it('does not recommend buying a low-growth financial company on P/E alone', () => {
    const recommendation = generateAdvisory('NU', { NU: makeFintechAsset(4.2) }, []);

    expect(recommendation.status).not.toBe('BUY');
  });

  it('uses Yahoo target consensus only when analyst coverage is sufficient', () => {
    const asset = makeTechnologyAsset('US');
    asset.quote.price = 100;
    asset.yahooMetrics = {
      'financialData.targetMeanPrice': 70,
      'financialData.numberOfAnalystOpinions': 6,
    };

    const coveredRecommendation = generateAdvisory('TECH', { TECH: asset }, []);
    expect(coveredRecommendation.reasons.some((reason) =>
      reason.text.includes('objetivo medio de Yahoo Finance') && reason.type === 'negative'
    )).toBe(true);

    asset.yahooMetrics['financialData.numberOfAnalystOpinions'] = 2;
    const sparseRecommendation = generateAdvisory('TECH', { TECH: asset }, []);
    expect(sparseRecommendation.reasons.some((reason) =>
      reason.text.includes('cobertura insuficiente') && reason.type === 'neutral'
    )).toBe(true);
  });

  it('does not calculate sector concentration across mixed quote currencies', () => {
    const usdAsset = makeFintechAsset(6.4);
    const arsAsset = {
      ...makeFintechAsset(6.4),
      symbol: 'LOCAL',
      profile: { ...usdAsset.profile, symbol: 'LOCAL', currency: 'ARS' },
      quote: { ...usdAsset.quote, symbol: 'LOCAL' },
    } as AssetData;
    const holdings: Holding[] = [
      { symbol: 'NU', quantity: 1, totalCost: 100, avgPurchasePrice: 100, assetData: usdAsset },
      { symbol: 'LOCAL', quantity: 1, totalCost: 100, avgPurchasePrice: 100, assetData: arsAsset },
    ];

    const recommendation = generateAdvisory('NU', { NU: usdAsset, LOCAL: arsAsset }, holdings);

    expect(recommendation.impact.currentAllocationPercent).toBeNull();
    expect(recommendation.impact.simulatedAllocationPercent).toBeNull();
    expect(recommendation.reasons.some((reason) => reason.text.includes('distintas monedas'))).toBe(true);
  });

  it('recommends SELL when severe overvaluation and independent financial risks agree', () => {
    const asset = makeTechnologyAsset('US');
    asset.profile.beta = 2.2;
    asset.quote.price = 100;
    asset.quote.forwardPE = 70;
    asset.quote.priceAvg50 = 120;
    asset.quote.priceAvg200 = 130;
    asset.keyMetrics.returnOnEquityTTM = -0.1;
    asset.keyMetrics.netDebtToEBITDATTM = 6;
    asset.keyMetrics.evToEBITDATTM = 40;
    asset.keyMetrics.evToSalesTTM = 6;
    asset.ratios[0] = {
      ...asset.ratios[0],
      priceToEarningsRatio: 50,
      priceToSalesRatio: 6,
      priceToBookRatio: 15,
      debtToEquityRatio: 5,
      currentRatio: 0.5,
      interestCoverageRatio: 0.5,
      operatingProfitMargin: -0.15,
    };
    asset.analystEstimates = [{
      ...makeFintechAsset(4).analystEstimates[0],
      symbol: 'TECH',
      date: '2027-12-31',
      epsAvg: 1,
      numAnalystsEps: 8,
      revenueAvg: 20_000_000_000,
      numAnalystsRevenue: 8,
    }];
    asset.priceTargetConsensus = {
      symbol: 'TECH',
      targetHigh: 0,
      targetLow: 0,
      targetConsensus: 0,
      targetMedian: 0,
    };

    const recommendation = generateAdvisory('TECH', { TECH: asset }, []);

    expect(recommendation.status, JSON.stringify(recommendation, null, 2)).toBe('SELL');
    expect(recommendation.reasons.filter((reason) => reason.type === 'negative').length).toBeGreaterThanOrEqual(3);
  });

  it('does not score fintech debt/equity and recalculates valuation stars from forward models', () => {
    const asset = makeFintechAsset(6.4);
    asset.rating = {
      symbol: 'NU', rating: 'B-', overallScore: 2,
      discountedCashFlowScore: 1, returnOnEquityScore: 5, returnOnAssetsScore: 4,
      debtToEquityScore: 1, priceToEarningsScore: 1, priceToBookScore: 1,
    };

    const scores = calculateContextualRatingScores(asset);

    expect(scores.debtToEquity).toBeNull();
    expect(scores.priceToEarnings).toBe(5);
    expect(scores.priceToBook).toBeGreaterThanOrEqual(1);
    expect(scores.priceToBook).toBeLessThanOrEqual(5);
  });

  it('leaves unavailable valuation scores unscored instead of assigning zero stars', () => {
    const asset = makeFintechAsset(6.4);
    asset.rating = {
      symbol: 'NU', rating: 'B-', overallScore: 2,
      discountedCashFlowScore: 0, returnOnEquityScore: 5, returnOnAssetsScore: 4,
      debtToEquityScore: 0, priceToEarningsScore: 0, priceToBookScore: 0,
    };

    const scores = calculateContextualRatingScores(asset);

    expect(scores.discountedCashFlow).toBeNull();
    expect(scores.debtToEquity).toBeNull();
    expect(scores.priceToEarnings).toBeGreaterThanOrEqual(1);
    expect(scores.priceToBook).toBeGreaterThanOrEqual(1);
  });
});

function makeTechnologyAsset(country: string): AssetData {
  return {
    symbol: 'TECH',
    profile: {
      symbol: 'TECH', companyName: 'Technology Co', sector: 'Technology', industry: 'Software',
      country, currency: 'USD', beta: 1, marketCap: 1_000,
    },
    quote: { symbol: 'TECH', name: 'Technology Co', price: 100, marketCap: 1_000 },
    keyMetrics: {
      symbol: 'TECH', marketCap: 1_000, enterpriseValueTTM: 1_200,
      evToEBITDATTM: 12, evToSalesTTM: 5, returnOnEquityTTM: 0.2,
      earningsYieldTTM: 0.04, freeCashFlowYieldTTM: 0.04,
    },
    ratios: [{
      symbol: 'TECH', date: '2026-06-30', priceToEarningsRatio: 25,
      priceToBookRatio: 4, priceToSalesRatio: 8, ebitMargin: 0.15,
      netIncomePerShare: 4, dividendYield: 0, reportedCurrency: 'USD',
    }],
  } as unknown as AssetData;
}

describe('sector and country comparable valuation', () => {
  it('includes available sales and EBIT multiples and bridges EV through net debt', () => {
    const result = calculateBlendedFairValue(makeTechnologyAsset('US'));
    const evEbitda = result.modelsUsed.find((model) => model.name === 'EV/EBITDA por Sector');

    expect(evEbitda).toBeDefined();
    expect(evEbitda!.value).toBeCloseTo(155);
    expect(result.modelsUsed.some((model) => model.name === 'Precio/Ventas por Sector')).toBe(true);
    expect(result.modelsUsed.map((model) => model.name)).toContain('EV/Ventas por Sector');
    expect(result.modelsUsed.find((model) => model.name === 'EV/Ventas por Sector')!.value).toBeCloseTo(136);
    expect(result.modelsUsed.some((model) => model.name === 'EV/EBIT por Sector')).toBe(true);
    expect(result.modelsUsed.some((model) => model.name === 'Precio/Valor Contable por Sector')).toBe(true);
  });

  it('applies the issuer country adjustment alongside sector benchmarks', () => {
    const result = calculateBlendedFairValue(makeTechnologyAsset('BR'));

    expect(result.context.sector).toBe('Technology');
    expect(result.context.country).toContain('Brasil');
    expect(result.context.countryRiskPremiumPct).toBeCloseTo(4.2);
    expect(result.context.valuationDiscountPct).toBeCloseTo(22);
  });

  it('keeps Insights mispricing aligned with the blended fair value, not the standalone provider DCF', () => {
    const asset = makeTechnologyAsset('US');
    asset.dcfLevered = { symbol: 'TECH', date: '2026-01-01', dcf: 50, 'Stock Price': 100 };
    const valuation = calculateBlendedFairValue(asset);
    const insight = toInsightItem(asset);

    expect(insight).toBeDefined();
    expect(insight!.dcf).toBe(valuation.fairValue);
    expect(insight!.mispricingPct).toBe(valuation.spread);
    expect(insight!.dcf).not.toBe(50);
  });

  it('uses FMP country risk premium instead of the static fallback when available', () => {
    const result = calculateBlendedFairValue(makeTechnologyAsset('BR'), [{
      country: 'Brazil', continent: 'South America', countryRiskPremium: 6.5, totalEquityRiskPremium: 11.2,
    }]);

    expect(result.context.country).toBe('Brazil');
    expect(result.context.countryRiskPremiumPct).toBeCloseTo(6.5);
  });

  it('keeps analyst targets as a low-weight reference and includes the advanced FMP DCF', () => {
    const asset = makeTechnologyAsset('US');
    asset.priceTargetConsensus = {
      symbol: 'TECH', targetHigh: 130, targetLow: 95, targetConsensus: 112, targetMedian: 110,
    };
    asset.dcf = [{ year: '2030', equityValuePerShare: 125 }] as AssetData['dcf'];

    const result = calculateBlendedFairValue(asset);
    const analystTarget = result.modelsUsed.find((model) => model.name === 'Consenso de Analistas');
    const advancedDcf = result.modelsUsed.find((model) => model.name === 'DCF Avanzado FMP');

    expect(analystTarget?.weight).toBe(0.25);
    expect(advancedDcf?.value).toBe(125);
  });

  it('uses median FMP peer multiples when at least three peers provide each ratio', () => {
    const asset = makeTechnologyAsset('US');
    asset.peerValuations = [
      { symbol: 'P1', companyName: 'Peer One', price: 10, marketCap: 100, priceToEarningsRatio: 15, priceToBookRatio: 2, priceToSalesRatio: 2, priceToFreeCashFlowRatio: 20, ebitMargin: 0.1, evToEBITDA: 10, evToEBIT: 20, evToSales: 3 },
      { symbol: 'P2', companyName: 'Peer Two', price: 10, marketCap: 100, priceToEarningsRatio: 20, priceToBookRatio: 3, priceToSalesRatio: 3, priceToFreeCashFlowRatio: 25, ebitMargin: 0.1, evToEBITDA: 12, evToEBIT: 22, evToSales: 4 },
      { symbol: 'P3', companyName: 'Peer Three', price: 10, marketCap: 100, priceToEarningsRatio: 25, priceToBookRatio: 4, priceToSalesRatio: 4, priceToFreeCashFlowRatio: 30, ebitMargin: 0.1, evToEBITDA: 14, evToEBIT: 24, evToSales: 5 },
    ];
    asset.ratios[0].ebitMargin = 0.3;

    const result = calculateBlendedFairValue(asset);
    const evEbitda = result.modelsUsed.find((model) => model.name === 'EV/EBITDA por Pares FMP');

    expect(evEbitda).toBeDefined();
    expect(evEbitda!.value).toBeCloseTo(100);
    expect(result.modelsUsed.find((model) => model.name === 'P/E por EPS estimado')!.description).toContain('mediana FMP de 3 pares');
    expect(result.modelsUsed.some((model) => model.name === 'Precio/Ventas por Pares FMP')).toBe(true);
    expect(result.modelsUsed.find((model) => model.name === 'EV/Ventas por Pares FMP')!.description).toContain('margen EBIT ajustado 1.50x');
    expect(result.context.forwardEpsGrowthPct).toBeNull();
  });

  it('classifies a profitable large company as consolidated and low risk when indicators support it', () => {
    const asset = makeTechnologyAsset('US');
    asset.profile.beta = 0.8;
    asset.profile.marketCap = 50_000_000_000;
    asset.keyMetrics.returnOnEquityTTM = 0.2;
    asset.keyMetrics.netDebtToEBITDATTM = 1.2;

    const valuation = calculateBlendedFairValue(asset);
    const profile = classifyBusinessProfile(asset, valuation.context);

    expect(profile.typeLabel).toBe('Empresa consolidada y rentable');
    expect(profile.riskLevel).toBe('bajo');
  });

  it('classifies fast-growing financial companies without calling model count confidence', () => {
    const asset = makeFintechAsset(6.4);
    asset.profile.country = 'BR';
    asset.profile.beta = 2.1;

    const valuation = calculateBlendedFairValue(asset);
    const profile = classifyBusinessProfile(asset, valuation.context);

    expect(profile.typeLabel).toBe('Financiera de alto crecimiento');
    expect(profile.riskLevel).toBe('alto');
    expect(profile.riskFactors).toContain('volatilidad de mercado elevada (beta 2.10)');
  });

  it('identifies cyclical sectors and does not infer low risk without supporting data', () => {
    const asset = makeTechnologyAsset('US');
    asset.profile.sector = 'Energy';
    asset.profile.beta = 1.3;

    const valuation = calculateBlendedFairValue(asset);
    const profile = classifyBusinessProfile(asset, valuation.context);

    expect(profile.typeLabel).toBe('Negocio cíclico');
    expect(profile.riskLevel).toBe('moderado');
  });

  it('uses forward analyst revenue, EBITDA, and EBIT estimates when currencies match', () => {
    const asset = makeTechnologyAsset('US');
    asset.analystEstimates = [{
      symbol: 'TECH', date: '2027-12-31', revenueAvg: 175,
      ebitdaAvg: 55, ebitAvg: 50, epsAvg: 4.5,
      numAnalystsRevenue: 8, numAnalystsEps: 8,
    }] as AssetData['analystEstimates'];
    asset.dcf = [{ year: '2027', wacc: 10 }] as AssetData['dcf'];

    const years = (new Date('2027-12-31').getTime() - Date.now()) / (365.25 * 24 * 60 * 60 * 1000);
    const result = calculateBlendedFairValue(asset);
    const forwardEvEbitda = result.modelsUsed.find((model) => model.name === 'EV/EBITDA Forward por consenso');

    expect(result.modelsUsed.some((model) => model.name === 'P/S Forward por ventas estimadas')).toBe(true);
    expect(result.modelsUsed.some((model) => model.name === 'EV/Ventas Forward por consenso')).toBe(true);
    expect(forwardEvEbitda).toBeDefined();
    expect(forwardEvEbitda!.value).toBeCloseTo((55 * 17.5 / Math.pow(1.1, years) - 200) / 10, 2);
    expect(result.modelsUsed.some((model) => model.name === 'EV/EBIT Forward por consenso')).toBe(true);
  });

  it('does not combine forward estimates reported in a different currency', () => {
    const asset = makeTechnologyAsset('US');
    asset.profile.currency = 'EUR';
    asset.analystEstimates = [{
      symbol: 'TECH', date: '2027-12-31', revenueAvg: 175,
      ebitdaAvg: 55, ebitAvg: 50, epsAvg: 4.5,
      numAnalystsRevenue: 8, numAnalystsEps: 8,
    }] as AssetData['analystEstimates'];

    const result = calculateBlendedFairValue(asset);

    expect(result.modelsUsed.some((model) => model.name.includes('Forward'))).toBe(false);
  });
});
