import type { Transaction } from '../../../types/portfolio';

export type BrokerType = 'iol' | 'balanz' | 'cocos' | 'bull-market' | 'unknown';

export interface ParsedCsvRow {
  symbol: string;
  title: string;
  market: string;
  currency: string;
  quantity: number;
  price: number;
  amount: number | null;
  date: string;
  dateEstimated: boolean;
  type: 'buy' | 'sell';
  raw: Record<string, string>;
}

export interface ParsedPortfolioCsv {
  broker: BrokerType;
  rows: ParsedCsvRow[];
  validRows: number;
  invalidRows: number;
}

const normalizeSymbol = (value: string): string => value.trim().toUpperCase().replace(/\s+/g, '');

const normalizeNumber = (value: string): number => {
  const cleaned = value.replace(/\s+/g, '').replace(/[^0-9,.-]/g, '').trim();
  if (!cleaned) return NaN;

  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');
  let normalized = cleaned;

  if (hasComma && hasDot) {
    const decimalSeparator = cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.') ? ',' : '.';
    const thousandsSeparator = decimalSeparator === ',' ? /\./g : /,/g;
    normalized = cleaned.replace(thousandsSeparator, '').replace(decimalSeparator, '.');
  } else if (hasComma) {
    normalized = /^-?\d{1,3}(,\d{3})+$/.test(cleaned)
      ? cleaned.replace(/,/g, '')
      : cleaned.replace(',', '.');
  } else if ((cleaned.match(/\./g) ?? []).length > 1 || /^-?\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    normalized = cleaned.replace(/\./g, '');
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
};

const normalizeDate = (value: string): string => {
  const cleaned = value.trim();
  if (!cleaned) return '';

  const localized = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(cleaned);
  const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(cleaned);
  const parts = localized
    ? [localized[3], localized[2], localized[1]]
    : isoDate
      ? [isoDate[1], isoDate[2], isoDate[3]]
      : null;

  if (parts) {
    const [year, month, day] = parts.map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day) {
      return date.toISOString();
    }
    return '';
  }

  const timestamp = Date.parse(cleaned);
  return Number.isNaN(timestamp) ? '' : new Date(timestamp).toISOString();
};

const normalizeHeader = (value: string): string => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const normalizeType = (value: string): 'buy' | 'sell' | null => {
  const normalized = value.trim().toLowerCase();
  if (['compra', 'buy', 'b', 'c'].includes(normalized)) return 'buy';
  if (['venta', 'sell', 'v', 's'].includes(normalized)) return 'sell';
  if (normalized.includes('compra')) return 'buy';
  if (normalized.includes('venta')) return 'sell';
  return null;
};

const splitCsvRecord = (line: string, delimiter: string): string[] => {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && quoted && line[index + 1] === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      cells.push(cell.trim());
      cell = '';
    } else {
      cell += character;
    }
  }

  cells.push(cell.trim());
  return cells;
};

const detectDelimiter = (header: string): string => {
  const candidates = [',', ';', '\t'];
  return candidates
    .map((delimiter) => ({ delimiter, columns: splitCsvRecord(header, delimiter).length }))
    .sort((left, right) => right.columns - left.columns)[0].delimiter;
};

const aliases = {
  title: ['titulo', 'nombre', 'descripcion', 'description'],
  symbol: ['ticker', 'simbolo', 'especie', 'activo', 'instrumento', 'codigo', 'symbol'],
  market: ['mercado', 'plaza', 'market'],
  quantity: ['cantidad', 'tenencia', 'saldo', 'nominales', 'unidades', 'qty', 'quantity'],
  currency: ['moneda', 'divisa', 'currency'],
  price: ['precio', 'precio unitario', 'precio promedio', 'precio de compra', 'costo promedio', 'costo medio', 'importe unitario', 'cotizacion', 'cotizacion actual', 'ultimo precio', 'price'],
  amount: ['importe', 'monto', 'valor total', 'valuacion', 'amount', 'total'],
  date: ['fecha', 'fecha operacion', 'fecha de operacion', 'concertacion', 'fecha concertacion', 'fecha de concertacion', 'date'],
  type: ['tipo', 'operacion', 'tipo operacion', 'compra venta', 'side', 'transaction type'],
};

const findColumn = (headers: string[], names: string[]): number => headers.findIndex((header) => names.includes(header));

export const isUsdCurrency = (currency: string): boolean => {
  const normalizedCurrency = normalizeHeader(currency);
  return ['usd', 'usd ccl', 'usd mep', 'us dollar', 'dollar', 'dolares', 'dolar', 'dolar estadounidense'].includes(normalizedCurrency);
};

export const isArsCurrency = (currency: string): boolean => {
  const normalizedCurrency = normalizeHeader(currency);
  return !normalizedCurrency || ['ar', 'ars', 'peso', 'pesos', 'peso argentino', 'pesos argentinos'].includes(normalizedCurrency);
};

export function getPriceInUsd(price: number, currency: string, cclRate?: number): number {
  if (isUsdCurrency(currency)) return price;
  if (!isArsCurrency(currency)) {
    throw new Error(`Moneda no compatible: ${currency}. Usa ARS o USD.`);
  }
  if (!cclRate || !Number.isFinite(cclRate) || cclRate <= 0) {
    throw new Error('No hay una cotización CCL válida para convertir los precios en USD.');
  }
  return price / cclRate;
}

