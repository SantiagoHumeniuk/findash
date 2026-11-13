// src/features/portfolio/lib/broker-import.ts
//
// Reads holdings exported by Argentine brokers (IOL, Balanz, Bull Market, Cocos and similar) and
// turns each row into a portfolio transaction. The files differ in column names, title rows,
// sections (Acciones / CEDEARs / Bonos...), number formats and units, so every step is tolerant:
// the header row is searched for, each row is classified on its own, and the review screen shows
// what FinDash understood before anything is saved.

import type { Transaction } from '../../../types/portfolio';
import { isDollarQuotedLocal, isFixedIncome, type LocalQuote } from '../../../services/api/local-market-api';

export type AssetKind = 'us-stock' | 'cedear' | 'ar-stock' | 'bond' | 'cash' | 'fund' | 'unknown';
export type Currency = 'ARS' | 'USD';

export const ASSET_KIND_LABELS: Record<AssetKind, string> = {
  'us-stock': 'Acción o ETF de EE. UU.',
  cedear: 'CEDEAR',
  'ar-stock': 'Acción argentina',
  bond: 'Renta fija (próximamente)',
  cash: 'Efectivo o caución',
  fund: 'Fondo común',
  unknown: 'Sin identificar',
};

/**
 * Kinds the portfolio takes for now: equities only. Bonds, ONs and letters are recognised and listed
 * but not imported until fixed income is supported end to end.
 */
export const IMPORTABLE_KINDS: AssetKind[] = ['cedear', 'us-stock', 'ar-stock'];

export interface BrokerRow {
  /** Row number in the file (1-based), for messages. */
  line: number;
  sheet: string;
  symbol: string;
  description: string;
  section: string;
  quantity: number;
  /** Average purchase price per unit, as written in the file. */
  costPrice: number | null;
  /** Current price per unit, as written in the file. */
  lastPrice: number | null;
  /** Current value of the position, as written in the file. */
  fileValue: number | null;
  currency: Currency | null;
  date: string | null;
  type: 'buy' | 'sell';
}

export interface ParsedBrokerFile {
  broker: string;
  rows: BrokerRow[];
  skippedLines: number;
  /** Header found, for the review screen. */
  headers: string[];
}

export interface ClassifyContext {
  cedearRatios: Record<string, number>;
  local: Map<string, LocalQuote>;
  /** US prices in USD, for tickers that might be US stocks. */
  usPrices: Map<string, number>;
  ccl: number;
}

export interface ClassifiedRow extends BrokerRow {
  kind: AssetKind;
  /** Why the kind was chosen, shown in the review. */
  reason: string;
  currency: Currency;
  /** Units per CEDEAR share (CEDEARs) or 100 for bonds quoted per 100 nominal. */
  ratio: number | null;
  /** Current value in pesos according to FinDash, to compare with the file. */
  findashValueArs: number | null;
  /** File value in pesos (converted when the file is in dollars). */
  fileValueArs: number | null;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Low level parsing
// ---------------------------------------------------------------------------

export const normalizeText = (value: string): string => value
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9$]+/g, ' ')
  .trim();

/**
 * Numbers as brokers write them: 1.234,56 · 1,234.56 · $ 1.234 · (1.234,56) · 12,5%.
 * `commaDecimal` is the file's convention, which settles "1.500" (fifteen hundred in an Argentine
 * file, one and a half in an American one).
 */
