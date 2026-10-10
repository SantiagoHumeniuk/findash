// src/utils/formatters.ts

/**
 * Formatea un valor numérico como una cadena de moneda en USD.
 * @param value - El número a formatear.
 * @returns Una cadena con el formato de moneda (ej: "$1,234.56").
 */
export const formatCurrency = (value: number): string => 
  `$${Number(value || 0).toLocaleString('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  })}`;

/**
 * Formatea un valor numérico como un porcentaje con dos decimales.
 * @param value - El número a formatear (ej: 5.23 para 5.23%).
 * @returns Una cadena con el formato de porcentaje (ej: "5.23%").
 */
export const formatPercent = (value: number): string => 
  `${Number(value || 0).toFixed(2)}%`;

/**
 * Formatea una cantidad, permitiendo hasta 4 decimales para mayor precisión.
 * @param value - El número a formatear.
 * @returns Una cadena con el número formateado.
 */
export const formatQuantity = (value: number): string => 
  Number(value || 0).toLocaleString('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 4 
  });

/**
 * Formatea un número o devuelve una cadena vacía si no es un número válido.
 * @param value - El valor a formatear.
 * @returns Una cadena con el número formateado o vacía.
 */
export const formatNumber = (value: number | string): string => 
  (typeof value === 'number' && isFinite(value)) ? value.toFixed(2) : '';