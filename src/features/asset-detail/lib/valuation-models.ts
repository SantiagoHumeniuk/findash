// src/features/asset-detail/lib/valuation-models.ts

import type { AssetAnalystEstimates, AssetData, AssetPeerValuation } from '../../../types/dashboard';
import type { RiskPremiumData } from '../../risk-premium/types/risk-premium.types';

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
  forwardEpsGrowthPct: number | null;
  epsAnalystCount: number;
}

export interface BlendedValuationResult {
  fairValue: number | null;
  fairValueRange: { low: number; high: number } | null;
  modelsUsed: ValuationModel[];
  isAnomaly: boolean;
  spread: number | null; // percentage difference from price
  context: ValuationContext;
}

export interface BusinessProfile {
  typeLabel: string;
  riskLevel: 'bajo' | 'moderado' | 'alto';
  description: string;
  riskFactors: string[];
}

function weightedQuantile(models: ValuationModel[], quantile: number): number {
  const sorted = [...models].sort((left, right) => left.value - right.value);
  const totalWeight = sorted.reduce((sum, model) => sum + model.weight, 0);
  const targetWeight = totalWeight * quantile;
  let accumulatedWeight = 0;

  for (const model of sorted) {
    accumulatedWeight += model.weight;
    if (accumulatedWeight >= targetWeight) return model.value;
  }

  return sorted[sorted.length - 1]?.value ?? 0;
}

// ============================================================================
// CONFIGURACIÓN DE SECTOR E INDUSTRIA (Benchmarks de Mercado Calibrados)
// ============================================================================

