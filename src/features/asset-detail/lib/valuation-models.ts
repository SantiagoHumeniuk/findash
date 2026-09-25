// src/features/asset-detail/lib/valuation-models.ts

import type { AssetData } from '../../../types/dashboard';

export interface ValuationModel {
  name: string;
  value: number;
  weight: number;
  category: 'intrinsic' | 'relative' | 'asset-based' | 'analyst';
  description: string;
}

export interface BlendedValuationResult {
  fairValue: number | null;
  modelsUsed: ValuationModel[];
  isAnomaly: boolean;
  spread: number | null; // percentage difference from price
  confidence: 'alta' | 'media' | 'baja' | null;
}

/**
 * Calcula un Valor Justo (Fair Value) robusto combinando múltiples modelos financieros.
 * 
 * Modelos incluidos:
 * 1. Consenso de Analistas de Wall Street (peso alto: datos ajustados por moneda)
 * 2. DCF Levered (Flujo de Caja Descontado apalancado)
 * 3. DCF Histórico (Fallback del DCF principal)
 * 4. Número de Graham (valoración defensiva clásica)
 * 5. Earnings Power Value (EPV - valor por poder de ganancias)
 * 6. Modelo de Ingreso Residual (Residual Income / Edwards-Bell-Ohlson)
 * 7. Valoración por EV/EBITDA relativa (Enterprise Value múltiplo)
 * 8. Peter Lynch PEG Fair Value (crecimiento vs precio)
 * 9. FCF Yield Fair Value (rendimiento de flujo de caja libre)
 * 10. Modelo de Descuento de Dividendos (Gordon Growth Model)
 * 11. Valor Contable Tangible por acción
 * 12. Graham Net-Net (activos corrientes netos)
 * 
 * Descarta automáticamente valores anómalos por errores de conversión de moneda (ADRs).
 * Aplica ponderación dinámica según calidad y disponibilidad de datos.
 */
