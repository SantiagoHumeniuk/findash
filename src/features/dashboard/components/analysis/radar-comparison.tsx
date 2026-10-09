// src/features/dashboard/components/analysis/radar-comparison.tsx

import * as React from "react"
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from "../../../../components/charts/lazy-recharts"
import { AssetData } from "../../../../types/dashboard"
import { indicatorConfig } from "../../../../utils/financial"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card"
import { ChartContainer, ChartTooltip } from "../../../../components/ui/chart"
import { Checkbox } from "../../../../components/ui/checkbox"
import { Zap } from "lucide-react"

// --- Props del Componente ---
interface RadarComparisonProps {
    assets: AssetData[];
}

// --- CONFIGURACIÓN PARA EL GRÁFICO RADAR ---
// Las claves deben coincidir con las definidas en indicatorConfig
const radarKeys = ['netDebtToEBITDA', 'roic', 'evToEbitda', 'beta', 'PER', 'fcfYield'];

const RADAR_METRIC_RANGES: Record<string, { min: number; max: number; lowerIsBetter: boolean }> = {
    netDebtToEBITDA: { min: 0, max: 5, lowerIsBetter: true }, // 0 excelente, >5 pobre
    evToEbitda: { min: 4, max: 100, lowerIsBetter: true }, // Ajustado rango más realista
    PER: { min: 5, max: 40, lowerIsBetter: true },
    beta: { min: 0, max: 3, lowerIsBetter: true }, // Ajustado para centrar mejor 1.0
    roic: { min: 0, max: 0.40, lowerIsBetter: false }, // 0% a 40% (valores decimales en API)
    fcfYield: { min: 0, max: 0.1, lowerIsBetter: false }, // 0% a 10% (valores decimales en API)
};

// --- Helper: Resolver valor desde la estructura de AssetData ---
const resolveValue = (asset: AssetData, key: string): number | null => {
    const config = indicatorConfig[key];
    if (!config) return null;

    let value: number | null = null;

    // Buscar en las fuentes de datos disponibles
    const sources = [asset.keyMetrics, asset.profile, asset.quote];

    for (const field of config.apiFields) {
        for (const source of sources) {
            if (source && typeof source === 'object' && field in source) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const val = (source as any)[field];
                if (typeof val === 'number' && Number.isFinite(val)) {
                    value = val;
                    break;
                }
            }
        }
        if (value !== null) break;
    }

    // Si no se encuentra, intentar calcular (fallback)
    if (value === null && config.compute) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawContext: any = {
            ...(asset.profile as any), // eslint-disable-line @typescript-eslint/no-explicit-any
            ...(asset.quote as any), // eslint-disable-line @typescript-eslint/no-explicit-any
            ...(asset.keyMetrics as any), // eslint-disable-line @typescript-eslint/no-explicit-any
        };
        const computed = config.compute(rawContext);
        if (computed !== null && Number.isFinite(computed)) value = computed;
    }

    return value;
};

// --- Funciones de Normalización ---
const normalizeForRadar = (value: number | null, key: string): number => {
    const config = RADAR_METRIC_RANGES[key];
    // Si no hay configuración o valor, retornamos 0 (centro del radar)
    if (!config || value === null || !Number.isFinite(value)) return 0;

    const { min, max, lowerIsBetter } = config;
    const clamped = Math.max(Math.min(value, max), min);
    let normalized = (clamped - min) / (max - min);

    if (lowerIsBetter) {
        normalized = 1 - normalized;
    }
    return normalized;
};

