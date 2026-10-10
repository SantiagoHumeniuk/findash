// src/features/dashboard/components/analysis/fundamentals-table.tsx

import React, { useMemo, useState } from "react";
import { AssetData } from "../../../../types/dashboard";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../../../../components/ui/accordion";
import { Button } from "../../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Checkbox } from "../../../../components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../../../components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../../components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../../../components/ui/tooltip";
import { Download, HelpCircle, LayoutGrid } from "lucide-react";
import { Indicator, indicatorConfig } from "../../../../utils/financial";
import { exportToPdf } from "../../../../utils/export-pdf";
import { useTheme } from "../../../../components/ui/theme-provider";
import { usePlanFeature } from "../../../../hooks/use-plan-feature";

// --- Props del Componente ---
interface FundamentalsTableProps {
    assets: AssetData[];
}

// --- Estructura para las Secciones ---
const indicatorSections = [
    {
        id: "valuation",
        title: "Métricas de Valoración",
        subtitle: "Ratios para medir la valoración relativa de la empresa.",
        keys: ["PER", "forwardPER", "pegRatio", "priceToBook", "priceToSales", "pfc_ratio", "evToEbitda", "evToSales", "earningsYield", "grahamNumber", "marketCap"],
    },
    {
        id: "profitability",
        title: "Rentabilidad y Márgenes",
        subtitle: "Eficiencia de la empresa para generar beneficios.",
        keys: ["grossMargin", "operatingMargin", "roe", "roa", "roic", "rdToRevenue"],
    },
    {
        id: "financialHealth",
        title: "Salud Financiera y Liquidez",
        subtitle: "Niveles de deuda y capacidad de pago a corto plazo.",
        keys: ["debtToEquity", "netDebtToEBITDA", "debt_to_assets", "currentRatio", "cashConversionCycle", "dso", "dio", "incomeQualityTTM"],
    },
    {
        id: "dividends",
        title: "Dividendos y Flujos",
        subtitle: "Retorno al accionista.",
        keys: ["dividendYield", "payout_ratio", "fcfYield", "dividendPerShare"],
    },
    {
        id: "technical",
        title: "Indicadores Técnicos y de Mercado",
        subtitle: "Volatilidad, momentum y sentimiento del mercado.",
        keys: ["beta", "relativeVolume", "rsi14", "sma50", "sma200", "smaSignal"],
    },
];

// --- Helper: Resolver valor del indicador desde la estructura compleja de AssetData ---
function resolveIndicatorValue(asset: AssetData, key: string): number | null {
    const config = indicatorConfig[key];
    if (!config) return null;
    if (
        asset.dataSource === 'Yahoo Finance' &&
        !['PER', 'forwardPER', 'marketCap', 'beta'].includes(key)
    ) return null;
    if (asset.dataSource === 'Yahoo Finance') {
        const yahooMetrics: Record<string, number> = {
            PER: asset.quote.pe ?? 0,
            forwardPER: asset.quote.forwardPE ?? 0,
            marketCap: asset.quote.marketCap,
            beta: asset.profile.beta,
        };
        return yahooMetrics[key] > 0 ? yahooMetrics[key] : null;
    }

    let value: number | null = null;

    // 1. Buscar valor directo en los campos API definidos
    // Prioridad de búsqueda: KeyMetrics (TTM) -> Quote (Tiempo real) -> Profile (Estático) -> Rating
    const sources = [asset.keyMetrics, asset.quote, asset.profile, asset.rating];

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

    // 2. Si no se encuentra y hay función de cálculo (compute), intentar calcular
    if (value === null && config.compute) {
        // Construimos un objeto 'raw' plano combinando las fuentes principales
        // Esto permite que las fórmulas como (yearHigh - price) / yearHigh funcionen
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawContext: any = {
            ...(asset.profile as any), // eslint-disable-line @typescript-eslint/no-explicit-any
            ...(asset.quote as any), // eslint-disable-line @typescript-eslint/no-explicit-any
            ...(asset.keyMetrics as any), // eslint-disable-line @typescript-eslint/no-explicit-any
        };
        const computed = config.compute(rawContext);
        if (computed !== null && Number.isFinite(computed)) {
            value = computed;
        }
    }

    // 3. Aplicar transformación de porcentaje si es necesario
    if (value !== null && config.asPercent) {
        value = value * 100; // Convertir 0.15 a 15.0
    }

    return value;
}

