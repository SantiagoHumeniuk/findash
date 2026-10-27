// src/features/sectors-industries/lib/format-utils.ts

/**
 * Formats a percentage value for display.
 * 
 * @param value - The percentage value to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted percentage string with + or - sign
 * 
 * @example
 * ```ts
 * formatPercentage(2.5) // "+2.50%"
 * formatPercentage(-1.3) // "-1.30%"
 * ```
 */
export function formatPercentage(value: number, decimals = 2): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

/**
 * Returns a color class based on the percentage value.
 * 
 * @param value - The percentage value
 * @returns Tailwind color class
 */
export function getPercentageColor(value: number): string {
  if (value > 0) return 'text-green-600 dark:text-green-400';
  if (value < 0) return 'text-red-600 dark:text-red-400';
  return 'text-muted-foreground';
}

/**
 * Formats a date string to a localized format.
 * 
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Formatted date string
 */
export function formatDate(dateString: string): string {
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(dateString)
    ? `${dateString}T12:00:00`
    : dateString);
  if (!Number.isFinite(date.getTime())) return dateString;
  return date.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Calculates statistics from performance data.
 * 
 * @param data - Array of performance data with averageChange property
 * @returns Object with min, max, average, and latest values
 */
export function calculateStats(data: { averageChange: number; date: string }[]) {
  if (data.length === 0) {
    return { min: 0, max: 0, average: 0, latest: 0, latestDate: '' };
  }

  const values = data.map(d => d.averageChange);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const average = values.reduce((a, b) => a + b, 0) / values.length;
  const latestRecord = data.reduce((latest, item) =>
    Date.parse(item.date) > Date.parse(latest.date) ? item : latest
  );
  const latest = latestRecord.averageChange;
  const latestDate = latestRecord.date;

  return { min, max, average, latest, latestDate };
}
