// src/features/asset-detail/lib/valuation-models.ts

import type { AssetData } from '../../../types/dashboard';

export interface ValuationModel {
  name: string;
  value: number;
  weight: number;
}

export interface BlendedValuationResult {
  fairValue: number | null;
  modelsUsed: ValuationModel[];
  isAnomaly: boolean;
  spread: number | null; // percentage difference from price
}

/**
 * Calcula un Valor Justo (Fair Value) robusto promediando varios modelos financieros.
 * Descarta automáticamente valores anómalos (ej. causados por errores de conversión de moneda en ADRs).
 */
export function calculateBlendedFairValue(asset: AssetData): BlendedValuationResult {
  const currentPrice = asset.quote?.price ?? 0;
  if (currentPrice === 0) {
    return { fairValue: null, modelsUsed: [], isAnomaly: false, spread: null };
  }

  // Validar si un cálculo teórico tiene sentido respecto al precio real.
  // Esto filtra los errores típicos de la API para ADRs (ej. DCF calculado en Pesos/Reales pero precio en USD).
  const isSane = (val: number, isAnalyst = false) => {
    if (isNaN(val) || val <= 0) return false;
    if (isAnalyst) return true; // Los objetivos de analistas de Wall Street siempre están en la moneda correcta
    
    const ratio = val / currentPrice;
    // Aceptamos entre -75% y +200% de margen. Valores fuera de esto suelen ser errores de la API.
    return ratio > 0.25 && ratio < 3.0; 
  };

  const models: ValuationModel[] = [];

  // 1. Consenso de Analistas (Altamente confiable, ajustado por moneda)
  if (asset.priceTargetConsensus?.targetConsensus) {
    const target = asset.priceTargetConsensus.targetConsensus;
    if (isSane(target, true)) {
      models.push({ name: 'Consenso de Analistas', value: target, weight: 1.5 });
    }
  } else if (asset.priceTarget?.targetConsensus) {
    const target = asset.priceTarget.targetConsensus;
    if (isSane(target, true)) {
      models.push({ name: 'Consenso de Analistas', value: target, weight: 1.5 });
    }
  }

  // 2. Número de Graham (Valoración defensiva: Valor Contable y Beneficios)
  if (asset.keyMetrics?.grahamNumberTTM) {
    const graham = asset.keyMetrics.grahamNumberTTM;
    if (isSane(graham)) {
      models.push({ name: 'Número de Graham', value: graham, weight: 1.0 });
    }
  }

  // 3. Flujo de Caja Descontado (DCF Levered de la API)
  let dcfVal: number | null = null;
  const levered = asset.dcfLevered as {equityValuePerShare?: number; dcf?: number} | undefined;
  if (levered) {
    if (typeof levered.equityValuePerShare === 'number') dcfVal = levered.equityValuePerShare;
    else if (typeof levered.dcf === 'number') dcfVal = levered.dcf;
  }
  
  if (dcfVal !== null && isSane(dcfVal)) {
    models.push({ name: 'DCF (Levered)', value: dcfVal, weight: 1.0 });
  } else {
    // 4. DCF Histórico (Fallback si el Levered falló o es anómalo)
    let historicalVal: number | null = null;
    if (asset.dcf && Array.isArray(asset.dcf) && asset.dcf.length > 0) {
      const sortedDcf = [...asset.dcf].sort((a, b) => {
        const dateA = new Date((a as any).date ?? (a as any).year ?? '').getTime();
        const dateB = new Date((b as any).date ?? (b as any).year ?? '').getTime();
        return dateB - dateA;
      });
      const latest = sortedDcf[0] as any;
      const raw = latest.dcf ?? latest['Stock Price'] ?? latest.stockPrice ?? latest.equityValuePerShare;
      if (typeof raw === 'number' || (typeof raw === 'string' && !isNaN(parseFloat(raw)))) {
        historicalVal = typeof raw === 'number' ? raw : parseFloat(raw);
      }
    }
    if (historicalVal !== null && isSane(historicalVal)) {
      models.push({ name: 'DCF (Histórico)', value: historicalVal, weight: 0.8 });
    }
  }

  // --- Promedio Ponderado Final ---
  
  if (models.length === 0) {
    // Si todos los modelos intrínsecos fallaron por error de moneda y no hay analistas, devolvemos el error crudo.
    let lastResort: number | null = null;
    let label = 'Desconocido';
    
    if (dcfVal !== null) {
      lastResort = dcfVal;
      label = 'DCF (Anómalo/Moneda Local)';
    }

    if (lastResort === null) {
        return { fairValue: null, modelsUsed: [], isAnomaly: false, spread: null };
    }

    const spread = ((lastResort - currentPrice) / currentPrice) * 100;
    return {
      fairValue: lastResort,
      modelsUsed: [{ name: label, value: lastResort, weight: 1 }],
      isAnomaly: true,
      spread
    };
  }

  let totalWeight = 0;
  let weightedSum = 0;

  for (const model of models) {
    totalWeight += model.weight;
    weightedSum += model.value * model.weight;
  }

  const fairValue = weightedSum / totalWeight;
  const spread = ((fairValue - currentPrice) / currentPrice) * 100;

  return {
    fairValue,
    modelsUsed: models,
    isAnomaly: false,
    spread
  };
}
