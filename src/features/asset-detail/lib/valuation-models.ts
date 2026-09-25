// src/features/asset-detail/lib/valuation-models.ts

import type { AssetData } from '../../../types/dashboard';

export interface ValuationModel {
  name: string;
  value: number;
  weight: number;
  category: 'intrinsic' | 'relative' | 'asset-based' | 'analyst';
  description: string;
}

export interface ValuationContext {
  sector: string;
  industry: string;
  country: string;
  currency: string;
  isAdr: boolean;
  countryRiskPremiumPct: number;
  valuationDiscountPct: number;
  adjustedCostOfEquityPct: number;
  benchmarkEvEbitda: number;
  benchmarkPe: number;
}

export interface BlendedValuationResult {
  fairValue: number | null;
  modelsUsed: ValuationModel[];
  isAnomaly: boolean;
  spread: number | null; // percentage difference from price
  confidence: 'alta' | 'media' | 'baja' | null;
  context: ValuationContext;
}

// ============================================================================
// CONFIGURACIÓN DE SECTOR E INDUSTRIA (Benchmarks de Mercado Calibrados)
// ============================================================================

interface SectorBenchmark {
  fairPE: number;             // Múltiplo P/E base justo
  fairEvEbitda: number;       // Múltiplo EV/EBITDA base justo (0 si no aplica, ej. Bancos)
  fairPB: number;             // Múltiplo P/B base justo
  requiredFcfYield: number;   // Yield de FCF exigido base (sin riesgo país)
  baseCostOfEquity: number;   // Costo de equity base (Ke) para US
  typicalRoe: number;         // ROE promedio esperado del sector
  maxPerpetualGrowth: number; // Tasa de crecimiento terminal sostenible (g)
}

const SECTOR_BENCHMARKS: Record<string, SectorBenchmark> = {
  'Energy': {
    fairPE: 7.5,
    fairEvEbitda: 4.8,
    fairPB: 1.1,
    requiredFcfYield: 0.11, // 11% FCF yield exigido por ciclicidad y transición energética
    baseCostOfEquity: 0.115,
    typicalRoe: 0.12,
    maxPerpetualGrowth: 0.02
  },
  'Basic Materials': {
    fairPE: 9.0,
    fairEvEbitda: 5.8,
    fairPB: 1.3,
    requiredFcfYield: 0.095,
    baseCostOfEquity: 0.110,
    typicalRoe: 0.11,
    maxPerpetualGrowth: 0.025
  },
  'Financial Services': {
    fairPE: 9.5,
    fairEvEbitda: 0, // No aplica EV/EBITDA a bancos por depósitos y pasivos operativos
    fairPB: 1.1,
    requiredFcfYield: 0, // No aplica FCF tradicional
    baseCostOfEquity: 0.110,
    typicalRoe: 0.13,
    maxPerpetualGrowth: 0.03
  },
  'Financial': {
    fairPE: 9.5,
    fairEvEbitda: 0,
    fairPB: 1.1,
    requiredFcfYield: 0,
    baseCostOfEquity: 0.110,
    typicalRoe: 0.13,
    maxPerpetualGrowth: 0.03
  },
  'Technology': {
    fairPE: 24.0,
    fairEvEbitda: 17.5,
    fairPB: 4.5,
    requiredFcfYield: 0.045,
    baseCostOfEquity: 0.090,
    typicalRoe: 0.20,
    maxPerpetualGrowth: 0.038
  },
  'Utilities': {
    fairPE: 13.5,
    fairEvEbitda: 8.5,
    fairPB: 1.4,
    requiredFcfYield: 0.065,
    baseCostOfEquity: 0.085,
    typicalRoe: 0.095,
    maxPerpetualGrowth: 0.02
  },
  'Communication Services': {
    fairPE: 15.0,
    fairEvEbitda: 7.5,
    fairPB: 2.0,
    requiredFcfYield: 0.070,
    baseCostOfEquity: 0.095,
    typicalRoe: 0.13,
    maxPerpetualGrowth: 0.025
  },
  'Consumer Cyclical': {
    fairPE: 15.5,
    fairEvEbitda: 9.5,
    fairPB: 2.5,
    requiredFcfYield: 0.065,
    baseCostOfEquity: 0.100,
    typicalRoe: 0.15,
    maxPerpetualGrowth: 0.028
  },
  'Consumer Discretionary': {
    fairPE: 15.5,
    fairEvEbitda: 9.5,
    fairPB: 2.5,
    requiredFcfYield: 0.065,
    baseCostOfEquity: 0.100,
    typicalRoe: 0.15,
    maxPerpetualGrowth: 0.028
  },
  'Consumer Defensive': {
    fairPE: 17.5,
    fairEvEbitda: 11.5,
    fairPB: 3.0,
    requiredFcfYield: 0.055,
    baseCostOfEquity: 0.085,
    typicalRoe: 0.16,
    maxPerpetualGrowth: 0.025
  },
  'Healthcare': {
    fairPE: 18.5,
    fairEvEbitda: 13.0,
    fairPB: 3.2,
    requiredFcfYield: 0.055,
    baseCostOfEquity: 0.090,
    typicalRoe: 0.15,
    maxPerpetualGrowth: 0.03
  },
  'Industrials': {
    fairPE: 16.0,
    fairEvEbitda: 10.5,
    fairPB: 2.7,
    requiredFcfYield: 0.060,
    baseCostOfEquity: 0.095,
    typicalRoe: 0.14,
    maxPerpetualGrowth: 0.025
  },
  'Real Estate': {
    fairPE: 16.0, // P/FFO proxy
    fairEvEbitda: 14.0,
    fairPB: 1.2,
    requiredFcfYield: 0.065,
    baseCostOfEquity: 0.090,
    typicalRoe: 0.08,
    maxPerpetualGrowth: 0.02
  }
};