export interface ImportUnitConversion {
  factor: number;
  source: 'local-adr' | 'cedear' | 'native' | 'fallback';
}

const LOCAL_SHARES_PER_ADR: Record<string, number> = {
  BMA: 10,
};

export function getImportUnitConversion(
  row: ParsedCsvRow,
  asCedears: boolean,
  cedearRatios: Record<string, number>,
): ImportUnitConversion {
  const symbol = row.symbol.replace(/[^a-zA-Z]/g, '').toUpperCase();
  const localAdrFactor = LOCAL_SHARES_PER_ADR[symbol];

  if (localAdrFactor && isArsCurrency(row.currency)) {
    return { factor: localAdrFactor, source: 'local-adr' };
  }

  if (!asCedears) return { factor: 1, source: 'native' };

  const ratio = cedearRatios[symbol];
  if (ratio && Number.isFinite(ratio) && ratio > 0) {
    return { factor: ratio, source: 'cedear' };
  }

  return { factor: 1, source: 'fallback' };
}

const detectBroker = (fileName: string, headers: string[]): BrokerType => {
  const source = normalizeHeader(`${fileName} ${headers.join(' ')}`);
  if (source.includes('bull market') || source.includes('bullmarket')) return 'bull-market';
  if (source.includes('cocos')) return 'cocos';
  if (source.includes('balanz')) return 'balanz';
  if (source.includes('iol') || source.includes('invertironline')) return 'iol';
  if (headers.includes('ticker')) return 'iol';
  if (headers.includes('precio unitario')) return 'balanz';
  if (headers.includes('activo') || headers.includes('operacion')) return 'cocos';
  return 'unknown';
};

const parseRow = (
  cells: string[],
  headers: string[],
  columns: { title: number; symbol: number; market: number; quantity: number; currency: number; price: number; amount: number; date: number; type: number },
): ParsedCsvRow | null => {
  const value = (column: number) => column < 0 ? '' : cells[column] ?? '';
  const symbol = normalizeSymbol(value(columns.symbol));
  const quantity = normalizeNumber(value(columns.quantity));
  const quotedPrice = normalizeNumber(value(columns.price));
  const amountValue = normalizeNumber(value(columns.amount));
  const amount = Number.isFinite(amountValue) ? amountValue : null;
  const price = Number.isFinite(quotedPrice) && quotedPrice > 0
    ? quotedPrice
    : amount !== null && quantity > 0
      ? amount / quantity
      : NaN;
  const dateValue = value(columns.date);
  const date = dateValue ? normalizeDate(dateValue) : new Date().toISOString();
  const operation = value(columns.type);
  const type = operation ? normalizeType(operation) : 'buy';

  if (!symbol || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price <= 0 || !date || !type) {
    return null;
  }

  return {
    symbol,
    title: value(columns.title),
    market: value(columns.market),
    currency: value(columns.currency),
    quantity,
    price,
    amount,
    date,
    dateEstimated: !dateValue,
    type,
    raw: cells.reduce<Record<string, string>>((result, cell, index) => {
      result[headers[index] ?? String(index + 1)] = cell;
      return result;
    }, {}),
  };
}

/**
 * Parsea un CSV exportado por brokers de inversión y lo normaliza a filas reutilizables.
 */
export function parsePortfolioCsv(csvText: string, fileName = ''): ParsedPortfolioCsv {
  const text = csvText.replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return { broker: 'unknown', rows: [], validRows: 0, invalidRows: 0 };
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitCsvRecord(lines[0], delimiter).map(normalizeHeader);
  const broker = detectBroker(fileName, headers);
  const columns = {
    title: findColumn(headers, aliases.title),
    symbol: findColumn(headers, aliases.symbol),
    market: findColumn(headers, aliases.market),
    quantity: findColumn(headers, aliases.quantity),
    currency: findColumn(headers, aliases.currency),
    price: findColumn(headers, aliases.price),
    amount: findColumn(headers, aliases.amount),
    date: findColumn(headers, aliases.date),
    type: findColumn(headers, aliases.type),
  };
  const rows: ParsedCsvRow[] = [];
  let invalidCount = 0;

  for (let index = 1; index < lines.length; index += 1) {
    const cells = splitCsvRecord(lines[index], delimiter);
    if (cells.every((cell) => !cell)) continue;

    const parsed = parseRow(cells, headers, columns);
    if (parsed) {
      rows.push(parsed);
    } else {
      invalidCount += 1;
    }
  }

  return {
    broker,
    rows,
    validRows: rows.length,
    invalidRows: invalidCount,
  };
}

/**
 * Mapea filas del CSV ya validadas al modelo de transacciones interno del portafolio.
 */
export function mapCsvRowsToTransactions(
  rows: ParsedCsvRow[],
  portfolioId: number,
  options: { asCedears?: boolean; cedearRatios?: Record<string, number>; cclRate?: number } = {},
): Omit<Transaction, 'id' | 'user_id'>[] {
  return rows.map((row) => {
    const conversion = getImportUnitConversion(row, options.asCedears ?? false, options.cedearRatios ?? {});
    const quantity = row.quantity / conversion.factor;
    let purchasePrice = getPriceInUsd(row.price, row.currency, options.cclRate);

    purchasePrice *= conversion.factor;

    return {
      portfolio_id: portfolioId,
      symbol: row.symbol,
      quantity,
      purchase_price: purchasePrice,
      purchase_date: row.date,
      transaction_type: row.type,
    };
  });
}
