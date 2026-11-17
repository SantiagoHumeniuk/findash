import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { BrokerImportButton } from './broker-import-button';

const importTransactions = vi.fn(() => Promise.resolve([]));
const ratioQuery = vi.hoisted(() => ({ loading: false }));
const fetchYahooMarketQuotes = vi.hoisted(() => vi.fn());

vi.mock('../../../hooks/use-portfolio', () => ({
  usePortfolio: () => ({
    importTransactions,
    currentPortfolio: { id: 7, name: 'IOL' },
    transactions: [{ id: 1, portfolio_id: 7, symbol: 'OLD', quantity: 1, purchase_price: 1, purchase_date: '2026-01-01', transaction_type: 'buy' }],
  }),
}));
vi.mock('../../../hooks/use-portfolio-limits', () => ({ usePortfolioLimits: () => ({ maxAssets: 20 }) }));
vi.mock('../../../hooks/use-cedear-ratios', () => ({
  useCedearRatios: () => ({
    ratios: { MELI: 120, 'BA.C': 4, BRKB: 22, NVDA: 24, AAPL: 20, GOOGL: 58, NU: 2 },
    loading: ratioQuery.loading,
  }),
}));
vi.mock('../../../hooks/use-ccl-rate', () => ({ fetchCclRate: () => Promise.resolve({ rate: 1500, date: '2026-11-15' }) }));
vi.mock('../../../services/api/yahoo-finance-api', () => ({ fetchYahooMarketQuotes }));
vi.mock('../../../services/api/local-market-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/api/local-market-api')>();
  return {
    ...actual,
    fetchLocalMarket: () => Promise.resolve({
      fetchedAt: '',
      quotes: new Map([
        ['MELI', { symbol: 'MELI', price: 22000, changePercent: 0, kind: 'cedear' }],
        ['BA.C', { symbol: 'BA.C', price: 17000, changePercent: 0, kind: 'cedear' }],
        ['GGAL', { symbol: 'GGAL', price: 6000, changePercent: 0, kind: 'stock' }],
        ['BMA', { symbol: 'BMA', price: 13080, changePercent: 0, kind: 'stock' }],
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
  beforeEach(() => {
    importTransactions.mockClear();
    ratioQuery.loading = false;
    fetchYahooMarketQuotes.mockReset().mockResolvedValue({
      fetchedAt: '',
      quotes: [
        { symbol: 'MELI', currency: 'USD', price: { value: 1760 } },
        { symbol: 'BAC', currency: 'USD', price: { value: 45 } },
        { symbol: 'NVDA', currency: 'USD', price: { value: 160 } },
      ],
    });
  });

  it('waits for the saved CEDEAR ratios before allowing an import', () => {
    ratioQuery.loading = true;
    render(<BrokerImportButton />);

    expect(screen.getByRole('button', { name: 'Cargando ratios…' })).toBeDisabled();
  });

  it('uses the preloaded ratio instead of deriving it from the current quote', async () => {
    const csv = ['Ticker;Cantidad;Último precio;PPC', 'BA.C;10;17.000;16.000'].join('\n');
    const { container } = render(<BrokerImportButton />);
    const input = container.querySelector<HTMLInputElement>('input[type=file]')!;
    fireEvent.change(input, { target: { files: [new File([csv], 'iol.csv', { type: 'text/csv' })] } });

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Ratio del CEDEAR BA.C')).toHaveValue(4);
    expect(within(dialog).queryByText(/deducido de los precios de hoy/)).not.toBeInTheDocument();
    expect(fetchYahooMarketQuotes).toHaveBeenCalledWith(['BAC']);
  });

  it('loads a catalog ratio when an imported ticker uses different punctuation and has no quote', async () => {
    const csv = ['Ticker;Cantidad;Último precio;PPC', 'BRK.B;10;100;90'].join('\n');
    const { container } = render(<BrokerImportButton />);
    const input = container.querySelector<HTMLInputElement>('input[type=file]')!;
    fireEvent.change(input, { target: { files: [new File([csv], 'iol.csv', { type: 'text/csv' })] } });

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Ratio del CEDEAR BRK.B')).toHaveValue(22);
  });

  it('imports the USD CEDEAR ticker using its company ratio and underlying quote', async () => {
    const csv = [
      'Ticker;Cantidad;Último precio;PPC;Moneda',
      'NVDAD;5;6,67;6,5;USD',
      'NVDA;2;160;150;USD',
    ].join('\n');
    const { container } = render(<BrokerImportButton />);
    const input = container.querySelector<HTMLInputElement>('input[type=file]')!;
    fireEvent.change(input, { target: { files: [new File([csv], 'iol.csv', { type: 'text/csv' })] } });

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Ratio del CEDEAR NVDAD')).toHaveValue(24);
    expect(within(dialog).getByText('US$ 6,5')).toBeInTheDocument();
    expect(fetchYahooMarketQuotes).toHaveBeenCalledWith(['NVDA']);

    fireEvent.click(within(dialog).getByRole('button', { name: /Reemplazar e importar 2 activos/ }));
    await waitFor(() => expect(importTransactions).toHaveBeenCalledOnce());
    const [transactions] = importTransactions.mock.calls[0] as unknown as [{ symbol: string; quantity: number; purchase_price: number }[]];
    expect(transactions.map((transaction) => transaction.symbol)).toEqual(['NVDA', 'NVDA']);
    expect(transactions[0].quantity).toBeCloseTo(5 / 24);
    expect(transactions[0].purchase_price).toBeCloseTo(6.5 * 24);
    expect(transactions[1].quantity).toBe(2);
    expect(transactions[1].purchase_price).toBe(150);
  });

  it('imports BMA.D as BMA without converting the USD PPC to pesos', async () => {
    const csv = ['Ticker;Cantidad;Último precio;PPC', 'BMA.D;10;$ 9,00;$ 8,72'].join('\n');
    const { container } = render(<BrokerImportButton />);
    const input = container.querySelector<HTMLInputElement>('input[type=file]')!;
    fireEvent.change(input, { target: { files: [new File([csv], 'iol.csv', { type: 'text/csv' })] } });

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('BMA')).toBeInTheDocument();
    expect(within(dialog).getByText('US$ 8,72')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: /Reemplazar e importar 1 activos/ }));

    await waitFor(() => expect(importTransactions).toHaveBeenCalledOnce());
    const [transactions] = importTransactions.mock.calls[0] as unknown as [{ symbol: string; purchase_price: number }[]];
    expect(transactions[0]).toMatchObject({ symbol: 'BMA.BA', purchase_price: 8.72 });
  });

  it('preloads the BMA ADR ratio and saves the equivalent local shares', async () => {
    const csv = ['Ticker;Cantidad;Último precio;PPC;Moneda', 'BMA;1;87,20;80,00;USD'].join('\n');
    const { container } = render(<BrokerImportButton />);
    const input = container.querySelector<HTMLInputElement>('input[type=file]')!;
    fireEvent.change(input, { target: { files: [new File([csv], 'adr.csv', { type: 'text/csv' })] } });

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Acciones locales por ADR BMA')).toHaveValue(10);
    expect(within(dialog).getByText(/10 acciones locales por ADR/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: /Reemplazar e importar 1 activos/ }));

    await waitFor(() => expect(importTransactions).toHaveBeenCalledOnce());
    const [transactions] = importTransactions.mock.calls[0] as unknown as [{ symbol: string; quantity: number; purchase_price: number }[]];
    expect(transactions[0]).toMatchObject({ symbol: 'BMA.BA', quantity: 10, purchase_price: 8 });
  });

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
