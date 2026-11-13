// src/features/asset-detail/lib/valuation-models.ts

import type { AssetData, AssetPeerValuation } from '../../../types/dashboard';
import type { RiskPremiumData } from '../../risk-premium/types/risk-premium.types';
import { DAMODARAN_COUNTRIES, MATURE_MARKET_ERP } from '../../../data/damodaran-country-risk';
import { getTerminalGrowth } from '../../../services/api/yahoo-fundamentals';

export interface ValuationModel {
  name: string;
  value: number;
  weight: number;
  category: 'intrinsic' | 'relative' | 'asset-based' | 'analyst';
  description: string;
  /** The model's raw result was beyond the accepted band and counts at its edge. */
  capped?: boolean;
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
  /** Growth used for the first projected years, before it fades to the long-term rate. */
  stageGrowthPct: number | null;
}

export type ValuationVerdict = 'infravalorada' | 'en-precio' | 'sobrevalorada';
export type ValuationConfidence = 'alta' | 'media' | 'baja';

export interface BlendedValuationResult {
  fairValue: number | null;
  fairValueRange: { low: number; high: number } | null;
  modelsUsed: ValuationModel[];
  isAnomaly: boolean;
  spread: number | null; // percentage difference from price
  /** Null when there are not enough models to give one. */
  verdict: ValuationVerdict | null;
  confidence: ValuationConfidence | null;
  context: ValuationContext;
}

export interface BusinessProfile {
  typeLabel: string;
  riskLevel: 'bajo' | 'moderado' | 'alto';
  description: string;
  riskFactors: string[];
}

