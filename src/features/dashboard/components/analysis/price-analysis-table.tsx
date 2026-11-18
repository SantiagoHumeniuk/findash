// src/features/dashboard/components/analysis/price-analysis-table.tsx

import React, { useMemo, useState } from "react";
import { AssetData } from "../../../../types/dashboard";
import { Button } from "../../../../components/ui/button";
import { ArrowDown, ArrowUp, Download, BarChart2, ShoppingCart } from "lucide-react";
import { AssetLogo } from "../../../../components/ui/asset-logo";
import { LiveValue } from "../../../../components/ui/live-value";
import { exportToPdf } from "../../../../utils/export-pdf";
import { toast } from "sonner";
import { indicatorConfig } from "../../../../utils/financial";
import { computeSharpe, computeStdDevPct } from "../../../../utils/financial-formulas";
import { useTheme } from "../../../../components/ui/theme-provider";
import { Link } from "react-router-dom";
import { AddTransactionModal } from "../../../portfolio/components";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../../../components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../../components/ui/tooltip";
import { usePrefetchAsset } from "../../../../hooks/use-prefetch-asset";
import { usePlanFeature } from "../../../../hooks/use-plan-feature";
import { mapYahooPeriodChange } from "../../../../services/api/yahoo-finance-mappers";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../../components/ui/select";

// --- Tipos Auxiliares ---
interface PreparedAssetRow {
    symbol: string;
    companyName: string;
    image: string;
    currentPrice: number | null;
    dayChange: number | null;
    monthChange: number | null;
    yearChange: number | null;
    stdDev: number | null;
    sharpeRatio: number | null;
    targetConsensus: number | null;
    original: AssetData;
}

interface PriceAnalysisTableProps {
    assets: AssetData[];
}

type SortKey = 'symbol' | 'currentPrice' | 'dayChange' | 'monthChange' | 'yearChange' | 'stdDev' | 'sharpeRatio' | 'targetConsensus';

const sortOptions: { value: SortKey; label: string }[] = [
    { value: 'symbol', label: 'Activo' },
    { value: 'currentPrice', label: 'Precio' },
    { value: 'dayChange', label: 'Variación diaria' },
    { value: 'monthChange', label: 'Variación mensual' },
    { value: 'yearChange', label: 'Variación anual' },
    { value: 'stdDev', label: 'Volatilidad' },
    { value: 'sharpeRatio', label: 'Ratio Sharpe' },
    { value: 'targetConsensus', label: 'Precio objetivo' },
];