const DEFAULT_SECTOR_BENCHMARK: SectorBenchmark = {
  fairPE: 15.0,
  fairEvEbitda: 10.0,
  fairPB: 2.2,
  requiredFcfYield: 0.065,
  baseCostOfEquity: 0.095,
  typicalRoe: 0.13,
  maxPerpetualGrowth: 0.025
};

// ============================================================================
// CONFIGURACIÓN DE RIESGO PAÍS Y GEOGRAFÍA (Damodaran Country Risk Model)
// ============================================================================

interface CountryProfile {
  countryRiskPremium: number; // Prima de riesgo país adicional sobre Ke de EE.UU.
  valuationDiscount: number;  // Descuento estructural sobre múltiplos de mercado
  regionName: string;
}

const COUNTRY_PROFILES: Record<string, CountryProfile> = {
  'US': { countryRiskPremium: 0.000, valuationDiscount: 0.00, regionName: 'Estados Unidos' },
  'USA': { countryRiskPremium: 0.000, valuationDiscount: 0.00, regionName: 'Estados Unidos' },
  'CA': { countryRiskPremium: 0.000, valuationDiscount: 0.00, regionName: 'Canadá' },
  'GB': { countryRiskPremium: 0.005, valuationDiscount: 0.03, regionName: 'Reino Unido' },
  'DE': { countryRiskPremium: 0.004, valuationDiscount: 0.02, regionName: 'Alemania' },
  'FR': { countryRiskPremium: 0.006, valuationDiscount: 0.04, regionName: 'Francia' },
  'CH': { countryRiskPremium: 0.000, valuationDiscount: 0.00, regionName: 'Suiza' },
  'NL': { countryRiskPremium: 0.003, valuationDiscount: 0.02, regionName: 'Países Bajos' },
  'JP': { countryRiskPremium: 0.004, valuationDiscount: 0.05, regionName: 'Japón' },
  'AU': { countryRiskPremium: 0.002, valuationDiscount: 0.02, regionName: 'Australia' },
  
  // Mercados Emergentes - América Latina
  'BR': { countryRiskPremium: 0.042, valuationDiscount: 0.22, regionName: 'Brasil (Mercado Emergente)' },
  'AR': { countryRiskPremium: 0.120, valuationDiscount: 0.45, regionName: 'Argentina (Alto Riesgo País)' },
  'MX': { countryRiskPremium: 0.028, valuationDiscount: 0.15, regionName: 'México (Mercado Emergente)' },
  'CL': { countryRiskPremium: 0.022, valuationDiscount: 0.12, regionName: 'Chile' },
  'CO': { countryRiskPremium: 0.038, valuationDiscount: 0.20, regionName: 'Colombia' },
  'PE': { countryRiskPremium: 0.032, valuationDiscount: 0.18, regionName: 'Perú' },
  
  // Asia y otros emergentes
  'CN': { countryRiskPremium: 0.026, valuationDiscount: 0.20, regionName: 'China (Riesgo Geopolítico/Regulatorio)' },
  'IN': { countryRiskPremium: 0.022, valuationDiscount: 0.10, regionName: 'India' },
  'KR': { countryRiskPremium: 0.012, valuationDiscount: 0.08, regionName: 'Corea del Sur' },
  'TW': { countryRiskPremium: 0.014, valuationDiscount: 0.10, regionName: 'Taiwán' },
  'ZA': { countryRiskPremium: 0.045, valuationDiscount: 0.25, regionName: 'Sudáfrica' }
};

