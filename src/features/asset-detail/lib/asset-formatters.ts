// src/features/asset-detail/lib/asset-formatters.ts

/**
 * Formatea números grandes usando notación K, M, B, T.
 * * @param num - Número a formatear
 * @returns String formateado con sufijo, o vacío si el dato no es válido
 */
export function formatLargeNumber(num: number | string | null | undefined): string {
  const n = Number(num);
  if (num === null || num === undefined || (typeof num === 'string' && num.trim() === '') || !Number.isFinite(n)) return '';

  if (Math.abs(n) >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(2)}K`;

  return n.toLocaleString('es-ES');
}

/**
 * Formatea un precio en dólares con 2 decimales.
 */
export function formatPrice(price: number | null | undefined): string {
  if (price === null || price === undefined || !Number.isFinite(price) || price <= 0) return '';
  return `$${price.toFixed(2)}`;
}

/**
 * Formatea un porcentaje con 2 decimales.
 */
export function formatPercentage(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  return `${value.toFixed(2)}%`;
}

/**
 * Calcula la diferencia porcentual (Potencial de subida/bajada) entre precio actual y valor intrínseco.
 * Fórmula: (ValorIntrínseco - PrecioActual) / PrecioActual
 * * @param currentPrice - Precio actual del activo
 * @param intrinsicValue - Valor intrínseco estimado (DCF)
 * @returns Porcentaje de potencial (positivo = subida/infravalorado, negativo = caída/sobrevalorado)
 */
export function calculateDCFDifference(
  currentPrice: number,
  intrinsicValue: number | null | undefined
): number | null {
  if (
    typeof intrinsicValue !== 'number' ||
    typeof currentPrice !== 'number' ||
    intrinsicValue <= 0 ||
    currentPrice <= 0
  ) {
    return null;
  }

  return ((intrinsicValue - currentPrice) / currentPrice) * 100;
}