export function parseNumber(value: unknown, commaDecimal = true): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  let text = value.trim();
  if (!text || /^[-–—]+$/.test(text)) return null;
  const negative = /^\(.*\)$/.test(text) || text.replace(/^[^\d-]+/, '').startsWith('-');
  text = text.replace(/[^\d.,]/g, '');
  if (!text) return null;
  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    const decimal = lastComma > lastDot ? ',' : '.';
    text = text.replace(decimal === ',' ? /\./g : /,/g, '').replace(decimal, '.');
  } else if (lastComma >= 0) {
    // "1,234" (thousands) vs "12,5" (decimals): Argentine files use comma decimals.
    text = /^\d{1,3}(,\d{3})+$/.test(text) && (text.match(/,/g) ?? []).length > 1
      ? text.replace(/,/g, '')
      : text.replace(/,/g, '.');
  } else if ((text.match(/\./g) ?? []).length > 1) {
    text = text.replace(/\./g, '');
  } else if (commaDecimal && /^\d{1,3}\.\d{3}$/.test(text)) {
    text = text.replace('.', '');
  }
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return null;
  return negative ? -parsed : parsed;
}

export function parseCurrency(value: unknown): Currency | null {
  if (typeof value !== 'string') return null;
  const text = normalizeText(value);
  if (!text) return null;
  if (/(^| )(us\$|u\$s|usd|us|dolar|dolares|mep|ccl|cable|d[oó]lar|u\$d|uss)( |$)/.test(text) || /us\$|u\$s|u\$d/i.test(value)) return 'USD';
  if (/(^| )(\$|ars|peso|pesos|ar\$)( |$)/.test(text) || text === '$') return 'ARS';
  return null;
}

function parseDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === 'number' && value > 20000 && value < 80000) {
    // Excel serial date.
    return new Date(Math.round((value - 25569) * 86400 * 1000)).toISOString().slice(0, 10);
  }
  if (typeof value !== 'string') return null;
  const text = value.trim();
  const local = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/.exec(text);
  if (local) {
    const year = Number(local[3].length === 2 ? `20${local[3]}` : local[3]);
    const date = new Date(Date.UTC(year, Number(local[2]) - 1, Number(local[1])));
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
}

type Role = 'symbol' | 'description' | 'quantity' | 'costPrice' | 'costTotal' | 'lastPrice' | 'value' | 'currency' | 'section' | 'date' | 'type';

/** Column names per role, most specific first. Matched against normalized header text. */
const ROLE_ALIASES: Record<Role, string[]> = {
  symbol: ['ticker', 'simbolo', 'especie', 'codigo', 'sigla', 'symbol', 'activo', 'instrumento', 'titulo'],
  description: ['descripcion', 'nombre', 'denominacion', 'detalle', 'razon social', 'emisor'],
  quantity: ['cantidad', 'cantidad disponible', 'cantidad nominal', 'tenencia', 'nominales', 'valor nominal', 'vn', 'unidades', 'cant', 'saldo', 'qty', 'quantity'],
  costPrice: ['ppc', 'p p c', 'precio promedio de compra', 'precio promedio compra', 'precio prom compra', 'precio promedio', 'precio de compra', 'precio compra', 'costo promedio', 'costo medio', 'costo unitario', 'precio costo', 'precio de costo', 'average price', 'avg price'],
  costTotal: ['costo total', 'monto invertido', 'importe invertido', 'total invertido', 'invertido', 'costo de adquisicion', 'costo', 'valor de compra'],
  lastPrice: ['ultimo precio', 'ult precio', 'ultima cotizacion', 'precio actual', 'precio de mercado', 'cotizacion', 'cotizacion actual', 'precio ultimo', 'last price', 'precio', 'price'],
  value: ['valorizado', 'valorizacion', 'valuacion', 'valuado', 'valor actual', 'monto actual', 'valor de mercado', 'tenencia valorizada', 'saldo valorizado', 'importe', 'monto', 'total', 'valor', 'market value'],
  currency: ['moneda', 'divisa', 'currency', 'mon'],
  section: ['tipo de instrumento', 'tipo instrumento', 'tipo de activo', 'clase de activo', 'clase', 'categoria', 'tipo'],
  date: ['fecha', 'fecha de operacion', 'fecha operacion', 'fecha de concertacion', 'fecha concertacion', 'concertacion', 'date'],
  type: ['operacion', 'tipo de operacion', 'tipo operacion', 'compra venta', 'side', 'transaction type'],
};