const DEFAULT_EMERGING_PROFILE: CountryProfile = {
  countryRiskPremium: 0.035,
  valuationDiscount: 0.18,
  regionName: 'Internacional / Emergente'
};

/**
 * Obtiene el benchmark del sector/industria
 */
function getSectorBenchmark(sectorName?: string, industryName?: string): SectorBenchmark {
  if (!sectorName) return DEFAULT_SECTOR_BENCHMARK;
  
  // Match exacto o aproximado de sector
  for (const [key, benchmark] of Object.entries(SECTOR_BENCHMARKS)) {
    if (sectorName.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(sectorName.toLowerCase())) {
      // Ajuste especial por industria si es Oil & Gas
      if (industryName && (industryName.toLowerCase().includes('oil') || industryName.toLowerCase().includes('gas'))) {
        return {
          ...benchmark,
          fairPE: Math.min(benchmark.fairPE, 7.0),
          fairEvEbitda: Math.min(benchmark.fairEvEbitda, 4.5),
          requiredFcfYield: Math.max(benchmark.requiredFcfYield, 0.12)
        };
      }
      return benchmark;
    }
  }

  return DEFAULT_SECTOR_BENCHMARK;
}

/**
 * Obtiene el perfil de riesgo país según el código de país o si es ADR
 */
function getCountryRisk(countryCode?: string, isAdr?: boolean): CountryProfile {
  if (!countryCode) {
    return isAdr ? DEFAULT_EMERGING_PROFILE : COUNTRY_PROFILES['US'];
  }
  
  const normalized = countryCode.toUpperCase().trim();
  if (COUNTRY_PROFILES[normalized]) {
    return COUNTRY_PROFILES[normalized];
  }
  
  return DEFAULT_EMERGING_PROFILE;
}

/**
 * Calcula un Valor Justo (Fair Value) robusto, inmune a distorsiones de divisas / ADRs
 * y completamente calibrado por Sector, Industria y Geografía.
 */
