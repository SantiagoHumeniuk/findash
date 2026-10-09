// src/features/dashboard/components/charts/historical-performance-chart.tsx

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "../../../../components/charts/lazy-recharts"
import { AssetData } from "../../../../types/dashboard"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card"
import { ChartContainer, ChartTooltip, ChartLegend, ChartLegendContent } from "../../../../components/ui/chart"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../../components/ui/select"
import { Checkbox } from "../../../../components/ui/checkbox"
import { AreaChartIcon } from "lucide-react"
import { useAuth } from "../../../../hooks/use-auth"
import { useConfig } from "../../../../hooks/use-config"
import { hasApiCallsAvailable, incrementApiCallCounter } from "../../../../services/api/apiLimiter"
import { fetchYahooFinanceQuotes } from "../../../../services/api/yahoo-finance-api"
import { normalizeHistoricalPerformance, type HistoricalPerformanceRow } from "../../lib/historical-performance"

interface HistoricalPerformanceChartProps {
  assets: AssetData[];
}

type TimeRange = "7d" | "30d" | "90d" | "1y" | "ytd" | "all";

interface BenchmarkHistory {
  histories: Partial<Record<'SPY' | 'QQQ', { date: string; close: number }[]>>;
  errors: Partial<Record<'SPY' | 'QQQ', string>>;
}