interface SectorBenchmark {
  fairPE: number;             // Múltiplo P/E base justo
  fairEvEbitda: number;       // Múltiplo EV/EBITDA base justo (0 si no aplica, ej. Bancos)
  fairEvEbit: number;
  fairEvSales: number;
  fairPS: number;
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
    fairEvEbit: 7.0,
    fairEvSales: 1.2,
    fairPS: 0.9,
    fairPB: 1.1,
    requiredFcfYield: 0.11, // 11% FCF yield exigido por ciclicidad y transición energética
    baseCostOfEquity: 0.115,
    typicalRoe: 0.12,
    maxPerpetualGrowth: 0.02
  },
  'Basic Materials': {
    fairPE: 9.0,
    fairEvEbitda: 5.8,
    fairEvEbit: 8.0,
    fairEvSales: 2.0,
    fairPS: 1.5,
    fairPB: 1.3,
    requiredFcfYield: 0.095,
    baseCostOfEquity: 0.110,
    typicalRoe: 0.11,
    maxPerpetualGrowth: 0.025
  },
  'Financial Services': {
    fairPE: 9.5,
    fairEvEbitda: 0, // No aplica EV/EBITDA a bancos por depósitos y pasivos operativos
    fairEvEbit: 0,
    fairEvSales: 0,
    fairPS: 1.8,
    fairPB: 1.1,
    requiredFcfYield: 0, // No aplica FCF tradicional
    baseCostOfEquity: 0.110,
    typicalRoe: 0.13,
    maxPerpetualGrowth: 0.03
  },
  'Financial': {
    fairPE: 9.5,
    fairEvEbitda: 0,
    fairEvEbit: 0,
    fairEvSales: 0,
    fairPS: 1.8,
    fairPB: 1.1,
    requiredFcfYield: 0,
    baseCostOfEquity: 0.110,
    typicalRoe: 0.13,
    maxPerpetualGrowth: 0.03
  },
  'Technology': {
    fairPE: 24.0,
    fairEvEbitda: 17.5,
    fairEvEbit: 20.0,
    fairEvSales: 6.5,
    fairPS: 6.5,
    fairPB: 4.5,
    requiredFcfYield: 0.045,
    baseCostOfEquity: 0.090,
    typicalRoe: 0.20,
    maxPerpetualGrowth: 0.038
  },
  'Utilities': {
    fairPE: 13.5,
    fairEvEbitda: 8.5,
    fairEvEbit: 12.0,
    fairEvSales: 4.0,
    fairPS: 2.0,
    fairPB: 1.4,
    requiredFcfYield: 0.065,
    baseCostOfEquity: 0.085,
    typicalRoe: 0.095,
    maxPerpetualGrowth: 0.02
  },
  'Communication Services': {
    fairPE: 15.0,
    fairEvEbitda: 7.5,
    fairEvEbit: 10.0,
    fairEvSales: 3.0,
    fairPS: 2.3,
    fairPB: 2.0,
    requiredFcfYield: 0.070,
    baseCostOfEquity: 0.095,
    typicalRoe: 0.13,
    maxPerpetualGrowth: 0.025
  },
  'Consumer Cyclical': {
    fairPE: 15.5,
    fairEvEbitda: 9.5,
    fairEvEbit: 12.0,
    fairEvSales: 2.2,
    fairPS: 1.8,
    fairPB: 2.5,
    requiredFcfYield: 0.065,
    baseCostOfEquity: 0.100,
    typicalRoe: 0.15,
    maxPerpetualGrowth: 0.028
  },
  'Consumer Discretionary': {
    fairPE: 15.5,
    fairEvEbitda: 9.5,
    fairEvEbit: 12.0,
    fairEvSales: 2.2,
    fairPS: 1.8,
    fairPB: 2.5,
    requiredFcfYield: 0.065,
    baseCostOfEquity: 0.100,
    typicalRoe: 0.15,
    maxPerpetualGrowth: 0.028
  },
  'Consumer Defensive': {
    fairPE: 17.5,
    fairEvEbitda: 11.5,
    fairEvEbit: 14.0,
    fairEvSales: 2.5,
    fairPS: 2.0,
    fairPB: 3.0,
    requiredFcfYield: 0.055,
    baseCostOfEquity: 0.085,
    typicalRoe: 0.16,
    maxPerpetualGrowth: 0.025
  },
  'Healthcare': {
    fairPE: 18.5,
    fairEvEbitda: 13.0,
    fairEvEbit: 16.0,
    fairEvSales: 4.0,
    fairPS: 3.5,
    fairPB: 3.2,
    requiredFcfYield: 0.055,
    baseCostOfEquity: 0.090,
    typicalRoe: 0.15,
    maxPerpetualGrowth: 0.03
  },
  'Industrials': {
    fairPE: 16.0,
    fairEvEbitda: 10.5,
    fairEvEbit: 13.0,
    fairEvSales: 2.5,
    fairPS: 2.0,
    fairPB: 2.7,
    requiredFcfYield: 0.060,
    baseCostOfEquity: 0.095,
    typicalRoe: 0.14,
    maxPerpetualGrowth: 0.025
  },
  'Real Estate': {
    fairPE: 16.0, // P/FFO proxy
    fairEvEbitda: 14.0,
    fairEvEbit: 0,
    fairEvSales: 0,
    fairPS: 0,
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
  fairEvEbit: 12.0,
  fairEvSales: 2.0,
  fairPS: 2.0,
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

const DEFAULT_UNKNOWN_COUNTRY_PROFILE: CountryProfile = {
  countryRiskPremium: 0.02,
  valuationDiscount: 0.10,
  regionName: 'País no informado'
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
function getCountryRisk(
  countryCode?: string,
  isAdr?: boolean,
  riskPremiumData: RiskPremiumData[] = [],
): CountryProfile {
  if (!countryCode) {
    return isAdr ? DEFAULT_EMERGING_PROFILE : DEFAULT_UNKNOWN_COUNTRY_PROFILE;
  }
  
  const normalized = countryCode.toUpperCase().trim();
  const fallbackProfile = COUNTRY_PROFILES[normalized] ?? DEFAULT_EMERGING_PROFILE;
  const countryName = getCountryName(countryCode);
  const riskPremium = riskPremiumData.find((entry) =>
    normalizeCountryName(entry.country) === normalizeCountryName(countryName)
  );

  if (!riskPremium || !Number.isFinite(riskPremium.countryRiskPremium) || riskPremium.countryRiskPremium < 0) {
    return fallbackProfile;
  }

  return {
    ...fallbackProfile,
    countryRiskPremium: riskPremium.countryRiskPremium / 100,
    regionName: riskPremium.country,
  };
}

function getEvBasedFairValue(
  currentPrice: number,
  actualMultiple: number,
  targetMultiple: number,
  enterpriseValue: number,
  marketCap: number,
): number {
  if (enterpriseValue > 0 && marketCap > 0) {
    const sharesOutstanding = marketCap / currentPrice;
    const targetEnterpriseValue = enterpriseValue * (targetMultiple / actualMultiple);
    return (marketCap + targetEnterpriseValue - enterpriseValue) / sharesOutstanding;
  }

  return currentPrice * (targetMultiple / actualMultiple);
}

function getDiscountedForecastEvValue(
  currentPrice: number,
  forecastMetric: number,
  targetMultiple: number,
  enterpriseValue: number,
  marketCap: number,
  forecastYears: number,
  costOfCapital: number,
): number {
  if (currentPrice <= 0 || forecastMetric <= 0 || targetMultiple <= 0 || enterpriseValue <= 0 || marketCap <= 0) return 0;

  const sharesOutstanding = marketCap / currentPrice;
  const netDebt = enterpriseValue - marketCap;
  const presentEnterpriseValue = forecastMetric * targetMultiple / Math.pow(1 + costOfCapital, forecastYears);
  return (presentEnterpriseValue - netDebt) / sharesOutstanding;
}

function getDiscountedForecastPsValue(
  currentPrice: number,
  forecastRevenue: number,
  targetMultiple: number,
  marketCap: number,
  forecastYears: number,
  costOfEquity: number,
): number {
  if (currentPrice <= 0 || forecastRevenue <= 0 || targetMultiple <= 0 || marketCap <= 0) return 0;

  const sharesOutstanding = marketCap / currentPrice;
  return forecastRevenue * targetMultiple / sharesOutstanding / Math.pow(1 + costOfEquity, forecastYears);
}

interface PeerMedian {
  value: number | null;
  count: number;
}

function getPeerMedian(
  peers: AssetPeerValuation[],
  metric: keyof AssetPeerValuation,
  minValue: number,
  maxValue: number,
): PeerMedian {
  const values = peers
    .map((peer) => peer[metric])
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value >= minValue && value <= maxValue)
    .sort((left, right) => left - right);

  if (values.length < 3) return { value: null, count: values.length };
  const middle = Math.floor(values.length / 2);
  const value = values.length % 2 === 0
    ? (values[middle - 1] + values[middle]) / 2
    : values[middle];

  return { value, count: values.length };
}

function normalizeCountryName(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '');
}

