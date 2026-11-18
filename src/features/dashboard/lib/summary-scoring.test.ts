import { describe, expect, it } from 'vitest';
import { scoreAssetSummary, type SummaryAssetInput } from './summary-scoring';

const healthyAsset: SummaryAssetInput = {
  profile: { sector: 'Technology', industry: 'Software', beta: 1 },
  quote: {
    pe: 12,
    forwardPE: 10,
    forwardEPS: 6,
    trailingEPS: 4,
    price: 100,
    priceAvg50: 95,
    priceAvg200: 90,
  },
  ratios: [{
    date: '2026-10-01',
    priceToEarningsRatio: 12,
    operatingProfitMargin: 0.25,
    netProfitMargin: 0.2,
    debtToEquityRatio: 0.4,
    currentRatio: 2,
    interestCoverageRatio: 7,
  }],
  keyMetrics: { returnOnEquityTTM: 0.25, netDebtToEBITDATTM: 0.5 },
  priceTargetConsensus: { targetConsensus: 130 },
};

describe('scoreAssetSummary', () => {
  it('requires broad coverage and strong absolute evidence for a positive verdict', () => {
    const result = scoreAssetSummary(healthyAsset);

    expect(result.verdict).toBe('positive');
    expect(result.coverage).toBe(100);
    expect(result.reasons).toHaveLength(14);
    expect(result.verdictText).toContain('sin alertas críticas');
  });

  it('flags several independent risks instead of relying on relative ranking', () => {
    const weakAsset: SummaryAssetInput = {
      ...healthyAsset,
      profile: { ...healthyAsset.profile, beta: 2.3 },
      quote: {
        ...healthyAsset.quote,
        pe: 80,
        forwardPE: 90,
        forwardEPS: 2,
        trailingEPS: 4,
        price: 100,
        priceAvg50: 130,
        priceAvg200: 140,
      },
      ratios: [{
        ...healthyAsset.ratios[0],
        operatingProfitMargin: -0.1,
        netProfitMargin: -0.05,
        debtToEquityRatio: 4,
        currentRatio: 0.7,
        interestCoverageRatio: 1,
      }],
      keyMetrics: { returnOnEquityTTM: -0.1, netDebtToEBITDATTM: 5 },
      priceTargetConsensus: { targetConsensus: 60 },
    };

    const result = scoreAssetSummary(weakAsset);
    expect(result.verdict).toBe('negative');
    expect(result.weaknesses.length).toBeGreaterThanOrEqual(5);
    expect(result.reasons.some((reason) => reason.includes('PER forward exigente'))).toBe(true);
    expect(result.reasons.some((reason) => reason.includes('EPS forward'))).toBe(true);
  });

  it('keeps the verdict neutral when there is not enough data', () => {
    const result = scoreAssetSummary({
      ...healthyAsset,
      profile: { ...healthyAsset.profile, beta: 0 },
      quote: { ...healthyAsset.quote, pe: undefined, forwardPE: undefined, forwardEPS: undefined, trailingEPS: undefined, priceAvg50: 0, priceAvg200: 0 },
      ratios: [],
      keyMetrics: { returnOnEquityTTM: null, netDebtToEBITDATTM: null },
      priceTargetConsensus: { targetConsensus: 0 },
    });

    expect(result.verdict).toBe('neutral');
    expect(result.coverage).toBe(0);
    expect(Object.values(result.categoryScores).every(score => score === null)).toBe(true);
    expect(result.verdictText).toContain('Cobertura limitada');
  });

  it('counts valid zero-valued profitability and leverage metrics', () => {
    const result = scoreAssetSummary({
      ...healthyAsset,
      keyMetrics: { returnOnEquityTTM: 0, netDebtToEBITDATTM: 0 },
    });

    expect(result.reasons).toContain('ROE de 0.0%; rentabilidad aún moderada.');
    expect(result.reasons).toContain('Deuda neta/EBITDA de 0.00x.');
  });

  it('measures financial companies against only applicable indicators', () => {
    const result = scoreAssetSummary({
      ...healthyAsset,
      profile: { ...healthyAsset.profile, sector: 'Financial Services' },
    });

    expect(result.coverage).toBe(100);
    expect(result.categoryScores.financial_health).toBeNull();
  });
});
