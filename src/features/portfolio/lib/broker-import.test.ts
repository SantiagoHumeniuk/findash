import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import bymaCedearRatios from '../../../data/cedear-ratios.json';
import { findCedearRatio } from '../../../data/cedear-ratio-lookup';
import { getArgentineAdrRatio } from '../../../data/argentine-adr-ratio-lookup';
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

describe('Argentine ADR ratios', () => {
  it('preloads the local-share ticker and shares represented by each ADR', () => {
    expect(getArgentineAdrRatio('BMA')).toEqual({ localSymbol: 'BMA', sharesPerAdr: 10 });
    expect(getArgentineAdrRatio('TGS')).toEqual({ localSymbol: 'TGSU2', sharesPerAdr: 5 });
    expect(getArgentineAdrRatio('unknown')).toBeNull();
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
    expect(rows[0].warnings).toEqual([]);
    expect(rows[1].warnings).toEqual([]);
    // Fixed income is recognised but left out of the portfolio for now.
    expect(rows[2].warnings.join(' ')).toContain('renta fija');
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
    expect(transactions.some((tx) => tx.symbol === 'AL30.BA')).toBe(false);
  });

  it('normalizes a USD-traded Argentine share line and keeps its PPC in dollars', () => {
    const parsed = parseCsv([
      'Ticker;Cantidad;Último precio;PPC',
      'BMA.D;10;$ 9,00;$ 8,72',
    ].join('\n'));
    const bmaContext: ClassifyContext = {
      ...context,
      local: new Map([...local, ['BMA', { symbol: 'BMA', price: 13_080, changePercent: 0, kind: 'stock' }]]),
    };
    const row = classifyRow(parsed.rows[0], bmaContext);

    expect(row.symbol).toBe('BMA');
    expect(row.currency).toBe('USD');
    expect(row.kind).toBe('ar-stock');
    expect(row.ratio).toBe(1);
    expect(row.costPrice).toBe(8.72);
    expect(toTransactions([row], 7, CCL)[0]).toMatchObject({
      symbol: 'BMA.BA',
      quantity: 10,
      purchase_price: 8.72,
    });
  });

  it('converts an Argentine ADR into local shares with the preloaded ratio', () => {
    const parsed = parseCsv([
      'Ticker;Cantidad;Último precio;PPC;Moneda',
      'BMA;1;87,20;80,00;USD',
    ].join('\n'));
    const bmaContext: ClassifyContext = {
      ...context,
      local: new Map([...local, ['BMA', { symbol: 'BMA', price: 13_080, changePercent: 0, kind: 'stock' }]]),
      usPrices: new Map([...context.usPrices, ['BMA', 87.2]]),
    };
    const row = classifyRow(parsed.rows[0], bmaContext);

    expect(row).toMatchObject({
      kind: 'ar-stock',
      isAdr: true,
      localStockSymbol: 'BMA',
      ratio: 10,
      findashValueArs: 130_800,
    });
    expect(row.reason).toContain('10 acciones locales por ADR');
    expect(toTransactions([row], 7, CCL)[0]).toMatchObject({
      symbol: 'BMA.BA',
      quantity: 10,
      purchase_price: 8,
    });
  });

  it('converts ADRs whose US and BYMA tickers differ to the local stock ticker', () => {
    const parsed = parseCsv([
      'Ticker;Cantidad;Último precio;PPC;Moneda',
      'TGS;2;50;45;USD',
    ].join('\n'));
    const tgsContext: ClassifyContext = {
      ...context,
      local: new Map([...local, ['TGSU2', { symbol: 'TGSU2', price: 15_000, changePercent: 0, kind: 'stock' }]]),
    };
    const row = classifyRow(parsed.rows[0], tgsContext);
    const [transaction] = toTransactions([row], 7, CCL);

    expect(transaction).toMatchObject({
      symbol: 'TGSU2.BA',
      quantity: 10,
      purchase_price: 9,
    });
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
    expect(transactions.map((tx) => tx.symbol)).toEqual(['AAPL']);
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

describe('CEDEARs by default', () => {
  it('does not confuse an underlying US ticker with a differently punctuated CEDEAR', () => {
    expect(findCedearRatio('BAC', { 'BA.C': 4 })).toBeNull();
  });

  it('uses the base company ratio for USD-denominated CEDEAR tickers', () => {
    expect(findCedearRatio('NVDAD', bymaCedearRatios)).toBe(bymaCedearRatios.NVDA);
    expect(findCedearRatio('AAPLD', bymaCedearRatios)).toBe(bymaCedearRatios.AAPL);
    expect(findCedearRatio('GOGLD', bymaCedearRatios)).toBe(bymaCedearRatios.GOOGL);
    expect(findCedearRatio('NUD', bymaCedearRatios)).toBe(bymaCedearRatios.NU);
  });

  it('imports a USD CEDEAR using the base ticker ratio and USD purchase cost', () => {
    const usdCedear = classifyRow(
      parseCsv(['Ticker;Cantidad;Último precio;PPC;Moneda', 'NVDAD;5;6,67;6,5;USD'].join('\n')).rows[0],
      { ...context, cedearRatios: bymaCedearRatios, local: new Map(), usPrices: new Map() },
    );

    expect(usdCedear.kind).toBe('cedear');
    expect(usdCedear.ratio).toBe(bymaCedearRatios.NVDA);
    expect(usdCedear.currency).toBe('USD');
    expect(usdCedear.underlyingSymbol).toBe('NVDA');
    expect(toTransactions([usdCedear], 1, CCL)[0]).toMatchObject({
      symbol: 'NVDA',
      quantity: 5 / bymaCedearRatios.NVDA,
      purchase_price: 6.5 * bymaCedearRatios.NVDA,
    });
  });

  it('loads the catalog ratio when the broker ticker uses different punctuation and quotes are unavailable', () => {
    const noMarketData: ClassifyContext = {
      ...context,
      cedearRatios: bymaCedearRatios,
      local: new Map(),
      usPrices: new Map(),
    };
    const parsed = parseCsv(['Ticker;Cantidad;Último precio;PPC', 'BRK.B;10;100;90'].join('\n'));
    const row = classifyRow(parsed.rows[0], noMarketData);

    expect(row.kind).toBe('cedear');
    expect(row.ratio).toBe(bymaCedearRatios.BRKB);
    expect(row.warnings).not.toContain('Falta el ratio del CEDEAR: cargalo para convertirlo bien.');
    expect(toTransactions([row], 1, CCL)[0]).toMatchObject({
      symbol: 'BRK-B',
      quantity: 10 / bymaCedearRatios.BRKB,
    });
  });

  it('treats a CEDEAR filed under "Acciones" as a CEDEAR', () => {
    const rows = classifyAll(['Acciones', 'Ticker;Cantidad;PPC', 'MELI;10;18.000'].join('\n'));
    expect(rows[0].kind).toBe('cedear');
    expect(rows[0].ratio).toBe(120);
  });

  it('deduces a missing ratio from today\'s prices and says so', () => {
    const withoutRatio = { ...context, cedearRatios: {} };
    const parsed = parseCsv(['Ticker;Cantidad;Último precio;PPC', 'MELI;10;22.000;18.000'].join('\n'));
    const row = classifyRow(parsed.rows[0], withoutRatio);
    expect(row.kind).toBe('cedear');
    // US$1.760 × CCL 1.500 ÷ $22.000 = 120.
    expect(row.ratio).toBe(120);
    expect(row.warnings.join(' ')).toContain('deducido de los precios');
    expect(toTransactions([row], 1, CCL)[0].quantity).toBeCloseTo(10 / 120);
  });

  it('keeps US shares when the file is in dollars', () => {
    const rows = classifyAll(['Ticker;Cantidad;PPC;Moneda', 'MELI;2;1500;USD'].join('\n'));
    expect(rows[0].kind).toBe('us-stock');
  });
});
