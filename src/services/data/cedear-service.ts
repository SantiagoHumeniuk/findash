// src/services/data/cedear-service.ts

import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/logger';

/**
 * Obtiene los ratios de conversión de CEDEARs desde la base de datos.
 * @returns {Promise<Record<string, number>>} - Un objeto (mapa) donde la clave es el símbolo del activo y el valor es su ratio de conversión.
 */
export const fetchCedearRatios = async (): Promise<Record<string, number>> => {
  try {
    const { data, error } = await supabase.from('cedear_ratios').select('symbol,ratio');

    if (error) {
      throw error;
    }

    // Convertimos el array de objetos en un mapa para un acceso más eficiente (ej: ratios['AAPL'])
    const ratiosMap = data.reduce((acc: Record<string, number>, item: { symbol: string; ratio: number }) => {
      const symbol = item.symbol.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      if (Number.isFinite(item.ratio) && item.ratio > 0) acc[symbol] = item.ratio;
      return acc;
    }, {});

    return ratiosMap;

  } catch (err) {
    await logger.error('CEDEAR_RATIOS_FETCH_FAILED', 'No se pudieron obtener los ratios de CEDEARs.', {
      errorMessage: (err as Error).message,
    });
    // Devolvemos un objeto vacío en caso de error para no romper la aplicación.
    return {};
  }
};