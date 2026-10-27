import { describe, expect, it } from 'vitest';
import type { AssetData } from '../types/dashboard';
import { getIndicatorStatus, indicatorConfig } from './financial';

function makeAsset(industry: string, sector: string): AssetData {
  return {
    profile: { industry, sector },
    quote: { price: 100 },
  } as AssetData;
}

describe('getIndicatorStatus', () => {
  it('uses higher PER bands for technology than for consumer staples', () => {
    expect(getIndicatorStatus('PER', indicatorConfig.PER, 25, makeAsset('Software - Infrastructure', 'Technology'))).toBe('good');
    expect(getIndicatorStatus('PER', indicatorConfig.PER, 25, makeAsset('Beverages - Non-Alcoholic', 'Consumer Defensive'))).toBe('bad');
  });

  it('scales fractional thresholds to match percentage values shown in the table', () => {
    expect(getIndicatorStatus('operatingMargin', indicatorConfig.operatingMargin, 10)).toBe('normal');
    expect(getIndicatorStatus('operatingMargin', indicatorConfig.operatingMargin, 20)).toBe('good');
    expect(getIndicatorStatus('earningsYield', indicatorConfig.earningsYield, 8)).toBe('good');
    expect(getIndicatorStatus('earningsYield', indicatorConfig.earningsYield, 4)).toBe('bad');
  });

  it('uses quote context for target prices and leaves non-directional metrics neutral', () => {
    const asset = makeAsset('Software', 'Technology');
    expect(getIndicatorStatus('targetPrice', indicatorConfig.targetPrice, 120, asset)).toBe('good');
    expect(getIndicatorStatus('targetPrice', indicatorConfig.targetPrice, 90, asset)).toBe('bad');
    expect(getIndicatorStatus('analystCount', indicatorConfig.analystCount, 20, asset)).toBe('neutral');
  });
});

describe('Yahoo-derived fundamentals', () => {
  it('does not turn missing moving averages into a bearish signal', () => {
    expect(indicatorConfig.smaSignal.compute?.({})).toBeNull();
    expect(indicatorConfig.smaSignal.compute?.({ priceAvg50: 120, priceAvg200: 100 })).toBe(1);
    expect(indicatorConfig.smaSignal.compute?.({ priceAvg50: 90, priceAvg200: 100 })).toBe(0);
  });

  it('derives net debt to EBITDA only when EBITDA is available and positive', () => {
    expect(indicatorConfig.netDebtToEBITDA.compute?.({
      totalDebt: 500,
      totalCash: 100,
      ebitda: 200,
    })).toBe(2);
    expect(indicatorConfig.netDebtToEBITDA.compute?.({
      totalDebt: 500,
      totalCash: 100,
      ebitda: 0,
    })).toBeNull();
  });
});
