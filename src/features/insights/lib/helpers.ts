import type { AssetData } from "../../../types/dashboard";
import type { RiskPremiumData } from "../../risk-premium/types/risk-premium.types";
import type { InsightItem } from "../types/insights.types";
import { calculateBlendedFairValue } from "../../asset-detail/lib/valuation-models";

/**
 * Construye un InsightItem a partir de AssetData.
 * Usa la misma l\u00f3gica de c\u00e1lculo de DCF que asset-detail.
 */
export function toInsightItem(a: AssetData, riskPremiumData: RiskPremiumData[] = []): InsightItem | undefined {
  const price = a.quote?.price ?? 0;
  if (price === 0) return undefined;

  const valuation = calculateBlendedFairValue(a, riskPremiumData);
  const fairValue = valuation.fairValue;
  if (fairValue === null || !Number.isFinite(fairValue) || fairValue <= 0) return undefined;

  const target = a.priceTargetConsensus?.targetConsensus ?? undefined;

  // Mispricing con denominador PRECIO para coincidir con el detalle del activo
  // Positivo: infravalorada (dcf > precio). Negativo: sobrevalorada (precio > dcf).
  const mispricingPct = valuation.spread ?? undefined;
  
  // Si el mispricing es mayor a 5000% (anomal\u00eda), descartamos
  if (mispricingPct !== undefined && Math.abs(mispricingPct) > 5000) {
    return undefined;
  }

  const targetUpsidePct = target && price > 0 ? ((target - price) / price) * 100 : undefined;

  return {
    symbol: a.profile?.symbol ?? a.quote?.symbol ?? 'N/A',
    companyName: a.profile?.companyName ?? a.quote?.name ?? 'N/A',
    currentPrice: price,
    dcf: fairValue,
    priceTarget: target,
    mispricingPct,
    targetUpsidePct,
  };
}

/**
 * Ordena por infravaloración (mispricingPct descendente).
 */
export function sortUndervalued(items: InsightItem[]): InsightItem[] {
  return items
    .filter(i => typeof i.mispricingPct === 'number' && i.mispricingPct > 0)
    .sort((a, b) => (b.mispricingPct! - a.mispricingPct!));
}

/**
 * Ordena por sobrevaloración (mispricingPct ascendente, valores negativos).
 */
export function sortOvervalued(items: InsightItem[]): InsightItem[] {
  return items
    .filter(i => typeof i.mispricingPct === 'number' && i.mispricingPct < 0)
    .sort((a, b) => (a.mispricingPct! - b.mispricingPct!));
}