function getCountryName(countryCodeOrName: string): string {
  const normalized = countryCodeOrName.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return countryCodeOrName;

  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(normalized) ?? countryCodeOrName;
  } catch {
    return countryCodeOrName;
  }
}

export function classifyBusinessProfile(asset: AssetData, context: ValuationContext): BusinessProfile {
  const sector = `${asset.profile?.sector ?? ''} ${asset.profile?.industry ?? ''}`;
  const isFinancial = /financial|bank|credit|fintech|payment|consumer finance/i.test(sector);
  const beta = asset.profile?.beta > 0 ? asset.profile.beta : null;
  const netDebtToEbitda = asset.keyMetrics?.netDebtToEBITDATTM;
  const roe = asset.keyMetrics?.returnOnEquityTTM;
  const forwardGrowth = context.forwardEpsGrowthPct;
  const riskFactors: string[] = [];
  let severeRisk = false;

  if (beta !== null && beta >= 1.5) {
    riskFactors.push(`volatilidad de mercado elevada (beta ${beta.toFixed(2)})`);
    severeRisk ||= beta >= 2;
  }
  if (context.countryRiskPremiumPct >= 4) {
    riskFactors.push(`riesgo país alto (${context.countryRiskPremiumPct.toFixed(1)}%)`);
    severeRisk ||= context.countryRiskPremiumPct >= 7;
  }
  if (!isFinancial && Number.isFinite(netDebtToEbitda) && netDebtToEbitda >= 3) {
    riskFactors.push(`deuda neta elevada (${netDebtToEbitda.toFixed(1)}x EBITDA)`);
    severeRisk ||= netDebtToEbitda >= 5;
  }
  if (Number.isFinite(roe) && roe < 0) {
    riskFactors.push('rentabilidad sobre patrimonio negativa');
    severeRisk ||= roe <= -0.05;
  }
  if (forwardGrowth !== null && forwardGrowth >= 30) {
    riskFactors.push(`crecimiento esperado alto (${forwardGrowth.toFixed(0)}%), con mayor incertidumbre`);
  }

  const riskLevel = severeRisk || riskFactors.length >= 2
    ? 'alto'
    : riskFactors.length === 0 && beta !== null && beta <= 1 && Number.isFinite(roe) && roe >= 0.1
      && context.countryRiskPremiumPct <= 2
      ? 'bajo'
      : 'moderado';

  let typeLabel = 'Empresa de perfil general';
  if (isFinancial && forwardGrowth !== null && forwardGrowth >= 25) {
    typeLabel = 'Financiera de alto crecimiento';
  } else if (isFinancial) {
    typeLabel = 'Entidad financiera';
  } else if (forwardGrowth !== null && forwardGrowth >= 25) {
    typeLabel = 'Empresa de alto crecimiento';
  } else if (/utilities|consumer defensive/i.test(sector)) {
    typeLabel = 'Negocio defensivo';
  } else if (/energy|basic materials|consumer cyclical|consumer discretionary/i.test(sector)) {
    typeLabel = 'Negocio cíclico';
  } else if (/real estate|industrial/i.test(sector)) {
    typeLabel = 'Negocio intensivo en activos';
  } else if ((asset.profile?.marketCap ?? asset.quote?.marketCap ?? 0) >= 10_000_000_000
    && Number.isFinite(roe) && roe >= 0.1 && beta !== null && beta <= 1.1 && riskLevel === 'bajo') {
    typeLabel = 'Empresa consolidada y rentable';
  }

  const descriptions: Record<string, string> = {
    'Financiera de alto crecimiento': 'Crecimiento estimado elevado en una entidad financiera; puede combinar expansión rápida con mayor volatilidad y riesgo de ejecución.',
    'Entidad financiera': 'La solidez depende especialmente de la calidad crediticia, la capitalización regulatoria y la gestión de depósitos; la deuda/EBITDA no es comparable con otros sectores.',
    'Empresa de alto crecimiento': 'Las estimaciones apuntan a una expansión acelerada; suele haber más incertidumbre sobre la ejecución y la valoración.',
    'Negocio defensivo': 'Opera en un sector con demanda relativamente estable; aun así, el riesgo depende de su balance, rentabilidad y país.',
    'Negocio cíclico': 'Sus resultados pueden variar con el ciclo económico, los precios de materias primas o el gasto discrecional.',
    'Negocio intensivo en activos': 'La generación de valor depende en gran medida de activos, inversión y condiciones de financiación.',
    'Empresa consolidada y rentable': 'Combina gran escala, rentabilidad positiva y señales de volatilidad y riesgo país acotados.',
    'Empresa de perfil general': 'No hay señales suficientes para asignar un perfil sectorial más específico; el nivel de riesgo refleja los indicadores disponibles.',
  };

  return {
    typeLabel,
    riskLevel,
    description: descriptions[typeLabel],
    riskFactors,
  };
}

/**
 * Calcula un Valor Justo (Fair Value) robusto, inmune a distorsiones de divisas / ADRs
 * y completamente calibrado por Sector, Industria y Geografía.
 */
