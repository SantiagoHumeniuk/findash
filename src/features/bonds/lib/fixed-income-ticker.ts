/**
 * Normalizes dollar-denominated Argentine bonds to the DATA912 MEP ticker.
 *
 * @param symbol - Workbook or market ticker, optionally ending in C, D, or O
 * @param currency - Contract currency
 * @returns The D ticker for USD contracts, or the unchanged ticker for ARS
 */
export function normalizeFixedIncomeTicker(
  symbol: string,
  currency: 'USD' | 'ARS',
): string {
  const normalized = symbol.trim().toUpperCase();
  if (currency !== 'USD') return normalized;
  return `${normalized.replace(/[DCO]$/, '')}D`;
}
