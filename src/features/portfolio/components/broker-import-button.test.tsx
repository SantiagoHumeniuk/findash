import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { BrokerImportButton } from './broker-import-button';

const importTransactions = vi.fn(() => Promise.resolve([]));

vi.mock('../../../hooks/use-portfolio', () => ({
  usePortfolio: () => ({
    importTransactions,
    currentPortfolio: { id: 7, name: 'IOL' },
    transactions: [{ id: 1, portfolio_id: 7, symbol: 'OLD', quantity: 1, purchase_price: 1, purchase_date: '2026-01-01', transaction_type: 'buy' }],
  }),
}));
vi.mock('../../../hooks/use-portfolio-limits', () => ({ usePortfolioLimits: () => ({ maxAssets: 20 }) }));
vi.mock('../../../hooks/use-cedear-ratios', () => ({ useCedearRatios: () => ({ ratios: { MELI: 120 }, loading: false }) }));
vi.mock('../../../hooks/use-ccl-rate', () => ({ fetchCclRate: () => Promise.resolve({ rate: 1500, date: '2026-11-15' }) }));
vi.mock('../../../services/api/yahoo-finance-api', () => ({
  fetchYahooMarketQuotes: () => Promise.resolve({ fetchedAt: '', quotes: [{ symbol: 'MELI', currency: 'USD', price: { value: 1760 } }] }),
}));
vi.mock('../../../services/api/local-market-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/api/local-market-api')>();
  return {
    ...actual,
    fetchLocalMarket: () => Promise.resolve({
      fetchedAt: '',
      quotes: new Map([
        ['MELI', { symbol: 'MELI', price: 22000, changePercent: 0, kind: 'cedear' }],
        ['GGAL', { symbol: 'GGAL', price: 6000, changePercent: 0, kind: 'stock' }],
      ]),
    }),
  };
});

const csv = [
  'Símbolo;Cantidad;Último precio;PPC;Valorizado',
  'MELI;10;22.000;18.000;220.000',
  'GGAL;100;6.000;5.000;600.000',
  'ARS;50.000;1;1;50.000',
].join('\n');

describe('BrokerImportButton', () => {
  beforeEach(() => importTransactions.mockClear());

  it('reviews the file, compares values with the broker and replaces the portfolio on confirm', async () => {
    const { container } = render(<BrokerImportButton />);
    const input = container.querySelector<HTMLInputElement>('input[type=file]')!;
    fireEvent.change(input, { target: { files: [new File([csv], 'iol.csv', { type: 'text/csv' })] } });

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('MELI')).toBeInTheDocument();
    expect(within(dialog).getByText('Coincide con tu broker')).toBeInTheDocument();
    expect(within(dialog).getByText(/No se importa/, { selector: 'span' })).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: /Reemplazar e importar 2 activos/ }));
    await waitFor(() => expect(importTransactions).toHaveBeenCalledOnce());
    const [transactions, options] = importTransactions.mock.calls[0] as unknown as [{ symbol: string; quantity: number }[], unknown];
    expect(transactions.map((tx) => tx.symbol)).toEqual(['MELI', 'GGAL.BA']);
    expect(transactions[0].quantity).toBeCloseTo(10 / 120);
    expect(options).toEqual({ replacePortfolioId: 7 });
  });
});
