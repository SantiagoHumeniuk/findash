import type {
  AssetKeyMetrics,
  AssetPriceTargetConsensus,
  AssetProfile,
  AssetQuote,
  AssetRatios,
} from '../../../types/dashboard';

type Category = 'valuation' | 'profitability' | 'financial_health' | 'momentum';

export interface SummaryScore {
  score: number;
  coverage: number;
  categoryScores: Record<Category, number>;
  strengths: string[];
  weaknesses: string[];
  reasons: string[];
  verdict: 'positive' | 'neutral' | 'negative';
  verdictText: string;
}

export interface SummaryAssetInput {
  profile: Pick<AssetProfile, 'sector' | 'industry' | 'beta'>;
  quote: Pick<AssetQuote, 'pe' | 'forwardPE' | 'forwardEPS' | 'trailingEPS' | 'price' | 'priceAvg50' | 'priceAvg200'>;
  ratios: Pick<AssetRatios,
    'date' | 'priceToEarningsRatio' | 'operatingProfitMargin' | 'netProfitMargin' |
    'debtToEquityRatio' | 'currentRatio' | 'interestCoverageRatio'>[];
  keyMetrics: Pick<AssetKeyMetrics, 'returnOnEquityTTM' | 'netDebtToEBITDATTM'>;
  priceTargetConsensus: Pick<AssetPriceTargetConsensus, 'targetConsensus'>;
}

function validNumber(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value);
}

function latestRatios(asset: SummaryAssetInput): SummaryAssetInput['ratios'][number] | null {
  return [...(asset.ratios ?? [])]
    .filter((ratio) => Number.isFinite(Date.parse(ratio.date)))
    .sort((left, right) => Date.parse(right.date) - Date.parse(left.date))[0] ?? null;
}

/**
 * Builds an absolute, explainable score from valuation, quality, balance-sheet,
 * and market-trend evidence. Missing metrics reduce coverage, not the score.
 */
