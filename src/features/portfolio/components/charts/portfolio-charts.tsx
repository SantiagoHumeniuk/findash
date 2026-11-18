// src/features/portfolio/components/charts/portfolio-charts.tsx

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Holding } from "../../../../types/portfolio";
import { BarChart3, PieChart as PieChartIcon } from "lucide-react";
import { formatCurrency, formatPercent } from "../../../../lib/utils";
import {
  calculateAllocationData,
  calculatePlData,
  generateChartConfig
} from "../../lib/portfolio.utils";
import { AssetHistorical, AssetData } from "../../../../types/dashboard";
import { HistoricalPerformanceChart } from "../../../dashboard/components/charts/historical-performance-chart";
import { AllocationChart } from "./allocation-chart";
import { usePortfolioAnalytics } from "../../hooks/use-portfolio-analytics";

/**
 * Hook personalizado para procesar datos de gráficos del portfolio.
 * Memoiza los cálculos para evitar recalcular en cada render.
 * 
 * @param holdings - Array de holdings actuales del portfolio
 * @returns Datos procesados para los gráficos (allocación, P&L, configuración)
 */
const useChartData = (holdings: Holding[]) => {
  return useMemo(() => {
    const { allocationData } = calculateAllocationData(holdings);
    const plData = calculatePlData(holdings);
    const chartConfig = generateChartConfig(allocationData);

    return { allocationData, plData, chartConfig };
  }, [holdings]);
};

/**
 * Props para el componente PortfolioCharts
 */
interface PortfolioChartsProps {
  /** Holdings actuales del portfolio */
  holdings: Holding[];
  /** Historial de precios agregado del portfolio (opcional) */
  portfolioHistory?: AssetHistorical[];
  /** Datos completos del dashboard para acceder a SPY y QQQ */
  portfolioData?: Record<string, AssetData>;
}

/**
 * Componente principal de gráficos del portfolio.
 * Muestra visualizaciones de distribución, rendimiento, y análisis sectorial/geográfico.
 * 
 * Optimizado con React.memo para evitar renders cuando los props no cambian.
 * 
 * @param holdings - Holdings actuales del portfolio
 * @param portfolioHistory - Historial de rendimiento agregado (opcional)
 */