// --- Helpers de Formato ---
const formatCurrency = (v: number | null) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? `$${v.toFixed(2)}` : "—");
const formatNumber = (v: number | null) => (typeof v === "number" && Number.isFinite(v) ? v.toFixed(2) : "—");
const formatPercent = (value: number | null) =>
    typeof value === 'number' && Number.isFinite(value)
        ? `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
        : '—';
const formatMagnitudePercent = (value: number | null) =>
    typeof value === 'number' && Number.isFinite(value)
        ? `${value.toFixed(2)}%`
        : '—';

const getReturnColor = (value: number | null) =>
    typeof value !== 'number' || !Number.isFinite(value)
        ? 'text-muted-foreground'
        : value >= 0
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-rose-600 dark:text-rose-400';

// --- Componente Principal ---
export const PriceAnalysisTable = React.memo(function PriceAnalysisTable({ assets }: PriceAnalysisTableProps) {
    const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: "symbol", dir: "asc" });
    const { theme } = useTheme();
    const [buyModalInfo, setBuyModalInfo] = useState({ isOpen: false, ticker: null as string | null, price: null as number | null });

    // Hooks de Optimización y UX
    const { prefetchAssetIfNotCached } = usePrefetchAsset();
    const { hasAccess: canExportPdf, upgradeMessage } = usePlanFeature('exportPdf');

    // Preparación de datos y cálculos al vuelo
    const preparedAssets = useMemo((): PreparedAssetRow[] => {
        return assets.map(asset => {
            const history = asset.historicalReturns || [];
            const latestPrice = asset.quote?.price ?? null;

            // 1. Calcular Retornos Diarios (Index 0 = Antiguo -> Index N = Nuevo)
            const returns: number[] = [];
            for (let i = 1; i < history.length; i++) {
                const prev = history[i - 1].close;
                const curr = history[i].close;
                if (prev > 0) returns.push(curr / prev - 1);
            }

            // 2. Calcular Métricas de Riesgo
            const sharpeRatio = computeSharpe(returns) ?? null;
            const stdDev = computeStdDevPct(returns.slice(-30)) ?? null;

            return {
                symbol: asset.profile.symbol,
                companyName: asset.profile.companyName,
                image: asset.profile.image,
                currentPrice: latestPrice,
                dayChange: asset.quote?.changePercentage ?? null,
                monthChange: asset.dataSource === 'Yahoo Finance'
                    ? mapYahooPeriodChange(history, 1) ?? asset.stockPriceChange["1M"] ?? null
                    : asset.stockPriceChange["1M"] ?? null,
                yearChange: asset.dataSource === 'Yahoo Finance'
                    ? mapYahooPeriodChange(history, 12) ?? asset.stockPriceChange["1Y"] ?? null
                    : asset.stockPriceChange["1Y"] ?? null,
                stdDev,
                sharpeRatio,
                targetConsensus: asset.priceTargetConsensus?.targetConsensus ?? null,
                original: asset
            };
        });
    }, [assets]);

    // Lógica de Ordenamiento
    const sortedAssets = useMemo(() => {
        return [...preparedAssets].sort((a, b) => {
            const valA = a[sort.key] ?? (sort.dir === 'asc' ? Infinity : -Infinity);
            const valB = b[sort.key] ?? (sort.dir === 'asc' ? Infinity : -Infinity);

            if (sort.key === 'symbol') {
                return sort.dir === 'asc' ? a.symbol.localeCompare(b.symbol) : b.symbol.localeCompare(a.symbol);
            }
            if (typeof valA === 'number' && typeof valB === 'number') {
                return sort.dir === 'asc' ? valA - valB : valB - valA;
            }
            return 0;
        });
    }, [preparedAssets, sort]);

    const handleSortChange = (key: string) => {
        const option = sortOptions.find(item => item.value === key);
        if (option) setSort(prev => ({ ...prev, key: option.value }));
    };

    const handlePdfExport = () => {
        const title = "Análisis de Precios y Volatilidad";
        const head = [['Activo', 'Precio', 'Var. Diaria', 'Var. Mensual', 'Var. Anual', 'Volatilidad', 'Ratio Sharpe', 'Precio Objetivo']];
        const body = sortedAssets.map(asset => [
            asset.symbol,
            formatCurrency(asset.currentPrice),
            typeof asset.dayChange === 'number' ? `${asset.dayChange.toFixed(2)}%` : '',
            typeof asset.monthChange === 'number' ? `${asset.monthChange.toFixed(2)}%` : '',
            typeof asset.yearChange === 'number' ? `${asset.yearChange.toFixed(2)}%` : '',
            typeof asset.stdDev === 'number' ? `${asset.stdDev.toFixed(2)}%` : '',
            formatNumber(asset.sharpeRatio),
            formatCurrency(asset.targetConsensus)
        ]);

        const assetsForExport = sortedAssets.map(p => ({
            ...p.original,
            symbol: p.symbol,
            currentPrice: p.currentPrice,
            dayChange: p.dayChange,
            monthChange: p.monthChange,
            yearChange: p.yearChange,
            stdDev: p.stdDev,
            sharpeRatio: p.sharpeRatio
        })) as unknown as AssetData[];

        void exportToPdf({
            title,
            subtitle: "Análisis de rendimiento y riesgo.",
            sections: [{ title: 'Tabla de Precios', head, body }],
            assets: assetsForExport,
            theme,
            indicatorConfig,
        }).catch((error: unknown) => {
            console.error('Error durante la exportación a PDF:', error);
            toast.error(`Error al exportar el PDF: ${error instanceof Error ? error.message : 'Error desconocido'}`);
        });
    };

    if (assets.length === 0) return null;

    return (
        <>
            <Card className="overflow-hidden border-border/70 bg-card/95 shadow-sm">
                <div className="h-1 bg-gradient-to-r from-cyan-400 via-primary to-violet-500" aria-hidden="true" />
                <CardHeader className="gap-4 p-4 sm:p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                            <div className="rounded-xl border border-cyan-500/20 bg-gradient-to-br from-primary/15 to-cyan-500/10 p-2.5 text-primary shadow-sm">
                                <BarChart2 className="h-5 w-5 sm:h-6 sm:w-6" />
                            </div>
                            <div className="min-w-0">
                                <CardTitle className="text-lg sm:text-xl">Precios y volatilidad</CardTitle>
                                <CardDescription className="mt-1 text-xs sm:text-sm">
                                    Rendimiento, riesgo y cotización en una vista compacta.
                                </CardDescription>
                            </div>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <div className="flex items-center gap-2">
                                <span className="hidden text-xs font-medium text-muted-foreground sm:inline">Ordenar</span>
                                <Select value={sort.key} onValueChange={handleSortChange}>
                                    <SelectTrigger aria-label="Ordenar activos por" className="h-9 w-full rounded-lg bg-background sm:w-[170px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {sortOptions.map(option => (
                                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-9 w-9 shrink-0"
                                    aria-label={sort.dir === 'asc' ? 'Orden ascendente' : 'Orden descendente'}
                                    title={sort.dir === 'asc' ? 'Orden ascendente' : 'Orden descendente'}
                                    onClick={() => setSort(prev => ({ ...prev, dir: prev.dir === 'asc' ? 'desc' : 'asc' }))}
                                >
                                    {sort.dir === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                                </Button>
                            </div>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="outline" size="sm" className="w-full gap-2 sm:w-auto" disabled={!canExportPdf}>
                                                    <Download className="h-4 w-4" />
                                                    Exportar
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent>
                                                <DropdownMenuItem onClick={handlePdfExport}>Exportar a PDF</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </TooltipTrigger>
                                {!canExportPdf && <TooltipContent><p className="text-xs">{upgradeMessage}</p></TooltipContent>}
                            </Tooltip>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
                        {sortedAssets.map(asset => {
                            const metrics = [
                                { label: 'Cambio diario', value: formatPercent(asset.dayChange), className: getReturnColor(asset.dayChange) },
                                { label: 'Cambio mensual', value: formatPercent(asset.monthChange), className: getReturnColor(asset.monthChange) },
                                { label: 'Cambio anual', value: formatPercent(asset.yearChange), className: getReturnColor(asset.yearChange) },
                                { label: 'Volatilidad', value: formatMagnitudePercent(asset.stdDev), className: 'text-foreground' },
                                { label: 'Ratio Sharpe', value: formatNumber(asset.sharpeRatio), className: 'text-foreground' },
                                { label: 'Precio objetivo', value: formatCurrency(asset.targetConsensus), className: 'text-foreground' },
                            ];

                            return (
                                <Card
                                    key={asset.symbol}
                                    className="group relative overflow-hidden border-border/70 bg-gradient-to-br from-card via-card to-primary/[0.03] transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg"
                                >
                                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-cyan-400/70 via-primary/50 to-transparent opacity-70 transition-opacity group-hover:opacity-100" />
                                    <CardContent className="p-4 sm:p-5">
                                        <div className="flex items-start justify-between gap-3">
                                            <Link
                                                to={`/asset/${asset.symbol}`}
                                                className="flex min-w-0 items-center gap-3"
                                                onMouseEnter={() => prefetchAssetIfNotCached(asset.symbol)}
                                                onFocus={() => prefetchAssetIfNotCached(asset.symbol)}
                                            >
                                                <AssetLogo
                                                    morph
                                                    src={asset.image}
                                                    name={asset.companyName}
                                                    symbol={asset.symbol}
                                                    className="size-10 shrink-0"
                                                />
                                                <div className="min-w-0">
                                                    <p className="font-bold tracking-tight transition-colors group-hover:text-primary">{asset.symbol}</p>
                                                    <p className="truncate text-xs text-muted-foreground">
                                                        {asset.companyName || 'Empresa sin nombre disponible'}
                                                    </p>
                                                </div>
                                            </Link>
                                            <div className="shrink-0 text-right">
                                                <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Cotización</p>
                                                <LiveValue value={asset.currentPrice}>
                                                    <p className="mt-0.5 text-lg font-bold tabular-nums">{formatCurrency(asset.currentPrice)}</p>
                                                </LiveValue>
                                            </div>
                                        </div>

                                        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                                            {metrics.map(metric => (
                                                <div key={metric.label} className="min-w-0 rounded-xl border border-border/60 bg-background/70 px-2.5 py-2">
                                                    <p className="truncate text-[10px] font-medium text-muted-foreground">{metric.label}</p>
                                                    <p className={`mt-1 truncate text-sm font-semibold tabular-nums ${metric.className}`}>
                                                        {metric.value}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="mt-3 flex items-center justify-between gap-3 border-t border-dashed pt-3">
                                            <span className="text-[10px] text-muted-foreground">Datos de mercado</span>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 gap-1.5 border-primary/20 px-3 hover:border-primary/40 hover:bg-primary/5"
                                                aria-label={`Comprar ${asset.symbol}`}
                                                onClick={() => setBuyModalInfo({ isOpen: true, ticker: asset.symbol, price: asset.currentPrice })}
                                            >
                                                <ShoppingCart className="h-3.5 w-3.5 text-primary" />
                                                Comprar
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
            <AddTransactionModal
                isOpen={buyModalInfo.isOpen}
                onClose={() => setBuyModalInfo({ isOpen: false, ticker: null, price: null })}
                ticker={buyModalInfo.ticker}
                currentPrice={buyModalInfo.price}
            />
        </>
    );
});