export const HistoricalPerformanceChart = React.memo(function HistoricalPerformanceChart({ assets }: HistoricalPerformanceChartProps) {
  const [timeRange, setTimeRange] = React.useState<TimeRange>("all");
  const [selectedBenchmark, setSelectedBenchmark] = React.useState<"none" | "SPY" | "QQQ">("none");
  const { user, profile } = useAuth();
  const config = useConfig();

  // Estado para controlar qué series (activos) son visibles en el gráfico
  const [visibleAssets, setVisibleAssets] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(assets.filter(a => !['SPY', 'QQQ'].includes(a.profile.symbol)).map(a => [a.profile.symbol, true]))
  );

  const benchmarkQuery = useQuery({
    queryKey: ['historical-benchmark', user?.id, profile?.id],
    enabled: selectedBenchmark !== 'none' && !!user && !!profile,
    staleTime: 60 * 60 * 1000,
    retry: 1,
    queryFn: async (): Promise<BenchmarkHistory> => {
      if (!await hasApiCallsAvailable(user, profile, config)) {
        throw new Error('Se alcanzó el límite diario de consultas del plan o no se pudo verificar el uso.');
      }

      const response = await fetchYahooFinanceQuotes(['SPY', 'QQQ']);
      const histories: BenchmarkHistory['histories'] = {};
      const errors: BenchmarkHistory['errors'] = {};
      for (const symbol of ['SPY', 'QQQ'] as const) {
        const quote = response.quotes.find((item) => item.symbol === symbol);
        const history = quote?.history.filter((point) =>
          Number.isFinite(Date.parse(point.date)) && Number.isFinite(point.close) && point.close > 0
        ) ?? [];
        if (history.length >= 2) {
          histories[symbol] = history.map(({ date, close }) => ({ date, close }));
        } else {
          errors[symbol] = quote?.error ?? 'Yahoo no devolvió historial suficiente';
        }
      }

      if (!histories.SPY && !histories.QQQ) {
        throw new Error(Object.entries(errors).map(([symbol, message]) => `${symbol}: ${message}`).join('. ') ||
          'Yahoo Finance no devolvió historial de los índices.');
      }
      await incrementApiCallCounter(user.id);
      return { histories, errors };
    },
  });

  // Sincronizar visibilidad cuando cambian los assets prop
  React.useEffect(() => {
    setVisibleAssets(prev => {
      const next = { ...prev };
      assets.forEach(a => {
        if (!['SPY', 'QQQ'].includes(a.profile.symbol)) {
          next[a.profile.symbol] ??= true;
        }
      });
      Object.keys(next).forEach(k => {
        if (!assets.some(a => a.profile.symbol === k)) delete next[k];
      });
      return next;
    });
  }, [assets]);

  // Actualizar visibleAssets cuando cambia el benchmark
  React.useEffect(() => {
    setVisibleAssets(prev => {
      const next = { ...prev };
      ['SPY', 'QQQ'].forEach(b => {
        if (b === selectedBenchmark) {
          next[b] = true;
        } else {
          delete next[b]; // Ocultar los no seleccionados
        }
      });
      return next;
    });
  }, [selectedBenchmark]);

  type ChartConfigLocal = Record<string, { label: string; color: string }>;

  // --- Procesamiento de Datos del Gráfico ---
  const { chartData, chartConfig } = React.useMemo(() => {
    if (assets.length === 0) {
      return { chartData: [] as HistoricalPerformanceRow[], chartConfig: {} as ChartConfigLocal };
    }

    const histories: Record<string, { date: string; close: number }[]> = {};
    const allDates = new Set<string>();

    assets.forEach(asset => {
      if (asset.historicalReturns && asset.historicalReturns.length > 0) {
        histories[asset.profile.symbol] = asset.historicalReturns
          .filter(item => Number.isFinite(item.close) && item.close > 0)
          .map(item => ({ date: item.date.split('T')[0], close: item.close }))
          .sort((left, right) => left.date.localeCompare(right.date));
      }
    });

    const indexHistory = selectedBenchmark === 'none'
      ? undefined
      : benchmarkQuery.data?.histories[selectedBenchmark];
    if (selectedBenchmark !== 'none' && indexHistory) {
      histories[selectedBenchmark] = indexHistory;
    } else if (selectedBenchmark !== 'none' && !histories[selectedBenchmark]) {
      return {
        chartData: [] as HistoricalPerformanceRow[],
        chartConfig: {} as ChartConfigLocal,
      };
    }

    Object.values(histories).forEach(history => history.forEach(point => allDates.add(point.date)));
    const sortedDates = [...allDates].sort((left, right) => left.localeCompare(right));
    const seriesSymbols = Object.keys(histories);
    const firstAvailableDate = (history: { date: string; close: number }[]) => history[0]?.date;
    const comparisonStart = selectedBenchmark !== 'none'
      ? [selectedBenchmark, ...seriesSymbols.filter(symbol => symbol !== 'SPY' && symbol !== 'QQQ')]
          .map(symbol => histories[symbol] && firstAvailableDate(histories[symbol]))
          .filter((date): date is string => !!date)
          .sort()
          .at(-1)
      : undefined;
    const activeDates = comparisonStart
      ? sortedDates.filter(date => date >= comparisonStart)
      : sortedDates;

    const getPriceAtDate = (history: { date: string; close: number }[] | undefined, date: string) => {
      if (!history) return null;
      for (let index = history.length - 1; index >= 0; index -= 1) {
        if (history[index].date <= date) return history[index].close;
      }
      return null;
    };

    let finalChartData: HistoricalPerformanceRow[] = activeDates.map(dateStr => {
      const entry: HistoricalPerformanceRow = {
        originalDate: dateStr,
        day: new Date(`${dateStr}T12:00:00`).toLocaleDateString("es-ES", {
          year: "numeric",
          month: "short",
          day: "numeric",
        }),
      };
      seriesSymbols.forEach(symbol => {
        entry[symbol] = getPriceAtDate(histories[symbol], dateStr);
      });
      return entry;
    });

    if (timeRange !== 'all' && finalChartData.length > 0) {
      const endDate = new Date(`${finalChartData[finalChartData.length - 1].originalDate}T12:00:00`);
      const startDate = new Date(endDate);
      if (timeRange === 'ytd') {
        startDate.setMonth(0, 1);
        startDate.setHours(0, 0, 0, 0);
      } else {
        const days = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 }[timeRange];
        startDate.setDate(startDate.getDate() - days);
      }
      const startDateString = startDate.toISOString().slice(0, 10);
      finalChartData = finalChartData.filter(row => row.originalDate >= startDateString);
    }

    if (selectedBenchmark !== 'none') {
      const comparableSymbols = assets
        .map(asset => asset.profile.symbol)
        .filter(symbol => !['SPY', 'QQQ'].includes(symbol) && histories[symbol]);
      finalChartData = finalChartData.filter(row =>
        typeof row[selectedBenchmark] === 'number' &&
        comparableSymbols.every(symbol => typeof row[symbol] === 'number')
      );
      finalChartData = normalizeHistoricalPerformance(finalChartData, seriesSymbols);
    }

    const config: ChartConfigLocal = {};
    assets.forEach((asset, index) => {
      const symbol = asset.profile.symbol;
      config[asset.profile.symbol] = {
        label: symbol === 'PORTFOLIO' ? 'Mi Portafolio' : symbol,
        color: `var(--chart-${(index % 12) + 1})`,
      };
    });
    if (selectedBenchmark !== 'none') {
        const label = selectedBenchmark === 'SPY' ? 'S&P 500 (SPY)' : 'Nasdaq 100 (QQQ)';
        config[selectedBenchmark] = {
            label,
            color: 'var(--chart-3)'
        };
    }

    return { chartData: finalChartData, chartConfig: config };
  }, [assets, timeRange, selectedBenchmark, benchmarkQuery.data]);

  // --- Cálculo del Dominio Y (Auto-zoom) ---
  const yDomain = React.useMemo(() => {
    if (!chartData?.length) return [0, 100]; // Fallback

    // Solo consideramos los activos visibles
    const symbols = Object.keys(visibleAssets).filter(s => visibleAssets[s]);
    if (symbols.length === 0) return [0, 100];

    let minVal = Infinity;
    let maxVal = -Infinity;

    chartData.forEach(row => {
      symbols.forEach(s => {
        const v = row[s];
        if (typeof v === 'number' && Number.isFinite(v)) {
          if (v < minVal) minVal = v;
          if (v > maxVal) maxVal = v;
        }
      });
    });

    if (minVal === Infinity) return [0, 100];

    // Añadir un poco de padding (10%) arriba y abajo para que no toque los bordes
    const padding = Math.max((maxVal - minVal) * 0.1, 0.5);
    return [Math.floor(Math.max(0, minVal - padding)), Math.ceil(maxVal + padding)];
  }, [chartData, visibleAssets]);

  if (assets.length === 0) {
    return (
      <Card className="flex items-center justify-center h-64 sm:h-96">
        <p className="text-muted-foreground text-sm sm:text-base px-4">Añade activos para ver su rendimiento.</p>
      </Card>
    );
  }

  function toggleAsset(symbol: string) {
    setVisibleAssets(prev => ({ ...prev, [symbol]: !prev[symbol] }));
  }

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <AreaChartIcon className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            <div>
              <CardTitle className="text-lg sm:text-xl">Rendimiento Histórico</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {selectedBenchmark === 'none'
                  ? assets.some(asset => asset.profile.symbol === 'PORTFOLIO')
                    ? 'Evolución del valor histórico reconstruido con tus tenencias actuales.'
                    : 'Evolución del precio de cierre de los activos.'
                  : assets.some(asset => asset.profile.symbol === 'PORTFOLIO')
                    ? 'Cotizaciones reales en porcentaje; el portafolio se reconstruye con las tenencias actuales, no con cambios históricos de composición.'
                    : 'Rendimiento porcentual acumulado desde el inicio del período seleccionado.'}
              </CardDescription>
            </div>
          </div>
          <Select value={timeRange} onValueChange={(value: TimeRange) => setTimeRange(value)}>
            <SelectTrigger className="w-full sm:w-[160px] rounded-lg h-9 sm:h-10 text-xs sm:text-sm">
              <SelectValue placeholder="Seleccionar rango" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">Máximo</SelectItem>
              <SelectItem value="1y">Último Año</SelectItem>
              <SelectItem value="ytd">Año Actual (YTD)</SelectItem>
              <SelectItem value="90d">Últimos 90 días</SelectItem>
              <SelectItem value="30d">Últimos 30 días</SelectItem>
              <SelectItem value="7d">Últimos 7 días</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 mt-3 sm:mt-4">
          <div className="flex-1 flex gap-1.5 sm:gap-2 overflow-x-auto pb-2">
            {assets.filter(a => !['SPY', 'QQQ'].includes(a.profile.symbol)).map((asset, index) => {
              const symbol = asset.profile.symbol;
              const color = `var(--chart-${(index % 12) + 1})`;
              return (
                <label key={symbol} className="inline-flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 rounded-md border bg-muted/30 whitespace-nowrap h-8 sm:h-10 cursor-pointer hover:bg-muted/50 transition-colors">
                  <Checkbox
                    checked={visibleAssets[symbol] ?? true}
                    onCheckedChange={() => toggleAsset(symbol)}
                    className="h-3.5 w-3.5 sm:h-4 sm:w-4"
                  />
                  <span className="flex items-center gap-1.5 sm:gap-2">
                    <span style={{ width: 8, height: 8, background: color, display: 'inline-block', borderRadius: 2 }} className="sm:w-[10px] sm:h-[10px]" />
                    <span className="text-xs sm:text-sm">{symbol}</span>
                  </span>
                </label>
              );
            })}
          </div>
          {/* Los índices se consultan al seleccionarlos y respetan el límite diario del plan. */}
          <div className="w-full sm:w-[220px]">
            <Select value={selectedBenchmark} onValueChange={setSelectedBenchmark}>
              <SelectTrigger className="w-full rounded-lg h-9 sm:h-10 text-xs sm:text-sm">
                <SelectValue placeholder="Comparar con..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="none">Sin comparación</SelectItem>
                <SelectItem value="SPY">S&P 500 (SPY)</SelectItem>
                <SelectItem value="QQQ">Nasdaq 100 (QQQ)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {selectedBenchmark !== 'none' && benchmarkQuery.isLoading && (
          <p className="text-xs text-muted-foreground" role="status">Consultando historial real de SPY y QQQ...</p>
        )}
        {selectedBenchmark !== 'none' && benchmarkQuery.isError && (
          <p className="text-xs text-destructive" role="alert">{benchmarkQuery.error.message}</p>
        )}
        {selectedBenchmark !== 'none' && benchmarkQuery.data && !benchmarkQuery.data.histories[selectedBenchmark] && (
          <p className="text-xs text-destructive" role="alert">
            {selectedBenchmark}: {benchmarkQuery.data.errors[selectedBenchmark] ?? 'No hay datos históricos disponibles.'}
          </p>
        )}
      </CardHeader>
      <CardContent className="px-2 pt-3 sm:px-6 sm:pt-6">
        <ChartContainer config={chartConfig} className="w-full h-[280px] sm:h-[350px] lg:h-[400px]">
          <AreaChart data={chartData}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.5} />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={30}
              tickFormatter={(value: unknown, index: number) => {
                // Mostrar menos etiquetas en móvil si hay muchos datos
                const skip = chartData.length > 50 ? 6 : 3;
                return index % skip === 0 && typeof value === 'string' ? value : "";
              }}
              style={{ fontSize: 10 }}
            />
            <YAxis
              domain={yDomain as [number, number]}
              tickFormatter={(value) => selectedBenchmark === 'none'
                ? `$${Math.round(Number(value))}`
                : `${Number(value).toFixed(1)}%`}
              tickLine={false}
              axisLine={false}
              width={50}
              tickMargin={8}
              style={{ fontSize: 10 }}
            />
            <ChartTooltip
              cursor={{ stroke: 'var(--muted-foreground)', strokeWidth: 1, strokeDasharray: '3 3' }}
              content={({ payload, label }: { payload?: unknown[]; label?: React.ReactNode }) => {
                interface AreaTooltipItem {
                  color?: string;
                  name?: string;
                  value?: number | null;
                }
                if (!payload || payload.length === 0) return null;

                return (
                  <Card className="p-2 shadow-lg border-none bg-background/95 backdrop-blur-sm text-xs sm:text-sm">
                    <CardHeader className="p-1 pb-2 border-b mb-1 font-bold text-xs sm:text-sm">{label}</CardHeader>
                    <CardContent className="p-1 space-y-1.5">
                      {payload.map((itemRaw, index) => {
                        const item = itemRaw as AreaTooltipItem;
                        const name = typeof item.name === 'string' ? item.name : '';
                        const displayName = chartConfig[name]?.label ?? name;

                        // Si está oculto, no mostrar (aunque Recharts suele filtrarlo, es doble seguridad)
                        if (!visibleAssets[name]) return null;

                        const color = typeof item.color === 'string' ? item.color : undefined;
                        const value = typeof item.value === 'number' ? item.value : null;

                        return (
                          <div key={index} className="flex items-center justify-between gap-4 min-w-[120px]">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                              <span className="text-xs font-medium text-muted-foreground">{displayName}:</span>
                            </div>
                            <span className="font-bold text-xs">
                              {value !== null
                                ? selectedBenchmark === 'none' ? `$${value.toFixed(2)}` : `${value.toFixed(2)}%`
                                : 'N/A'}
                            </span>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                );
              }}
            />
            <ChartLegend content={<ChartLegendContent />} />
            {[...new Set([...assets.map(asset => asset.profile.symbol), ...(selectedBenchmark !== 'none' ? [selectedBenchmark] : [])])].map((symbol) => {
              if (!symbol || !visibleAssets[symbol]) return null;
              const color = chartConfig[symbol]?.color ?? `var(--chart-1)`;
              return (
                <Area
                  key={symbol}
                  dataKey={symbol}
                  type="monotone"
                  fill={`url(#fill${symbol})`}
                  stroke={color}
                  strokeWidth={2}
                  connectNulls={true}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  isAnimationActive={true}
                />
              );
            })}
            <defs>
              {[...new Set([...assets.map(asset => asset.profile.symbol), ...(selectedBenchmark !== 'none' ? [selectedBenchmark] : [])])].map((symbol) => {
                if (!symbol) return null;
                const color = chartConfig[symbol]?.color ?? `var(--chart-1)`;
                return (
                  <linearGradient key={`grad-${symbol}`} id={`fill${symbol}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={color} stopOpacity={0.01} />
                  </linearGradient>
                );
              })}
            </defs>
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
});