export const PortfolioCharts = React.memo(function PortfolioCharts({ holdings, portfolioHistory, portfolioData }: PortfolioChartsProps) {
  const { allocationData, plData, chartConfig } = useChartData(holdings);
  const { data: analyticsData, isLoading: isAnalyticsLoading } = usePortfolioAnalytics();
  const sortedAllocation = useMemo(
    () => [...allocationData].sort((a, b) => b.value - a.value),
    [allocationData],
  );
  const sortedReturns = useMemo(
    () => [...plData].sort((a, b) => b.pl - a.pl),
    [plData],
  );
  const maxAllocation = Math.max(1, ...sortedAllocation.map((item) => item.percentage));
  const maxReturn = Math.max(1, ...sortedReturns.map((item) => Math.abs(item.pl)));

  // Mock AssetData para el gráfico histórico
  // Memoized para evitar recrear el objeto en cada render si la historia no cambia
  const portfolioAsset = useMemo((): AssetData | null => {
    if (!portfolioHistory || portfolioHistory.length === 0) return null;

    const lastPoint = portfolioHistory[portfolioHistory.length - 1];

    // Construimos un objeto AssetData mínimo necesario para el componente HistoricalPerformanceChart
    return {
      symbol: 'PORTFOLIO',
      profile: {
        symbol: 'PORTFOLIO',
        companyName: 'Mi Portafolio',
        price: lastPoint.close,
        currency: 'USD',
        exchangeFullName: 'Personal',
        industry: 'Investment',
        website: '',
        description: 'Evolución histórica agregada.',
        ceo: 'Tú',
        sector: 'Financial',
        country: 'Global',
        fullTimeEmployees: '0',
        phone: '',
        address: '',
        city: '',
        state: '',
        zip: '',
        image: '',
        ipoDate: '',
        defaultImage: true,
        isEtf: false,
        isActivelyTrading: true,
        isAdr: false,
        isFund: true,
        beta: 1,
        marketCap: lastPoint.close,
        lastDividend: 0,
        volume: 0,
        averageVolume: 0,
        range: '',
        change: lastPoint.change ?? 0,
        changePercentage: lastPoint.changePercent ?? 0,
        cik: '',
        isin: '',
        cusip: '',
        exchange: ''
      },
      quote: {
        symbol: 'PORTFOLIO',
        name: 'Mi Portafolio',
        price: lastPoint.close,
        change: lastPoint.change ?? 0,
        changePercentage: lastPoint.changePercent ?? 0,
        volume: 0,
        dayLow: lastPoint.low,
        dayHigh: lastPoint.high,
        yearHigh: 0,
        yearLow: 0,
        marketCap: lastPoint.close,
        priceAvg50: 0,
        priceAvg200: 0,
        exchange: '',
        open: lastPoint.open,
        previousClose: lastPoint.close,
        timestamp: new Date(lastPoint.date).getTime()
      },
      historicalReturns: portfolioHistory,
      keyMetrics: {
        symbol: 'PORTFOLIO',
        marketCap: lastPoint.close,
        enterpriseValueTTM: 0,
        evToSalesTTM: 0,
        evToOperatingCashFlowTTM: 0,
        evToFreeCashFlowTTM: 0,
        evToEBITDATTM: 0,
        netDebtToEBITDATTM: 0,
        currentRatioTTM: 0,
        incomeQualityTTM: 0,
        grahamNumberTTM: 0,
        grahamNetNetTTM: 0,
        taxBurdenTTM: 0,
        interestBurdenTTM: 0,
        workingCapitalTTM: 0,
        investedCapitalTTM: 0,
        returnOnAssetsTTM: 0,
        operatingReturnOnAssetsTTM: 0,
        returnOnTangibleAssetsTTM: 0,
        returnOnEquityTTM: 0,
        returnOnInvestedCapitalTTM: 0,
        returnOnCapitalEmployedTTM: 0,
        earningsYieldTTM: 0,
        freeCashFlowYieldTTM: 0,
        capexToOperatingCashFlowTTM: 0,
        capexToDepreciationTTM: 0,
        capexToRevenueTTM: 0,
        salesGeneralAndAdministrativeToRevenueTTM: 0,
        researchAndDevelopementToRevenueTTM: 0,
        stockBasedCompensationToRevenueTTM: 0,
        intangiblesToTotalAssetsTTM: 0,
        averageReceivablesTTM: 0,
        averagePayablesTTM: 0,
        averageInventoryTTM: 0,
        daysOfSalesOutstandingTTM: 0,
        daysOfPayablesOutstandingTTM: 0,
        daysOfInventoryOutstandingTTM: 0,
        operatingCycleTTM: 0,
        cashConversionCycleTTM: 0,
        freeCashFlowToEquityTTM: 0,
        freeCashFlowToFirmTTM: 0,
        tangibleAssetValueTTM: 0,
        netCurrentAssetValueTTM: 0
      },
      priceTarget: {
        symbol: 'PORTFOLIO',
        lastMonthCount: 0,
        lastMonthAvgPriceTarget: 0,
        lastQuarterCount: 0,
        lastQuarterAvgPriceTarget: 0,
        lastYearCount: 0,
        lastYearAvgPriceTarget: 0,
        allTimeCount: 0,
        allTimeAvgPriceTarget: 0,
        publishers: []
      },
      dcf: [],
      rating: {
        symbol: 'PORTFOLIO',
        rating: '',
        overallScore: 0,
        discountedCashFlowScore: 0,
        returnOnEquityScore: 0,
        returnOnAssetsScore: 0,
        debtToEquityScore: 0,
        priceToEarningsScore: 0,
        priceToBookScore: 0
      },
      geography: {
        symbol: 'PORTFOLIO',
        fiscalYear: new Date().getFullYear(),
        period: 'FY',
        reportedCurrency: 'USD',
        date: new Date().toISOString(),
        data: {}
      },
      production: {
        symbol: 'PORTFOLIO',
        fiscalYear: new Date().getFullYear(),
        period: 'FY',
        reportedCurrency: 'USD',
        date: new Date().toISOString(),
        data: {}
      },
      priceTargetConsensus: {
        symbol: 'PORTFOLIO',
        targetHigh: 0,
        targetLow: 0,
        targetConsensus: 0,
        targetMedian: 0
      },
      keyMetricsYearly: [],
      dcfLevered: {
        symbol: 'PORTFOLIO',
        date: new Date().toISOString(),
        dcf: 0,
        'Stock Price': lastPoint.close
      },
      stockPriceChange: {
        symbol: 'PORTFOLIO',
        '1D': 0,
        '5D': 0,
        '1M': 0,
        '3M': 0,
        '6M': 0,
        ytd: 0,
        '1Y': 0,
        '3Y': 0,
        '5Y': 0,
        '10Y': 0,
        max: 0
      },
      ratios: [],
      analystEstimates: [],
      gradesConsensus: {
        symbol: 'PORTFOLIO',
        strongBuy: 0,
        buy: 0,
        hold: 0,
        sell: 0,
        strongSell: 0,
        consensus: ''
      }
    };
  }, [portfolioHistory]);

  const historicalAssets = useMemo(() => {
    const arr: AssetData[] = [];
    if (portfolioAsset) arr.push(portfolioAsset);
    if (portfolioData?.SPY) arr.push(portfolioData.SPY);
    if (portfolioData?.QQQ) arr.push(portfolioData.QQQ);
    return arr;
  }, [portfolioAsset, portfolioData]);

  if (holdings.length === 0) return null;

  return (
    <div className="space-y-4">
      {portfolioAsset && <HistoricalPerformanceChart assets={historicalAssets} />}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="flex"
        >
          <Card className="flex w-full flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <PieChartIcon className="size-4 text-primary sm:size-5" /> Distribución por activos
              </CardTitle>
              <CardDescription>Qué parte de tu portafolio representa cada posición.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className="flex h-3 overflow-hidden rounded-full bg-muted"
                role="img"
                aria-label={sortedAllocation.map((entry) => `${entry.name}: ${entry.percentage.toFixed(1)}%`).join(', ')}
              >
                {sortedAllocation.map((entry, index) => (
                  <span
                    key={entry.name}
                    className="h-full min-w-0.5"
                    style={{
                      width: `${entry.percentage}%`,
                      backgroundColor: chartConfig[entry.name]?.color ?? `var(--chart-${(index % 6) + 1})`,
                    }}
                  />
                ))}
              </div>
              <div className="space-y-2.5">
                {sortedAllocation.map((entry, index) => {
                  const color = chartConfig[entry.name]?.color ?? `var(--chart-${(index % 6) + 1})`;
                  return (
                    <div key={entry.name} className="grid grid-cols-[minmax(3.5rem,4rem)_minmax(2rem,1fr)_3.25rem_5.5rem] items-center gap-2 text-sm sm:grid-cols-[4.5rem_minmax(2rem,1fr)_3.5rem_6rem]">
                      <span className="truncate font-medium" title={entry.name}>{entry.name}</span>
                      <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <span className="block h-full rounded-full" style={{ width: `${(entry.percentage / maxAllocation) * 100}%`, backgroundColor: color }} />
                      </span>
                      <span className="text-right tabular-nums text-muted-foreground">{entry.percentage.toFixed(1)}%</span>
                      <span className="text-right tabular-nums">{formatCurrency(entry.value)}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.05 }}
          className="flex"
        >
          <Card className="w-full">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <BarChart3 className="size-4 text-primary sm:size-5" /> Retorno por activo
              </CardTitle>
              <CardDescription>Ordenado de mejor a peor desde tu precio promedio.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {sortedReturns.map((entry) => {
                const isPositive = entry.pl >= 0;
                const width = `${Math.max((Math.abs(entry.pl) / maxReturn) * 50, 1)}%`;
                return (
                  <div key={entry.symbol} className="grid grid-cols-[3.5rem_minmax(0,1fr)_5.5rem] items-center gap-2 text-sm sm:grid-cols-[4.5rem_minmax(0,1fr)_6rem]">
                    <span className="truncate font-medium" title={entry.symbol}>{entry.symbol}</span>
                    <span
                      className="relative h-5"
                      role="img"
                      aria-label={`${entry.symbol}: ${formatPercent(entry.pl)}`}
                    >
                      <span className="absolute inset-y-0 left-1/2 w-px bg-border" />
                      <span
                        className={`absolute top-1/2 h-2.5 -translate-y-1/2 rounded-full ${isPositive ? 'bg-green-500' : 'bg-red-500'}`}
                        style={isPositive
                          ? { left: '50%', width }
                          : { right: '50%', width }}
                      />
                    </span>
                    <span className={`text-right text-xs font-semibold tabular-nums sm:text-sm ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {isPositive ? '▲' : '▼'} {formatPercent(entry.pl)}
                    </span>
                  </div>
                );
              })}
              <div className="flex items-center gap-4 border-t pt-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-green-500" /> Ganancia</span>
                <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-red-500" /> Pérdida</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {Boolean(analyticsData ?? isAnalyticsLoading) && (
        <details className="group rounded-xl border bg-card">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
            Análisis avanzado
            <span className="text-xs text-muted-foreground group-open:hidden">Ver exposición por sector y país</span>
            <span className="hidden text-xs text-muted-foreground group-open:inline">Ocultar análisis</span>
          </summary>
          <div className="space-y-4 border-t p-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <AllocationChart
                data={analyticsData?.sectorAllocation ?? []}
                type="sector"
                title="Diversificación por sector"
                description="Exposición de tu portafolio a diferentes industrias."
                isLoading={isAnalyticsLoading}
              />
              <AllocationChart
                data={analyticsData?.countryAllocation ?? []}
                type="country"
                title="Exposición geográfica"
                description="Distribución de tus activos por país de origen."
                isLoading={isAnalyticsLoading}
              />
            </div>
          </div>
        </details>
      )}
    </div>
  );
});