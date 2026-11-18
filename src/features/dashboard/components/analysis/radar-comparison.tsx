// src/features/dashboard/components/analysis/radar-comparison.tsx

import * as React from "react"
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from "../../../../components/charts/lazy-recharts"
import { AssetData } from "../../../../types/dashboard"
import { indicatorConfig } from "../../../../utils/financial"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card"
import { ChartContainer, ChartTooltip } from "../../../../components/ui/chart"
import { Checkbox } from "../../../../components/ui/checkbox"
import { Button } from "../../../../components/ui/button"
import { Zap } from "lucide-react"

// --- Props del Componente ---
interface RadarComparisonProps {
    assets: AssetData[];
}

// --- CONFIGURACIÓN PARA EL GRÁFICO RADAR ---
// Las claves deben coincidir con las definidas en indicatorConfig
const radarKeys = ['netDebtToEBITDA', 'roic', 'evToEbitda', 'beta', 'PER', 'fcfYield'];
const radarMetricLabels: Record<string, string> = {
    netDebtToEBITDA: 'Deuda neta/EBITDA',
    roic: 'ROIC',
    evToEbitda: 'EV/EBITDA',
    beta: 'Beta',
    PER: 'PER',
    fcfYield: 'FCF Yield',
};

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
                if (
                    typeof val === 'number' &&
                    Number.isFinite(val) &&
                    ((key !== 'PER' && key !== 'evToEbitda') || val > 0)
                ) {
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

const countAvailableMetrics = (asset: AssetData) =>
    radarKeys.filter(key => resolveValue(asset, key) !== null).length;

// --- Funciones de Normalización ---
const normalizeForRadar = (value: number | null, key: string): number | null => {
    const config = RADAR_METRIC_RANGES[key];
    if (!config || value === null || !Number.isFinite(value)) return null;

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
    // An asset needs at least three resolvable axes to draw a meaningful shape.
    const hasRadarCoverage = (asset: AssetData) =>
        countAvailableMetrics(asset) >= 3;
    const fallbackAssets = React.useMemo(
        () => assets.filter(asset => !hasRadarCoverage(asset)),
        [assets]
    );
    const chartAssets = React.useMemo(
        () => assets.filter(hasRadarCoverage),
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
            const label = radarMetricLabels[key] || indicatorConfig[key]?.label || key;
            const metricData: { metric: string, [ticker: string]: number | string | null } = {
                metric: label,
            };

            chartAssets.forEach(asset => {
                const rawValue = resolveValue(asset, key);
                const symbol = asset.profile.symbol;

                // Valor normalizado (0 a 1) para el dibujo del gráfico
                metricData[symbol] = normalizeForRadar(rawValue, key);

                // Valor original formateado para el tooltip
                let originalFormatted = '';
                if (rawValue !== null) {
                    const isPercent = indicatorConfig[key]?.asPercent;
                    // Si es porcentaje en la config pero el rango radar está en decimales (ej ROIC),
                    // ajustamos la visualización.
                    if (isPercent) {
                        // Si el valor crudo es pequeño (ej 0.05) y esperamos %, lo multiplicamos
                        // Pero ojo, si ya viene como 5.0, no lo multiplicamos.
                        // Ratio metrics are normalized to decimal values before display.
                        originalFormatted = (rawValue * 100).toFixed(2) + '%';
                    } else {
                        originalFormatted = rawValue.toFixed(2);
                    }
                }
                metricData[`${symbol}_original`] = rawValue === null ? 'Sin dato' : originalFormatted;
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
    const hasVisibleAssets = chartAssets.some(asset => visibleAssets[asset.profile.symbol] ?? true);

    if (chartAssets.length === 0) {
        return (
            <Card className="flex items-center justify-center h-64 sm:h-96">
                <div className="text-center text-muted-foreground px-4">
                    <p className="font-semibold text-sm sm:text-base">
                        {fallbackAssets.length > 0 ? 'No hay métricas suficientes para generar el radar' : 'Sin activos para comparar'}
                    </p>
                    <p className="text-xs sm:text-sm">
                        {fallbackAssets.length > 0
                            ? `Se requieren al menos 3 de las 6 métricas del radar. Sin cobertura suficiente: ${fallbackAssets.map(asset => asset.profile.symbol).join(', ')}.`
                            : 'Agregá al menos un activo para ver el gráfico radar.'}
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
                        <CardTitle className="text-lg sm:text-xl">Perfiles por activo</CardTitle>
                        <CardDescription className="text-xs sm:text-sm">
                            Un gráfico separado por activo, con la misma escala para compararlos sin superponer sus formas. Los múltiplos PER y EV/EBITDA no positivos se omiten porque no son comparables con esta escala.
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
                                    <span className="text-xs sm:text-sm font-medium">
                                        {symbol} <span className="text-muted-foreground">({countAvailableMetrics(asset)}/6)</span>
                                    </span>
                                </span>
                            </label>
                        );
                    })}
                </div>
                {!hasVisibleAssets ? (
                    <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-4 text-center">
                        <p className="text-sm text-muted-foreground">Ocultaste todos los activos del radar.</p>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setVisibleAssets(Object.fromEntries(chartAssets.map(asset => [asset.profile.symbol, true])))}
                        >
                            Mostrar todos los activos
                        </Button>
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                        {chartAssets.map((asset, index) => {
                            const symbol = asset.profile.symbol;
                            if (visibleAssets[symbol] === false) return null;
                            const color = `var(--chart-${(index % 12) + 1})`;

                            return (
                                <Card key={symbol} className="min-w-0 overflow-hidden">
                                    <CardHeader className="p-4 pb-0">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <CardTitle className="text-base">{symbol}</CardTitle>
                                                <CardDescription className="mt-1 truncate text-xs">
                                                    {asset.profile.companyName || 'Nombre de empresa no disponible'}
                                                </CardDescription>
                                            </div>
                                            <span className="shrink-0 rounded-full border bg-muted/40 px-2 py-1 text-[10px] font-medium text-muted-foreground">
                                                {countAvailableMetrics(asset)}/6 métricas
                                            </span>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-2 sm:p-3">
                                        <ChartContainer config={chartConfig} className="h-[250px] w-full">
                                            <RadarChart data={chartData} outerRadius="62%">
                                                <PolarGrid />
                                                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 9 }} />
                                                <PolarRadiusAxis domain={[0, 1]} tick={false} axisLine={false} />
                                                <ChartTooltip
                                                    content={({ payload, label }: { payload?: unknown[]; label?: React.ReactNode }) => {
                                                        interface RadarTooltipItem {
                                                            payload?: Record<string, unknown>;
                                                        }
                                                        const item = payload?.[0] as RadarTooltipItem | undefined;
                                                        if (!item) return null;
                                                        const original = item.payload?.[`${symbol}_original`];

                                                        return (
                                                            <Card className="border-none bg-background/95 p-2 shadow-lg backdrop-blur-sm">
                                                                <CardHeader className="p-1 pb-2">
                                                                    <span className="text-xs text-muted-foreground">{symbol}</span>
                                                                    <span className="font-semibold">{label}</span>
                                                                </CardHeader>
                                                                <CardContent className="p-1 text-sm font-bold">
                                                                    {typeof original === 'string' ? original : 'Sin dato'}
                                                                </CardContent>
                                                            </Card>
                                                        );
                                                    }}
                                                />
                                                <Radar
                                                    name={symbol}
                                                    dataKey={symbol}
                                                    stroke={color}
                                                    fill={color}
                                                    fillOpacity={0.18}
                                                />
                                            </RadarChart>
                                        </ChartContainer>
                                        <div className="grid grid-cols-2 gap-2 px-2 pb-2">
                                            {chartData.map(metric => {
                                                const rawValue = metric[`${symbol}_original`];
                                                return (
                                                    <div key={metric.metric} className="flex min-w-0 items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1.5">
                                                        <span className="truncate text-[10px] text-muted-foreground">{metric.metric}</span>
                                                        <span className="shrink-0 text-[10px] font-semibold tabular-nums">
                                                            {typeof rawValue === 'string' ? rawValue : 'Sin dato'}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
                <p className="mt-3 text-xs text-muted-foreground">
                    Cada eje se normaliza con un rango fijo y se limita a ese rango. Los valores originales aparecen debajo del gráfico; los ejes faltantes se excluyen y no se convierten en cero.
                    {fallbackAssets.length > 0 && ` Omitidos por cobertura insuficiente: ${fallbackAssets.map(asset => asset.profile.symbol).join(', ')}.`}
                </p>
            </CardContent>
        </Card>
    );
});