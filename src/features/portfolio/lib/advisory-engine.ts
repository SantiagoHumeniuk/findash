// src/features/portfolio/lib/advisory-engine.ts

import { AssetData } from '../../../types/dashboard';
import { Holding } from '../../../types/portfolio';
import { calculateBlendedFairValue } from '../../asset-detail/lib/valuation-models';

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
    forwardPE: number | null;
    debtToEquity: number | null;
    netDebtToEbitda: number | null;
    currentRatio: number | null;
    interestCoverage: number | null;
    roe: number | null;
    operatingMargin: number | null;
    beta: number | null;
    isFinancialCompany: boolean;
  };
  impact: {
    sector: string;
    currentAllocationPercent: number | null;
    simulatedAllocationPercent: number | null;
  };
  valuation: {
    fairValue: number | null;
    fairValueRange: { low: number; high: number } | null;
    upsidePct: number | null;
    forwardEpsGrowthPct: number | null;
    confidence: 'alta' | 'media' | 'baja' | null;
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

  if (!asset) {
    return {
      status: 'HOLD',
      confidence: 15,
      reasons: [{ text: 'No hay datos suficientes para emitir una recomendación.', type: 'neutral' }],
      techData: {
        pe: null,
        forwardPE: null,
        debtToEquity: null,
        netDebtToEbitda: null,
        currentRatio: null,
        interestCoverage: null,
        roe: null,
        operatingMargin: null,
        beta: null,
        isFinancialCompany: false,
      },
      impact: { sector: 'Otros', currentAllocationPercent: 0, simulatedAllocationPercent: 0 },
      valuation: { fairValue: null, fairValueRange: null, upsidePct: null, forwardEpsGrowthPct: null, confidence: null },
    };
  }

  const latestRatios = Array.isArray(asset.ratios)
    ? [...asset.ratios].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] ?? null
    : null;
  const pe = latestRatios?.priceToEarningsRatio ?? null;
  const forwardPE = asset.quote?.forwardPE ?? null;
  const debtToEquity = latestRatios?.debtToEquityRatio ?? null;
  const netDebtToEbitda = asset.keyMetrics?.netDebtToEBITDATTM ?? null;
  const currentRatio = latestRatios?.currentRatio ?? null;
  const interestCoverage = latestRatios?.interestCoverageRatio ?? null;
  const roe = asset.keyMetrics?.returnOnEquityTTM ?? null;
  const operatingMargin = latestRatios?.operatingProfitMargin ?? null;
  const beta = asset?.profile?.beta ?? null;
  const sector = asset?.profile?.sector ?? 'Otros';
  const isFinancialCompany = /financial|bank|credit|fintech|payment|consumer finance/i.test(
    `${sector} ${asset.profile?.industry ?? ''}`
  );
  const valuation = calculateBlendedFairValue(asset);
  const valuationConfidence = valuation.isAnomaly
    ? 'baja'
    : valuation.modelsUsed.length >= 4
      ? 'alta'
      : valuation.modelsUsed.length > 0
        ? 'media'
        : 'baja';
  const upsidePct = valuation.spread;
  const forwardEpsGrowthPct = valuation.context.forwardEpsGrowthPct;
  const positiveDomains = new Set<string>();
  const negativeDomains = new Set<string>();

  // Anchor the signal to the blended fair value instead of universal P/E cutoffs.
  if (upsidePct !== null) {
    if (upsidePct >= 30) {
      score += 22;
      positiveDomains.add('valoración');
      reasons.push({ text: `El valor justo ponderado sugiere un potencial de ${upsidePct.toFixed(1)}% frente al precio actual.`, type: 'positive' });
    } else if (upsidePct >= 15) {
      score += 15;
      positiveDomains.add('valoración');
      reasons.push({ text: `El valor justo ponderado indica un potencial de ${upsidePct.toFixed(1)}%.`, type: 'positive' });
    } else if (upsidePct >= 5) {
      score += 7;
      reasons.push({ text: `El valor justo estima un potencial moderado de ${upsidePct.toFixed(1)}%.`, type: 'positive' });
    } else if (upsidePct <= -30) {
      score -= 22;
      negativeDomains.add('valoración');
      reasons.push({ text: `El precio está ${Math.abs(upsidePct).toFixed(1)}% por encima del valor justo ponderado.`, type: 'negative' });
    } else if (upsidePct <= -15) {
      score -= 15;
      negativeDomains.add('valoración');
      reasons.push({ text: `La valoración ponderada sugiere una caída potencial de ${Math.abs(upsidePct).toFixed(1)}%.`, type: 'negative' });
    } else if (upsidePct <= -5) {
      score -= 7;
      reasons.push({ text: `El activo cotiza algo por encima del valor justo estimado (${upsidePct.toFixed(1)}%).`, type: 'negative' });
    } else {
      reasons.push({ text: 'El precio está cerca del valor justo estimado.', type: 'neutral' });
    }
  } else {
    reasons.push({ text: 'No hay modelos de valoración suficientes; no se recomienda comprar o vender basándose solo en ratios aislados.', type: 'neutral' });
  }

  if (forwardPE !== null && forwardPE > 0) {
    if (forwardPE > 50) {
      score -= 10;
      negativeDomains.add('valoración');
      reasons.push({ text: `PER forward muy exigente (${forwardPE.toFixed(1)}x), sensible a cualquier incumplimiento de estimaciones.`, type: 'negative' });
    } else if (forwardPE > 35) {
      score -= 5;
      reasons.push({ text: `PER forward alto (${forwardPE.toFixed(1)}x); exige crecimiento sostenido.`, type: 'negative' });
    } else {
      reasons.push({ text: `PER forward ${forwardPE.toFixed(1)}x, según ganancias estimadas y no realizadas.`, type: 'neutral' });
    }
  } else {
    reasons.push({ text: 'Yahoo/FMP no entregó PER forward válido; no se usa una proyección faltante como señal positiva.', type: 'neutral' });
  }

  if (forwardEpsGrowthPct !== null) {
    if (forwardEpsGrowthPct >= 40) {
      score += 12;
      positiveDomains.add('crecimiento');
      reasons.push({ text: `El consenso estima crecimiento de EPS de ${forwardEpsGrowthPct.toFixed(1)}% y se pondera según la cobertura de analistas.`, type: 'positive' });
    } else if (forwardEpsGrowthPct >= 20) {
      score += 8;
      positiveDomains.add('crecimiento');
      reasons.push({ text: `El EPS estimado crecería ${forwardEpsGrowthPct.toFixed(1)}% en el próximo período.`, type: 'positive' });
    } else if (forwardEpsGrowthPct >= 5) {
      score += 4;
      reasons.push({ text: `El EPS estimado muestra crecimiento moderado (${forwardEpsGrowthPct.toFixed(1)}%).`, type: 'positive' });
    } else if (forwardEpsGrowthPct <= -20) {
      score -= 15;
      negativeDomains.add('crecimiento');
      reasons.push({ text: `El consenso proyecta una contracción de EPS de ${Math.abs(forwardEpsGrowthPct).toFixed(1)}%.`, type: 'negative' });
    } else if (forwardEpsGrowthPct < -5) {
      score -= 8;
      negativeDomains.add('crecimiento');
      reasons.push({ text: `El EPS estimado caería ${Math.abs(forwardEpsGrowthPct).toFixed(1)}%.`, type: 'negative' });
    }
  } else {
    reasons.push({ text: 'No hay consenso forward de EPS utilizable para validar la tesis de crecimiento.', type: 'neutral' });
  }

  // D/E is not comparable for banks and lenders, where deposits are operating funding.
  if (!isFinancialCompany && debtToEquity !== null) {
    if (debtToEquity < 0.5) {
      score += 8;
      positiveDomains.add('balance');
      reasons.push({ text: 'Excelente salud financiera con niveles de deuda muy bajos.', type: 'positive' });
    } else if (debtToEquity > 2) {
      score -= 12;
      negativeDomains.add('balance');
      reasons.push({ text: `Nivel de deuda elevado (${debtToEquity.toFixed(1)}x capital). Posible riesgo de solvencia.`, type: 'negative' });
    }
  } else if (isFinancialCompany) {
    reasons.push({ text: 'Deuda/Equity no se usa como penalización: depósitos y fondeo son parte del negocio financiero.', type: 'neutral' });
  } else {
    reasons.push({ text: 'No hay un ratio deuda/capital actualizado; la solvencia queda parcialmente sin evaluar.', type: 'neutral' });
  }

  if (!isFinancialCompany) {
    if (netDebtToEbitda !== null && netDebtToEbitda > 4) {
      score -= 12;
      negativeDomains.add('balance');
      reasons.push({ text: `Deuda neta/EBITDA de ${netDebtToEbitda.toFixed(2)}x: apalancamiento difícil de cubrir con la generación operativa.`, type: 'negative' });
    } else if (netDebtToEbitda !== null && netDebtToEbitda < 1) {
      score += 4;
      positiveDomains.add('balance');
      reasons.push({ text: `Deuda neta/EBITDA baja (${netDebtToEbitda.toFixed(2)}x).`, type: 'positive' });
    } else if (netDebtToEbitda === null) {
      reasons.push({ text: 'No hay dato actualizado de deuda neta/EBITDA.', type: 'neutral' });
    }

    if (currentRatio !== null && currentRatio < 0.8) {
      score -= 8;
      negativeDomains.add('balance');
      reasons.push({ text: `Liquidez corriente muy ajustada (${currentRatio.toFixed(2)}x).`, type: 'negative' });
    } else if (currentRatio === null) {
      reasons.push({ text: 'No hay dato de liquidez corriente.', type: 'neutral' });
    }

    if (interestCoverage !== null && interestCoverage < 1.5) {
      score -= 10;
      negativeDomains.add('balance');
      reasons.push({ text: `Cobertura de intereses baja (${interestCoverage.toFixed(2)}x): riesgo para afrontar costos financieros.`, type: 'negative' });
    } else if (interestCoverage === null) {
      reasons.push({ text: 'No hay dato de cobertura de intereses.', type: 'neutral' });
    }
  }

  // Profitability thresholds differ for financial companies.
  if (roe !== null) {
    const strongRoe = isFinancialCompany ? 0.2 : 0.15;
    const weakRoe = isFinancialCompany ? 0.08 : 0.05;
    if (roe > strongRoe) {
      score += 8;
      positiveDomains.add('rentabilidad');
      reasons.push({ text: `Alta rentabilidad sobre el capital (ROE del ${(roe * 100).toFixed(1)}%).`, type: 'positive' });
    } else if (roe < weakRoe) {
      score -= 12;
      negativeDomains.add('rentabilidad');
      reasons.push({ text: `Rentabilidad moderada o baja (${(roe * 100).toFixed(1)}%).`, type: 'negative' });
    }
  } else {
    reasons.push({ text: 'No hay dato ROE actualizado para medir la rentabilidad del capital.', type: 'neutral' });
  }

  if (operatingMargin !== null) {
    if (operatingMargin < 0) {
      score -= 10;
      negativeDomains.add('rentabilidad');
      reasons.push({ text: `Margen operativo negativo (${(operatingMargin * 100).toFixed(1)}%).`, type: 'negative' });
    } else if (operatingMargin >= 0.2) {
      score += 4;
      positiveDomains.add('rentabilidad');
      reasons.push({ text: `Margen operativo robusto (${(operatingMargin * 100).toFixed(1)}%).`, type: 'positive' });
    } else {
      reasons.push({ text: `Margen operativo de ${(operatingMargin * 100).toFixed(1)}%.`, type: 'neutral' });
    }
  } else {
    reasons.push({ text: 'No hay dato de margen operativo; la calidad de resultados queda incompleta.', type: 'neutral' });
  }

  // Beta is a risk modifier, not a directional buy/sell signal by itself.
  if (beta !== null) {
    if (beta > 1.8) {
      score -= 8;
      negativeDomains.add('riesgo de mercado');
      reasons.push({ text: `Beta alta (${beta.toFixed(2)}): mayor volatilidad y riesgo de precio.`, type: 'negative' });
    } else if (beta < 0.8) {
      score += 2;
      reasons.push({ text: 'Beta baja: volatilidad histórica inferior a la del mercado.', type: 'positive' });
    } else {
      reasons.push({ text: `Beta ${beta.toFixed(2)}: riesgo de mercado intermedio.`, type: 'neutral' });
    }
  } else {
    reasons.push({ text: 'Beta no disponible; la volatilidad relativa no puede estimarse.', type: 'neutral' });
  }

  const price = asset.quote?.price ?? 0;
  const priceAvg50 = asset.quote?.priceAvg50 ?? 0;
  const priceAvg200 = asset.quote?.priceAvg200 ?? 0;
  if (price > 0 && priceAvg200 > 0) {
    const longTrendPct = ((price / priceAvg200) - 1) * 100;
    if (longTrendPct <= -20) {
      score -= 10;
      negativeDomains.add('tendencia');
      reasons.push({ text: `Precio ${Math.abs(longTrendPct).toFixed(1)}% bajo la media de 200 ruedas: tendencia de largo plazo bajista.`, type: 'negative' });
    } else if (longTrendPct >= 10) {
      score += 4;
      positiveDomains.add('tendencia');
      reasons.push({ text: `Precio ${longTrendPct.toFixed(1)}% sobre la media de 200 ruedas.`, type: 'positive' });
    } else {
      reasons.push({ text: `Precio ${longTrendPct.toFixed(1)}% respecto de la media de 200 ruedas.`, type: 'neutral' });
    }
  } else {
    reasons.push({ text: 'Media móvil de 200 ruedas no disponible para confirmar tendencia.', type: 'neutral' });
  }
  if (price > 0 && priceAvg50 > 0 && price < priceAvg50 * 0.85) {
    score -= 5;
    negativeDomains.add('tendencia');
    reasons.push({ text: 'El precio está más de 15% debajo de la media de 50 ruedas.', type: 'negative' });
  }

  // Directional calls require valuation plus independent evidence and adequate data.
  let status: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
  if (
    score >= 72 &&
    upsidePct !== null &&
    upsidePct >= 20 &&
    positiveDomains.size >= 2 &&
    valuationConfidence !== 'baja'
  ) {
    status = 'BUY';
  } else if (
    score <= 30 &&
    upsidePct !== null &&
    upsidePct <= -20 &&
    negativeDomains.size >= 2 &&
    valuationConfidence !== 'baja'
  ) {
    status = 'SELL';
  } else {
    reasons.push({
      text: status === 'HOLD' && (upsidePct === null || Math.abs(upsidePct) < 20)
        ? 'La valoración no supera el umbral mínimo de ±20% para una señal de compra/venta; se mantiene una postura neutral.'
        : `La señal direccional no cumple simultáneamente los umbrales de score, cobertura y confirmación independientes (positivas: ${positiveDomains.size}, riesgos: ${negativeDomains.size}).`,
      type: 'neutral',
    });
  }

  const availableSignals = [
    valuation.modelsUsed.length > 0,
    forwardEpsGrowthPct !== null,
    roe !== null,
    operatingMargin !== null,
    beta !== null,
    forwardPE !== null && forwardPE > 0,
    !isFinancialCompany && debtToEquity !== null,
    !isFinancialCompany && netDebtToEbitda !== null,
    !isFinancialCompany && currentRatio !== null,
    !isFinancialCompany && interestCoverage !== null,
    priceAvg200 > 0,
  ].filter(Boolean).length;
  const confidenceAdjustment = valuationConfidence === 'alta' ? 12 : valuationConfidence === 'media' ? 4 : -10;
  const confidence = Math.min(95, Math.max(15, 15 + availableSignals * 7 + confidenceAdjustment + Math.min(10, valuation.context.epsAnalystCount)));

  // Concentration is meaningful only when all holdings share a quoted currency and have prices.
  const holdingCurrencies = holdings.map((holding) =>
    portfolioData[holding.symbol]?.profile?.currency?.trim().toUpperCase()
  );
  const portfolioCurrency = holdingCurrencies[0];
  const canCompareAllocation = holdings.length > 0 &&
    Boolean(portfolioCurrency) &&
    holdingCurrencies.every((currency) => currency === portfolioCurrency) &&
    holdings.every((holding) => {
      const price = portfolioData[holding.symbol]?.quote?.price;
      return price !== undefined && Number.isFinite(price) && price > 0;
    });
  const totalMarketValue = canCompareAllocation
    ? holdings.reduce((sum, holding) => sum + holding.quantity * portfolioData[holding.symbol].quote.price, 0)
    : 0;
  const currentHolding = holdings.find(h => h.symbol === symbol);
  const currentAssetValue = (currentHolding?.quantity ?? 0) * (asset.quote?.price ?? 0);
  const sectorValue = holdings
    .filter(h => portfolioData[h.symbol]?.profile?.sector === sector)
    .reduce((sum, h) => sum + (h.quantity * (portfolioData[h.symbol]?.quote?.price ?? 0)), 0);

  const sectorAllocationPercent = canCompareAllocation && totalMarketValue > 0
    ? (sectorValue / totalMarketValue) * 100
    : null;
  const simulatedSectorValue = sectorValue - currentAssetValue;
  const simulatedTotalValue = totalMarketValue - currentAssetValue;
  const simulatedAllocationPercent = sectorAllocationPercent !== null && simulatedTotalValue > 0
    ? (simulatedSectorValue / simulatedTotalValue) * 100
    : null;
  if (sectorAllocationPercent !== null && sectorAllocationPercent >= 35) {
    reasons.push({ text: `Alta concentración: ${sector} representa ${sectorAllocationPercent.toFixed(1)}% del portafolio.`, type: 'negative' });
  } else if (sectorAllocationPercent !== null && sectorAllocationPercent >= 20) {
    reasons.push({ text: `Concentración sectorial relevante: ${sector} representa ${sectorAllocationPercent.toFixed(1)}% del portafolio.`, type: 'neutral' });
  } else if (sectorAllocationPercent === null) {
    reasons.push({ text: 'No se calcula la concentración sectorial porque faltan precios o las posiciones tienen distintas monedas de cotización.', type: 'neutral' });
  }

  return {
    status,
    confidence,
    reasons,
    techData: {
      pe,
      forwardPE,
      debtToEquity,
      netDebtToEbitda,
      currentRatio,
      interestCoverage,
      roe,
      operatingMargin,
      beta,
      isFinancialCompany,
    },
    impact: {
      sector,
      currentAllocationPercent: sectorAllocationPercent,
      simulatedAllocationPercent
    },
    valuation: {
      fairValue: valuation.fairValue,
      fairValueRange: valuation.fairValueRange,
      upsidePct,
      forwardEpsGrowthPct,
      confidence: valuationConfidence,
    },
  };
}
