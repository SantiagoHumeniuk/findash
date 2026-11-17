import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { AssetData } from '../../../../types/dashboard';
import { DCFValuationCard } from './dcf-valuation-card';

const valuation = vi.hoisted(() => ({
  spread: 25,
  verdict: 'infravalorada' as 'infravalorada' | 'en-precio' | 'sobrevalorada',
}));

vi.mock('../../lib/valuation-models', () => ({
  FAIR_PRICE_BAND_PCT: 10,
  calculateBlendedFairValue: () => ({
    fairValue: 100 * (1 + valuation.spread / 100),
    fairValueRange: null,
    modelsUsed: [],
    isAnomaly: false,
    spread: valuation.spread,
    verdict: valuation.verdict,
    confidence: 'alta',
    context: {
      sector: 'Technology',
      industry: 'Software',
      country: 'United States',
      countryRiskPremiumPct: 0,
      valuationDiscountPct: 0,
      forwardEpsGrowthPct: null,
      stageGrowthPct: null,
      adjustedCostOfEquityPct: 0.09,
    },
  }),
  classifyBusinessProfile: () => ({
    typeLabel: 'Empresa de perfil general',
    riskLevel: 'moderado',
    description: 'Perfil general',
    riskFactors: [],
  }),
}));

vi.mock('../../../risk-premium/hooks/use-risk-premium-query', () => ({
  useRiskPremiumQuery: () => ({ data: [] }),
}));

vi.mock('../../../../hooks/use-plan-feature', () => ({
  usePlanFeature: () => ({ hasAccess: true }),
}));

describe('DCFValuationCard spread bar', () => {
  beforeEach(() => {
    valuation.spread = 25;
    valuation.verdict = 'infravalorada';
  });

  const renderCard = () => render(
    <DCFValuationCard
      asset={{
        profile: { isEtf: false },
        quote: { price: 100 },
      } as AssetData}
    />,
  );

  it('extends the undervalued bar from the center toward the right', () => {
    renderCard();

    const fill = screen.getByTestId('fair-value-spread-fill');
    expect(fill).toHaveClass('bg-green-500');
    expect(fill).toHaveStyle({ left: '50%', width: '12.5%' });
    expect(screen.getByRole('img', { name: /Desvío del precio respecto al valor justo: \+25\.00%/ }))
      .toBeInTheDocument();
  });

  it('extends the overvalued bar from the center toward the left', () => {
    valuation.spread = -25;
    valuation.verdict = 'sobrevalorada';
    renderCard();

    const fill = screen.getByTestId('fair-value-spread-fill');
    expect(fill).toHaveClass('bg-red-500');
    expect(fill).toHaveStyle({ right: '50%', width: '12.5%' });
  });
});