export function calculateBlendedFairValue(asset: AssetData): BlendedValuationResult {
  const currentPrice = asset.quote?.price ?? 0;
  
  const emptyContext: ValuationContext = {
    sector: asset.profile?.sector || 'General',
    industry: asset.profile?.industry || 'General',
    country: asset.profile?.country || 'US',
    currency: asset.profile?.currency || 'USD',
    isAdr: Boolean(asset.profile?.isAdr),
    countryRiskPremiumPct: 0,
    valuationDiscountPct: 0,
    adjustedCostOfEquityPct: 9.5,
    benchmarkEvEbitda: 10,
    benchmarkPe: 15
  };

  if (currentPrice <= 0) {
    return { fairValue: null, modelsUsed: [], isAnomaly: false, spread: null, confidence: null, context: emptyContext };
  }

  // --- Parámetros de Calibración ---
  const sectorName = asset.profile?.sector || '';
  const industryName = asset.profile?.industry || '';
  const countryCode = asset.profile?.country || 'US';
  const isAdr = Boolean(asset.profile?.isAdr);
  const isStateOwned = /petrobras|ypf|ecopetrol|saudi|gazprom|rosneft|sinpec|petrochina/i.test(asset.profile?.companyName || '') ||
                       /petrobras|ypf|ecopetrol/i.test(asset.symbol || '');

  const sectorBenchmark = getSectorBenchmark(sectorName, industryName);
  const countryRisk = getCountryRisk(countryCode, isAdr);

  // Prima de riesgo país y descuento de valuación
  let countryRiskPremium = countryRisk.countryRiskPremium;
  let valuationDiscount = countryRisk.valuationDiscount;

  // Ajuste adicional para empresas estatales en emergentes (riesgo de gobernanza / dividendos)
  if (isStateOwned && countryCode !== 'US') {
    countryRiskPremium += 0.015; // +1.5% extra Ke
    valuationDiscount = Math.min(valuationDiscount + 0.08, 0.40); // Descuento de gobernanza
  }

  // Costo de capital ajustado por país y beta del activo
  const assetBeta = asset.profile?.beta && asset.profile.beta > 0.3 && asset.profile.beta < 3.0 ? asset.profile.beta : 1.0;
  const adjustedCostOfEquity = (sectorBenchmark.baseCostOfEquity + countryRiskPremium) * (0.7 + 0.3 * assetBeta);
  const adjustedFcfRequiredYield = (sectorBenchmark.requiredFcfYield + countryRiskPremium) * (0.8 + 0.2 * assetBeta);

  // Múltiplos calibrados por sector y descontados por riesgo geográfico
  const adjustedFairPe = Math.max(sectorBenchmark.fairPE * (1 - valuationDiscount), 4.0);
  const adjustedFairEvEbitda = sectorBenchmark.fairEvEbitda > 0 ? Math.max(sectorBenchmark.fairEvEbitda * (1 - valuationDiscount), 3.0) : 0;
  const adjustedFairPb = Math.max(sectorBenchmark.fairPB * (1 - valuationDiscount), 0.6);

  const context: ValuationContext = {
    sector: sectorName || 'General',
    industry: industryName || 'General',
    country: countryRisk.regionName,
    currency: asset.profile?.currency || 'USD',
    isAdr,
    countryRiskPremiumPct: countryRiskPremium * 100,
    valuationDiscountPct: valuationDiscount * 100,
    adjustedCostOfEquityPct: adjustedCostOfEquity * 100,
    benchmarkEvEbitda: adjustedFairEvEbitda,
    benchmarkPe: adjustedFairPe
  };

  // --- Helpers de Sanidad ---
  const isSane = (val: number, isAnalyst = false) => {
    if (isNaN(val) || !isFinite(val) || val <= 0) return false;
    if (isAnalyst) return true; // Wall Street consensus ya está en la moneda de cotización
    const ratio = val / currentPrice;
    // Rango aceptable: entre -75% y +150% del precio actual para evitar distorsiones absurdas
    return ratio > 0.25 && ratio < 2.50;
  };

  // Obtener ratios más recientes
  const latestRatios = asset.ratios && asset.ratios.length > 0
    ? [...asset.ratios].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
    : null;

  // Obtener estimaciones de analistas
  const latestEstimates = asset.analystEstimates && asset.analystEstimates.length > 0
    ? [...asset.analystEstimates].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
    : null;

  // Obtener métricas anuales ordenadas
  const sortedYearly = asset.keyMetricsYearly && asset.keyMetricsYearly.length > 0
    ? [...asset.keyMetricsYearly].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    : [];

  const models: ValuationModel[] = [];

  // ============================================================================
  // MODELO 1: Consenso de Analistas de Wall Street
  // Los analistas ya ajustan moneda, ADRs y riesgo soberano en su precio objetivo.
  // Peso: 1.6
  // ============================================================================
  if (asset.priceTargetConsensus?.targetConsensus) {
    const target = asset.priceTargetConsensus.targetConsensus;
    if (isSane(target, true)) {
      models.push({
        name: 'Consenso de Analistas',
        value: target,
        weight: 1.6,
        category: 'analyst',
        description: `Precio objetivo consenso de analistas (ajustado por moneda y riesgo)`
      });
    }
  } else if ((asset.priceTarget as any)?.targetConsensus) {
    const target = (asset.priceTarget as any).targetConsensus;
    if (isSane(target, true)) {
      models.push({
        name: 'Consenso de Analistas',
        value: target,
        weight: 1.6,
        category: 'analyst',
        description: `Precio objetivo consenso de analistas (ajustado por moneda y riesgo)`
      });
    }
  }

  // ============================================================================
  // MODELO 2: Multiplicador EV/EBITDA Calibrado por Sector & Geografía
  // Fórmula: FV = currentPrice × (Múltiplo Justo / Múltiplo Actual)
  // 100% Inmune a divisas (es un ratio adimensional).
  // Peso: 1.3
  // ============================================================================
  if (adjustedFairEvEbitda > 0 && asset.keyMetrics?.evToEBITDATTM && asset.keyMetrics.evToEBITDATTM > 0) {
    const actualEvEbitda = asset.keyMetrics.evToEBITDATTM;
    
    // Ajuste de calidad por ROE relativo al sector
    const currentRoe = asset.keyMetrics?.returnOnEquityTTM ?? sectorBenchmark.typicalRoe;
    const roeQualityMultiplier = currentRoe > 0 ? Math.min(Math.max(currentRoe / sectorBenchmark.typicalRoe, 0.75), 1.35) : 1.0;
    const targetEvEbitda = adjustedFairEvEbitda * roeQualityMultiplier;

    if (actualEvEbitda > 1.0 && actualEvEbitda < 80) {
      const evEbitdaFairValue = currentPrice * (targetEvEbitda / actualEvEbitda);
      if (isSane(evEbitdaFairValue)) {
        models.push({
          name: 'EV/EBITDA por Sector',
          value: evEbitdaFairValue,
          weight: 1.3,
          category: 'relative',
          description: `Múltiplo objetivo ${targetEvEbitda.toFixed(1)}x vs ${actualEvEbitda.toFixed(1)}x actual (Sector ${sectorName || 'General'} en ${countryRisk.regionName})`
        });
      }
    }
  }

  // ============================================================================
  // MODELO 3: Multiplicador P/E Calibrado por Sector & Geografía
  // Fórmula: FV = currentPrice × (P/E Justo / P/E Actual) = EPS_implícito × P/E Justo
  // Inmune a divisas y ADRs.
  // Peso: 1.2
  // ============================================================================
  const actualPe = latestRatios?.priceToEarningsRatio && latestRatios.priceToEarningsRatio > 0
    ? latestRatios.priceToEarningsRatio
    : (asset.keyMetrics?.earningsYieldTTM && asset.keyMetrics.earningsYieldTTM > 0 ? 1 / asset.keyMetrics.earningsYieldTTM : 0);

  if (actualPe > 1.0 && actualPe < 150) {
    // Ajustar P/E justo por crecimiento y ROE
    let targetPe = adjustedFairPe;
    const currentRoe = asset.keyMetrics?.returnOnEquityTTM ?? sectorBenchmark.typicalRoe;
    if (currentRoe > sectorBenchmark.typicalRoe * 1.3) targetPe *= 1.15;
    else if (currentRoe < sectorBenchmark.typicalRoe * 0.7) targetPe *= 0.85;

    // Ajuste por crecimiento estimado
    if (latestEstimates?.epsAvg && latestRatios?.netIncomePerShare && latestRatios.netIncomePerShare > 0) {
      const impliedGrowth = (latestEstimates.epsAvg - latestRatios.netIncomePerShare) / latestRatios.netIncomePerShare;
      if (impliedGrowth > 0.15) targetPe *= 1.10;
    }

    const peFairValue = currentPrice * (targetPe / actualPe);
    if (isSane(peFairValue)) {
      models.push({
        name: 'P/E Ajustado por Sector',
        value: peFairValue,
        weight: 1.2,
        category: 'relative',
        description: `P/E objetivo ${targetPe.toFixed(1)}x vs ${actualPe.toFixed(1)}x actual (${sectorName || 'Sector'})`
      });
    }
  }

  // ============================================================================
  // MODELO 4: Rendimiento FCF Yield Calibrado por Riesgo País & Beta
  // Fórmula: FV = currentPrice × (FCF Yield Actual / Yield Exigido)
  // Inmune a divisas y ADRs.
  // Peso: 1.1
  // ============================================================================
  const fcfYield = asset.keyMetrics?.freeCashFlowYieldTTM && asset.keyMetrics.freeCashFlowYieldTTM > 0
    ? asset.keyMetrics.freeCashFlowYieldTTM
    : (latestRatios?.priceToFreeCashFlowRatio && latestRatios.priceToFreeCashFlowRatio > 0 ? 1 / latestRatios.priceToFreeCashFlowRatio : 0);

  if (fcfYield > 0.01 && fcfYield < 0.60 && adjustedFcfRequiredYield > 0.02) {
    const fcfFairValue = currentPrice * (fcfYield / adjustedFcfRequiredYield);
    if (isSane(fcfFairValue)) {
      models.push({
        name: 'Rendimiento FCF Ajustado',
        value: fcfFairValue,
        weight: 1.1,
        category: 'intrinsic',
        description: `FCF Yield actual ${(fcfYield * 100).toFixed(1)}% vs ${(adjustedFcfRequiredYield * 100).toFixed(1)}% exigido por riesgo`
      });
    }
  }

  // ============================================================================
  // MODELO 5: Earnings Power Value (EPV) Inmune a Moneda
  // Fórmula: FV = currentPrice × (Earnings Yield / Costo de Capital WACC)
  // Mide el valor intrínseco de ganancias estables capitalizadas al costo de equity soberano.
  // Peso: 1.0
  // ============================================================================
  const earningsYield = asset.keyMetrics?.earningsYieldTTM && asset.keyMetrics.earningsYieldTTM > 0
    ? asset.keyMetrics.earningsYieldTTM
    : (actualPe > 0 ? 1 / actualPe : 0);

  if (earningsYield > 0.01 && earningsYield < 0.60 && adjustedCostOfEquity > 0.04) {
    const epvFairValue = currentPrice * (earningsYield / adjustedCostOfEquity);
    if (isSane(epvFairValue)) {
      models.push({
        name: 'Earnings Power Value (EPV)',
        value: epvFairValue,
        weight: 1.0,
        category: 'intrinsic',
        description: `Ganancias normalizadas capitalizadas a Ke ${(adjustedCostOfEquity * 100).toFixed(1)}% (Riesgo ${countryRisk.regionName})`
      });
    }
  }

  // ============================================================================
  // MODELO 6: Residual Income (Edwards-Bell-Ohlson) Adimensional
  // Fórmula: FV = currentPrice × [1 + (ROE - Ke) / (Ke - g)] / actualPB
  // Mide el valor de mercado derivado de la creación de valor económico sobre capital contable.
  // Peso: 0.95
  // ============================================================================
  const actualPb = latestRatios?.priceToBookRatio && latestRatios.priceToBookRatio > 0
    ? latestRatios.priceToBookRatio
    : (asset.rating?.priceToBookScore ? 1.0 : 0);

  const roe = asset.keyMetrics?.returnOnEquityTTM ?? latestRatios?.returnOnEquity;

  if (actualPb > 0.2 && actualPb < 25 && roe && roe > 0.02 && roe < 1.0) {
    const payoutRatio = latestRatios?.dividendPayoutRatio ?? 0.4;
    const retentionRate = Math.max(0, Math.min(1, 1 - payoutRatio));
    const g = Math.min(roe * retentionRate, sectorBenchmark.maxPerpetualGrowth);
    const ke = adjustedCostOfEquity;

    if (ke > g) {
      const economicSpread = roe - ke;
      const targetPb = 1 + economicSpread / (ke - g);
      if (targetPb > 0.2 && targetPb < 15) {
        const riFairValue = currentPrice * (targetPb / actualPb);
        if (isSane(riFairValue)) {
          models.push({
            name: 'Ingreso Residual (EBO)',
            value: riFairValue,
            weight: 0.95,
            category: 'intrinsic',
            description: `P/B teórico ${targetPb.toFixed(2)}x vs ${actualPb.toFixed(2)}x (ROE ${(roe * 100).toFixed(1)}% vs Ke ${(ke * 100).toFixed(1)}%)`
          });
        }
      }
    }
  }

  // ============================================================================
  // MODELO 7: Descuento de Dividendos (Gordon Growth Model) Inmune a Moneda
  // Fórmula: FV = currentPrice × [Dividend Yield × (1 + g) / (Ke - g)]
  // Solo aplica para empresas pagadoras de dividendos.
  // Peso: 0.8
  // ============================================================================
  const dividendYield = latestRatios?.dividendYield && latestRatios.dividendYield > 0
    ? latestRatios.dividendYield
    : (asset.profile?.lastDividend && asset.profile.lastDividend > 0 && currentPrice > 0 ? asset.profile.lastDividend / currentPrice : 0);

  if (dividendYield > 0.015 && dividendYield < 0.35) {
    const roeVal = roe && roe > 0 ? roe : sectorBenchmark.typicalRoe;
    const payout = latestRatios?.dividendPayoutRatio ?? 0.5;
    const g = Math.min(Math.max(roeVal * (1 - payout), 0.01), sectorBenchmark.maxPerpetualGrowth);
    const ke = adjustedCostOfEquity;

    if (ke > g) {
      const ddmFairValue = currentPrice * (dividendYield * (1 + g) / (ke - g));
      if (isSane(ddmFairValue)) {
        models.push({
          name: 'Descuento de Dividendos (DDM)',
          value: ddmFairValue,
          weight: 0.8,
          category: 'intrinsic',
          description: `Yield ${(dividendYield * 100).toFixed(1)}% proyectado a tasa g ${(g * 100).toFixed(1)}% descontado a ${(ke * 100).toFixed(1)}%`
        });
      }
    }
  }

  // ============================================================================
  // MODELO 8: Peter Lynch PEG Fair Value Normalizado
  // Fórmula: FV = currentPrice × (Tasa de Crecimiento % / P/E Actual)
  // Con límite máximo de PEG según sector.
  // Peso: 0.75
  // ============================================================================
  if (actualPe > 3.0 && actualPe < 60 && sortedYearly.length >= 2) {
    const recentYear = sortedYearly[0];
    const olderYear = sortedYearly[Math.min(sortedYearly.length - 1, 3)];

    if (recentYear.earningsYield && olderYear.earningsYield && olderYear.earningsYield > 0 && recentYear.earningsYield > 0) {
      const yearsApart = Math.max(1, (new Date(recentYear.date).getTime() - new Date(olderYear.date).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      const growthRate = Math.pow(recentYear.earningsYield / olderYear.earningsYield, 1 / yearsApart) - 1;

      if (growthRate > 0.03 && growthRate < 0.40) {
        const growthPct = growthRate * 100;
        // PEG justo = 1.0 para US tech, 0.75 - 0.85 para emergentes / cíclicas
        const targetPeg = 1.0 * (1 - valuationDiscount * 0.5);
        const pegFairValue = currentPrice * ((growthPct * targetPeg) / actualPe);

        if (isSane(pegFairValue)) {
          models.push({
            name: 'PEG de Peter Lynch',
            value: pegFairValue,
            weight: 0.75,
            category: 'relative',
            description: `Crecimiento anual ${(growthPct).toFixed(1)}% vs P/E ${actualPe.toFixed(1)}x (PEG Objetivo ${targetPeg.toFixed(2)})`
          });
        }
      }
    }
  }

  // ============================================================================
  // MODELO 9: DCF de la API (solo si está en la misma moneda o validado)
  // ============================================================================
  let dcfVal: number | null = null;
  const levered = asset.dcfLevered as { equityValuePerShare?: number; dcf?: number } | undefined;
  if (levered) {
    if (typeof levered.equityValuePerShare === 'number') dcfVal = levered.equityValuePerShare;
    else if (typeof levered.dcf === 'number') dcfVal = levered.dcf;
  }

  // Solo incluir DCF nominal si es para activos de US o si está en rango estricto
  if (dcfVal !== null && !isAdr && isSane(dcfVal)) {
    models.push({
      name: 'DCF Apalancado',
      value: dcfVal,
      weight: 1.0,
      category: 'intrinsic',
      description: 'Flujo de caja descontado proyectado con WACC'
    });
  }

  // --- Promedio Ponderado Final ---

  if (models.length === 0) {
    // Si no hay modelos válidos, devolver null seguro
    return {
      fairValue: null,
      modelsUsed: [],
      isAnomaly: true,
      spread: null,
      confidence: null,
      context
    };
  }

  // Filtrar outliers con IQR si hay 4 o más modelos
  let filteredModels = [...models];
  if (models.length >= 4) {
    const values = models.map(m => m.value).sort((a, b) => a - b);
    const q1 = values[Math.floor(values.length * 0.25)];
    const q3 = values[Math.floor(values.length * 0.75)];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    const nonOutliers = models.filter(m => m.value >= lowerBound && m.value <= upperBound);
    if (nonOutliers.length >= Math.ceil(models.length * 0.5)) {
      filteredModels = nonOutliers;
    }
  }

  let totalWeight = 0;
  let weightedSum = 0;

  for (const model of filteredModels) {
    totalWeight += model.weight;
    weightedSum += model.value * model.weight;
  }

  const fairValue = weightedSum / totalWeight;
  const spread = ((fairValue - currentPrice) / currentPrice) * 100;

  // Determinar nivel de confianza
  let confidence: 'alta' | 'media' | 'baja';
  const categories = new Set(filteredModels.map(m => m.category));
  if (filteredModels.length >= 5 && categories.size >= 3) {
    confidence = 'alta';
  } else if (filteredModels.length >= 3) {
    confidence = 'media';
  } else {
    confidence = 'baja';
  }

  return {
    fairValue,
    modelsUsed: filteredModels,
    isAnomaly: false,
    spread,
    confidence,
    context
  };
}