function matchRole(header: string): Role | null {
  if (!header) return null;
  for (const role of Object.keys(ROLE_ALIASES) as Role[]) {
    if (ROLE_ALIASES[role].includes(header)) return role;
  }
  return null;
}

function mapColumns(headers: string[]): Partial<Record<Role, number>> {
  const columns: Partial<Record<Role, number>> = {};
  // Assign roles by alias priority, so "Precio promedio" wins costPrice and "Precio" goes to lastPrice.
  for (const role of Object.keys(ROLE_ALIASES) as Role[]) {
    for (const alias of ROLE_ALIASES[role]) {
      const index = headers.findIndex((header, position) => header === alias && !Object.values(columns).includes(position));
      if (index >= 0) {
        columns[role] = index;
        break;
      }
    }
  }
  return columns;
}

function scoreHeader(cells: string[]): number {
  const roles = new Set(cells.map((cell) => matchRole(normalizeText(cell))).filter(Boolean));
  if (!roles.has('symbol') || !roles.has('quantity')) return 0;
  return roles.size;
}

const CASH_SYMBOLS = new Set(['ARS', 'USD', 'PESOS', 'DOLARES', 'DOLAR', '$', 'US$', 'U$S', 'MEP', 'CCL', 'CABLE', 'EFECTIVO', 'DISPONIBLE']);

function cleanSymbol(value: string): string {
  const text = value.trim().toUpperCase();
  // "MELI - MercadoLibre", "MELI (CEDEAR)", "MELI.BA", "BCBA:GGAL"
  const withoutMarket = text.replace(/^[A-Z]+:/, '');
  const token = /^[A-Z0-9][A-Z0-9.$/-]*/.exec(withoutMarket)?.[0] ?? '';
  return token.replace(/\.BA$/, '').replace(/[.-]$/, '');
}

/** Text of a spreadsheet cell, whatever its type (strings, numbers, dates, empty). */
export function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

const isBlank = (cells: unknown[]) => cells.every((cell) => cellText(cell).trim() === '');

/** Whether the file writes decimals with a comma (1.234,56) rather than a dot (1,234.56). */
function usesCommaDecimals(sheets: { rows: unknown[][] }[]): boolean {
  let comma = 0;
  let dot = 0;
  for (const sheet of sheets) {
    for (const row of sheet.rows.slice(0, 400)) {
      for (const cell of row) {
        if (typeof cell !== 'string') continue;
        const text = cell.replace(/[^d.,]/g, '');
        if (/^d{1,3}(.d{3})*,d+$/.test(text) || /^d+,d{1,2}$/.test(text)) comma += 1;
        else if (/^d{1,3}(,d{3})*.d+$/.test(text) && !/^d{1,3}.d{3}$/.test(text)) dot += 1;
      }
    }
  }
  return comma >= dot;
}

