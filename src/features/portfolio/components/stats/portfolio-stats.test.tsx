import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { AssetData } from '../../../../types/dashboard';
import type { Holding } from '../../../../types/portfolio';
import { PortfolioStats } from './portfolio-stats';

vi.mock('../../../../hooks/use-ccl-rate', () => ({
  useCclRate: () => ({ data: undefined }),
}));

function createAssetData(symbol: string, price: number): AssetData {
  return {
    profile: { symbol, companyName: symbol, image: '', industry: '', beta: 1 },
    quote: { symbol, name: symbol, price, change: 0, changePercentage: 0 },
  } as AssetData;
}

describe('PortfolioStats', () => {
  it('shows best and worst performers by nominal gain and percentage', () => {
    const holdings: Holding[] = [
      { symbol: 'PCT+', quantity: 1, totalCost: 10, avgPurchasePrice: 10, assetData: createAssetData('PCT+', 15) },
      { symbol: 'USD-', quantity: 1, totalCost: 1000, avgPurchasePrice: 1000, assetData: createAssetData('USD-', 900) },
      { symbol: 'USD+', quantity: 1, totalCost: 2000, avgPurchasePrice: 2000, assetData: createAssetData('USD+', 2100) },
      { symbol: 'PCT-', quantity: 1, totalCost: 10, avgPurchasePrice: 10, assetData: createAssetData('PCT-', 4) },
    ];

    render(
      <PortfolioStats
        holdings={holdings}
        totalPerformance={{ pl: 95, percent: 3.17 }}
        portfolioData={Object.fromEntries(holdings.map(({ symbol, assetData }) => [symbol, assetData]))}
      />,
    );

    expect(screen.getByText('USD+')).toBeInTheDocument();
    expect(screen.getByText('USD-')).toBeInTheDocument();
    expect(screen.getByText('PCT+')).toBeInTheDocument();
    expect(screen.getByText('PCT-')).toBeInTheDocument();
    expect(screen.getAllByText('50.00%', { exact: true })).toHaveLength(2);
    expect(screen.getByText('-60.00%')).toBeInTheDocument();
    expect(screen.getByText('USD+ · 69.56%')).toBeInTheDocument();
    expect(screen.getByText('Posiciones en ganancia')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Evolución del valor del portafolio' })).not.toBeInTheDocument();
  });
});
