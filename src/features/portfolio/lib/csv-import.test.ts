import { describe, expect, it } from 'vitest';
import { mapCsvRowsToTransactions, parsePortfolioCsv } from './csv-import';

describe('parsePortfolioCsv', () => {
  it('detects and normalizes IOL CSV data', () => {
    const csv = [
      'Ticker;Cantidad;Precio;Fecha;Tipo',
      'YPFD;10;150.65;12/08/2024;Compra',
      'GGAL;5;650,5;20/08/2024;Venta',
    ].join('\n');

    const result = parsePortfolioCsv(csv);

    expect(result.broker).toBe('iol');
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      symbol: 'YPFD',
      quantity: 10,
      price: 150.65,
      type: 'buy',
    });
    expect(result.rows[1]).toMatchObject({
      symbol: 'GGAL',
      quantity: 5,
      price: 650.5,
      type: 'sell',
    });
  });

  it('supports Balanz and COCOS-like exports', () => {
    const balanzCsv = [
      'Símbolo,Cantidad,Precio unitario,Fecha,Tipo',
      'TXAR,8,125,30/11/2024,compra',
    ].join('\n');

    const cocosCsv = [
      'Activo,Cantidad,Precio de compra,Fecha,Operación',
      'AAPL,2,210.75,2024-12-01,Venta',
    ].join('\n');

    expect(parsePortfolioCsv(balanzCsv).broker).toBe('balanz');
    expect(parsePortfolioCsv(cocosCsv).rows[0]).toMatchObject({
      symbol: 'AAPL',
      quantity: 2,
      price: 210.75,
      type: 'sell',
    });
  });

  it('ignores empty rows and invalid records', () => {
    const csv = [
      'Ticker,Cantidad,Precio,Fecha,Tipo',
      'PAMP,3,75.2,2024-09-10,Compra',
      ',,,',
      'INVALID,abc,1.1,2024-09-11,Compra',
    ].join('\n');

    const result = parsePortfolioCsv(csv);

    expect(result.validRows).toBe(1);
    expect(result.invalidRows).toBe(1);
    expect(result.rows).toHaveLength(1);
  });

  it('handles BOM, quoted delimiters, local thousands and decimal separators', () => {
    const csv = [
      '\uFEFFActivo;Tenencia;Costo promedio;Fecha de concertación;Operación',
      '"BRK, B";1.250;1.234,56;31/12/2024;Compra',
    ].join('\r\n');

    const result = parsePortfolioCsv(csv, 'cartera-cocos.csv');

    expect(result.broker).toBe('cocos');
    expect(result.rows[0]).toMatchObject({
      symbol: 'BRK,B',
      quantity: 1250,
      price: 1234.56,
      type: 'buy',
    });
    expect(result.rows[0].date).toBe('2024-12-31T00:00:00.000Z');
  });

  it('detects Bull Market from the export filename', () => {
    const result = parsePortfolioCsv(
      'Especie,Cantidad,Costo medio\nAL30,10,980',
      'bull-market-tenencia.csv',
    );

    expect(result.broker).toBe('bull-market');
    expect(result.rows[0]).toMatchObject({ symbol: 'AL30', quantity: 10, price: 980 });
    expect(result.rows[0].dateEstimated).toBe(true);
  });

  it('imports holdings exports with title, market, currency, quote and amount columns', () => {
    const csv = [
      'Título,Símbolo,Mercado,Cantidad,Moneda,Cotización,Importe',
      'YPF Sociedad Anónima,YPFD,BCBA,12,ARS,"$ 1.234,50","$ 14.814,00"',
    ].join('\n');

    const result = parsePortfolioCsv(csv);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      symbol: 'YPFD',
      quantity: 12,
      price: 1234.5,
      type: 'buy',
      dateEstimated: true,
    });
  });

  it('derives unit price from amount when the quote column is absent', () => {
    const result = parsePortfolioCsv(
      'Especie,Tenencia,Moneda,Importe\nAL30,20,ARS,"$ 24.000,00"',
    );

    expect(result.rows[0]).toMatchObject({
      symbol: 'AL30',
      quantity: 20,
      price: 1200,
      amount: 24000,
    });
  });

  it('keeps USD CEDEAR quotes in USD and applies the ratio to stored transactions', () => {
    const { rows } = parsePortfolioCsv(
      'Símbolo,Cantidad,Moneda,Cotización\nAAPL,10,USD,15',
    );

    const [transaction] = mapCsvRowsToTransactions(rows, 4, {
      asCedears: true,
      cedearRatios: { AAPL: 10 },
      cclRate: 1200,
    });

    expect(transaction).toMatchObject({
      symbol: 'AAPL',
      quantity: 1,
      purchase_price: 150,
      portfolio_id: 4,
    });
  });

  it('converts ARS CEDEAR quotes to USD by dividing by CCL', () => {
    const { rows } = parsePortfolioCsv(
      'Símbolo,Cantidad,Moneda,Cotización\nAAPL,10,ARS,18000',
    );

    const [transaction] = mapCsvRowsToTransactions(rows, 4, {
      asCedears: true,
      cedearRatios: { AAPL: 10 },
      cclRate: 1200,
    });

    expect(transaction).toMatchObject({ quantity: 1, purchase_price: 150 });
  });

  it('assumes ARS for CEDEAR quotes when the CSV has no currency column', () => {
    const { rows } = parsePortfolioCsv('Símbolo,Cantidad,Cotización\nAAPL,10,18000');
    const [transaction] = mapCsvRowsToTransactions(rows, 4, {
      asCedears: true,
      cedearRatios: { AAPL: 10 },
      cclRate: 1200,
    });

    expect(transaction).toMatchObject({ quantity: 1, purchase_price: 150 });
  });

  it('converts an ordinary imported ARS average purchase price to USD with CCL', () => {
    const { rows } = parsePortfolioCsv(
      'Símbolo,Cantidad,Moneda,Precio promedio\nGGAL,25,ARS,120000',
    );
    const [transaction] = mapCsvRowsToTransactions(rows, 4, { cclRate: 1200 });

    expect(transaction).toMatchObject({ quantity: 25, purchase_price: 100 });
  });

  it('recognizes AR$ as ARS and converts the average price with CCL', () => {
    const { rows } = parsePortfolioCsv(
      'Símbolo,Cantidad,Moneda,Precio promedio\nXYZ,25,AR$,120000',
    );
    const [transaction] = mapCsvRowsToTransactions(rows, 4, { cclRate: 1200 });

    expect(transaction).toMatchObject({ symbol: 'XYZ', quantity: 25, purchase_price: 100 });
  });

  it('imports an unlisted CEDEAR ratio as a warned 1:1 holding', () => {
    const { rows } = parsePortfolioCsv('Símbolo,Cantidad,Moneda,Cotización\nXYZ,25,AR$,120000');
    const [transaction] = mapCsvRowsToTransactions(rows, 4, {
      asCedears: true,
      cedearRatios: {},
      cclRate: 1200,
    });

    expect(transaction).toMatchObject({ symbol: 'XYZ', quantity: 25, purchase_price: 100 });
  });

  it('normalizes local BMA shares to the NYSE ADR basis for USD valuation', () => {
    const { rows } = parsePortfolioCsv(
      'Símbolo,Mercado,Cantidad,Moneda,Cotización\nBMA,BCBA,1000,AR$,12000',
    );
    const [transaction] = mapCsvRowsToTransactions(rows, 4, { cclRate: 1200 });

    expect(transaction).toMatchObject({
      symbol: 'BMA',
      quantity: 100,
      purchase_price: 100,
    });
    expect(transaction.quantity * transaction.purchase_price).toBe(10000);
  });
});