/** Turns the cells of one or more sheets into broker rows. */
export function parseBrokerSheets(sheets: { name: string; rows: unknown[][] }[], fileName = ''): ParsedBrokerFile {
  const parsed: BrokerRow[] = [];
  const commaDecimal = usesCommaDecimals(sheets);
  const num = (value: unknown) => parseNumber(value, commaDecimal);
  let skippedLines = 0;
  let headersFound: string[] = [];

  for (const sheet of sheets) {
    const rows = sheet.rows;
    let headerIndex = -1;
    let best = 0;
    for (let index = 0; index < Math.min(rows.length, 60); index += 1) {
      const score = scoreHeader((rows[index] ?? []).map((cell) => cellText(cell)));
      if (score > best) {
        best = score;
        headerIndex = index;
      }
    }
    if (headerIndex < 0) continue;

    const headerCells = rows[headerIndex].map((cell) => cellText(cell));
    const headers = headerCells.map(normalizeText);
    const columns = mapColumns(headers);
    if (headersFound.length === 0) headersFound = headerCells.filter((cell) => cell.trim());
    // Section titles before the header (e.g. "CEDEARs") still apply to the first block.
    let section = '';
    for (let index = headerIndex - 1; index >= 0 && index >= headerIndex - 3; index -= 1) {
      const filled = (rows[index] ?? []).filter((cell) => cellText(cell).trim());
      if (filled.length === 1) {
        section = cellText(filled[0]);
        break;
      }
    }

    for (let index = headerIndex + 1; index < rows.length; index += 1) {
      const cells = rows[index] ?? [];
      if (isBlank(cells)) continue;
      const cell = (role: Role) => (columns[role] === undefined ? undefined : cells[columns[role]]);
      const text = (role: Role) => cellText(cell(role)).trim();
      const filled = cells.filter((value) => cellText(value).trim());

      // A repeated header (one per section) is skipped; a lone label starts a new section.
      if (scoreHeader(cells.map((value) => cellText(value))) >= best) continue;
      const quantity = num(cell('quantity'));
      if (filled.length <= 2 && quantity === null) {
        section = cellText(filled[0]).trim();
        continue;
      }
      const symbolText = text('symbol');
      if (/^total|^subtotal/i.test(symbolText) || /^total|^subtotal/i.test(cellText(filled[0]))) continue;

      const symbol = cleanSymbol(symbolText);
      if (!symbol || quantity === null || quantity === 0) {
        skippedLines += 1;
        continue;
      }

      const costPriceRaw = num(cell('costPrice'));
      const costTotal = num(cell('costTotal'));
      const lastPrice = num(cell('lastPrice'));
      const fileValue = num(cell('value'));
      let costPrice = costPriceRaw && costPriceRaw > 0 ? costPriceRaw : null;
      if (costPrice === null && costTotal && costTotal > 0) {
        // A "Costo" column may hold the total or the unit cost; the current price tells which.
        const perUnit = costTotal / Math.abs(quantity);
        costPrice = lastPrice && Math.max(costTotal / lastPrice, lastPrice / costTotal) < Math.max(perUnit / lastPrice, lastPrice / perUnit)
          ? costTotal
          : perUnit;
      }
      // Some files put Compra/Venta in a column called "Tipo".
      const sectionCell = text('section');
      const sectionIsOperation = /^(compra|venta|buy|sell)\b/i.test(sectionCell);
      const sectionText = (sectionIsOperation ? '' : sectionCell) || section;
      const operation = normalizeText(text('type') || (sectionIsOperation ? sectionCell : ''));
      const currency = parseCurrency(text('currency'))
        ?? parseCurrency(cellText(cell('lastPrice')))
        ?? parseCurrency(cellText(cell('costPrice')))
        ?? parseCurrency(cellText(cell('value')))
        ?? (/dolar|usd|u\$s|exterior/i.test(sectionText) ? 'USD' : null);

      parsed.push({
        line: index + 1,
        sheet: sheet.name,
        symbol,
        description: text('description'),
        section: sectionText,
        quantity: Math.abs(quantity),
        costPrice,
        lastPrice: lastPrice && lastPrice > 0 ? lastPrice : null,
        fileValue: fileValue && fileValue !== 0 ? Math.abs(fileValue) : null,
        currency,
        date: parseDate(cell('date')),
        type: /venta|sell|^v$|^s$/.test(operation) || quantity < 0 ? 'sell' : 'buy',
      });
    }
  }

  return { broker: detectBroker(fileName, headersFound), rows: parsed, skippedLines, headers: headersFound };
}