/** No model is precise enough to call a few percent a mispricing. */
export const FAIR_PRICE_BAND_PCT = 10;
const PROJECTION_YEARS = 10;
const DEFAULT_RISK_FREE_RATE = 0.042;
const MAX_STAGE_GROWTH = 0.2;
/** Growth reported in a high-inflation currency overstates what the dollar price will see. */
const MAX_STAGE_GROWTH_FOREIGN_CURRENCY = 0.1;
const UNKNOWN_COUNTRY_RISK_PREMIUM = 0.02;
/** Results count at these edges instead of being dropped, so a strong signal is never lost. */
const MIN_VALUE_RATIO = 0.4;
const MAX_VALUE_RATIO = 2;
/** Beyond this the inputs are broken (mixed currencies, stale targets), not the company cheap. */
const DATA_ERROR_RATIO = 5;
/** A perpetuity priced closer than this to its growth rate is worth almost anything; keep the gap. */
const MIN_TERMINAL_SPREAD = 0.04;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function isPositive(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
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

function normalizeCountryName(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
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

/** Damodaran's country risk premium as a fraction; callers may pass a fresher table. */
function getCountryRisk(country: string, riskPremiumData: RiskPremiumData[]): { name: string; premium: number } {
  if (!country) return { name: 'Sin país informado', premium: UNKNOWN_COUNTRY_RISK_PREMIUM };
  const name = getCountryName(country);
  const table = riskPremiumData.length > 0 ? riskPremiumData : DAMODARAN_COUNTRIES;
  const entry = table.find((item) => normalizeCountryName(item.country) === normalizeCountryName(name));
  if (!entry || !isNumber(entry.countryRiskPremium) || entry.countryRiskPremium < 0) {
    return { name, premium: UNKNOWN_COUNTRY_RISK_PREMIUM };
  }
  return { name: entry.country, premium: entry.countryRiskPremium / 100 };
}

/**
 * Present value, per unit of the starting cash flow, of a stream whose growth fades linearly
 * from `startGrowth` to `terminalGrowth` over ten years, plus its terminal value.
 * `payout` is the share of each year's flow that reaches shareholders.
 */
export function fadingGrowthMultiple(
  startGrowth: number,
  discountRate: number,
  terminalGrowth: number,
  options: { baseIsTrailing: boolean; payout?: (growth: number) => number },
): number | null {
  if (discountRate <= MIN_TERMINAL_SPREAD) return null;
  const longTermGrowth = Math.min(terminalGrowth, discountRate - MIN_TERMINAL_SPREAD);
  const payout = options.payout ?? (() => 1);
  let flow = 1;
  let value = 0;
  for (let year = 1; year <= PROJECTION_YEARS; year += 1) {
    const growth = startGrowth + (longTermGrowth - startGrowth) * ((year - 1) / (PROJECTION_YEARS - 1));
    // A forward figure already is year one; a trailing figure has to grow into it.
    if (year > 1 || options.baseIsTrailing) flow *= 1 + growth;
    value += flow * payout(growth) / (1 + discountRate) ** year;
  }
  const terminal = flow * (1 + longTermGrowth) * payout(longTermGrowth) / (discountRate - longTermGrowth);
  return value + terminal / (1 + discountRate) ** PROJECTION_YEARS;
}

export function classifyBusinessProfile(asset: AssetData, context: ValuationContext): BusinessProfile {
  const sector = `${asset.profile?.sector ?? ''} ${asset.profile?.industry ?? ''}`;
  const isFinancial = /financial|bank|credit|fintech|payment|consumer finance/i.test(sector);
  const beta = asset.profile?.beta > 0 ? asset.profile.beta : null;
  const netDebtToEbitda = asset.keyMetrics?.netDebtToEBITDATTM ?? Number.NaN;
  const roe = asset.keyMetrics?.returnOnEquityTTM ?? Number.NaN;
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
 * Fair value from a few independent views of the company: its cash flows, its earnings,
 * how its sector is priced and what analysts expect. Every view uses the same growth and
 * the same discount rate, and works on ratios so ADRs and foreign currencies cannot distort it.
 */
export function calculateBlendedFairValue(
  asset: AssetData,
  riskPremiumData: RiskPremiumData[] = [],
): BlendedValuationResult {
  const currentPrice = asset.quote?.price ?? 0;
  const metrics = asset.yahooMetrics ?? {};
  const sectorName = asset.profile?.sector || '';
  const industryName = asset.profile?.industry || '';
  const sectorStats = asset.valuationInputs?.sector ?? null;
  const countryRisk = getCountryRisk(asset.profile?.country || '', riskPremiumData);

  const riskFreeRate = isPositive(asset.valuationInputs?.riskFreeRate) && asset.valuationInputs.riskFreeRate < 0.15
    ? asset.valuationInputs.riskFreeRate
    : DEFAULT_RISK_FREE_RATE;
  // Blume-adjusted beta, bounded: raw betas of thinly traded ADRs are often meaningless.
  const rawBeta = isPositive(asset.profile?.beta) && asset.profile.beta < 4 ? asset.profile.beta : 1;
  const beta = clamp(0.67 * rawBeta + 0.33, 0.75, 1.75);
  const costOfEquity = riskFreeRate + beta * MATURE_MARKET_ERP + countryRisk.premium;
  const terminalGrowth = getTerminalGrowth(riskFreeRate);
  // A multiple is worth less where capital costs more: scale sector multiples by the ratio of rates.
  const matureCostOfEquity = riskFreeRate + MATURE_MARKET_ERP;
  const countryFactor = matureCostOfEquity / (matureCostOfEquity + countryRisk.premium);

  const epsGrowth = metrics['earningsTrend.+1y.growth'];
  const revenueGrowth = metrics['earningsTrend.+1y.revenue.growth'];
  // Sales are the anchor: one year of earnings growth is often a rebound, so it adds at most five points.
  const stageGrowth = isNumber(revenueGrowth)
    ? clamp(revenueGrowth + (isNumber(epsGrowth) ? clamp(epsGrowth - revenueGrowth, -0.05, 0.05) : 0), -0.05, MAX_STAGE_GROWTH)
    : isNumber(epsGrowth)
      ? clamp(epsGrowth, -0.05, 0.15)
      : null;
  const analystCount = metrics['financialData.numberOfAnalystOpinions'] ?? 0;

  const context: ValuationContext = {
    sector: sectorName || 'General',
    industry: industryName || 'General',
    country: countryRisk.name,
    currency: asset.profile?.currency || 'USD',
    isAdr: Boolean(asset.profile?.isAdr),
    countryRiskPremiumPct: countryRisk.premium * 100,
    valuationDiscountPct: (1 - countryFactor) * 100,
    adjustedCostOfEquityPct: costOfEquity * 100,
    benchmarkEvEbitda: 0,
    benchmarkPe: sectorStats?.forwardPe ?? 0,
    forwardEpsGrowthPct: isNumber(epsGrowth) ? epsGrowth * 100 : null,
    epsAnalystCount: analystCount,
    stageGrowthPct: stageGrowth === null ? null : stageGrowth * 100,
  };
  const empty: BlendedValuationResult = {
    fairValue: null, fairValueRange: null, modelsUsed: [], isAnomaly: false, spread: null, verdict: null, confidence: null, context,
  };
  if (currentPrice <= 0) return empty;

  // Statements and per-share estimates must be in the quote's currency to be compared with the price.
  // Yahoo's own P/E is currency-safe, so price ÷ (P/E × EPS) reveals a mismatch even when labels agree.
  const statementCurrency = asset.ratios?.[0]?.reportedCurrency?.trim().toUpperCase();
  const quoteCurrency = asset.profile?.currency?.trim().toUpperCase();
  const forwardPe = metrics['summaryDetail.forwardPE'] ?? metrics['keyStatistics.forwardPE'];
  const forwardEps = metrics['keyStatistics.forwardEps'];
  const impliedConversion = isPositive(forwardPe) && isPositive(forwardEps) ? currentPrice / (forwardPe * forwardEps) : null;
  const amountsMatchPrice = (!statementCurrency || !quoteCurrency || statementCurrency === quoteCurrency)
    && (impliedConversion === null || (impliedConversion > 0.85 && impliedConversion < 1.15));

  const isFinancial = /financial|bank|credit|fintech|payment|consumer finance/i.test(`${sectorName} ${industryName}`);
  const isRealEstate = /real estate|reit/i.test(`${sectorName} ${industryName}`);
  const growth = Math.min(stageGrowth ?? 0.04, amountsMatchPrice ? MAX_STAGE_GROWTH : MAX_STAGE_GROWTH_FOREIGN_CURRENCY);
  const growthLabel = stageGrowth === null
    ? 'crecimiento inicial 4% (sin estimaciones)'
    : `crecimiento inicial ${(growth * 100).toFixed(1)}%`;
  const rateLabel = `descuento ${(costOfEquity * 100).toFixed(1)}%`;

  const models: ValuationModel[] = [];
  const addModel = (model: Omit<ValuationModel, 'value' | 'capped'>, valueRatio: number | null) => {
    if (valueRatio === null || !Number.isFinite(valueRatio) || valueRatio <= 0 || valueRatio > DATA_ERROR_RATIO) return;
    const bounded = clamp(valueRatio, MIN_VALUE_RATIO, MAX_VALUE_RATIO);
    models.push({ ...model, value: currentPrice * bounded, ...(bounded !== valueRatio ? { capped: true } : {}) });
  };

  // --- Cash flows ---
  const dcfRow = (asset.yahooDataVersion ?? 0) >= 4 && amountsMatchPrice
    ? asset.dcf?.find((row) => isPositive(row.equityValuePerShare))
    : undefined;
  if (dcfRow && !isFinancial) {
    addModel({
      name: 'DCF a 10 años',
      weight: 1,
      category: 'intrinsic',
      description: `Flujos de caja proyectados 10 años con sus márgenes históricos, descontados al ${dcfRow.wacc.toFixed(1)}% (WACC) más valor terminal`,
    }, dcfRow.equityValuePerShare / currentPrice);
  }

  const marketCap = metrics['summaryDetail.marketCap'] ?? metrics['price.marketCap'] ?? asset.quote?.marketCap;
  // One year of free cash flow swings with investment cycles: average it with what the last three
  // years' margin would produce on today's sales.
  const revenue = metrics['financialData.totalRevenue'];
  const fcfMargins = (asset.yahooInsights?.annualStatements ?? []).slice(0, 3).flatMap((period) => {
    const { FreeCashFlow: cash, TotalRevenue: sales } = period.values;
    return isNumber(cash) && isPositive(sales) ? [cash / sales] : [];
  });
  const averageFcfMargin = fcfMargins.length > 0 ? fcfMargins.reduce((sum, value) => sum + value, 0) / fcfMargins.length : null;
  const fcfYields = isPositive(marketCap)
    ? [
      asset.keyMetrics?.freeCashFlowYieldTTM,
      averageFcfMargin !== null && isPositive(revenue) ? averageFcfMargin * revenue / marketCap : null,
    ].filter(isNumber)
    : [];
  const fcfYield = fcfYields.length > 0 ? fcfYields.reduce((sum, value) => sum + value, 0) / fcfYields.length : null;
  // Both cash views tell the same story; this simpler one steps in only when the DCF cannot be built.
  if (!dcfRow && !isFinancial && !isRealEstate && amountsMatchPrice && fcfYield !== null && fcfYield > 0.005 && fcfYield < 0.25) {
    const fcfGrowth = clamp(isNumber(revenueGrowth) ? revenueGrowth : growth, -0.05, 0.15);
    const multiple = fadingGrowthMultiple(fcfGrowth, costOfEquity, terminalGrowth, { baseIsTrailing: true });
    addModel({
      name: 'Flujo de caja libre con crecimiento',
      weight: 1,
      category: 'intrinsic',
      description: `Flujo de caja libre normalizado con los últimos tres años (${(fcfYield * 100).toFixed(1)}% del valor de mercado), crecimiento inicial ${(fcfGrowth * 100).toFixed(1)}% que converge al ${(terminalGrowth * 100).toFixed(1)}%, ${rateLabel}`,
    }, multiple === null ? null : fcfYield * multiple);
  }

  // --- Earnings ---
  const hasForwardPe = isPositive(forwardPe) && forwardPe > 2 && forwardPe < 500;
  if (hasForwardPe && !isRealEstate) {
    const returnOnEquity = clamp(metrics['financialData.returnOnEquity'] ?? 0.15, 0.08, 0.5);
    // Growth has to be financed: the part of earnings that must be reinvested is not the shareholder's.
    const justifiedPe = fadingGrowthMultiple(growth, costOfEquity, terminalGrowth, {
      baseIsTrailing: false,
      payout: (rate) => clamp(1 - rate / returnOnEquity, 0.25, 1),
    });
    addModel({
      name: 'Ganancias con crecimiento',
      weight: 1.2,
      category: 'intrinsic',
      description: justifiedPe === null ? '' : `P/E justificado ${justifiedPe.toFixed(1)}x vs ${forwardPe.toFixed(1)}x actual sobre ganancias estimadas: ${growthLabel} que converge al ${(terminalGrowth * 100).toFixed(1)}%, ${rateLabel}`,
    }, justifiedPe === null ? null : justifiedPe / forwardPe);
  }

  const dividendYield = metrics['summaryDetail.dividendYield'];
  if (isRealEstate && isPositive(dividendYield) && dividendYield > 0.01 && dividendYield < 0.15) {
    const dividendGrowth = clamp(isNumber(revenueGrowth) ? revenueGrowth : 0.03, 0, 0.06);
    const multiple = fadingGrowthMultiple(dividendGrowth, costOfEquity, terminalGrowth, { baseIsTrailing: true });
    addModel({
      name: 'Dividendos con crecimiento',
      weight: 1.2,
      category: 'intrinsic',
      description: `Dividendo actual ${(dividendYield * 100).toFixed(1)}%, crecimiento inicial ${(dividendGrowth * 100).toFixed(1)}%, ${rateLabel}. En inmobiliarias la ganancia contable subestima la caja`,
    }, multiple === null ? null : dividendYield * multiple);
  }

  // --- Sector ---
  if (hasForwardPe && sectorStats && isPositive(sectorStats.forwardPe) && sectorStats.count >= 10) {
    // Trailing over forward P/E is the earnings growth the market expects, measured the same way for
    // the company and its sector. About three years of that gap separate their multiples.
    const trailingPe = metrics['summaryDetail.trailingPE'];
    const impliedGrowth = isPositive(trailingPe) && trailingPe < 150 ? clamp(trailingPe / forwardPe - 1, -0.1, 0.4) : null;
    const growthAdjustment = impliedGrowth !== null && isNumber(sectorStats.growth)
      ? clamp(((1 + impliedGrowth) / (1 + sectorStats.growth)) ** 3, 0.8, 1.25)
      : 1;
    const sectorPe = sectorStats.forwardPe * growthAdjustment * countryFactor;
    // Part of any gap with the sector is earned (quality, leverage, cyclicality): assume half of it closes.
    const targetPe = Math.sqrt(sectorPe * forwardPe);
    addModel({
      name: 'P/E frente al sector',
      weight: 0.7,
      category: 'relative',
      description: `P/E objetivo ${targetPe.toFixed(1)}x vs ${forwardPe.toFixed(1)}x actual, a mitad de camino del P/E agregado de ${sectorStats.count} empresas del sector (${sectorStats.forwardPe.toFixed(1)}x), ajustado por crecimiento (${growthAdjustment.toFixed(2)}x)${countryFactor < 0.99 ? ` y riesgo país (${countryFactor.toFixed(2)}x)` : ''}`,
    }, targetPe / forwardPe);
  }

  // --- Analysts ---
  const target = asset.priceTargetConsensus?.targetConsensus;
  if (isPositive(target) && target / currentPrice > 0.2) {
    addModel({
      name: 'Consenso de analistas',
      weight: analystCount >= 5 ? 0.8 : 0.4,
      category: 'analyst',
      description: analystCount > 0
        ? `Precio objetivo promedio de ${analystCount} analistas a 12 meses`
        : 'Precio objetivo promedio de analistas a 12 meses',
    }, target / currentPrice);
  }

  // One view alone is an opinion, not a valuation.
  if (models.length < 2) return { ...empty, isAnomaly: models.length === 0 };

  const totalWeight = models.reduce((sum, model) => sum + model.weight, 0);
  const fairValue = models.reduce((sum, model) => sum + model.value * model.weight, 0) / totalWeight;
  const values = models.map((model) => model.value);
  const dispersion = (Math.max(...values) - Math.min(...values)) / fairValue;
  const confidence: ValuationConfidence = models.length >= 4 && dispersion <= 0.6
    ? 'alta'
    : models.length >= 3 && dispersion <= 1
      ? 'media'
      : 'baja';
  const spread = ((fairValue - currentPrice) / currentPrice) * 100;

  return {
    fairValue,
    fairValueRange: { low: weightedQuantile(models, 0.2), high: weightedQuantile(models, 0.8) },
    modelsUsed: models,
    isAnomaly: false,
    spread,
    verdict: spread >= FAIR_PRICE_BAND_PCT ? 'infravalorada' : spread <= -FAIR_PRICE_BAND_PCT ? 'sobrevalorada' : 'en-precio',
    confidence,
    context,
  };
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
  const dcfModel = models.find((model) => model.name === 'DCF a 10 años');
  const peModel = models.find((model) => model.name === 'P/E frente al sector')
    ?? models.find((model) => model.name === 'Ganancias con crecimiento');
  
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
    priceToBook: scoreFairValueRatio(pbPeerFairValue ?? 0, currentPrice)
      ?? (isValidRatingScore(fallback?.priceToBookScore) ? fallback.priceToBookScore : null),
    debtToEquity: isFinancialCompany
      ? null
      : actualDebtToEquity && actualDebtToEquity > 0 && peerDebtToEquity.value
        ? scoreRelativeDebt(actualDebtToEquity, peerDebtToEquity.value)
        : isValidRatingScore(fallback?.debtToEquityScore) ? fallback.debtToEquityScore : null,
  };
}
