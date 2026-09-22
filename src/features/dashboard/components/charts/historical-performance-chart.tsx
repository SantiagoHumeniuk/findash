// src/features/dashboard/components/charts/historical-performance-chart.tsx

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "../../../../components/charts/lazy-recharts"
import { AssetData } from "../../../../types/dashboard"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card"
import { ChartContainer, ChartTooltip, ChartLegend, ChartLegendContent } from "../../../../components/ui/chart"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "../../../../components/ui/select"
import { Checkbox } from "../../../../components/ui/checkbox"
import { AreaChartIcon } from "lucide-react"

interface HistoricalPerformanceChartProps {
  assets: AssetData[];
  portfolios?: { id: number; name: string }[];
  currentPortfolio?: { id: number; name: string } | null;
}

type TimeRange = "7d" | "30d" | "90d" | "1y" | "ytd" | "all";

// ✅ Envolvemos el componente con React.memo para evitar re-renders innecesarios
export const HistoricalPerformanceChart = React.memo(function HistoricalPerformanceChart({ assets, portfolios, currentPortfolio }: HistoricalPerformanceChartProps) {
  const [timeRange, setTimeRange] = React.useState<TimeRange>("all");

  // Estado para controlar qué series (activos) son visibles en el gráfico
  const [visibleAssets, setVisibleAssets] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(assets.filter(a => !['SPY', 'QQQ'].includes(a.profile.symbol)).map(a => [a.profile.symbol, true]))
  );
  
  // Estado para el benchmark seleccionado
  const [selectedBenchmark, setSelectedBenchmark] = React.useState<string>("none");

  // Sincronizar visibilidad cuando cambian los assets prop
  React.useEffect(() => {
    setVisibleAssets(prev => {
      const next = { ...prev };
      assets.forEach(a => {
        if (!['SPY', 'QQQ'].includes(a.profile.symbol) && !a.profile.symbol.startsWith('PORT_')) {
          next[a.profile.symbol] ??= true;
        }
      });
      Object.keys(next).forEach(k => {
        if (!assets.some(a => a.profile.symbol === k) && !k.startsWith('PORT_')) delete next[k];
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
      // Handle other portfolios
      portfolios?.forEach(p => {
        const symbol = `PORT_${p.id}`;
        if (selectedBenchmark === symbol) {
            next[symbol] = true;
        } else {
            delete next[symbol];
        }
      });
      return next;
    });
  }, [selectedBenchmark, portfolios]);

  interface ChartRow {
    day: string;
    originalDate: string; // Para filtrado preciso
    [symbol: string]: string | number | null;
  }

  type ChartConfigLocal = Record<string, { label: string; color: string }>;

  // --- Procesamiento de Datos del Gráfico ---
  const { chartData, chartConfig } = React.useMemo(() => {
    if (assets.length === 0) {
      return { chartData: [] as ChartRow[], chartConfig: {} as ChartConfigLocal };
    }

    const pricesByDateByAsset: Record<string, Map<string, number>> = {};
    const allDates = new Set<string>();

    // 1. Recopilar todos los precios por fecha
    assets.forEach(asset => {
      if (asset.historicalReturns && asset.historicalReturns.length > 0) {
        pricesByDateByAsset[asset.profile.symbol] = new Map();

        asset.historicalReturns.forEach(item => {
          const dateStr = item.date.split('T')[0];
          pricesByDateByAsset[asset.profile.symbol].set(dateStr, item.close);
          allDates.add(dateStr);
        });
      }
    });

    // Añadir mock data para otros portfolios o índices faltantes si están seleccionados
    if (selectedBenchmark !== 'none') {
        const isPort = selectedBenchmark.startsWith('PORT_');
        const isMissingIndex = ['SPY', 'QQQ'].includes(selectedBenchmark) && !pricesByDateByAsset[selectedBenchmark];
        
        if (isPort || isMissingIndex) {
            pricesByDateByAsset[selectedBenchmark] = new Map();
            // Generar una línea simulada para visualización
            let mockValue = 100;
            const sorted = Array.from(allDates).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
            sorted.forEach(dateStr => {
                mockValue = mockValue * (1 + (Math.random() * 0.04 - 0.015)); // Random drift
                pricesByDateByAsset[selectedBenchmark].set(dateStr, mockValue);
            });
        }
    }

    // 2. Ordenar todas las fechas únicas cronológicamente
    const sortedDates = Array.from(allDates).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    // 3. Construir filas del gráfico (unificando datos por fecha)
    let finalChartData: ChartRow[] = sortedDates.map(dateStr => {
      const dateObj = new Date(dateStr);
      const entry: ChartRow = {
        originalDate: dateStr,
        day: dateObj.toLocaleDateString("es-ES", {
          year: "numeric",
          month: "short",
          day: "numeric",
        }),
      };

      assets.forEach(asset => {
        entry[asset.profile.symbol] = pricesByDateByAsset[asset.profile.symbol]?.get(dateStr) ?? null;
      });
      if (selectedBenchmark !== 'none') {
        entry[selectedBenchmark] = pricesByDateByAsset[selectedBenchmark]?.get(dateStr) ?? null;
      }

      return entry;
    });

    // 4. Filtrar por rango de tiempo seleccionado
    const dataLength = finalChartData.length;
    if (timeRange !== 'all' && dataLength > 1) {
      let startIndex = 0;

      switch (timeRange) {
        case '7d': startIndex = Math.max(0, dataLength - 7); break;
        case '30d': startIndex = Math.max(0, dataLength - 30); break;
        case '90d': startIndex = Math.max(0, dataLength - 90); break;
        case '1y': startIndex = Math.max(0, dataLength - 365); break; // Aprox 252 días de trading, pero tomamos calendario
        case 'ytd': {
          const currentYear = new Date().getFullYear();
          startIndex = finalChartData.findIndex(d => new Date(d.originalDate).getFullYear() === currentYear);
          if (startIndex === -1) startIndex = 0; // Si no hay datos de este año, mostrar todo o nada
          break;
        }
        default: startIndex = 0;
      }

      finalChartData = finalChartData.slice(startIndex);
    }

    // 5. Generar configuración de colores para el gráfico
    const config: ChartConfigLocal = {};
    assets.forEach((asset, index) => {
      config[asset.profile.symbol] = {
        label: asset.profile.symbol,
        color: `var(--chart-${(index % 12) + 1})`,
      };
    });
    if (selectedBenchmark !== 'none') {
        const isPort = selectedBenchmark.startsWith('PORT_');
        let label = selectedBenchmark;
        if (isPort && portfolios) {
            const port = portfolios.find(p => `PORT_${p.id}` === selectedBenchmark);
            if (port) label = port.name;
        } else if (selectedBenchmark === 'SPY') label = 'S&P 500 (SPY)';
        else if (selectedBenchmark === 'QQQ') label = 'Nasdaq 100 (QQQ)';
        
        config[selectedBenchmark] = {
            label,
            color: 'var(--chart-3)' // Usar un color distinto para comparaciones
        };
    }

    return { chartData: finalChartData, chartConfig: config };
  }, [assets, timeRange, selectedBenchmark, portfolios]);

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
    const padding = (maxVal - minVal) * 0.1;
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
              <CardDescription className="text-xs sm:text-sm">Evolución del precio de cierre de los activos.</CardDescription>
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
          {/* Select para benchmarks y otros portafolios */}
          <div className="w-full sm:w-[220px]">
            <Select value={selectedBenchmark} onValueChange={setSelectedBenchmark}>
              <SelectTrigger className="w-full rounded-lg h-9 sm:h-10 text-xs sm:text-sm">
                <SelectValue placeholder="Comparar con..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="none">Sin comparación</SelectItem>
                
                {/* Grupo de Índices */}
                <SelectGroup>
                  <SelectLabel>Índices del Mercado</SelectLabel>
                  <SelectItem value="SPY">S&P 500 (SPY)</SelectItem>
                  <SelectItem value="QQQ">Nasdaq 100 (QQQ)</SelectItem>
                </SelectGroup>

                  {/* Grupo de Portafolios (Si hay más de uno) */}
                  {portfolios && portfolios.length > 1 && (
                    <SelectGroup>
                        <SelectLabel>Mis Otros Portafolios</SelectLabel>
                        {portfolios.filter(p => p.id !== currentPortfolio?.id).map(p => (
                            <SelectItem key={p.id} value={`PORT_${p.id}`}>{p.name}</SelectItem>
                        ))}
                    </SelectGroup>
                  )}
                </SelectContent>
            </Select>
          </div>
        </div>
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
              tickFormatter={(value) => `$${Math.round(Number(value))}`}
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

                        // Si está oculto, no mostrar (aunque Recharts suele filtrarlo, es doble seguridad)
                        if (!visibleAssets[name]) return null;

                        const color = typeof item.color === 'string' ? item.color : undefined;
                        const value = typeof item.value === 'number' ? item.value : null;

                        return (
                          <div key={index} className="flex items-center justify-between gap-4 min-w-[120px]">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                              <span className="text-xs font-medium text-muted-foreground">{name}:</span>
                            </div>
                            <span className="font-bold text-xs">
                              {value !== null ? `$${value.toFixed(2)}` : 'N/A'}
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
            {[...assets, { profile: { symbol: selectedBenchmark !== 'none' ? selectedBenchmark : '' } }].map((asset) => {
              const symbol = asset.profile?.symbol;
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
              {[...assets, { profile: { symbol: selectedBenchmark !== 'none' ? selectedBenchmark : '' } }].map((asset) => {
                const symbol = asset.profile?.symbol;
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