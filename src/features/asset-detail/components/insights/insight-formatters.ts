// src/features/asset-detail/components/insights/insight-formatters.ts

const NOT_AVAILABLE = 'N/D';

const COMPACT_STEPS = [
  { size: 1e12, suffix: 'T' },
  { size: 1e9, suffix: 'B' },
  { size: 1e6, suffix: 'M' },
  { size: 1e3, suffix: 'K' },
];

/** 403.9B-style figures, matching the K/M/B/T notation used elsewhere in the app. */
export function formatCompact(value: number | null | undefined, currency?: string): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return NOT_AVAILABLE;
  const step = COMPACT_STEPS.find(({ size }) => Math.abs(value) >= size);
  const number = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(step ? value / step.size : value);
  const formatted = `${number}${step?.suffix ?? ''}`;
  return currency ? `${currency} ${formatted}` : formatted;
}

/** Formats a fraction (0.123) as a percentage (12,3 %). */
export function formatFraction(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return NOT_AVAILABLE;
  return new Intl.NumberFormat('es-AR', { style: 'percent', maximumFractionDigits: digits }).format(value);
}

export function formatDecimal(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return NOT_AVAILABLE;
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return NOT_AVAILABLE;
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? NOT_AVAILABLE : date.toLocaleDateString('es-AR');
}

/** Quarter label such as "T2 2026" from a period end date. */
export function quarterLabel(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  return `T${Math.floor(parsed.getMonth() / 3) + 1} ${parsed.getFullYear()}`;
}
