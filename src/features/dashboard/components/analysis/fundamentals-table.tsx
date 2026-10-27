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
import {
    getIndicatorStatus,
    getIndicatorStatusClass,
    Indicator,
    indicatorConfig,
} from "../../../../utils/financial";
import { exportToPdf } from "../../../../utils/export-pdf";
import { useTheme } from "../../../../components/ui/theme-provider";
import { usePlanFeature } from "../../../../hooks/use-plan-feature";
import { toast } from "sonner";

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
        keys: ["PER", "forwardPER", "epsTTM", "epsForward", "targetPrice", "pegRatio", "priceToBook", "priceToSales", "pfc_ratio", "evToEbitda", "evToSales", "earningsYield", "grahamNumber", "marketCap"],
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
        keys: ["beta", "analystCount", "relativeVolume", "rsi14", "sma50", "sma200", "smaSignal"],
    },
];

// --- Helper: Resolver valor del indicador desde la estructura compleja de AssetData ---
const yahooMetricFields: Record<string, string[]> = {
    PER: ['summaryDetail.trailingPE'],
    forwardPER: ['summaryDetail.forwardPE', 'keyStatistics.forwardPE'],
    epsTTM: ['keyStatistics.trailingEps'],
    epsForward: ['keyStatistics.forwardEps'],
    targetPrice: ['financialData.targetMeanPrice'],
    analystCount: ['financialData.numberOfAnalystOpinions'],
    pegRatio: ['keyStatistics.pegRatio'],
    priceToBook: ['keyStatistics.priceToBook'],
    priceToSales: ['summaryDetail.priceToSalesTrailing12Months'],
    evToEbitda: ['keyStatistics.enterpriseToEbitda'],
    evToSales: ['keyStatistics.enterpriseToRevenue'],
    grossMargin: ['financialData.grossMargins'],
    operatingMargin: ['financialData.operatingMargins'],
    roe: ['financialData.returnOnEquity'],
    roa: ['financialData.returnOnAssets'],
    debtToEquity: ['financialData.debtToEquity'],
    currentRatio: ['financialData.currentRatio'],
    dividendYield: ['summaryDetail.dividendYield'],
    payout_ratio: ['keyStatistics.payoutRatio'],
    dividendPerShare: ['summaryDetail.trailingAnnualDividendRate'],
    beta: ['summaryDetail.beta'],
    marketCap: ['price.marketCap'],
    sma50: ['summaryDetail.fiftyDayAverage'],
    sma200: ['summaryDetail.twoHundredDayAverage'],
};

function getYahooComputeContext(asset: AssetData): Record<string, number> {
    const metrics = asset.yahooMetrics ?? {};
    const context: Record<string, number> = {};
    const aliases: Record<string, string> = {
        volume: 'price.regularMarketVolume',
        averageVolume: 'summaryDetail.averageVolume',
        priceAvg50: 'summaryDetail.fiftyDayAverage',
        priceAvg200: 'summaryDetail.twoHundredDayAverage',
        lastDividend: 'summaryDetail.trailingAnnualDividendRate',
        priceToFreeCashFlowsRatioTTM: 'keyStatistics.priceToFreeCashflow',
        totalDebt: 'financialData.totalDebt',
        totalCash: 'financialData.totalCash',
        ebitda: 'financialData.ebitda',
    };

    for (const [field, key] of Object.entries(aliases)) {
        const value = metrics[key];
        if (typeof value === 'number' && Number.isFinite(value)) context[field] = value;
    }
    if (asset.quote.price > 0 && Number.isFinite(asset.quote.price)) {
        context.price = asset.quote.price;
    }

    const marketCap = metrics['price.marketCap'];
    const freeCashFlow = metrics['financialData.freeCashflow'];
    if (
        typeof marketCap === 'number' &&
        Number.isFinite(marketCap) &&
        marketCap > 0 &&
        typeof freeCashFlow === 'number' &&
        Number.isFinite(freeCashFlow) &&
        freeCashFlow > 0
    ) {
        context.priceToFreeCashFlowsRatioTTM = marketCap / freeCashFlow;
    }

    const totalDebt = metrics['financialData.totalDebt'];
    const totalCash = metrics['financialData.totalCash'];
    const ebitda = metrics['financialData.ebitda'];
    if (
        typeof totalDebt === 'number' &&
        Number.isFinite(totalDebt) &&
        typeof totalCash === 'number' &&
        Number.isFinite(totalCash) &&
        typeof ebitda === 'number' &&
        Number.isFinite(ebitda) &&
        ebitda > 0
    ) {
        context.netDebtToEBITDA = (totalDebt - totalCash) / ebitda;
    }

    return context;
}