export function calculateBlendedFairValue(
  asset: AssetData,
  riskPremiumData: RiskPremiumData[] = [],
): BlendedValuationResult {
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
    benchmarkPe: 15,
    forwardEpsGrowthPct: null,
    epsAnalystCount: 0,
  };

  if (currentPrice <= 0) {
    return { fairValue: null, fairValueRange: null, modelsUsed: [], isAnomaly: false, spread: null, context: emptyContext };
  }

  // --- Parámetros de Calibración ---
  const sectorName = asset.profile?.sector || '';
  const industryName = asset.profile?.industry || '';
  const countryCode = asset.profile?.country || '';
  const isFinancialCompany = /financial|bank|credit|fintech|payment|consumer finance/i.test(
    `${sectorName} ${industryName}`
  );
  const isAdr = Boolean(asset.profile?.isAdr);
  const isStateOwned = /petrobras|ypf|ecopetrol|saudi|gazprom|rosneft|sinpec|petrochina/i.test(asset.profile?.companyName || '') ||
                       /petrobras|ypf|ecopetrol/i.test(asset.symbol || '');

  const sectorBenchmark = getSectorBenchmark(sectorName, industryName);
  const countryRisk = getCountryRisk(countryCode, isAdr, riskPremiumData);

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
  const adjustedFairEvEbit = sectorBenchmark.fairEvEbit > 0 ? Math.max(sectorBenchmark.fairEvEbit * (1 - valuationDiscount), 4.0) : 0;
  const adjustedFairEvSales = sectorBenchmark.fairEvSales > 0 ? Math.max(sectorBenchmark.fairEvSales * (1 - valuationDiscount), 0.5) : 0;
  const adjustedFairPS = sectorBenchmark.fairPS > 0 ? Math.max(sectorBenchmark.fairPS * (1 - valuationDiscount), 0.5) : 0;
  const peers = asset.peerValuations ?? [];
  const peerPe = getPeerMedian(peers, 'priceToEarningsRatio', 1, 100);
  const peerPb = getPeerMedian(peers, 'priceToBookRatio', 0.1, 30);
  const peerPs = getPeerMedian(peers, 'priceToSalesRatio', 0.1, 100);
  const peerEvEbitda = getPeerMedian(peers, 'evToEBITDA', 0.5, 100);
  const peerEvEbit = getPeerMedian(peers, 'evToEBIT', 0.5, 200);
  const peerEvSales = getPeerMedian(peers, 'evToSales', 0.1, 100);
  const peerEbitMargin = getPeerMedian(peers, 'ebitMargin', 0.005, 0.8);
  const currentEbitMargin = asset.ratios?.length
    ? [...asset.ratios]
      .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())[0]?.ebitMargin ?? 0
    : 0;
  const salesMarginAdjustment = currentEbitMargin > 0 && peerEbitMargin.value
    ? Math.min(Math.max(currentEbitMargin / peerEbitMargin.value, 0.75), 1.5)
    : 1;
  const fairPeBenchmark = peerPe.value ?? adjustedFairPe;
  const fairPbBenchmark = peerPb.value ?? sectorBenchmark.fairPB * (1 - valuationDiscount);
  const fairPsBenchmark = (peerPs.value ?? adjustedFairPS) * salesMarginAdjustment;
  const fairEvEbitdaBenchmark = peerEvEbitda.value ?? adjustedFairEvEbitda;
  const fairEvEbitBenchmark = peerEvEbit.value ?? adjustedFairEvEbit;
  const fairEvSalesBenchmark = (peerEvSales.value ?? adjustedFairEvSales) * salesMarginAdjustment;
  const benchmarkSource = (peer: PeerMedian) => peer.value !== null
    ? `mediana FMP de ${peer.count} pares`
    : 'benchmark de sector';
  const context: ValuationContext = {
    sector: sectorName || 'General',
    industry: industryName || 'General',
    country: countryRisk.regionName,
    currency: asset.profile?.currency || 'USD',
    isAdr,
    countryRiskPremiumPct: countryRiskPremium * 100,
    valuationDiscountPct: valuationDiscount * 100,
    adjustedCostOfEquityPct: adjustedCostOfEquity * 100,
    benchmarkEvEbitda: fairEvEbitdaBenchmark,
    benchmarkPe: fairPeBenchmark,
    forwardEpsGrowthPct: null,
    epsAnalystCount: 0,
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

  const sortedFutureEstimates = asset.analystEstimates && asset.analystEstimates.length > 0
    ? [...asset.analystEstimates]
      .filter((estimate) => new Date(estimate.date).getTime() >= Date.now())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    : [];
  const findNearestEstimate = (hasValue: (estimate: AssetAnalystEstimates) => boolean) =>
    sortedFutureEstimates.find(hasValue) ?? null;
  const forwardEstimates = findNearestEstimate((estimate) => estimate.epsAvg > 0);
  const forwardRevenueEstimates = findNearestEstimate((estimate) => estimate.revenueAvg > 0);
  const forwardEbitdaEstimates = findNearestEstimate((estimate) => estimate.ebitdaAvg > 0);
  const forwardEbitEstimates = findNearestEstimate((estimate) => estimate.ebitAvg > 0);
  const currentEps = latestRatios?.netIncomePerShare;
  const rawForwardEpsGrowth = currentEps && currentEps > 0 && forwardEstimates
    ? (forwardEstimates.epsAvg / currentEps) - 1
    : null;
  const forwardEpsGrowthPct = rawForwardEpsGrowth !== null && Number.isFinite(rawForwardEpsGrowth)
    ? rawForwardEpsGrowth * 100
    : null;
  const epsAnalystCount = forwardEstimates?.numAnalystsEps ?? 0;
  context.forwardEpsGrowthPct = forwardEpsGrowthPct;
  context.epsAnalystCount = epsAnalystCount;

  const models: ValuationModel[] = [];
  const currentMarketCap = asset.keyMetrics?.marketCap || asset.quote?.marketCap || asset.profile?.marketCap || 0;
  const currentEnterpriseValue = asset.keyMetrics?.enterpriseValueTTM ?? 0;
  const rawDcfWacc = asset.dcf?.find((projection) => projection.wacc > 0)?.wacc;
  const dcfWacc = rawDcfWacc && rawDcfWacc > 1 ? rawDcfWacc / 100 : rawDcfWacc;
  const hasDcfWacc = Boolean(dcfWacc && dcfWacc > 0.02 && dcfWacc < 0.5);
  const adjustedCostOfCapital = hasDcfWacc
    ? dcfWacc + countryRiskPremium
    : adjustedCostOfEquity;
  const enterpriseDiscountLabel = hasDcfWacc ? 'WACC' : 'Ke (proxy)';
  const reportingCurrency = latestRatios?.reportedCurrency?.trim().toUpperCase();
  const quoteCurrency = asset.profile?.currency?.trim().toUpperCase();
  const hasComparableCurrency = Boolean(reportingCurrency && quoteCurrency && reportingCurrency === quoteCurrency);
  const estimateWeight = (forwardRevenueEstimates?.numAnalystsRevenue ?? 0) >= 5 ? 0.55 : 0.35;
  const forecastYears = (date: string) => Math.max((new Date(date).getTime() - Date.now()) / (365.25 * 24 * 60 * 60 * 1000), 0);

  if (hasComparableCurrency && forwardRevenueEstimates && fairPsBenchmark > 0) {
    const years = forecastYears(forwardRevenueEstimates.date);
    const value = getDiscountedForecastPsValue(
      currentPrice,
      forwardRevenueEstimates.revenueAvg,
      fairPsBenchmark,
      currentMarketCap,
      years,
      adjustedCostOfEquity,
    );
    if (isSane(value)) {
      models.push({
        name: 'P/S Forward por ventas estimadas',
        value,
        weight: estimateWeight,
        category: 'relative',
        description: `Ventas estimadas ${new Date(forwardRevenueEstimates.date).getFullYear()} × P/S objetivo ${fairPsBenchmark.toFixed(1)}x (${benchmarkSource(peerPs)}; margen EBIT ajustado ${salesMarginAdjustment.toFixed(2)}x), descontado a Ke ${(adjustedCostOfEquity * 100).toFixed(1)}%`
      });
    }
  }

  if (hasComparableCurrency && !isFinancialCompany && currentEnterpriseValue > 0 && currentMarketCap > 0) {
    const forwardEvModels = [
      {
        estimate: forwardRevenueEstimates,
        metric: forwardRevenueEstimates?.revenueAvg ?? 0,
        targetMultiple: fairEvSalesBenchmark,
        name: 'EV/Ventas Forward por consenso',
        label: 'ventas',
        peer: peerEvSales,
        marginAdjustment: salesMarginAdjustment
      },
      {
        estimate: forwardEbitdaEstimates,
        metric: forwardEbitdaEstimates?.ebitdaAvg ?? 0,
        targetMultiple: fairEvEbitdaBenchmark,
        name: 'EV/EBITDA Forward por consenso',
        label: 'EBITDA',
        peer: peerEvEbitda,
        marginAdjustment: 1
      },
      {
        estimate: forwardEbitEstimates,
        metric: forwardEbitEstimates?.ebitAvg ?? 0,
        targetMultiple: fairEvEbitBenchmark,
        name: 'EV/EBIT Forward por consenso',
        label: 'EBIT',
        peer: peerEvEbit,
        marginAdjustment: 1
      },
    ];

    for (const forwardModel of forwardEvModels) {
      if (!forwardModel.estimate || forwardModel.metric <= 0 || forwardModel.targetMultiple <= 0) continue;
      const years = forecastYears(forwardModel.estimate.date);
      const value = getDiscountedForecastEvValue(
        currentPrice,
        forwardModel.metric,
        forwardModel.targetMultiple,
        currentEnterpriseValue,
        currentMarketCap,
        years,
        adjustedCostOfCapital,
      );
      if (isSane(value)) {
        models.push({
          name: forwardModel.name,
          value,
          weight: estimateWeight,
          category: 'relative',
          description: `${forwardModel.label} estimado ${new Date(forwardModel.estimate.date).getFullYear()} × múltiplo objetivo ${forwardModel.targetMultiple.toFixed(1)}x (${benchmarkSource(forwardModel.peer)}${forwardModel.marginAdjustment !== 1 ? `; margen EBIT ajustado ${forwardModel.marginAdjustment.toFixed(2)}x` : ''}); deuda neta actual y descuento a ${enterpriseDiscountLabel} ${(adjustedCostOfCapital * 100).toFixed(1)}%`
        });
      }
    }
  }

  // ============================================================================
  // MODELO 1: Consenso de Analistas de Wall Street
  // Los analistas ya ajustan moneda, ADRs y riesgo soberano en su precio objetivo.
  // El target es una referencia de sentimiento, no un modelo intrínseco.
  // Se mantiene con influencia baja porque los modelos de DCF/múltiplos llevan el peso principal.
  // ============================================================================
  if (asset.priceTargetConsensus?.targetConsensus) {
    const target = asset.priceTargetConsensus.targetConsensus;
    if (isSane(target, true)) {
      models.push({
        name: 'Consenso de Analistas',
        value: target,
        weight: 0.25,
        category: 'analyst',
        description: `Precio objetivo consenso de analistas (ajustado por moneda y riesgo)`
      });
    }
  } else {
    const legacyConsensusTarget = (asset.priceTarget as unknown as { targetConsensus?: unknown } | undefined)?.targetConsensus;
    if (typeof legacyConsensusTarget === 'number' && isSane(legacyConsensusTarget, true)) {
      models.push({
        name: 'Consenso de Analistas',
        value: legacyConsensusTarget,
        weight: 0.25,
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
  if (fairEvEbitdaBenchmark > 0 && asset.keyMetrics?.evToEBITDATTM && asset.keyMetrics.evToEBITDATTM > 0) {
    const actualEvEbitda = asset.keyMetrics.evToEBITDATTM;
    
    // Ajuste de calidad por ROE relativo al sector
    const currentRoe = asset.keyMetrics?.returnOnEquityTTM ?? sectorBenchmark.typicalRoe;
    const roeQualityMultiplier = currentRoe > 0 ? Math.min(Math.max(currentRoe / sectorBenchmark.typicalRoe, 0.75), 1.35) : 1.0;
    const targetEvEbitda = fairEvEbitdaBenchmark * roeQualityMultiplier;

    if (actualEvEbitda > 1.0 && actualEvEbitda < 80) {
      const marketCap = asset.keyMetrics?.marketCap || asset.quote?.marketCap || 0;
      const evEbitdaFairValue = getEvBasedFairValue(
        currentPrice,
        actualEvEbitda,
        targetEvEbitda,
        asset.keyMetrics?.enterpriseValueTTM ?? 0,
        marketCap,
      );
      if (isSane(evEbitdaFairValue)) {
        models.push({
          name: peerEvEbitda.value !== null ? 'EV/EBITDA por Pares FMP' : 'EV/EBITDA por Sector',
          value: evEbitdaFairValue,
          weight: 1.3,
          category: 'relative',
          description: `Múltiplo objetivo ${targetEvEbitda.toFixed(1)}x vs ${actualEvEbitda.toFixed(1)}x actual (${benchmarkSource(peerEvEbitda)}; ${sectorName || 'Sector'}, ${countryRisk.regionName})`
        });
      }
    }
  }

  const actualPs = latestRatios?.priceToSalesRatio;
  if (fairPsBenchmark > 0 && actualPs && actualPs > 0.1 && actualPs < 100) {
    const psFairValue = currentPrice * (fairPsBenchmark / actualPs);
    if (isSane(psFairValue)) {
      models.push({
        name: peerPs.value !== null ? 'Precio/Ventas por Pares FMP' : 'Precio/Ventas por Sector',
        value: psFairValue,
        weight: 0.65,
        category: 'relative',
        description: `P/S objetivo ${fairPsBenchmark.toFixed(1)}x vs ${actualPs.toFixed(1)}x actual (${benchmarkSource(peerPs)}; margen EBIT ajustado ${salesMarginAdjustment.toFixed(2)}x; ${sectorName || 'Sector'})`
      });
    }
  }

  const actualEvSales = asset.keyMetrics?.evToSalesTTM;
  const marketCap = asset.keyMetrics?.marketCap || asset.quote?.marketCap || 0;
  if (!isFinancialCompany && fairEvSalesBenchmark > 0 && actualEvSales && actualEvSales > 0.1 && actualEvSales < 100) {
    const evSalesFairValue = getEvBasedFairValue(
      currentPrice,
      actualEvSales,
      fairEvSalesBenchmark,
      asset.keyMetrics?.enterpriseValueTTM ?? 0,
      marketCap,
    );
    if (isSane(evSalesFairValue)) {
      models.push({
        name: peerEvSales.value !== null ? 'EV/Ventas por Pares FMP' : 'EV/Ventas por Sector',
        value: evSalesFairValue,
        weight: 0.65,
        category: 'relative',
        description: `EV/Ventas objetivo ${fairEvSalesBenchmark.toFixed(1)}x vs ${actualEvSales.toFixed(1)}x actual (${benchmarkSource(peerEvSales)}; margen EBIT ajustado ${salesMarginAdjustment.toFixed(2)}x; ${sectorName || 'Sector'})`
      });
    }
  }

  const ebitMargin = latestRatios?.ebitMargin;
  const actualEvEbit = actualEvSales && ebitMargin && ebitMargin > 0.01 ? actualEvSales / ebitMargin : 0;
  if (!isFinancialCompany && fairEvEbitBenchmark > 0 && actualEvEbit > 1 && actualEvEbit < 150) {
    const evEbitFairValue = getEvBasedFairValue(
      currentPrice,
      actualEvEbit,
      fairEvEbitBenchmark,
      asset.keyMetrics?.enterpriseValueTTM ?? 0,
      marketCap,
    );
    if (isSane(evEbitFairValue)) {
      models.push({
        name: peerEvEbit.value !== null ? 'EV/EBIT por Pares FMP' : 'EV/EBIT por Sector',
        value: evEbitFairValue,
        weight: 0.65,
        category: 'relative',
        description: `EV/EBIT estimado ${actualEvEbit.toFixed(1)}x vs objetivo ${fairEvEbitBenchmark.toFixed(1)}x (${benchmarkSource(peerEvEbit)}; ${sectorName || 'Sector'})`
      });
    }
  }

  // ============================================================================
  // MODELO 3: P/E forward ajustado por crecimiento estimado, ROE y riesgo.
  // Las financieras de alto crecimiento pueden justificar múltiplos mayores, pero con un tope explícito.
  // ============================================================================
  const actualPe = latestRatios?.priceToEarningsRatio && latestRatios.priceToEarningsRatio > 0
    ? latestRatios.priceToEarningsRatio
    : (asset.keyMetrics?.earningsYieldTTM && asset.keyMetrics.earningsYieldTTM > 0 ? 1 / asset.keyMetrics.earningsYieldTTM : 0);

  if (actualPe > 1.0 && actualPe < 150) {
    let targetPe = fairPeBenchmark;
    const currentRoe = asset.keyMetrics?.returnOnEquityTTM ?? sectorBenchmark.typicalRoe;
    if (currentRoe > sectorBenchmark.typicalRoe * 1.3) targetPe *= 1.15;
    else if (currentRoe < sectorBenchmark.typicalRoe * 0.7) targetPe *= 0.85;

    if (forwardEpsGrowthPct !== null) {
      const boundedGrowthPct = Math.min(Math.max(forwardEpsGrowthPct, -30), 60);
      if (isFinancialCompany) {
        if (boundedGrowthPct > 0) {
          const riskAdjustedPeg = Math.max(0.65, 1 - valuationDiscount * 0.5);
          targetPe = Math.max(targetPe, boundedGrowthPct * riskAdjustedPeg);
        } else {
          targetPe *= 1 + (boundedGrowthPct / 100) * 0.5;
        }
      } else {
        targetPe *= 1 + (boundedGrowthPct / 100) * 0.75;
      }
    }
    targetPe = Math.min(Math.max(targetPe, 4), 40);

    const peFairValue = currentPrice * (targetPe / actualPe);
    if (isSane(peFairValue)) {
      const coverageWeight = epsAnalystCount >= 5 ? 1 : epsAnalystCount >= 3 ? 0.75 : 0.5;
      models.push({
        name: 'P/E por EPS estimado',
        value: peFairValue,
        weight: forwardEpsGrowthPct !== null
          ? (isFinancialCompany && forwardEpsGrowthPct >= 20 ? 2.0 : 1.2) * coverageWeight
          : 1.2,
        category: 'relative',
        description: forwardEpsGrowthPct !== null
          ? `EPS forward: ${forwardEpsGrowthPct.toFixed(1)}% con ${epsAnalystCount} analistas; P/E objetivo ${targetPe.toFixed(1)}x vs ${actualPe.toFixed(1)}x actual (${benchmarkSource(peerPe)}).`
          : `P/E objetivo ${targetPe.toFixed(1)}x vs ${actualPe.toFixed(1)}x actual (${benchmarkSource(peerPe)}; ${sectorName || 'Sector'}); sin estimación forward válida.`
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
        weight: 1.0,
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
        weight: isFinancialCompany && (forwardEpsGrowthPct ?? 0) >= 20 ? 0.45 : 0.9,
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

  if (!isFinancialCompany && fairPbBenchmark > 0 && actualPb > 0.2 && actualPb < 25) {
    const currentRoe = roe ?? sectorBenchmark.typicalRoe;
    const roeQualityMultiplier = currentRoe > 0
      ? Math.min(Math.max(currentRoe / sectorBenchmark.typicalRoe, 0.65), 1.4)
      : 1;
    const targetPb = Math.max(fairPbBenchmark * roeQualityMultiplier, 0.4);
    const pbFairValue = currentPrice * (targetPb / actualPb);
    if (isSane(pbFairValue)) {
      models.push({
        name: peerPb.value !== null ? 'Precio/Valor Contable por Pares FMP' : 'Precio/Valor Contable por Sector',
        value: pbFairValue,
        weight: 0.65,
        category: 'relative',
        description: `P/B objetivo ${targetPb.toFixed(1)}x vs ${actualPb.toFixed(1)}x actual; ${benchmarkSource(peerPb)}, ajustado por ROE`
      });
    }
  }

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
            weight: isFinancialCompany && (forwardEpsGrowthPct ?? 0) >= 20 ? 0.5 : 0.8,
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

  const advancedDcf = asset.dcf
    ?.filter((projection) => Number.isFinite(projection.equityValuePerShare) && projection.equityValuePerShare > 0)
    .sort((left, right) => Number(right.year) - Number(left.year))[0];
  if (advancedDcf && !isAdr && isSane(advancedDcf.equityValuePerShare)) {
    models.push({
      name: 'DCF Avanzado FMP',
      value: advancedDcf.equityValuePerShare,
      weight: 1.1,
      category: 'intrinsic',
      description: `DCF avanzado de FMP hasta ${advancedDcf.year}, con proyección explícita, WACC y valor terminal`
    });
  }

  // --- Promedio Ponderado Final ---

  if (models.length === 0) {
    // Si no hay modelos válidos, devolver null seguro
    return {
      fairValue: null,
      fairValueRange: null,
      modelsUsed: [],
      isAnomaly: true,
      spread: null,
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
  const fairValueRange = {
    low: weightedQuantile(filteredModels, 0.2),
    high: weightedQuantile(filteredModels, 0.8),
  };
  const spread = ((fairValue - currentPrice) / currentPrice) * 100;

  return {
    fairValue,
    fairValueRange,
    modelsUsed: filteredModels,
    isAnomaly: false,
    spread,
    context
  };
}

export interface ContextualRatingScores {
  discountedCashFlow: number | null;
  priceToEarnings: number | null;
  priceToBook: number | null;
  debtToEquity: number | null;
}

function isValidRatingScore(score: number | null | undefined): score is number {
  return typeof score === 'number' && Number.isFinite(score) && score >= 1 && score <= 5;
}

function scoreFairValueRatio(fairValue: number, currentPrice: number): number | null {
  if (!Number.isFinite(fairValue) || fairValue <= 0 || currentPrice <= 0) return null;
  const ratio = fairValue / currentPrice;
  if (ratio >= 1.4) return 5;
  if (ratio >= 1.15) return 4;
  if (ratio >= 0.95) return 3;
  if (ratio >= 0.8) return 2;
  return 1;
}

function scoreRelativeDebt(actualRatio: number, peerMedian: number): number {
  const relativeRatio = actualRatio / peerMedian;
  if (relativeRatio <= 0.6) return 5;
  if (relativeRatio <= 0.85) return 4;
  if (relativeRatio <= 1.15) return 3;
  if (relativeRatio <= 1.5) return 2;
  return 1;
}

export function calculateContextualRatingScores(
  asset: AssetData,
  riskPremiumData: RiskPremiumData[] = [],
): ContextualRatingScores {
  const fallback = asset.rating;
  const valuation = calculateBlendedFairValue(asset, riskPremiumData);
  const currentPrice = asset.quote?.price ?? 0;
  const models = valuation.modelsUsed;
  const dcfModel = models.find((model) => model.name === 'DCF Avanzado FMP')
    ?? models.find((model) => model.name === 'DCF Apalancado');
  const peModel = models.find((model) => model.name === 'P/E por EPS estimado');
  const pbModel = models.find((model) => model.name.startsWith('Precio/Valor Contable'))
    ?? models.find((model) => model.name === 'Ingreso Residual (EBO)');

  const latestRatios = asset.ratios?.length
    ? [...asset.ratios].sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())[0]
    : null;
  const peerDebtToEquity = getPeerMedian(asset.peerValuations ?? [], 'debtToEquity', 0.01, 20);
  const isFinancialCompany = /financial|bank|credit|fintech|payment|consumer finance/i.test(
    `${asset.profile?.sector ?? ''} ${asset.profile?.industry ?? ''}`
  );
  const actualDebtToEquity = latestRatios?.debtToEquityRatio;
  const currentPb = latestRatios?.priceToBookRatio;
  const peerPb = getPeerMedian(asset.peerValuations ?? [], 'priceToBookRatio', 0.1, 30);
  const peerRoe = getPeerMedian(asset.peerValuations ?? [], 'returnOnEquity', 0.01, 1.5);
  const companyRoe = asset.keyMetrics?.returnOnEquityTTM ?? latestRatios?.returnOnEquity;
  const pbPeerFairValue = currentPb && currentPb > 0 && peerPb.value && peerRoe.value && companyRoe && companyRoe > 0
    ? currentPrice * peerPb.value * Math.min(Math.max(companyRoe / peerRoe.value, 0.65), 1.4) / currentPb
    : null;

  return {
    discountedCashFlow: scoreFairValueRatio(dcfModel?.value ?? 0, currentPrice)
      ?? (isValidRatingScore(fallback?.discountedCashFlowScore) ? fallback.discountedCashFlowScore : null),
    priceToEarnings: scoreFairValueRatio(peModel?.value ?? 0, currentPrice)
      ?? (isValidRatingScore(fallback?.priceToEarningsScore) ? fallback.priceToEarningsScore : null),
    priceToBook: scoreFairValueRatio(pbPeerFairValue ?? pbModel?.value ?? 0, currentPrice)
      ?? (isValidRatingScore(fallback?.priceToBookScore) ? fallback.priceToBookScore : null),
    debtToEquity: isFinancialCompany
      ? null
      : actualDebtToEquity && actualDebtToEquity > 0 && peerDebtToEquity.value
        ? scoreRelativeDebt(actualDebtToEquity, peerDebtToEquity.value)
        : isValidRatingScore(fallback?.debtToEquityScore) ? fallback.debtToEquityScore : null,
  };
}
