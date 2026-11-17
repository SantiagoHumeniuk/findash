import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { AssetData } from '../../../../types/dashboard';
import type { HoldingWithMetrics } from '../../../../types/portfolio';
import { PortfolioView } from './portfolio-view';

vi.mock('../../../../components/ui/asset-logo', () => ({ AssetLogo: () => null }));
vi.mock('../../lib/advisory-engine', () => ({ generateAdvisory: () => ({}) }));
vi.mock('../modals/recommendation-modal', () => ({ RecommendationModal: () => null }));

describe('PortfolioView', () => {
  it('links the asset ticker to its individual detail page', () => {
    const assetData = {
      profile: { symbol: 'GOOGL', companyName: 'Alphabet', image: '', industry: 'Technology' },
      quote: { symbol: 'GOOGL', name: 'Alphabet', price: 180, change: 0, changePercentage: 0 },
    } as AssetData;
    const holding = {
      symbol: 'GOOGL',
      quantity: 1,
      totalCost: 150,
      avgPurchasePrice: 150,
      assetData,
      currentPrice: 180,
      marketValue: 180,
      pl: 30,
      plPercent: 20,
      holdingDays: 10,
    } as HoldingWithMetrics;

    render(
      <MemoryRouter>
        <PortfolioView
          holdings={[holding]}
          portfolioData={{ GOOGL: assetData }}
          onDeleteAsset={vi.fn()}
          onAddMore={vi.fn()}
          onSell={vi.fn()}
        />
      </MemoryRouter>,
    );

    const assetLinks = screen.getAllByRole('link', { name: 'Ver detalle de GOOGL' });
    expect(assetLinks).toHaveLength(2);
    assetLinks.forEach(link => expect(link).toHaveAttribute('href', '/asset/GOOGL'));
    expect(screen.getAllByRole('row')[1]).toHaveClass('hover:bg-primary/10');
  });
});