function getLegacyComputeContext(asset: AssetData): Record<string, number> {
    const context: Record<string, number> = {};
    for (const source of [asset.profile, asset.quote, asset.keyMetrics]) {
        for (const [field, value] of Object.entries(source)) {
            if (typeof value === 'number' && Number.isFinite(value)) context[field] = value;
        }
    }
    return context;
}

function resolveIndicatorValue(asset: AssetData, key: string): number | null {
    const config = indicatorConfig[key];
    if (!config) return null;

    let value: number | null = null;
    const yahooValue = yahooMetricFields[key]
        ?.map((field) => asset.yahooMetrics?.[field])
        .find((candidate): candidate is number =>
            typeof candidate === 'number' && Number.isFinite(candidate)
        );
    if (yahooValue !== undefined) value = yahooValue;

    // 1. Buscar valor directo en los campos API definidos
    // Prioridad de búsqueda: KeyMetrics (TTM) -> Quote (Tiempo real) -> Profile (Estático) -> Rating
    const sources = [asset.keyMetrics, asset.quote, asset.profile, asset.rating];

    if (value === null && asset.dataSource !== 'Yahoo Finance') {
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
    }

    // 2. Si no se encuentra y hay función de cálculo (compute), intentar calcular
    if (value === null && config.compute) {
        const rawContext = asset.dataSource === 'Yahoo Finance'
            ? getYahooComputeContext(asset)
            : getLegacyComputeContext(asset);
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
const formatValue = (config: Indicator, value: number | null, currency?: string) => {
    if (value === null || value === undefined) return "";
    if (config.unit === 'currency') {
        const amount = value.toLocaleString('es-AR', { maximumFractionDigits: 2 });
        return currency ? `${currency} ${amount}` : amount;
    }
    if (config.unit === 'count') return Math.round(value).toLocaleString('es-AR');
    if (config.isLargeNumber) {
        if (Math.abs(value) >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
        if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
        return `${(value / 1e6).toFixed(2)}M`;
    }
    if (config.asPercent) return `${value.toFixed(2)}%`;
    return value.toFixed(2);
};

// --- Componente Principal ---
export const FundamentalsTable = React.memo(function FundamentalsTable({ assets }: FundamentalsTableProps) {
    const [hideNA, setHideNA] = useState(true);
    const [openSections, setOpenSections] = useState<string[]>(["valuation"]);
    const { theme } = useTheme();
    const { hasAccess: canExportPdf, upgradeMessage } = usePlanFeature('exportPdf');
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
                currency: asset.profile.currency,
                asset,
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
                                // Estructura para el exportador PDF
                                return {
                                    content: formatValue(config, rawValue, item.currency),
                                    rawValue: rawValue ?? 'N/A'
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
        }).catch((error: unknown) => {
            console.error('Error durante la exportación a PDF:', error);
            toast.error(`Error al exportar el PDF: ${error instanceof Error ? error.message : 'Error desconocido'}`);
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
                                Comparativa detallada de las métricas disponibles.
                            </CardDescription>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
                        <div className="flex items-center space-x-2">
                            <Checkbox id="hideNA" checked={hideNA} onCheckedChange={(checked: boolean) => setHideNA(!!checked)} className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            <label htmlFor="hideNA" className="text-xs sm:text-sm font-medium leading-none">Ocultar métricas sin valor</label>
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
                                                                <TableCell key={item.symbol} className={`text-center font-semibold text-xs sm:text-sm ${getIndicatorStatusClass(getIndicatorStatus(key, config, item.values[key], item.asset))}`}>
                                                                    {formatValue(config, item.values[key], item.currency)}
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
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground" aria-label="Leyenda de calidad de indicadores">
                    <span className="font-medium text-foreground">Lectura orientativa:</span>
                    <span className="text-green-600 dark:text-green-400">Bueno</span>
                    <span className="text-yellow-600 dark:text-yellow-500">Intermedio</span>
                    <span className="text-red-600 dark:text-red-500">Desfavorable</span>
                    <span>Los múltiplos se ajustan por sector/industria; las métricas sin interpretación direccional quedan neutras.</span>
                </div>
            </CardContent>
        </Card>
    );
});