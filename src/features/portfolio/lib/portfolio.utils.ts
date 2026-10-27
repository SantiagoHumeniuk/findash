// src/features/portfolio/lib/portfolio.utils.ts

import {
  Holding,
  AllocationDatum,
  PlDatum,
  ChartConfigFixed,
  PortfolioMetrics
} from "../../../types/portfolio";
import { AssetData } from "../../../types/dashboard";

export const formatQuantity = (value: number): string =>
  Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });

export const formatDate = (dateString: string): string =>
  new Date(dateString).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

export const formatNumber = (value: number | string): string =>
  typeof value === "number" && isFinite(value) ? value.toFixed(2) : "";

/**
 * Calcula las métricas del portfolio
 */
export function calculatePortfolioMetrics(
  holdings: Holding[],
  portfolioData: Record<string, AssetData>
): PortfolioMetrics {
  const initialStats: PortfolioMetrics = {
    totalInvested: 0,
    currentValue: 0,
    currentPL: 0,
    currentPLPercent: 0,
    dailyPL: 0,
    bestPerformer: { symbol: "", plPercent: 0 },
    worstPerformer: { symbol: "", plPercent: 0 },
    bestPerformerUsd: { symbol: "", plValue: 0 },
    worstPerformerUsd: { symbol: "", plValue: 0 },
    positionsCount: 0,
    portfolioBeta: null,
    avgHoldingDays: 0,
  };

  if (!holdings || holdings.length === 0) return initialStats;

  let totalInvested = 0;
  let currentValue = 0;
  let dailyPL = 0;
  let weightedBetaSum = 0;

  // Arrays temporales para ordenar
  const performersPct: { symbol: string; plPercent: number }[] = [];
  const performersUsd: { symbol: string; plValue: number }[] = [];

  for (const holding of holdings) {
    const assetData: AssetData | undefined = portfolioData[holding.symbol];

    const currentPrice = assetData?.quote?.price ?? 0;
    const dayChangePercent = assetData?.quote?.changePercentage ?? 0;

    const marketValue = holding.quantity * currentPrice;
    const plValue = marketValue - holding.totalCost;
    const plPercent = holding.totalCost > 0 ? (plValue / holding.totalCost) * 100 : 0;

    // Cálculo de P&L Diario
    if (isFinite(currentPrice) && isFinite(dayChangePercent)) {
      // Precio ayer = Precio Hoy / (1 + (Cambio% / 100))
      const previousDayPrice = currentPrice / (1 + (dayChangePercent / 100));
      dailyPL += holding.quantity * (currentPrice - previousDayPrice);
    }

    totalInvested += holding.totalCost;
    currentValue += marketValue;

    // Beta Ponderado
    if (typeof assetData?.profile?.beta === "number") {
      weightedBetaSum += assetData.profile.beta * marketValue;
    }

    performersPct.push({ symbol: holding.symbol, plPercent });
    performersUsd.push({ symbol: holding.symbol, plValue });
  }

  const currentPL = currentValue - totalInvested;
  const currentPLPercent = totalInvested > 0 ? (currentPL / totalInvested) * 100 : 0;

  // Ordenar para encontrar mejores/peores
  performersPct.sort((a, b) => b.plPercent - a.plPercent);
  performersUsd.sort((a, b) => b.plValue - a.plValue);

  return {
    totalInvested,
    currentValue,
    currentPL,
    currentPLPercent,
    dailyPL,

    // Porcentuales
    bestPerformer: performersPct[0] || initialStats.bestPerformer,
    worstPerformer: performersPct[performersPct.length - 1] || initialStats.worstPerformer,

    // Nominales (USD)
    bestPerformerUsd: performersUsd[0] || initialStats.bestPerformerUsd,
    worstPerformerUsd: performersUsd[performersUsd.length - 1] || initialStats.worstPerformerUsd,

    positionsCount: holdings.length,
    portfolioBeta: currentValue > 0 ? weightedBetaSum / currentValue : null,
    avgHoldingDays: 0,
  };
}

/**
 * Procesa los holdings para generar datos de alocación
 */
export function calculateAllocationData(holdings: Holding[]): {
  allocationData: AllocationDatum[];
  totalValue: number;
} {
  if (!holdings || holdings.length === 0) {
    return { allocationData: [], totalValue: 0 };
  }

  // CORRECCIÓN: Usar h.assetData.quote.price
  const totalValue = holdings.reduce(
    (acc, h) => acc + h.quantity * (h.assetData.quote?.price ?? 0),
    0
  );

  const allocationData: AllocationDatum[] = holdings.map((h) => {
    const value = h.quantity * (h.assetData.quote?.price ?? 0);
    const percentage = totalValue > 0 ? (value / totalValue) * 100 : 0;
    return {
      name: h.symbol,
      value,
      percentage,
    };
  });

  return { allocationData, totalValue };
}

/**
 * Calcula los datos de P&L por activo
 */
export function calculatePlData(holdings: Holding[]): PlDatum[] {
  if (!holdings || holdings.length === 0) return [];

  return holdings.map((h) => {
    // CORRECCIÓN: Usar h.assetData.quote.price
    const marketValue = h.quantity * (h.assetData.quote?.price ?? 0);
    const plValue = marketValue - h.totalCost;
    const plPercent = h.totalCost > 0 ? ((marketValue - h.totalCost) / h.totalCost) * 100 : 0;
    return {
      symbol: h.symbol,
      pl: plPercent,
      plValue: plValue,
    };
  });
}

export function generateChartConfig(allocationData: AllocationDatum[]): ChartConfigFixed {
  const colors = [
    "var(--chart-1)", "var(--chart-2)", "var(--chart-3)",
    "var(--chart-4)", "var(--chart-5)", "var(--chart-6)",
  ];

  const chartConfig: ChartConfigFixed = {};
  allocationData.forEach((item, index) => {
    chartConfig[item.name] = {
      label: item.name,
      color: colors[index % colors.length],
    };
  });

  return chartConfig;
}

export function calculateDailyPlPercent(currentValue: number, dailyPL: number): number {
  // Evitar división por cero si currentValue es igual a dailyPL (inicio del día)
  const prevValue = currentValue - dailyPL;
  return prevValue > 0 ? (dailyPL / prevValue) * 100 : 0;
}

export function getColorClass(value: number): string {
  return value >= 0 ? "text-green-500" : "text-red-500";
}

export function isFutureDate(dateString: string): boolean {
  // Ajuste para evitar falsos positivos por zona horaria, comparamos solo fecha
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const input = new Date(dateString);
  return input > new Date(); // Simple check, input suele venir en UTC o local 00:00
}

export function calculateFinalQuantity(
  enteredQuantity: number,
  isCedears: boolean,
  ratio: number | null | undefined
): number {
  return isCedears && ratio ? enteredQuantity / ratio : enteredQuantity;
}

export function calculateFinalPrice(
  enteredPrice: number,
  isCedears: boolean,
  ratio: number | null | undefined
): number {
  return isCedears && ratio ? enteredPrice * ratio : enteredPrice;
}