function detectBroker(fileName: string, headers: string[]): string {
  const source = normalizeText(`${fileName} ${headers.join(' ')}`);
  if (/bull ?market/.test(source)) return 'Bull Market';
  if (source.includes('cocos')) return 'Cocos';
  if (source.includes('balanz')) return 'Balanz';
  if (/iol|invertir ?online/.test(source)) return 'IOL';
  if (source.includes('ppc')) return 'IOL';
  return 'Broker';
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

function sectionKind(section: string): AssetKind | null {
  const text = normalizeText(section);
  if (!text) return null;
  if (text.includes('cedear')) return 'cedear';
  if (/fci|fondo/.test(text)) return 'fund';
  if (/caucion|efectivo|disponible|moneda|cuenta corriente|saldo|cash|liquidez/.test(text)) return 'cash';
  if (/bono|titulo publico|titulos publicos|obligacion|negociable|\bon\b|letra|lecap|renta fija|deuda|boncer|soberano|corporativ/.test(text)) return 'bond';
  if (/exterior|usa|eeuu|estados unidos|nyse|nasdaq|internacional/.test(text)) return 'us-stock';
  if (/accion|equity|panel|merval|lider|general|renta variable/.test(text)) return 'ar-stock';
  return null;
}

/** Closeness of two prices as a ratio (1 = equal); Infinity when either is missing. */
const distance = (a: number | null | undefined, b: number | null | undefined): number =>
  a && b && a > 0 && b > 0 ? Math.max(a / b, b / a) : Infinity;

/** Each candidate's expected price in the row's currency, to compare with the file. */
function candidatePrices(row: BrokerRow, context: ClassifyContext): Partial<Record<AssetKind, number>> {
  const local = context.local.get(row.symbol);
  const prices: Partial<Record<AssetKind, number>> = {};
  const inUsd = row.currency === 'USD';
  const us = context.usPrices.get(row.symbol);
  if (us) prices['us-stock'] = inUsd ? us : us * context.ccl;
  if (local?.kind === 'cedear') prices.cedear = inUsd ? local.price / context.ccl : local.price;
  else if (context.cedearRatios[row.symbol] && us) {
    const perCedear = (us * context.ccl) / context.cedearRatios[row.symbol];
    prices.cedear = inUsd ? perCedear / context.ccl : perCedear;
  }
  if (local?.kind === 'stock') prices['ar-stock'] = inUsd ? local.price / context.ccl : local.price;
  if (local && isFixedIncome(local.kind)) {
    const dollarLine = isDollarQuotedLocal(row.symbol, context.local);
    prices.bond = dollarLine === inUsd ? local.price : inUsd ? local.price / context.ccl : local.price * context.ccl;
  }
  return prices;
}

/**
 * Decides what each row is. The file's own section wins when it names one; otherwise the row's
 * price is compared with each market it could belong to, which tells a MELI CEDEAR at $20.000
 * from a MELI share at US$1.400 even when the file says neither.
 */
export function classifyRow(row: BrokerRow, context: ClassifyContext): ClassifiedRow {
  const sectionHint = sectionKind(row.section);
  const filePrice = row.lastPrice ?? (row.fileValue ? row.fileValue / row.quantity : null) ?? row.costPrice;
  const prices = candidatePrices(row, context);
  let kind: AssetKind = 'unknown';
  let reason = '';

  if (CASH_SYMBOLS.has(row.symbol) || sectionHint === 'cash') {
    kind = 'cash';
    reason = 'Efectivo, saldo o caución';
  } else if (sectionHint === 'fund') {
    kind = 'fund';
    reason = 'Fondo común de inversión';
  } else {
    const candidates = (Object.entries(prices) as [AssetKind, number][])
      // Bonds are often written per 1 nominal instead of per 100.
      .map(([candidate, price]) => [candidate, Math.min(distance(filePrice, price), candidate === 'bond' ? distance(filePrice, price / 100) : Infinity)] as const)
      .sort((left, right) => left[1] - right[1]);
    const bestByPrice = candidates[0]?.[1] < 1.35 ? candidates[0][0] : null;

    if (sectionHint && prices[sectionHint] !== undefined && (!bestByPrice || bestByPrice === sectionHint)) {
      kind = sectionHint;
      reason = `Sección "${row.section}" del archivo`;
    } else if (bestByPrice) {
      kind = bestByPrice;
      reason = 'Su precio coincide con la cotización de este mercado';
    } else if (prices.cedear !== undefined && row.currency !== 'USD' && sectionHint !== 'bond') {
      // Most users hold CEDEARs: a ticker that trades as one in pesos is a CEDEAR unless the file
      // clearly says otherwise (dollars, or a fixed income section).
      kind = 'cedear';
      reason = 'Cotiza como CEDEAR en pesos';
    } else if (sectionHint) {
      kind = sectionHint;
      reason = `Sección "${row.section}" del archivo`;
    } else if (prices['ar-stock'] !== undefined) {
      kind = 'ar-stock';
      reason = 'Cotiza en el mercado argentino';
    } else if (prices.bond !== undefined) {
      kind = 'bond';
      reason = 'Cotiza como bono, ON o letra';
    } else if (prices['us-stock'] !== undefined) {
      kind = 'us-stock';
      reason = 'Cotiza en EE. UU.';
    } else {
      reason = 'No encontramos su cotización';
    }
  }

  return finalizeRow(row, kind, reason, context);
}

/**
 * Completes a row once its kind is known: currency, ratio, values to compare and warnings. The
 * review screen calls it again when the user changes a row's kind or types a missing ratio.
 */
export function finalizeRow(
  row: BrokerRow,
  kind: AssetKind,
  reason: string,
  context: ClassifyContext,
  override: { ratio?: number | null } = {},
): ClassifiedRow {
  const warnings: string[] = [];
  const filePrice = row.lastPrice ?? (row.fileValue ? row.fileValue / row.quantity : null) ?? row.costPrice;
  const currency: Currency = row.currency
    ?? (kind === 'us-stock' ? 'USD' : kind === 'bond' && isDollarQuotedLocal(row.symbol, context.local) ? 'USD' : 'ARS');
  let ratio: number | null = null;
  if (kind === 'cedear') {
    const stored = context.cedearRatios[row.symbol] ?? null;
    const market = stored === null ? marketRatio(row.symbol, context) : null;
    ratio = override.ratio !== undefined ? override.ratio : stored ?? market;
    if (!ratio) warnings.push('Falta el ratio del CEDEAR: cargalo para convertirlo bien.');
    else if (override.ratio === undefined && stored === null) warnings.push(`Ratio ${ratio}:1 deducido de los precios de hoy; confirmalo si tenés el dato del broker.`);
  }
  if (kind === 'bond') warnings.push('La renta fija todavía no se carga en el portafolio: la vamos a sumar más adelante.');
  if (kind === 'bond') {
    // Per 100 nominal unless the file clearly uses per-unit prices.
    const market = candidatePrices(row, context).bond;
    ratio = override.ratio !== undefined && override.ratio !== null
      ? override.ratio
      : market && filePrice && distance(filePrice, market / 100) < distance(filePrice, market) ? 1 : 100;
  }
  if (IMPORTABLE_KINDS.includes(kind) && row.costPrice === null) {
    warnings.push('Sin precio de compra: se usa el precio actual, así que la ganancia arranca en cero.');
  }
  if (kind === 'unknown') warnings.push('Elegí qué tipo de activo es para importarlo.');

  const findashValueArs = valueInArs({ ...row, kind, currency, ratio }, context);
  if (IMPORTABLE_KINDS.includes(kind) && findashValueArs === null) {
    warnings.push('FinDash no encontró su cotización hoy: se va a mostrar a precio de compra.');
  }
  const fileValueArs = row.fileValue === null
    ? (row.lastPrice !== null ? toArs(row.lastPrice * row.quantity / (kind === 'bond' && ratio === 100 ? 100 : 1), currency, context.ccl) : null)
    : toArs(row.fileValue, currency, context.ccl);
  if (findashValueArs !== null && fileValueArs !== null && distance(findashValueArs, fileValueArs) > 1.1) {
    warnings.push('El valor que calcula FinDash difiere más de 10% del archivo: revisá el tipo y la cantidad.');
  }

  return { ...row, kind, reason, currency, ratio, findashValueArs, fileValueArs, warnings };
}

const toArs = (amount: number, currency: Currency, ccl: number) => (currency === 'USD' ? amount * ccl : amount);

/** Ratios are whole numbers of CEDEARs per share, or one CEDEAR per whole number of shares. */
export function snapRatio(implied: number): number {
  if (!(implied > 0)) return 0;
  if (implied >= 1) return Math.max(1, Math.round(implied));
  return 1 / Math.round(1 / implied);
}

/** Ratio implied by today's prices (US price × CCL ÷ CEDEAR price), for CEDEARs not yet in the table. */
function marketRatio(symbol: string, context: ClassifyContext): number | null {
  const local = context.local.get(symbol);
  const us = context.usPrices.get(symbol);
  if (local?.kind !== 'cedear' || !us || !(context.ccl > 0)) return null;
  const ratio = snapRatio((us * context.ccl) / local.price);
  return ratio > 0 ? ratio : null;
}

/** What the position is worth today in pesos, by FinDash's own prices. */
function valueInArs(row: Pick<ClassifiedRow, 'symbol' | 'quantity' | 'kind' | 'currency' | 'ratio'>, context: ClassifyContext): number | null {
  const local = context.local.get(row.symbol);
  switch (row.kind) {
    case 'us-stock': {
      const us = context.usPrices.get(row.symbol);
      return us ? row.quantity * us * context.ccl : null;
    }
    case 'cedear': {
      if (local?.kind === 'cedear') return row.quantity * local.price;
      const us = context.usPrices.get(row.symbol);
      return us && row.ratio ? (row.quantity / row.ratio) * us * context.ccl : null;
    }
    case 'ar-stock':
      return local ? row.quantity * local.price : null;
    case 'bond': {
      if (!local) return null;
      const perNominal = local.price / 100;
      return row.quantity * (isDollarQuotedLocal(row.symbol, context.local) ? perNominal * context.ccl : perNominal);
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

/** Portfolio symbol of a local instrument (valued with Buenos Aires prices, converted at CCL). */
export const localSymbol = (symbol: string) => `${symbol}.BA`;

/**
 * Converts reviewed rows into transactions. Every amount is stored in dollars, as the rest of the
 * portfolio: peso amounts are divided by today's CCL, the same rate used to value the position, so
 * the gain or loss in percent equals the broker's.
 */
export function toTransactions(
  rows: ClassifiedRow[],
  portfolioId: number,
  ccl: number,
  today = new Date().toISOString().slice(0, 10),
): Omit<Transaction, 'id' | 'user_id'>[] {
  return rows.flatMap((row) => {
    if (!IMPORTABLE_KINDS.includes(row.kind)) return [];
    const unitPrice = row.costPrice ?? row.lastPrice ?? (row.fileValue ? row.fileValue / row.quantity : null);
    if (!unitPrice || unitPrice <= 0) return [];
    const usd = row.currency === 'USD' ? unitPrice : unitPrice / ccl;
    const base = { portfolio_id: portfolioId, purchase_date: row.date ?? today, transaction_type: row.type };

    switch (row.kind) {
      case 'cedear': {
        if (!row.ratio) return [];
        // Stored as underlying shares: N CEDEARs at a ratio of R are N/R shares.
        return [{ ...base, symbol: row.symbol, quantity: row.quantity / row.ratio, purchase_price: usd * row.ratio }];
      }
      case 'bond':
        // Quantity in nominal units; price per nominal unit.
        return [{ ...base, symbol: localSymbol(row.symbol), quantity: row.quantity, purchase_price: usd / (row.ratio ?? 100) }];
      case 'ar-stock':
        return [{ ...base, symbol: localSymbol(row.symbol), quantity: row.quantity, purchase_price: usd }];
      default:
        return [{ ...base, symbol: row.symbol, quantity: row.quantity, purchase_price: usd }];
    }
  });
}