export function scoreAssetSummary(asset: SummaryAssetInput): SummaryScore {
  const ratios = latestRatios(asset);
  const categoryWeights: Record<Category, number> = {
    valuation: 0.3,
    profitability: 0.3,
    financial_health: 0.2,
    momentum: 0.2,
  };
  const categoryPoints: Record<Category, number[]> = {
    valuation: [],
    profitability: [],
    financial_health: [],
    momentum: [],
  };
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const reasons: string[] = [];
  let totalSignals = 0;

  const addSignal = (category: Category, value: number | null | undefined, evaluate: (value: number) => {
    score: number;
    reason: string;
    polarity: 'positive' | 'negative' | 'neutral';
  }) => {
    if (!validNumber(value)) return;
    totalSignals += 1;
    const signal = evaluate(value);
    categoryPoints[category].push(signal.score);
    reasons.push(signal.reason);
    if (signal.polarity === 'positive') strengths.push(signal.reason);
    if (signal.polarity === 'negative') weaknesses.push(signal.reason);
  };

  const trailingPe = validNumber(asset.quote.pe) && asset.quote.pe > 0
    ? asset.quote.pe
    : ratios?.priceToEarningsRatio;
  const forwardPe = validNumber(asset.quote.forwardPE) && asset.quote.forwardPE > 0
    ? asset.quote.forwardPE
    : null;
  const forwardEps = validNumber(asset.quote.forwardEPS) && asset.quote.forwardEPS > 0
    ? asset.quote.forwardEPS
    : null;
  const trailingEps = validNumber(asset.quote.trailingEPS) && asset.quote.trailingEPS > 0
    ? asset.quote.trailingEPS
    : null;
  const operatingMargin = ratios?.operatingProfitMargin;
  const netMargin = ratios?.netProfitMargin;
  const roe = asset.keyMetrics?.returnOnEquityTTM || null;
  const debtToEquity = ratios?.debtToEquityRatio;
  const netDebtToEbitda = asset.keyMetrics?.netDebtToEBITDATTM || null;
  const currentRatio = ratios?.currentRatio;
  const interestCoverage = ratios?.interestCoverageRatio;
  const beta = asset.profile?.beta;
  const price = asset.quote?.price;
  const priceAvg50 = asset.quote?.priceAvg50;
  const priceAvg200 = asset.quote?.priceAvg200;
  const target = asset.priceTargetConsensus?.targetConsensus;
  const forwardGrowth = validNumber(forwardEps) && validNumber(trailingEps) && trailingEps > 0
    ? ((forwardEps / trailingEps) - 1) * 100
    : null;
  const targetUpside = validNumber(target) && validNumber(price) && price > 0 && target > 0
    ? ((target / price) - 1) * 100
    : null;
  const isFinancialCompany = /financial|bank|credit|fintech|payment|consumer finance/i.test(
    `${asset.profile?.sector ?? ''} ${asset.profile?.industry ?? ''}`,
  );

  addSignal('valuation', validNumber(trailingPe) && trailingPe > 0 ? trailingPe : null, (value) => ({
    score: value <= 15 ? 80 : value <= 25 ? 65 : value <= 40 ? 45 : 20,
    reason: value > 40
      ? `PER histórico elevado (${value.toFixed(1)}x).`
      : value <= 15
        ? `PER histórico moderado (${value.toFixed(1)}x).`
        : `PER histórico de ${value.toFixed(1)}x; requiere comparación sectorial.`,
    polarity: value <= 15 ? 'positive' : value > 40 ? 'negative' : 'neutral',
  }));
  addSignal('valuation', validNumber(forwardPe) && forwardPe > 0 ? forwardPe : null, (value) => ({
    score: value <= 15 ? 85 : value <= 25 ? 65 : value <= 40 ? 40 : 15,
    reason: value > 40
      ? `PER forward exigente (${value.toFixed(1)}x).`
      : value <= 15
        ? `PER forward atractivo (${value.toFixed(1)}x), sujeto a que se cumplan las estimaciones.`
        : `PER forward de ${value.toFixed(1)}x; las ganancias proyectadas aún son inciertas.`,
    polarity: value <= 15 ? 'positive' : value > 40 ? 'negative' : 'neutral',
  }));
  addSignal('valuation', targetUpside, (value) => ({
    score: value >= 25 ? 85 : value >= 10 ? 65 : value <= -20 ? 20 : 45,
    reason: value >= 10
      ? `El precio objetivo promedio implica un potencial de ${value.toFixed(1)}%.`
      : value <= -20
        ? `El precio supera en ${Math.abs(value).toFixed(1)}% al objetivo promedio disponible.`
        : `El consenso de precio objetivo implica ${value.toFixed(1)}% de potencial, una señal limitada.`,
    polarity: value >= 10 ? 'positive' : value <= -20 ? 'negative' : 'neutral',
  }));
  addSignal('profitability', roe, (value) => ({
    score: value >= 0.2 ? 85 : value >= 0.1 ? 65 : value < 0 ? 15 : 40,
    reason: value >= 0.2
      ? `ROE sólido de ${(value * 100).toFixed(1)}%.`
      : value < 0
        ? `ROE negativo (${(value * 100).toFixed(1)}%).`
        : `ROE de ${(value * 100).toFixed(1)}%; rentabilidad aún moderada.`,
    polarity: value >= 0.2 ? 'positive' : value < 0 ? 'negative' : 'neutral',
  }));
  addSignal('profitability', operatingMargin, (value) => ({
    score: value >= 0.2 ? 80 : value >= 0.1 ? 65 : value < 0 ? 15 : 40,
    reason: value >= 0.2
      ? `Margen operativo alto (${(value * 100).toFixed(1)}%).`
      : value < 0
        ? `Margen operativo negativo (${(value * 100).toFixed(1)}%).`
        : `Margen operativo de ${(value * 100).toFixed(1)}%.`,
    polarity: value >= 0.2 ? 'positive' : value < 0 ? 'negative' : 'neutral',
  }));
  addSignal('profitability', netMargin, (value) => ({
    score: value >= 0.15 ? 80 : value >= 0.05 ? 60 : value < 0 ? 15 : 40,
    reason: value < 0
      ? `Margen neto negativo (${(value * 100).toFixed(1)}%).`
      : `Margen neto de ${(value * 100).toFixed(1)}%.`,
    polarity: value >= 0.15 ? 'positive' : value < 0 ? 'negative' : 'neutral',
  }));
  addSignal('profitability', forwardGrowth, (value) => ({
    score: value >= 20 ? 80 : value >= 5 ? 65 : value <= -20 ? 15 : value < 0 ? 30 : 50,
    reason: value >= 5
      ? `EPS forward supera al trailing EPS en ${value.toFixed(1)}%; es una estimación, no un resultado realizado.`
      : `EPS forward indica una variación de ${value.toFixed(1)}% frente al trailing EPS.`,
    polarity: value >= 5 ? 'positive' : value < -5 ? 'negative' : 'neutral',
  }));

  if (!isFinancialCompany) {
    addSignal('financial_health', debtToEquity, (value) => ({
      score: value <= 0.5 ? 85 : value <= 1.5 ? 65 : value > 3 ? 15 : 40,
      reason: value > 3
        ? `Apalancamiento elevado: deuda/capital de ${value.toFixed(2)}x.`
        : `Deuda/capital de ${value.toFixed(2)}x.`,
      polarity: value <= 0.5 ? 'positive' : value > 3 ? 'negative' : 'neutral',
    }));
    addSignal('financial_health', netDebtToEbitda, (value) => ({
      score: value <= 1 ? 85 : value <= 2.5 ? 65 : value > 4 ? 15 : 40,
      reason: value > 4
        ? `Deuda neta/EBITDA elevada (${value.toFixed(2)}x).`
        : `Deuda neta/EBITDA de ${value.toFixed(2)}x.`,
      polarity: value <= 1 ? 'positive' : value > 4 ? 'negative' : 'neutral',
    }));
    addSignal('financial_health', currentRatio, (value) => ({
      score: value >= 1.5 ? 80 : value >= 1 ? 60 : 20,
      reason: value < 1
        ? `Liquidez corriente ajustada (${value.toFixed(2)}x).`
        : `Liquidez corriente de ${value.toFixed(2)}x.`,
      polarity: value >= 1.5 ? 'positive' : value < 1 ? 'negative' : 'neutral',
    }));
    addSignal('financial_health', interestCoverage, (value) => ({
      score: value >= 5 ? 80 : value >= 2 ? 60 : 15,
      reason: value < 2
        ? `Cobertura de intereses baja (${value.toFixed(2)}x).`
        : `Cobertura de intereses de ${value.toFixed(2)}x.`,
      polarity: value >= 5 ? 'positive' : value < 2 ? 'negative' : 'neutral',
    }));
  } else {
    reasons.push('Deuda/capital y liquidez tradicional no se puntúan para entidades financieras.');
  }

  addSignal('momentum', validNumber(price) && validNumber(priceAvg50) && priceAvg50 > 0
    ? (price / priceAvg50 - 1) * 100 : null, (value) => ({
    score: value >= 5 ? 75 : value <= -10 ? 20 : 50,
    reason: value >= 5
      ? `Precio ${value.toFixed(1)}% sobre su promedio de 50 ruedas.`
      : `Precio ${Math.abs(value).toFixed(1)}% ${value < 0 ? 'bajo' : 'sobre'} su promedio de 50 ruedas.`,
    polarity: value >= 5 ? 'positive' : value <= -10 ? 'negative' : 'neutral',
  }));
  addSignal('momentum', validNumber(price) && validNumber(priceAvg200) && priceAvg200 > 0
    ? (price / priceAvg200 - 1) * 100 : null, (value) => ({
    score: value >= 5 ? 80 : value <= -10 ? 15 : 50,
    reason: value >= 5
      ? `Tendencia de largo plazo positiva: ${value.toFixed(1)}% sobre el promedio de 200 ruedas.`
      : `Tendencia de largo plazo débil: ${value.toFixed(1)}% respecto del promedio de 200 ruedas.`,
    polarity: value >= 5 ? 'positive' : value <= -10 ? 'negative' : 'neutral',
  }));
  addSignal('momentum', validNumber(beta) && beta > 0 ? beta : null, (value) => ({
    score: value > 2 ? 20 : value > 1.5 ? 40 : value < 0.8 ? 70 : 55,
    reason: value > 2
      ? `Beta muy alta (${value.toFixed(2)}): riesgo de volatilidad elevado.`
      : `Beta de ${value.toFixed(2)}.`,
    polarity: value > 2 ? 'negative' : value < 0.8 ? 'positive' : 'neutral',
  }));

  const categoryScores = Object.fromEntries(
    Object.entries(categoryPoints).map(([category, points]) => [
      category,
      points.length > 0 ? points.reduce((sum, point) => sum + point, 0) / points.length : 50,
    ]),
  ) as Record<Category, number>;
  const presentCategories = Object.entries(categoryPoints)
    .filter(([, points]) => points.length > 0)
    .map(([category]) => category as Category);
  const totalWeight = presentCategories.reduce((sum, category) => sum + categoryWeights[category], 0);
  const score = totalWeight > 0
    ? presentCategories.reduce((sum, category) => sum + categoryScores[category] * categoryWeights[category], 0) / totalWeight
    : 50;
  const coverage = Math.round((totalSignals / 14) * 100);
  const hasHighRisk = weaknesses.some((reason) =>
    /negativo|elevado|ajustada|baja|exigente/i.test(reason),
  );
  const verdict = coverage >= 40 && score >= 72 && !hasHighRisk
    ? 'positive'
    : coverage >= 35 && (score <= 32 || (score < 42 && weaknesses.length >= 3))
      ? 'negative'
      : 'neutral';
  const verdictText = coverage < 35
    ? `Cobertura limitada (${coverage}% de los indicadores disponibles): las señales no alcanzan para una conclusión direccional confiable.`
    : verdict === 'positive'
      ? `Fundamentos y tendencia favorables (score ${Math.round(score)}/100), con ${coverage}% de cobertura y sin alertas críticas detectadas. No implica una garantía de rendimiento.`
      : verdict === 'negative'
        ? `Señales de riesgo predominantes (score ${Math.round(score)}/100; cobertura ${coverage}%). Revisar la tesis, la valoración y el tamaño de la posición.`
        : `Señales mixtas (score ${Math.round(score)}/100; cobertura ${coverage}%): no hay evidencia suficiente para una señal clara de compra o venta.`;

  return {
    score: Math.round(score),
    coverage,
    categoryScores,
    strengths: strengths.slice(0, 4),
    weaknesses: weaknesses.slice(0, 5),
    reasons,
    verdict,
    verdictText,
  };
}
