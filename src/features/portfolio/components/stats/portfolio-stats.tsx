import { useMemo } from 'react';
import { useCclRate } from '../../../../hooks/use-ccl-rate';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Holding, PortfolioContextType } from '../../../../types/portfolio';
import { AssetData } from '../../../../types/dashboard';
import { formatCurrency, formatPercent } from '../../../../lib/utils';
import { calculatePortfolioMetrics, formatNumber, getColorClass } from '../../lib/portfolio.utils';
import { PerformanceMetrics } from '../../../../utils/performance-metrics';
import {
  Calendar,
  Clock,
  ShieldAlert,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

const formatSignedCurrency = (value: number) =>
  `${value >= 0 ? '+' : '−'}${formatCurrency(Math.abs(value))}`;

interface PortfolioStatsProps {
  holdings: Holding[];
  totalPerformance: PortfolioContextType['totalPerformance'];
  portfolioData: Record<string, AssetData>;
  avgHoldingDays?: number;
  historicalMetrics?: PerformanceMetrics;
  historyCoveragePercent?: number;
  historyUnavailableSymbols?: string[];
  historyIsLoading?: boolean;
}

function MetricLine({ label, value, className = '' }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-semibold tabular-nums text-right ${className}`}>{value}</span>
    </div>
  );
}

export function PortfolioStats({
  holdings,
  totalPerformance,
  portfolioData,
  avgHoldingDays,
  historicalMetrics,
  historyCoveragePercent = 0,
  historyUnavailableSymbols = [],
  historyIsLoading = false,
}: PortfolioStatsProps) {
  const { data: ccl } = useCclRate();
  const metrics = useMemo(() => {
    const portfolioMetrics = calculatePortfolioMetrics(holdings, portfolioData);
    return { ...portfolioMetrics, avgHoldingDays: avgHoldingDays ?? 0 };
  }, [holdings, portfolioData, avgHoldingDays]);
  const dailyPlPercent = metrics.currentValue > metrics.dailyPL
    ? (metrics.dailyPL / (metrics.currentValue - metrics.dailyPL)) * 100
    : 0;
  const isDailyPositive = metrics.dailyPL >= 0;
  const hasHistoricalYear = Boolean(historicalMetrics?.bestYear ?? historicalMetrics?.worstYear);
  const largestPosition = useMemo(() => {
    if (metrics.currentValue <= 0) return null;
    const largest = holdings.reduce<{ symbol: string; value: number } | null>((current, holding) => {
      const price = portfolioData[holding.symbol]?.quote?.price ?? 0;
      const value = holding.quantity * (Number.isFinite(price) ? price : 0);
      return !current || value > current.value ? { symbol: holding.symbol, value } : current;
    }, null);
    return largest
      ? { symbol: largest.symbol, weight: (largest.value / metrics.currentValue) * 100 }
      : null;
  }, [holdings, portfolioData, metrics.currentValue]);
  const positivePositionPercent = useMemo(() => {
    let valuedPositions = 0;
    let positivePositions = 0;

    for (const holding of holdings) {
      const currentPrice = portfolioData[holding.symbol]?.quote?.price;
      if (typeof currentPrice !== 'number' || !Number.isFinite(currentPrice) || currentPrice <= 0) continue;

      valuedPositions += 1;
      if (holding.quantity * currentPrice > holding.totalCost) positivePositions += 1;
    }

    return valuedPositions > 0 ? (positivePositions / valuedPositions) * 100 : null;
  }, [holdings, portfolioData]);

  return (
    <section aria-label="Resumen del portafolio" className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="flex h-full min-h-56 flex-col justify-between gap-5 p-5 sm:p-6">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Valor actual del portafolio</p>
                <p className="mt-1 break-words text-3xl font-bold tracking-tight sm:text-4xl">
                  {formatCurrency(metrics.currentValue)}
                </p>
                {ccl?.rate && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    ≈ {(metrics.currentValue * ccl.rate).toLocaleString('es-AR', {
                      style: 'currency',
                      currency: 'ARS',
                      maximumFractionDigits: 0,
                    })}
                  </p>
                )}
              </div>
              <div className="shrink-0 sm:text-right">
                <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold ${
                  isDailyPositive
                    ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                    : 'bg-red-500/10 text-red-600 dark:text-red-400'
                }`}>
                  {isDailyPositive
                    ? <TrendingUp aria-hidden="true" className="size-4" />
                    : <TrendingDown aria-hidden="true" className="size-4" />}
                  {formatSignedCurrency(metrics.dailyPL)} ({formatPercent(dailyPlPercent)})
                </span>
                <p className="mt-1 text-xs text-muted-foreground">Resultado del día</p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 border-t pt-3">
              <div>
                <p className="text-sm font-medium">Posiciones en ganancia</p>
              </div>
              <p className={`text-xl font-bold tabular-nums ${
                positivePositionPercent === null
                  ? 'text-muted-foreground'
                  : positivePositionPercent >= 50
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
              }`}>
                {positivePositionPercent === null ? 'N/D' : formatPercent(positivePositionPercent)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ganancia total histórica</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className={`text-3xl font-bold tracking-tight ${getColorClass(totalPerformance.pl)}`}>
                {formatSignedCurrency(totalPerformance.pl)}
              </span>
              <span className={`rounded-full bg-muted px-2 py-1 text-xs font-semibold ${getColorClass(totalPerformance.pl)}`}>
                {formatPercent(totalPerformance.percent)}
              </span>
            </div>
            <div className="space-y-2 border-t pt-3">
              <MetricLine label="Costo total invertido" value={formatCurrency(metrics.totalInvested)} />
              <MetricLine label="G/P de posiciones abiertas" value={formatSignedCurrency(metrics.currentPL)} className={getColorClass(metrics.currentPL)} />
              <MetricLine label="Rendimiento actual" value={formatPercent(metrics.currentPLPercent)} className={getColorClass(metrics.currentPL)} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert aria-hidden="true" className="size-4 text-primary" />
              Riesgo y permanencia
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <MetricLine
              label="Beta ponderado"
              value={metrics.portfolioBeta === null ? 'N/D' : formatNumber(metrics.portfolioBeta)}
            />
            <MetricLine
              label="Máx. caída histórica"
              value={historicalMetrics?.maxDrawdown == null
                ? 'N/D'
                : `${(historicalMetrics.maxDrawdown * 100).toFixed(2)}%`}
              className={historicalMetrics?.maxDrawdown == null ? '' : 'text-red-500'}
            />
            <MetricLine
              label="Permanencia promedio"
              value={<span className="inline-flex items-center gap-1"><Clock aria-hidden="true" className="size-3.5" />{Math.round(metrics.avgHoldingDays)} días</span>}
            />
            <MetricLine
              label="Mayor exposición"
              value={largestPosition
                ? `${largestPosition.symbol} · ${formatPercent(largestPosition.weight)}`
                : 'N/D'}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Target aria-hidden="true" className="size-4 text-primary" />
              Mejores y peores activos
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-green-500/10 bg-green-500/5 p-3">
              <p className="text-xs text-muted-foreground">Mejor en $</p>
              <p className="mt-1 truncate font-semibold">{metrics.bestPerformerUsd.symbol || '—'}</p>
              <p className={`mt-1 text-sm font-semibold ${getColorClass(metrics.bestPerformerUsd.plValue)}`}>
                {metrics.bestPerformerUsd.symbol
                  ? formatSignedCurrency(metrics.bestPerformerUsd.plValue)
                  : '—'}
              </p>
            </div>
            <div className="rounded-lg border border-red-500/10 bg-red-500/5 p-3">
              <p className="text-xs text-muted-foreground">Peor en $</p>
              <p className="mt-1 truncate font-semibold">{metrics.worstPerformerUsd.symbol || '—'}</p>
              <p className={`mt-1 text-sm font-semibold ${getColorClass(metrics.worstPerformerUsd.plValue)}`}>
                {metrics.worstPerformerUsd.symbol ? formatSignedCurrency(metrics.worstPerformerUsd.plValue) : '—'}
              </p>
            </div>
            <div className="rounded-lg border border-green-500/10 bg-green-500/5 p-3">
              <p className="text-xs text-muted-foreground">Mejor en %</p>
              <p className="mt-1 truncate font-semibold">{metrics.bestPerformer.symbol || '—'}</p>
              <p className={`mt-1 text-sm font-semibold ${getColorClass(metrics.bestPerformer.plPercent)}`}>
                {metrics.bestPerformer.symbol
                  ? formatPercent(metrics.bestPerformer.plPercent)
                  : '—'}
              </p>
            </div>
            <div className="rounded-lg border border-red-500/10 bg-red-500/5 p-3">
              <p className="text-xs text-muted-foreground">Peor en %</p>
              <p className="mt-1 truncate font-semibold">{metrics.worstPerformer.symbol || '—'}</p>
              <p className={`mt-1 text-sm font-semibold ${getColorClass(metrics.worstPerformer.plPercent)}`}>
                {metrics.worstPerformer.symbol
                  ? formatPercent(metrics.worstPerformer.plPercent)
                  : '—'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar aria-hidden="true" className="size-4 text-primary" />
              Años simulados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {hasHistoricalYear ? (
              <>
                <MetricLine
                  label="Mejor"
                  value={historicalMetrics?.bestYear
                    ? `${historicalMetrics.bestYear.year} · ${formatPercent(historicalMetrics.bestYear.return * 100)}`
                    : 'N/D'}
                  className="text-green-600 dark:text-green-400"
                />
                <MetricLine
                  label="Peor"
                  value={historicalMetrics?.worstYear
                    ? `${historicalMetrics.worstYear.year} · ${formatPercent(historicalMetrics.worstYear.return * 100)}`
                    : 'N/D'}
                  className="text-red-600 dark:text-red-400"
                />
              </>
            ) : historyIsLoading ? (
              <p className="text-sm text-muted-foreground">Cargando historial de las acciones locales...</p>
            ) : (
              <p className="text-sm text-muted-foreground">No hay suficiente historial para simular años.</p>
            )}
            {historyCoveragePercent > 0 && (
              <p className="border-t pt-3 text-xs text-muted-foreground">
                Cobertura histórica: {formatPercent(historyCoveragePercent)} del valor actual.
                La simulación usa las tenencias actuales y no incluye compras, ventas ni la variación histórica del CCL.
              </p>
            )}
            {!historyIsLoading && historyUnavailableSymbols.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Sin historial disponible para: {historyUnavailableSymbols.join(', ')}.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
