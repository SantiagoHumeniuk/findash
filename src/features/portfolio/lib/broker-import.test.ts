import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import type { LocalQuote } from '../../../services/api/local-market-api';
import { classifyRow, parseBrokerSheets, parseNumber, toTransactions, type ClassifyContext } from './broker-import';
import { parseDelimitedText } from './read-spreadsheet';

const CCL = 1500;
const local = new Map<string, LocalQuote>([
  ['MELI', { symbol: 'MELI', price: 22_000, changePercent: 1, kind: 'cedear' }],
  ['AAPL', { symbol: 'AAPL', price: 18_000, changePercent: 0, kind: 'cedear' }],
  ['GGAL', { symbol: 'GGAL', price: 6_000, changePercent: 0, kind: 'stock' }],
  ['ALUA', { symbol: 'ALUA', price: 800, changePercent: 0, kind: 'stock' }],
  ['AL30', { symbol: 'AL30', price: 85_000, changePercent: 0, kind: 'bond' }],
  ['AL30D', { symbol: 'AL30D', price: 57, changePercent: 0, kind: 'bond' }],
  ['YMCJO', { symbol: 'YMCJO', price: 150_000, changePercent: 0, kind: 'corp' }],
]);
const context: ClassifyContext = {
  cedearRatios: { MELI: 120, AAPL: 20 },
  local,
  usPrices: new Map([['MELI', 1760], ['AAPL', 240], ['GGAL', 40]]),
  ccl: CCL,
};

const parseCsv = (text: string, name = 'cartera.csv') => parseBrokerSheets([{ name, rows: parseDelimitedText(text) }], name);
const classifyAll = (text: string) => parseCsv(text).rows.map((row) => classifyRow(row, context));

describe('parseNumber', () => {
  it('reads Argentine and American formats', () => {
    expect(parseNumber('1.234,56')).toBe(1234.56);
    expect(parseNumber('1,234.56')).toBe(1234.56);
    expect(parseNumber('$ 1.500')).toBe(1500);
    expect(parseNumber('1.500')).toBe(1500);
    expect(parseNumber('1.500', false)).toBe(1.5);
    expect(parseNumber('(2.000,50)')).toBe(-2000.5);
    expect(parseNumber('12,5%')).toBe(12.5);
    expect(parseNumber('-')).toBeNull();
    expect(parseNumber(42)).toBe(42);
  });
});

describe('IOL holdings export', () => {
  const file = [
    'Mi portafolio;;;;;;',
    'Símbolo;Descripción;Cantidad;Últ. Precio;PPC;Ganancia-Pérdida %;Valorizado',
    'MELI;Cedear Mercadolibre;10;$ 22.000,00;$ 18.000,00;22,22%;$ 220.000,00',
    'GGAL;Grupo Financiero Galicia;100;$ 6.000,00;$ 5.000,00;20%;$ 600.000,00',
    'AL30;Bono Rep. Argentina 2030;1.000;$ 85.000,00;$ 70.000,00;21%;$ 850.000,00',
    'Total;;;;;;$ 1.670.000,00',
  ].join('\n');

  it('finds the header below the title, skips totals and reads every row', () => {
    const parsed = parseCsv(file, 'portafolio-iol.csv');
    expect(parsed.broker).toBe('IOL');
    expect(parsed.rows.map((row) => row.symbol)).toEqual(['MELI', 'GGAL', 'AL30']);
    expect(parsed.rows[2].quantity).toBe(1000);
    expect(parsed.rows[0].costPrice).toBe(18_000);
    expect(parsed.rows[0].lastPrice).toBe(22_000);
  });

  it('tells a CEDEAR, a local stock and a bond apart in the same file', () => {
    const rows = classifyAll(file);
    expect(rows.map((row) => row.kind)).toEqual(['cedear', 'ar-stock', 'bond']);
    expect(rows[2].ratio).toBe(100);
    for (const row of rows) expect(row.warnings).toEqual([]);
  });

  it('values each position like the broker', () => {
    const rows = classifyAll(file);
    expect(rows[0].findashValueArs).toBeCloseTo(220_000);
    expect(rows[1].findashValueArs).toBeCloseTo(600_000);
    expect(rows[2].findashValueArs).toBeCloseTo(850_000);
  });

  it('stores CEDEARs as shares and local assets with peso prices converted at CCL', () => {
    const transactions = toTransactions(classifyAll(file), 7, CCL, '2026-11-15');
    const meli = transactions.find((tx) => tx.symbol === 'MELI')!;
    expect(meli.quantity).toBeCloseTo(10 / 120);
    expect(meli.purchase_price).toBeCloseTo((18_000 / CCL) * 120);
    const ggal = transactions.find((tx) => tx.symbol === 'GGAL.BA')!;
    expect(ggal.quantity).toBe(100);
    expect(ggal.purchase_price).toBeCloseTo(5_000 / CCL);
    const bond = transactions.find((tx) => tx.symbol === 'AL30.BA')!;
    expect(bond.quantity).toBe(1000);
    // Cost of the position is preserved: 1.000 nominal at $70.000 per 100.
    expect(bond.quantity * bond.purchase_price * CCL).toBeCloseTo(700_000);
  });
});