// --- Componente Principal ---
export const RadarComparison = React.memo(function RadarComparison({ assets }: RadarComparisonProps) {
    const fallbackAssets = React.useMemo(
        () => assets.filter(asset => asset.dataSource === 'Yahoo Finance'),
        [assets]
    );
    const chartAssets = React.useMemo(
        () => assets.filter(asset => asset.dataSource !== 'Yahoo Finance'),
        [assets]
    );

    // Estado de visibilidad por activo
    const [visibleAssets, setVisibleAssets] = React.useState<Record<string, boolean>>(() =>
        Object.fromEntries(chartAssets.map(a => [a.profile.symbol, true]))
    );

    // Sincroniza el mapa de visibilidad cuando cambian los assets
    React.useEffect(() => {
        setVisibleAssets(prev => {
            const next = { ...prev } as Record<string, boolean>;
            chartAssets.forEach(a => {
                next[a.profile.symbol] ??= true;
            });
            Object.keys(next).forEach(k => {
                if (!chartAssets.some(a => a.profile.symbol === k)) delete next[k];
            });
            return next;
        });
    }, [chartAssets]);

    function toggleAsset(symbol: string) {
        setVisibleAssets(prev => ({ ...prev, [symbol]: !prev[symbol] }));
    }

    const chartData = React.useMemo(() => {
        return radarKeys.map(key => {
            const label = indicatorConfig[key]?.label || key;
            const metricData: { metric: string, [ticker: string]: number | string } = {
                metric: label,
            };

            chartAssets.forEach(asset => {
                const rawValue = resolveValue(asset, key);
                const symbol = asset.profile.symbol;

                // Valor normalizado (0 a 1) para el dibujo del gráfico
                metricData[symbol] = normalizeForRadar(rawValue, key);

                // Valor original formateado para el tooltip
                let originalFormatted = 'N/A';
                if (rawValue !== null) {
                    const isPercent = indicatorConfig[key]?.asPercent;
                    // Si es porcentaje en la config pero el rango radar está en decimales (ej ROIC),
                    // ajustamos la visualización.
                    if (isPercent) {
                        // Si el valor crudo es pequeño (ej 0.05) y esperamos %, lo multiplicamos
                        // Pero ojo, si ya viene como 5.0, no lo multiplicamos.
                        // Asumimos que FMP devuelve decimales (0.05) para ratios.
                        originalFormatted = (rawValue * 100).toFixed(2) + '%';
                    } else {
                        originalFormatted = rawValue.toFixed(2);
                    }
                }
                metricData[`${symbol}_original`] = originalFormatted;
            });

            return metricData;
        });
    }, [chartAssets]);

    type ChartConfig = Record<string, { label: string }>;
    const chartConfig: ChartConfig = React.useMemo(() => {
        const config: ChartConfig = {};
        chartAssets.forEach(asset => {
            config[asset.profile.symbol] = { label: asset.profile.symbol };
        });
        return config;
    }, [chartAssets]);

    if (chartAssets.length === 0) {
        return (
            <Card className="flex items-center justify-center h-64 sm:h-96">
                <div className="text-center text-muted-foreground px-4">
                    <p className="font-semibold text-sm sm:text-base">
                        {fallbackAssets.length > 0 ? 'Radar no disponible para datos de Yahoo' : 'Sin activos para comparar'}
                    </p>
                    <p className="text-xs sm:text-sm">
                        {fallbackAssets.length > 0
                            ? 'Yahoo Finance no devolvió todas las métricas necesarias. El activo sigue disponible en precios y PER.'
                            : 'Añade al menos un activo para ver el gráfico radar.'}
                    </p>
                </div>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader className="space-y-2 sm:space-y-3 p-4 sm:p-6">
                <div className="flex items-center gap-2 sm:gap-3">
                    <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                    <div>
                        <CardTitle className="text-lg sm:text-xl">Radar Comparativo</CardTitle>
                        <CardDescription className="text-xs sm:text-sm">
                            Perfil visual del activo. Un punto más alejado del centro es mejor.
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
                <div className="w-full flex gap-1.5 sm:gap-2 overflow-x-auto pb-2 mb-4">
                    {chartAssets.map((asset, index) => {
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
                                    <span className="text-xs sm:text-sm font-medium">{symbol}</span>
                                </span>
                            </label>
                        );
                    })}
                </div>
                <ChartContainer config={chartConfig} className="mx-auto w-full h-[350px] sm:h-[450px] lg:h-[500px]">
                    <RadarChart data={chartData}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 1]} tick={false} axisLine={false} />
                        <ChartTooltip
                            cursor={{ strokeDasharray: '3 3' }}
                            content={({ payload, label }: { payload?: unknown[]; label?: React.ReactNode }) => {
                                interface RadarTooltipItem {
                                    name?: string;
                                    color?: string;
                                    payload?: Record<string, unknown>;
                                }
                                if (!payload || payload.length === 0) return null;

                                return (
                                    <Card className="p-2 shadow-lg border-none bg-background/95 backdrop-blur-sm">
                                        <CardHeader className="p-1 pb-2 border-b mb-1">
                                            <span className="font-bold text-sm">{label}</span>
                                        </CardHeader>
                                        <CardContent className="p-1 space-y-1.5">
                                            {payload.map((itemRaw, index) => {
                                                const item = itemRaw as RadarTooltipItem;
                                                const name = typeof item.name === 'string' ? item.name : '';
                                                // Si el activo está oculto, no lo mostramos en tooltip (opcional, chart lo suele manejar)
                                                if (!visibleAssets[name]) return null;

                                                const color = typeof item.color === 'string' ? item.color : undefined;
                                                const original = item.payload?.[`${name}_original`] as string;

                                                return (
                                                    <div key={index} className="flex items-center justify-between gap-4 min-w-[120px]">
                                                        <div className="flex items-center gap-2">
                                                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                                                            <span className="text-xs font-medium text-muted-foreground">{name}:</span>
                                                        </div>
                                                        <span className="font-bold text-xs">{original}</span>
                                                    </div>
                                                );
                                            })}
                                        </CardContent>
                                    </Card>
                                );
                            }}
                        />
                        {/* Legend opcional, ya tenemos los checkboxes arriba */}
                        {chartAssets.map((asset, index) => {
                            const symbol = asset.profile.symbol;
                            if (!visibleAssets[symbol]) return null;
                            const colorVar = `var(--chart-${(index % 12) + 1})`;
                            return (
                                <Radar
                                    key={symbol}
                                    name={symbol}
                                    dataKey={symbol}
                                    stroke={colorVar}
                                    fill={colorVar}
                                    fillOpacity={0.2}
                                />
                            );
                        })}
                    </RadarChart>
                </ChartContainer>
            </CardContent>
        </Card>
    );
});