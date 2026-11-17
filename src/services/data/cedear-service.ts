// src/services/data/cedear-service.ts

import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/logger';
import bymaCedearRatios from '../../data/cedear-ratios.json';

// Official BYMA ratio list published on 2026-11-12; the duplicated CIBR row is excluded.

/**
 * Combina los ratios oficiales de BYMA con los ajustes automáticos de mercado.
 * @returns Mapa de ticker CEDEAR a CEDEARs por acción subyacente.
 */
export const fetchCedearRatios = async (): Promise<Record<string, number>> => {
  const ratiosMap: Record<string, number> = { ...bymaCedearRatios };

  try {
    const { data, error } = await supabase.from('cedear_ratios').select('symbol,ratio,source');

    if (error) {
      throw error;
    }

    for (const item of data ?? []) {
      const symbol = item.symbol.trim().toUpperCase();
      if (!Number.isFinite(item.ratio) || item.ratio <= 0) continue;
      if (item.source === 'mercado' || ratiosMap[symbol] === undefined) ratiosMap[symbol] = item.ratio;
    }
  } catch (err) {
    await logger.error('CEDEAR_RATIOS_FETCH_FAILED', 'No se pudieron obtener los ratios de CEDEARs.', {
      errorMessage: (err as Error).message,
    });
  }

  return ratiosMap;
};