// --- Funciones de Formato y Estilo ---
const formatValue = (config: Indicator, value: number | null) => {
    if (value === null || value === undefined) return "N/A";
    if (config.isLargeNumber) {
        if (Math.abs(value) >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
        if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
        return `${(value / 1e6).toFixed(2)}M`;
    }
    if (config.asPercent) return `${value.toFixed(2)}%`;
    return value.toFixed(2);
};

const getTrafficLightClass = (config: Indicator, value: number | null): string => {
    if (value === null || value === undefined) return "text-muted-foreground";
    const { green, yellow, lowerIsBetter } = config;
    if (lowerIsBetter) {
        if (value <= green) return 'text-green-600 dark:text-green-400';
        if (value <= yellow) return 'text-yellow-600 dark:text-yellow-500';
        return 'text-red-600 dark:text-red-500';
    } else {
        if (value >= green) return 'text-green-600 dark:text-green-400';
        if (value >= yellow) return 'text-yellow-600 dark:text-yellow-500';
        return 'text-red-600 dark:text-red-500';
    }
};

// --- Componente Principal ---
export const FundamentalsTable = React.memo(function FundamentalsTable({ assets }: FundamentalsTableProps) {
    const [hideNA, setHideNA] = useState(true);
    const [openSections, setOpenSections] = useState<string[]>(["valuation"]);
    const { theme } = useTheme();
    const { hasAccess: canExportPdf, upgradeMessage } = usePlanFeature('exportPdf');
    const yahooAssets = useMemo(
        () => assets.filter((asset) =>
            asset.dataSource?.includes('Yahoo Finance') === true ||
            Boolean(asset.yahooAttemptedAt) ||
            Boolean(asset.yahooError)
        ),
        [assets],
    );

    // Pre-calcular todos los valores para evitar trabajo en render
    const tableData = useMemo(() => {
        return assets.map(asset => {
            const values: Record<string, number | null> = {};
            indicatorSections.forEach(section => {
                section.keys.forEach(key => {
                    values[key] = resolveIndicatorValue(asset, key);
                });
            });
            return {
                symbol: asset.profile.symbol,
                values
            };
        });
    }, [assets]);

    // Filtrar filas/indicadores basados en hideNA y disponibilidad de datos
    const visibleKeysBySection = useMemo(() => {
        const visible: Record<string, string[]> = {};
        indicatorSections.forEach(section => {
            visible[section.id] = section.keys.filter(key =>
                !hideNA || tableData.some(item => item.values[key] !== null)
            );
        });
        return visible;
    }, [tableData, hideNA]);

    const handlePdfExport = () => {
        const title = "Indicadores Fundamentales";
        const subtitle = "Comparativa detallada de los indicadores clave de los activos seleccionados.";

        // Crear secciones para cada categoría de indicadores
        const sections = indicatorSections
            .filter(section => visibleKeysBySection[section.id].length > 0)
            .map(section => {
                // Crear cabecera de la tabla
                const head = [['Indicador', ...assets.map(asset => asset.profile.symbol)]];

                // Crear cuerpo de la tabla con los indicadores de esta sección
                const body = visibleKeysBySection[section.id]
                    .map(key => {
                        const config = indicatorConfig[key];
                        if (!config) return null;

                        return [
                            config.label,
                            ...tableData.map(item => {
                                const rawValue = item.values[key];
                                const formattedValue = formatValue(config, rawValue);
                                // Estructura para el exportador PDF
                                return {
                                    content: formattedValue,
                                    rawValue: rawValue ?? 0 // Fallback numérico para ordenamiento si fuera necesario
                                };
                            })
                        ];
                    })
                    .filter(row => row !== null);

                const metricKeys = visibleKeysBySection[section.id].filter(key =>
                    indicatorConfig[key]
                );

                return {
                    title: `${section.title} - ${section.subtitle}`,
                    head,
                    body,
                    metricKeys // Esto activará el sistema de colores semáforo
                };
            });

        void exportToPdf({
            title,
            subtitle,
            sections,
            assets,
            theme: theme,
            indicatorConfig: indicatorConfig,
        });
    };

    if (assets.length === 0) return null;

    return (
        <Card>
            <CardHeader className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-2 sm:gap-3">
                        <LayoutGrid className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                        <div>
                            <CardTitle className="text-lg sm:text-xl">Indicadores Fundamentales</CardTitle>
                            <CardDescription className="text-xs sm:text-sm">
                                Comparativa detallada. Los activos de Yahoo Finance muestran únicamente las métricas que esa fuente devolvió.
                            </CardDescription>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
                        <div className="flex items-center space-x-2">
                            <Checkbox id="hideNA" checked={hideNA} onCheckedChange={(checked: boolean) => setHideNA(!!checked)} className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            <label htmlFor="hideNA" className="text-xs sm:text-sm font-medium leading-none">Ocultar N/A</label>
                        </div>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="w-full sm:w-auto text-xs sm:text-sm"
                                                disabled={!canExportPdf}
                                            >
                                                <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2" />
                                                Exportar
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent>
                                            <DropdownMenuItem onClick={handlePdfExport}>Exportar a PDF</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </TooltipTrigger>
                            {!canExportPdf && (
                                <TooltipContent>
                                    <p className="text-xs">{upgradeMessage}</p>
                                </TooltipContent>
                            )}
                        </Tooltip>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
                {yahooAssets.length > 0 && (
                    <section className="mb-5 space-y-2" aria-label="Datos de Yahoo Finance">
                        <div>
                            <h3 className="text-sm font-semibold">Datos de Yahoo Finance</h3>
                            <p className="text-xs text-muted-foreground">
                                Métricas forward, resultados por acción y objetivos de analistas cuando Yahoo los informa.
                            </p>
                        </div>
                        <div className="overflow-x-auto rounded-lg border">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        <TableHead>Activo / estado</TableHead>
                                        <TableHead className="text-right">PER</TableHead>
                                        <TableHead className="text-right">PER forward</TableHead>
                                        <TableHead className="text-right">EPS TTM</TableHead>
                                        <TableHead className="text-right">EPS forward</TableHead>
                                        <TableHead className="text-right">Objetivo medio</TableHead>
                                        <TableHead className="text-right">Analistas</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {yahooAssets.map((asset) => {
                                        const metrics = asset.yahooMetrics ?? {};
                                        const metric = (...keys: string[]) => {
                                            const value = keys
                                                .map((key) => metrics[key])
                                                .find((candidate) =>
                                                    typeof candidate === 'number' &&
                                                    Number.isFinite(candidate) &&
                                                    candidate > 0
                                                );
                                            return typeof value === 'number' ? value : null;
                                        };
                                        const formatMetric = (value: number | null) =>
                                            value === null ? '—' : value.toLocaleString('es-AR', { maximumFractionDigits: 2 });
                                        const formatEps = (value: number | null) =>
                                            value === null ? '—' : `${formatMetric(value)} ${asset.profile.currency}`;
                                        const target = metric('financialData.targetMeanPrice');
                                        const analystCount = metric('financialData.numberOfAnalystOpinions');
                                        const sourceStatus = asset.yahooError
                                            ? `Yahoo parcial: ${asset.yahooError}`
                                            : asset.dataSource?.includes('Yahoo Finance')
                                                ? `Actualizado ${asset.yahooAttemptedAt
                                                    ? new Date(asset.yahooAttemptedAt).toLocaleString('es-AR')
                                                    : 'con Yahoo Finance'}`
                                                : 'Yahoo sin datos disponibles';

                                        return (
                                            <TableRow key={`yahoo-${asset.profile.symbol}`}>
                                                <TableCell className="min-w-40">
                                                    <span className="font-semibold">{asset.profile.symbol}</span>
                                                    <span
                                                        className={`mt-0.5 block max-w-64 truncate text-[10px] ${
                                                            asset.yahooError ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'
                                                        }`}
                                                        title={sourceStatus}
                                                    >
                                                        {sourceStatus}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    {formatMetric(metric('summaryDetail.trailingPE'))}
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    {formatMetric(metric('summaryDetail.forwardPE', 'defaultKeyStatistics.forwardPE'))}
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    {formatEps(metric('defaultKeyStatistics.trailingEps'))}
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    {formatEps(metric('defaultKeyStatistics.forwardEps'))}
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    {target === null ? '—' : `${asset.profile.currency} ${formatMetric(target)}`}
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    {analystCount === null ? '—' : formatMetric(analystCount)}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </section>
                )}
                <Accordion type="multiple" value={openSections} onValueChange={setOpenSections}>
                    {indicatorSections.map(section => (
                        visibleKeysBySection[section.id].length > 0 && (
                            <AccordionItem value={section.id} key={section.id}>
                                <AccordionTrigger className="text-base sm:text-lg hover:no-underline">
                                    {section.title}
                                </AccordionTrigger>
                                <AccordionContent>
                                    <div className="overflow-x-auto border rounded-lg -mx-4 sm:mx-0">
                                        <Table>
                                            <TableHeader className="bg-muted/50">
                                                <TableRow>
                                                    <TableHead className="w-[150px] sm:w-[200px] font-semibold text-xs sm:text-sm">Indicador</TableHead>
                                                    {assets.map(asset => (
                                                        <TableHead key={asset.profile.symbol} className="text-center font-semibold text-xs sm:text-sm">
                                                            <span>{asset.profile.symbol}</span>
                                                            {asset.dataSource?.includes('Yahoo Finance') && (
                                                                <span className="ml-1 block text-[10px] font-normal text-amber-600">
                                                                    {asset.dataSource === 'Yahoo Finance' ? 'Yahoo Finance' : 'FMP + Yahoo'}
                                                                </span>
                                                            )}
                                                        </TableHead>
                                                    ))}
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {visibleKeysBySection[section.id].map(key => {
                                                    const config = indicatorConfig[key];
                                                    if (!config) return null;

                                                    return (
                                                        <TableRow key={key}>
                                                            <TableCell className="font-medium text-xs sm:text-sm">
                                                                <div className="flex items-center gap-1.5 sm:gap-2">
                                                                    <span className="whitespace-nowrap">{config.label}</span>
                                                                    <TooltipProvider delayDuration={0}>
                                                                        <Tooltip>
                                                                            <TooltipTrigger asChild>
                                                                                <button><HelpCircle className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground" /></button>
                                                                            </TooltipTrigger>
                                                                            <TooltipContent className="max-w-xs text-xs sm:text-sm">
                                                                                <p>{config.explanation}</p>
                                                                            </TooltipContent>
                                                                        </Tooltip>
                                                                    </TooltipProvider>
                                                                </div>
                                                            </TableCell>
                                                            {tableData.map((item) => (
                                                                <TableCell key={item.symbol} className={`text-center font-semibold text-xs sm:text-sm ${getTrafficLightClass(config, item.values[key])}`}>
                                                                    {formatValue(config, item.values[key])}
                                                                </TableCell>
                                                            ))}
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        )
                    ))}
                </Accordion>
            </CardContent>
        </Card>
    );
});