describe('Balanz holdings by section', () => {
  const file = [
    'Tenencia al 15/11/2026',
    '',
    'CEDEARs',
    'Ticker,Descripción,Cantidad,Moneda,Precio,PPC,Monto',
    'AAPL,Apple Inc,40,Pesos,"18.000,00","15.000,00","720.000,00"',
    'Bonos',
    'Ticker,Descripción,Cantidad,Moneda,Precio,PPC,Monto',
    'AL30D,Bonar 2030 USD,500,Dólares,"57,00","50,00","285,00"',
    'Monedas',
    'Ticker,Descripción,Cantidad,Moneda,Precio,PPC,Monto',
    'ARS,Pesos,"150.000,00",Pesos,1,1,"150.000,00"',
  ].join('\n');

  it('follows the sections and leaves cash out of the import', () => {
    const rows = classifyAll(file);
    expect(rows.map((row) => [row.symbol, row.kind])).toEqual([['AAPL', 'cedear'], ['AL30D', 'bond'], ['ARS', 'cash']]);
    expect(rows[1].currency).toBe('USD');
    const transactions = toTransactions(rows, 1, CCL, '2026-11-15');
    expect(transactions.map((tx) => tx.symbol)).toEqual(['AAPL', 'AL30D.BA']);
    // Dollar bond: 500 nominal at US$50 per 100 → US$250 of cost.
    const bond = transactions[1];
    expect(bond.quantity * bond.purchase_price).toBeCloseTo(250);
  });
});

describe('Bull Market and Cocos style files', () => {
  it('reads a cost total instead of a unit cost', () => {
    const rows = classifyAll([
      'Especie;Cantidad;Precio;Costo total;Importe',
      'ALUA;1.000;800;700.000;800.000',
    ].join('\n'));
    expect(rows[0].kind).toBe('ar-stock');
    expect(rows[0].costPrice).toBe(700);
  });

  it('recognises a dollar account holding US shares', () => {
    const rows = classifyAll([
      'Instrumento,Cantidad,Precio promedio,Último precio,Valor actual,Moneda',
      'MELI,2,"1500.00","1760.00","3520.00",USD',
    ].join('\n'));
    expect(rows[0].kind).toBe('us-stock');
    expect(rows[0].findashValueArs).toBeCloseTo(3520 * CCL);
    const [tx] = toTransactions(rows, 1, CCL, '2026-11-15');
    expect(tx).toMatchObject({ symbol: 'MELI', quantity: 2, purchase_price: 1500 });
  });

  it('flags a missing CEDEAR ratio and a value that does not match', () => {
    const rows = classifyAll([
      'Ticker;Cantidad;Último precio;PPC',
      'XYZ;10;5.000;4.000',
    ].join('\n'));
    expect(rows[0].kind).toBe('unknown');
    expect(toTransactions(rows, 1, CCL)).toEqual([]);
  });

  it('uses the current price when the file has no cost, and says so', () => {
    const rows = classifyAll(['Símbolo;Cantidad;Último precio', 'GGAL;10;6.000'].join('\n'));
    expect(rows[0].warnings.join(' ')).toContain('Sin precio de compra');
    expect(toTransactions(rows, 1, CCL, '2026-11-15')[0].purchase_price).toBeCloseTo(6000 / CCL);
  });
});

describe('Excel files', () => {
  it('reads a real .xlsx workbook with numeric cells', () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Cartera Cocos'],
      ['Ticker', 'Cantidad', 'Precio promedio', 'Último precio', 'Valor actual'],
      ['MELI', 10, 18000, 22000, 220000],
      ['YMCJO', 5000, 140000, 150000, 7500000],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Tenencia');
    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const read = XLSX.read(buffer, { type: 'array' });
    const rows = XLSX.utils.sheet_to_json<unknown[]>(read.Sheets.Tenencia, { header: 1, raw: true, defval: '' });

    const parsed = parseBrokerSheets([{ name: 'Tenencia', rows }], 'cocos.xlsx');
    expect(parsed.broker).toBe('Cocos');
    const classified = parsed.rows.map((row) => classifyRow(row, context));
    expect(classified.map((row) => row.kind)).toEqual(['cedear', 'bond']);
    expect(classified[1].findashValueArs).toBeCloseTo(7_500_000);
  });
});
