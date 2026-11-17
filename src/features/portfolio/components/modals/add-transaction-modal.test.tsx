import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AddTransactionModal } from './add-transaction-modal';

const mocks = vi.hoisted(() => ({
  addTransaction: vi.fn(),
  transactions: [] as { portfolio_id: number; symbol: string }[],
  isAtLimit: false,
  currentPortfolio: { id: 7, name: 'Principal' },
}));

vi.mock('../../../../hooks/use-portfolio', () => ({
  usePortfolio: () => ({
    addTransaction: mocks.addTransaction,
    portfolios: [{ id: 7, name: 'Principal' }],
    transactions: mocks.transactions,
    currentPortfolio: mocks.currentPortfolio,
  }),
}));

vi.mock('../../../../hooks/use-portfolio-limits', () => ({
  usePortfolioLimits: () => ({
    isAtLimit: mocks.isAtLimit,
    upgradeMessage: 'Límite alcanzado.',
  }),
}));

vi.mock('../../../../hooks/use-cedear-ratios', () => ({
  useCedearRatios: () => ({ ratios: {}, loading: false }),
}));

vi.mock('../../../../hooks/use-ccl-rate', () => ({
  useCclRate: () => ({ data: null, isLoading: false }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe('AddTransactionModal Argentine ADR purchases', () => {
  beforeEach(() => {
    mocks.addTransaction.mockReset().mockResolvedValue(null);
    mocks.transactions = [];
    mocks.isAtLimit = false;
  });

  it('converts an ADR purchase into local ticker, shares, and unit cost', async () => {
    render(
      <AddTransactionModal
        isOpen
        onClose={vi.fn()}
        ticker="BMA"
        currentPrice={87.2}
      />,
    );

    expect(await screen.findByText('Ratio ADR: 1 BMA = 10 acciones BMA. Ingresá la cantidad de acciones locales que compraste.'))
      .toBeInTheDocument();
    expect(screen.getByLabelText('PPC por acción local (USD)')).toHaveValue(8.72);
    fireEvent.change(screen.getByLabelText('Cantidad de acciones locales'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Compra' }));

    await waitFor(() => {
      expect(mocks.addTransaction).toHaveBeenCalledWith(expect.objectContaining({
        symbol: 'BMA.BA',
        quantity: 10,
        purchase_price: 8.72,
        transaction_type: 'buy',
        portfolio_id: 7,
      }));
    });
  });

  it('keeps the entered local share count and PPC unchanged for an ADR purchase', async () => {
    render(
      <AddTransactionModal
        isOpen
        onClose={vi.fn()}
        ticker="BMA"
        currentPrice={87.2}
      />,
    );

    fireEvent.change(await screen.findByLabelText('Cantidad de acciones locales'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('PPC por acción local (USD)'), { target: { value: '9.25' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Compra' }));

    await waitFor(() => {
      expect(mocks.addTransaction).toHaveBeenCalledWith(expect.objectContaining({
        symbol: 'BMA.BA',
        quantity: 10,
        purchase_price: 9.25,
      }));
    });
  });

  it('allows buying more ADRs into an existing local position at the asset limit', async () => {
    mocks.transactions = [{ portfolio_id: 7, symbol: 'BMA.BA' }];
    mocks.isAtLimit = true;

    render(
      <AddTransactionModal
        isOpen
        onClose={vi.fn()}
        ticker="BMA"
        currentPrice={87.2}
      />,
    );

    fireEvent.change(await screen.findByLabelText('Cantidad de acciones locales'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Compra' }));

    await waitFor(() => expect(mocks.addTransaction).toHaveBeenCalledOnce());
  });

  it('does not reapply the ADR ratio when buying a local .BA ticker', async () => {
    render(
      <AddTransactionModal
        isOpen
        onClose={vi.fn()}
        ticker="BMA.BA"
        currentPrice={8.72}
      />,
    );

    expect(screen.queryByText(/Ratio ADR:/)).not.toBeInTheDocument();
    fireEvent.change(await screen.findByLabelText('Cantidad'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Compra' }));

    await waitFor(() => {
      expect(mocks.addTransaction).toHaveBeenCalledWith(expect.objectContaining({
        symbol: 'BMA.BA',
        quantity: 10,
        purchase_price: 8.72,
      }));
    });
  });
});