export function calculateBlendedFairValue(asset: AssetData): BlendedValuationResult {
  const currentPrice = asset.quote?.price ?? 0;
  if (currentPrice === 0) {
    return { fairValue: null, modelsUsed: [], isAnomaly: false, spread: null, confidence: null };
  }

  // --- Helpers ---

  // Validar si un valor teórico es razonable respecto al precio actual.
  // Filtra errores típicos de API para ADRs (DCF en moneda local vs precio en USD).
  const isSane = (val: number, isAnalyst = false) => {
    if (isNaN(val) || !isFinite(val) || val <= 0) return false;
    if (isAnalyst) return true; // Los targets de analistas están en la moneda correcta
    const ratio = val / currentPrice;
    // Rango aceptable: entre -80% y +300% del precio actual
    return ratio > 0.20 && ratio < 4.0;
  };

  // Obtener los ratios más recientes (último año fiscal)
  const latestRatios = asset.ratios && asset.ratios.length > 0
    ? [...asset.ratios].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
    : null;

  // Obtener las estimaciones de analistas más recientes
  const latestEstimates = asset.analystEstimates && asset.analystEstimates.length > 0
    ? [...asset.analystEstimates].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
    : null;

  // Obtener métricas anuales más recientes (para crecimiento)
  const sortedYearly = asset.keyMetricsYearly && asset.keyMetricsYearly.length > 0
    ? [...asset.keyMetricsYearly].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    : [];

  const models: ValuationModel[] = [];

  // ============================================================================
  // MODELO 1: Consenso de Analistas de Wall Street
  // Fuente: Price Target Consensus de analistas institucionales
  // Peso: 1.5 (alta confiabilidad, datos ya ajustados por moneda)
  // ============================================================================
  if (asset.priceTargetConsensus?.targetConsensus) {
    const target = asset.priceTargetConsensus.targetConsensus;
    if (isSane(target, true)) {
      models.push({
        name: 'Consenso de Analistas',
        value: target,
        weight: 1.5,
        category: 'analyst',
        description: 'Precio objetivo promedio de analistas de Wall Street'
      });
    }
  } else if ((asset.priceTarget as any)?.targetConsensus) {
    const target = (asset.priceTarget as any).targetConsensus;
    if (isSane(target, true)) {
      models.push({
        name: 'Consenso de Analistas',
        value: target,
        weight: 1.5,
        category: 'analyst',
        description: 'Precio objetivo promedio de analistas de Wall Street'
      });
    }
  }

  // ============================================================================
  // MODELO 2: DCF Levered (Flujo de Caja Descontado Apalancado)
  // Fórmula: Valor presente de flujos futuros de caja ajustados por deuda
  // Peso: 1.2
  // ============================================================================
  let dcfVal: number | null = null;
  const levered = asset.dcfLevered as { equityValuePerShare?: number; dcf?: number } | undefined;
  if (levered) {
    if (typeof levered.equityValuePerShare === 'number') dcfVal = levered.equityValuePerShare;
    else if (typeof levered.dcf === 'number') dcfVal = levered.dcf;
  }

  if (dcfVal !== null && isSane(dcfVal)) {
    models.push({
      name: 'DCF Apalancado',
      value: dcfVal,
      weight: 1.2,
      category: 'intrinsic',
      description: 'Flujo de Caja Descontado ajustado por estructura de deuda (WACC)'
    });
  } else {
    // MODELO 3: DCF Histórico (Fallback)
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
      models.push({
        name: 'DCF Histórico',
        value: historicalVal,
        weight: 0.8,
        category: 'intrinsic',
        description: 'Flujo de Caja Descontado basado en datos históricos proyectados'
      });
    }
  }

  // ============================================================================
  // MODELO 4: Número de Graham
  // Fórmula: √(22.5 × EPS × Book Value Per Share)
  // Es el límite máximo de precio para un "inversor defensivo"
  // Peso: 1.0
  // ============================================================================
  if (asset.keyMetrics?.grahamNumberTTM) {
    const graham = asset.keyMetrics.grahamNumberTTM;
    if (isSane(graham)) {
      models.push({
        name: 'Número de Graham',
        value: graham,
        weight: 1.0,
        category: 'asset-based',
        description: '√(22.5 × EPS × Valor Libros/Acción) — Valoración defensiva de Benjamin Graham'
      });
    }
  }

  // ============================================================================
  // MODELO 5: Earnings Power Value (EPV)
  // Fórmula: EPV = Earnings Ajustados / Costo de Capital (WACC o Ke)
  // Mide el valor de la empresa asumiendo ganancias constantes sin crecimiento.
  // Usamos earningsYieldTTM invertido como proxy.
  // Peso: 0.9
  // ============================================================================
  if (asset.keyMetrics?.earningsYieldTTM && asset.keyMetrics.earningsYieldTTM > 0) {
    // earningsYield = EPS / Price => EPV = EPS / costOfCapital
    // Si usamos un costo de capital del 10% como estándar:
    const earningsYield = asset.keyMetrics.earningsYieldTTM;
    const eps = earningsYield * currentPrice; // EPS = earningsYield × Price
    const costOfCapital = 0.10; // 10% como proxy estándar del costo de capital
    
    // Si hay datos de DCF con WACC, usar ese
    let wacc = costOfCapital;
    if (asset.dcf && Array.isArray(asset.dcf) && asset.dcf.length > 0) {
      const latestDcf = [...asset.dcf].sort((a, b) => {
        const dateA = new Date((a as any).date ?? (a as any).year ?? '').getTime();
        const dateB = new Date((b as any).date ?? (b as any).year ?? '').getTime();
        return dateB - dateA;
      })[0] as any;
      if (latestDcf.wacc && latestDcf.wacc > 0.01 && latestDcf.wacc < 0.30) {
        wacc = latestDcf.wacc;
      }
    }

    const epv = eps / wacc;
    if (isSane(epv)) {
      models.push({
        name: 'Earnings Power Value',
        value: epv,
        weight: 0.9,
        category: 'intrinsic',
        description: `EPV = EPS / WACC (${(wacc * 100).toFixed(1)}%) — Valor asumiendo ganancias estables sin crecimiento`
      });
    }
  }

  // ============================================================================
  // MODELO 6: Residual Income Model (Edwards-Bell-Ohlson)
  // Fórmula: FV = BV + Σ(RI_t / (1+r)^t)
  // Donde RI = EPS - (r × BV) = beneficio económico por encima del costo de capital
  // Simplificado: FV = BV + (ROE - r) × BV / (r - g)
  // Peso: 0.85
  // ============================================================================
  if (latestRatios?.bookValuePerShare && latestRatios.bookValuePerShare > 0) {
    const bvps = latestRatios.bookValuePerShare;
    const roe = asset.keyMetrics?.returnOnEquityTTM;
    
    if (roe && roe > 0 && roe < 1.0) { // ROE entre 0% y 100%
      const r = 0.10; // Costo de equity (10% estándar)
      
      // Estimar tasa de crecimiento sostenible: g = ROE × (1 - payout ratio)
      const payoutRatio = latestRatios.dividendPayoutRatio ?? 0;
      const retentionRate = Math.max(0, Math.min(1, 1 - payoutRatio));
      const g = Math.min(roe * retentionRate, 0.06); // Cap growth at 6%
      
      if (roe > r && r > g) {
        // Residual Income positivo: la empresa genera valor por encima de su costo de capital
        const residualIncome = (roe - r) * bvps;
        const residualIncomeCapitalized = residualIncome / (r - g);
        const riValue = bvps + residualIncomeCapitalized;
        
        if (isSane(riValue)) {
          models.push({
            name: 'Ingreso Residual (EBO)',
            value: riValue,
            weight: 0.85,
            category: 'intrinsic',
            description: `BV + (ROE ${(roe * 100).toFixed(1)}% - Ke ${(r * 100)}%) × BV / (Ke - g) — Beneficio económico sobre costo de capital`
          });
        }
      } else if (r > g) {
        // ROE < r: la empresa no genera valor económico, vale menos que su book value
        const residualIncome = (roe - r) * bvps;
        const residualIncomeCapitalized = residualIncome / (r - g);
        const riValue = bvps + residualIncomeCapitalized;
        
        if (riValue > 0 && isSane(riValue)) {
          models.push({
            name: 'Ingreso Residual (EBO)',
            value: riValue,
            weight: 0.7, // Peso menor cuando ROE < costo de capital
            category: 'intrinsic',
            description: `BV ajustado por ROE (${(roe * 100).toFixed(1)}%) inferior al costo de capital`
          });
        }
      }
    }
  }

  // ============================================================================
  // MODELO 7: Valoración Relativa por EV/EBITDA
  // Fórmula: Si EV/EBITDA actual > mediana del sector (~12x), está sobrevaluada
  // FV = (EBITDA × múltiplo justo × shares) + Efectivo - Deuda / Acciones
  // Simplificado: usamos la inversa del ratio actual vs benchmark
  // Peso: 0.7
  // ============================================================================
  if (asset.keyMetrics?.evToEBITDATTM && asset.keyMetrics.evToEBITDATTM > 0) {
    const currentEvEbitda = asset.keyMetrics.evToEBITDATTM;
    
    // Múltiplo justo: usamos la mediana histórica del mercado (~12-14x para empresas establecidas)
    // Ajustado según la calidad de la empresa (ROE, márgenes)
    let fairMultiple = 12.0;
    
    // Ajustar por calidad: empresas de alta calidad merecen múltiplos más altos
    if (asset.keyMetrics.returnOnEquityTTM && asset.keyMetrics.returnOnEquityTTM > 0.15) {
      fairMultiple = 14.0; // ROE > 15%: empresa de alta calidad
    }
    if (asset.keyMetrics.returnOnEquityTTM && asset.keyMetrics.returnOnEquityTTM > 0.25) {
      fairMultiple = 16.0; // ROE > 25%: empresa excepcional
    }
    
    // FV = Precio × (Múltiplo Justo / Múltiplo Actual)
    if (currentEvEbitda > 0 && currentEvEbitda < 100) { // Ignorar EV/EBITDA extremos
      const evEbitdaFairValue = currentPrice * (fairMultiple / currentEvEbitda);
      
      if (isSane(evEbitdaFairValue)) {
        models.push({
          name: 'EV/EBITDA Relativo',
          value: evEbitdaFairValue,
          weight: 0.7,
          category: 'relative',
          description: `Precio × (${fairMultiple}x justo / ${currentEvEbitda.toFixed(1)}x actual) — Múltiplo relativo de valor empresa`
        });
      }
    }
  }

  // ============================================================================
  // MODELO 8: Peter Lynch PEG Fair Value
  // Fórmula: FV = EPS × Tasa de Crecimiento de Ganancias × PEG justo (1.0)
  // Un PEG = 1 significa que el P/E es igual a la tasa de crecimiento
  // Peso: 0.75
  // ============================================================================
  if (latestRatios?.netIncomePerShare && latestRatios.netIncomePerShare > 0 && sortedYearly.length >= 2) {
    const eps = latestRatios.netIncomePerShare;
    
    // Calcular tasa de crecimiento compuesta de earnings yield (proxy de EPS growth)
    // Usando los últimos años disponibles
    const recentYear = sortedYearly[0];
    const olderYear = sortedYearly[Math.min(sortedYearly.length - 1, 3)]; // Hace 3 años o lo que haya
    
    if (recentYear.earningsYield && olderYear.earningsYield && olderYear.earningsYield > 0 && recentYear.earningsYield > 0) {
      const yearsApart = Math.max(1, (new Date(recentYear.date).getTime() - new Date(olderYear.date).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      const growthRate = Math.pow(recentYear.earningsYield / olderYear.earningsYield, 1 / yearsApart) - 1;
      
      // Solo usar si el crecimiento es razonable (entre 3% y 50%)
      if (growthRate > 0.03 && growthRate < 0.50) {
        const growthPct = growthRate * 100;
        // PEG = 1 => P/E justo = tasa de crecimiento en % => FV = EPS × growth%
        const pegFairValue = eps * growthPct;
        
        if (isSane(pegFairValue)) {
          models.push({
            name: 'PEG de Peter Lynch',
            value: pegFairValue,
            weight: 0.75,
            category: 'relative',
            description: `EPS × Crecimiento (${growthPct.toFixed(1)}%) — PEG justo = 1.0 según Peter Lynch`
          });
        }
      }
    }
  }

  // ============================================================================
  // MODELO 9: FCF Yield Fair Value
  // Fórmula: FV = FCF por acción / Yield justo requerido
  // Yield justo basado en tasa libre de riesgo + prima de riesgo de equity
  // Peso: 0.85
  // ============================================================================
  if (latestRatios?.freeCashFlowPerShare && latestRatios.freeCashFlowPerShare > 0) {
    const fcfps = latestRatios.freeCashFlowPerShare;
    // Yield justo: 5-6% para empresas estables, más alto para empresas riesgosas
    let requiredYield = 0.055; // 5.5% base
    
    // Ajustar por riesgo (beta)
    const beta = asset.profile?.beta ?? 1.0;
    if (beta > 1.5) requiredYield = 0.08; // Alta volatilidad
    else if (beta > 1.2) requiredYield = 0.065;
    else if (beta < 0.8) requiredYield = 0.045; // Baja volatilidad, defensive
    
    const fcfFairValue = fcfps / requiredYield;
    
    if (isSane(fcfFairValue)) {
      models.push({
        name: 'Rendimiento FCF',
        value: fcfFairValue,
        weight: 0.85,
        category: 'intrinsic',
        description: `FCF/Acción / Yield requerido (${(requiredYield * 100).toFixed(1)}%) — Valor según flujo de caja libre`
      });
    }
  }

  // ============================================================================
  // MODELO 10: Gordon Growth Model (Descuento de Dividendos)
  // Fórmula: FV = D₁ / (r - g) donde D₁ = dividendo esperado, r = Ke, g = tasa de crecimiento
  // Solo aplica si la empresa paga dividendos
  // Peso: 0.6 (menor porque muchas empresas no pagan dividendos)
  // ============================================================================
  if (latestRatios?.dividendPerShare && latestRatios.dividendPerShare > 0) {
    const d0 = latestRatios.dividendPerShare;
    const roe = asset.keyMetrics?.returnOnEquityTTM ?? 0.10;
    const payoutRatio = latestRatios.dividendPayoutRatio ?? 0.5;
    const retentionRate = Math.max(0, Math.min(1, 1 - payoutRatio));
    
    // Tasa de crecimiento sostenible: g = ROE × (1 - payout ratio)
    const g = Math.min(Math.max(roe * retentionRate, 0.01), 0.06); // Entre 1% y 6%
    const r = 0.10; // Costo de equity
    
    if (r > g) {
      const d1 = d0 * (1 + g); // Dividendo esperado del próximo período
      const ddmValue = d1 / (r - g);
      
      if (isSane(ddmValue)) {
        models.push({
          name: 'Gordon Growth (DDM)',
          value: ddmValue,
          weight: 0.6,
          category: 'intrinsic',
          description: `D₁ / (Ke - g) = $${d1.toFixed(2)} / (${(r * 100)}% - ${(g * 100).toFixed(1)}%) — Modelo de descuento de dividendos`
        });
      }
    }
  }

  // ============================================================================
  // MODELO 11: Valor Contable Tangible por Acción
  // FV = Tangible Book Value / Share — piso de valoración
  // Peso: 0.4 (es un piso, no un target realista para la mayoría de empresas)
  // ============================================================================
  if (latestRatios?.tangibleBookValuePerShare && latestRatios.tangibleBookValuePerShare > 0) {
    const tbvps = latestRatios.tangibleBookValuePerShare;
    
    if (isSane(tbvps)) {
      models.push({
        name: 'Valor Contable Tangible',
        value: tbvps,
        weight: 0.4,
        category: 'asset-based',
        description: 'Activos tangibles netos por acción — Valor de liquidación conservador'
      });
    }
  }

  // ============================================================================
  // MODELO 12: Graham Net-Net Working Capital
  // Fórmula: (Activos Corrientes - Pasivos Totales) / Acciones
  // Estrategia ultra-value de Graham: comprar por debajo del capital de trabajo neto
  // Peso: 0.3 (muy conservador, pocas empresas cotizan tan bajo)
  // ============================================================================
  if (asset.keyMetrics?.grahamNetNetTTM) {
    const netNet = asset.keyMetrics.grahamNetNetTTM;
    if (netNet > 0 && isSane(netNet)) {
      models.push({
        name: 'Graham Net-Net',
        value: netNet,
        weight: 0.3,
        category: 'asset-based',
        description: '(Activos Corrientes - Pasivos Totales) / Acciones — Liquidación ultra-conservadora'
      });
    }
  }

  // ============================================================================
  // MODELO BONUS: Reverse P/E Fair Value (basado en EPS y P/E justo del sector)
  // FV = EPS × P/E justo (usando mediana histórica ~15-18x)
  // Peso: 0.65
  // ============================================================================
  if (latestRatios?.netIncomePerShare && latestRatios.netIncomePerShare > 0) {
    const eps = latestRatios.netIncomePerShare;
    
    // P/E justo basado en calidad de la empresa
    let fairPE = 15.0; // Base: mediana histórica del S&P 500
    
    // Ajustar por ROE
    const roe = asset.keyMetrics?.returnOnEquityTTM ?? 0;
    if (roe > 0.20) fairPE = 20.0;
    else if (roe > 0.15) fairPE = 18.0;
    else if (roe > 0.10) fairPE = 16.0;
    else if (roe < 0.05) fairPE = 12.0;
    
    // Ajustar por crecimiento estimado de analistas
    if (latestEstimates?.epsAvg && latestEstimates.epsAvg > eps) {
      const impliedGrowth = (latestEstimates.epsAvg - eps) / eps;
      if (impliedGrowth > 0.15) fairPE *= 1.15; // Crecimiento alto: prima del 15%
      else if (impliedGrowth > 0.08) fairPE *= 1.08;
    }
    
    const peFairValue = eps * fairPE;
    
    if (isSane(peFairValue)) {
      models.push({
        name: 'P/E Justo Ajustado',
        value: peFairValue,
        weight: 0.65,
        category: 'relative',
        description: `EPS × P/E justo (${fairPE.toFixed(1)}x) ajustado por ROE y crecimiento esperado`
      });
    }
  }

  // --- Promedio Ponderado Final con Eliminación de Outliers ---

  if (models.length === 0) {
    // Si todos los modelos fallaron, intentar con el DCF crudo (posible error de moneda)
    let lastResort: number | null = null;
    let label = 'Desconocido';

    if (dcfVal !== null) {
      lastResort = dcfVal;
      label = 'DCF (Anómalo/Moneda Local)';
    }

    if (lastResort === null) {
      return { fairValue: null, modelsUsed: [], isAnomaly: false, spread: null, confidence: null };
    }

    const spread = ((lastResort - currentPrice) / currentPrice) * 100;
    return {
      fairValue: lastResort,
      modelsUsed: [{ name: label, value: lastResort, weight: 1, category: 'intrinsic', description: 'Valor estimado con datos inconsistentes' }],
      isAnomaly: true,
      spread,
      confidence: 'baja'
    };
  }

  // Filtrar outliers usando IQR (Interquartile Range) si hay suficientes modelos
  let filteredModels = [...models];
  if (models.length >= 4) {
    const values = models.map(m => m.value).sort((a, b) => a - b);
    const q1 = values[Math.floor(values.length * 0.25)];
    const q3 = values[Math.floor(values.length * 0.75)];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    const nonOutliers = models.filter(m => m.value >= lowerBound && m.value <= upperBound);
    // Solo filtrar si no eliminamos demasiados modelos
    if (nonOutliers.length >= Math.ceil(models.length * 0.5)) {
      filteredModels = nonOutliers;
    }
  }

  // Calcular promedio ponderado
  let totalWeight = 0;
  let weightedSum = 0;

  for (const model of filteredModels) {
    totalWeight += model.weight;
    weightedSum += model.value * model.weight;
  }

  const fairValue = weightedSum / totalWeight;
  const spread = ((fairValue - currentPrice) / currentPrice) * 100;

  // Determinar nivel de confianza basado en cantidad y diversidad de modelos
  let confidence: 'alta' | 'media' | 'baja';
  const categories = new Set(filteredModels.map(m => m.category));
  if (filteredModels.length >= 6 && categories.size >= 3) {
    confidence = 'alta';
  } else if (filteredModels.length >= 3 && categories.size >= 2) {
    confidence = 'media';
  } else {
    confidence = 'baja';
  }

  return {
    fairValue,
    modelsUsed: filteredModels,
    isAnomaly: false,
    spread,
    confidence
  };
}
