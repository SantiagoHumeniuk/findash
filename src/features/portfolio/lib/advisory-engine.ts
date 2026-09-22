// src/features/portfolio/lib/advisory-engine.ts

import { AssetData } from '../../../types/dashboard';
import { Holding } from '../../../types/portfolio';

export interface AdvisoryReason {
  text: string;
  type: 'positive' | 'negative' | 'neutral';
}

export interface AdvisoryResult {
  status: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reasons: AdvisoryReason[];
  techData: {
    pe: number | null;
    debtToEquity: number | null;
    roe: number | null;
    beta: number | null;
  };
  impact: {
    sector: string;
    currentAllocationPercent: number;
    simulatedAllocationPercent: number;
  };
}

export function generateAdvisory(
  symbol: string,
  portfolioData: Record<string, AssetData>,
  holdings: Holding[]
): AdvisoryResult {
  const asset = portfolioData[symbol];
  const reasons: AdvisoryReason[] = [];
  let score = 50; // Base score (HOLD range)

  const latestRatios = Array.isArray(asset?.ratios) ? asset.ratios[0] : null;
  const pe = latestRatios?.priceEarningsRatio ?? null;
  const debtToEquity = latestRatios?.debtToEquityRatio ?? null;
  const roe = asset?.keyMetrics?.returnOnEquityTTM ?? (latestRatios ? (latestRatios as any).returnOnEquity ?? null : null);
  const beta = asset?.profile?.beta ?? null;
  const sector = asset?.profile?.sector ?? 'Otros';

  // --- 1. Valuation (P/E) ---
  if (pe !== null) {
    if (pe < 15) {
      score += 15;
      reasons.push({ text: `Valoración atractiva con un P/E de ${pe.toFixed(1)} (por debajo del promedio).`, type: 'positive' });
    } else if (pe > 30) {
      score -= 15;
      reasons.push({ text: `Valoración elevada con un P/E de ${pe.toFixed(1)}. Riesgo de sobreprecio.`, type: 'negative' });
    } else {
      reasons.push({ text: `P/E de ${pe.toFixed(1)} se encuentra en niveles históricos razonables.`, type: 'neutral' });
    }
  }

  // --- 2. Financial Health (Debt/Equity) ---
  if (debtToEquity !== null) {
    if (debtToEquity < 0.5) {
      score += 10;
      reasons.push({ text: 'Excelente salud financiera con niveles de deuda muy bajos.', type: 'positive' });
    } else if (debtToEquity > 2) {
      score -= 15;
      reasons.push({ text: `Nivel de deuda elevado (${debtToEquity.toFixed(1)}x capital). Posible riesgo de solvencia.`, type: 'negative' });
    }
  }

  // --- 3. Profitability (ROE) ---
  if (roe !== null) {
    if (roe > 0.15) {
      score += 10;
      reasons.push({ text: `Alta rentabilidad sobre el capital (ROE del ${(roe * 100).toFixed(1)}%).`, type: 'positive' });
    } else if (roe < 0.05) {
      score -= 5;
      reasons.push({ text: `Rentabilidad moderada o baja (${(roe * 100).toFixed(1)}%).`, type: 'negative' });
    }
  }

  // --- 4. Volatility (Beta) ---
  if (beta !== null) {
    if (beta < 1) {
      reasons.push({ text: 'Activo defensivo con volatilidad menor a la del mercado.', type: 'positive' });
    } else {
      reasons.push({ text: 'Activo agresivo con mayor volatilidad que el mercado.', type: 'neutral' });
    }
  }

  // Determine status based on score
  let status: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
  if (score >= 70) status = 'BUY';
  else if (score <= 40) status = 'SELL';

  // Calculate Impact
  const totalMarketValue = holdings.reduce((sum, h) => {
    const price = portfolioData[h.symbol]?.quote?.price ?? 0;
    return sum + (h.quantity * price);
  }, 0);

  const currentHolding = holdings.find(h => h.symbol === symbol);
  const currentAssetValue = (currentHolding?.quantity ?? 0) * (asset?.quote?.price ?? 0);
  
  const currentAllocationPercent = totalMarketValue > 0 ? (currentAssetValue / totalMarketValue) * 100 : 0;
  
  const sectorValue = holdings
    .filter(h => portfolioData[h.symbol]?.profile?.sector === sector)
    .reduce((sum, h) => sum + (h.quantity * (portfolioData[h.symbol]?.quote?.price ?? 0)), 0);

  const sectorAllocationPercent = totalMarketValue > 0 ? (sectorValue / totalMarketValue) * 100 : 0;
  
  const simulatedSectorValue = sectorValue - currentAssetValue;
  const simulatedTotalValue = totalMarketValue - currentAssetValue;
  const simulatedAllocationPercent = simulatedTotalValue > 0 ? (simulatedSectorValue / simulatedTotalValue) * 100 : 0;

  return {
    status,
    confidence: Math.min(Math.max(score, 0), 100),
    reasons,
    techData: { pe, debtToEquity, roe, beta },
    impact: {
      sector,
      currentAllocationPercent: sectorAllocationPercent,
      simulatedAllocationPercent
    }
  };
}
