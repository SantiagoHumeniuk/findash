// src/features/dashboard/components/analysis/price-analysis-table.tsx

import React, { useMemo, useState } from "react";
import { AssetData } from "../../../../types/dashboard";
import { Button } from "../../../../components/ui/button";
import { ArrowDown, ArrowUp, Download, BarChart2, ShoppingCart } from "lucide-react";
import { exportToPdf } from "../../../../utils/export-pdf";
import { indicatorConfig } from "../../../../utils/financial";
import { computeSharpe, computeStdDevPct } from "../../../../utils/financial-formulas";
import { useTheme } from "../../../../components/ui/theme-provider";
import { Link } from "react-router-dom";
import { AddTransactionModal } from "../../../portfolio/components";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../../components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../../../components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../../components/ui/tooltip";
import { usePrefetchAsset } from "../../../../hooks/use-prefetch-asset";
import { usePlanFeature } from "../../../../hooks/use-plan-feature";

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
    lastMonthAvgPriceTarget: number | null;
    targetConsensus: number | null;
    original: AssetData;
}

interface PriceAnalysisTableProps {
    assets: AssetData[];
}

// --- Helpers de Formato ---
const formatCurrency = (v: number | null) => (typeof v === "number" && Number.isFinite(v) ? `$${v.toFixed(2)}` : "");
const formatNumber = (v: number | null) => (typeof v === "number" && Number.isFinite(v) ? v.toFixed(2) : "");
const pctNode = (v: number | null) => {
    if (typeof v !== "number" || !Number.isFinite(v)) return null;
    const color = v >= 0 ? "text-green-500" : "text-red-500";
    const Icon = v >= 0 ? ArrowUp : ArrowDown;
    return (
        <span className={`flex items-center justify-center gap-1 font-medium ${color}`}>
            <Icon className="w-3 h-3" />
            {v.toFixed(2)}%
        </span>
    );
};

// --- Componente de Cabecera Ordenable ---
const SortableTableHeader = ({
    children,
    align = 'left',
    sortKey,
    currentSort,
    onSort
}: {
    children: React.ReactNode;
    align?: 'left' | 'right' | 'center';
    sortKey: keyof PreparedAssetRow;
    currentSort: { key: string; dir: 'asc' | 'desc' };
    onSort: (key: string) => void;
}) => {
    const isActive = currentSort.key === sortKey;
    const Icon = currentSort.dir === 'asc' ? ArrowUp : ArrowDown;
    return (
        <TableHead className={`text-${align} w-[150px]`}>
            <Button variant="ghost" onClick={() => onSort(sortKey)} className={`w-full justify-${sortKey === 'symbol' ? 'start' : 'center'} h-8`}>
                {children}
                <Icon className={`w-4 h-4 ml-2 transition-opacity ${isActive ? 'opacity-100' : 'opacity-30'}`} />
            </Button>
        </TableHead>
    );
};

// --- Componente Principal ---
export const PriceAnalysisTable = React.memo(function PriceAnalysisTable({ assets }: PriceAnalysisTableProps) {
    const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: "symbol", dir: "asc" });
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
                monthChange: asset.dataSource === 'Yahoo Finance' ? null : asset.stockPriceChange["1M"] ?? null,
                yearChange: asset.dataSource === 'Yahoo Finance' ? null : asset.stockPriceChange["1Y"] ?? null,
                stdDev,
                sharpeRatio,
                lastMonthAvgPriceTarget: asset.priceTarget?.lastMonthAvgPriceTarget ?? null,
                targetConsensus: asset.priceTargetConsensus?.targetConsensus ?? null,
                original: asset
            };
        });
    }, [assets]);

    // Lógica de Ordenamiento
    const sortedAssets = useMemo(() => {
        return [...preparedAssets].sort((a, b) => {
            const valA = a[sort.key as keyof PreparedAssetRow] ?? (sort.dir === 'asc' ? Infinity : -Infinity);
            const valB = b[sort.key as keyof PreparedAssetRow] ?? (sort.dir === 'asc' ? Infinity : -Infinity);

            if (sort.key === 'symbol') {
                return sort.dir === 'asc' ? a.symbol.localeCompare(b.symbol) : b.symbol.localeCompare(a.symbol);
            }
            if (typeof valA === 'number' && typeof valB === 'number') {
                return sort.dir === 'asc' ? valA - valB : valB - valA;
            }
            return 0;
        });
    }, [preparedAssets, sort]);

    const handleSort = (key: string) => {
        setSort(prev => ({
            key,
            dir: prev.key === key && prev.dir === "asc" ? "desc" : "asc"
        }));
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
        });
    };

    if (assets.length === 0) return null;

    return (
        <>
            <Card>
                <CardHeader className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-2 sm:gap-3">
                            <BarChart2 className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                            <div>
                                <CardTitle className="text-lg sm:text-xl">Precios y Volatilidad</CardTitle>
                                <CardDescription className="text-xs sm:text-sm">Análisis de rendimiento y riesgo de los activos.</CardDescription>
                            </div>
                        </div>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" size="sm" className="w-full sm:w-auto text-xs sm:text-sm" disabled={!canExportPdf}>
                                                <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2" /> Exportar
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
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                    {/* --- VISTA ESCRITORIO --- */}
                    <div className="hidden sm:block">
                        <div className="border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        <SortableTableHeader sortKey="symbol" currentSort={sort} onSort={handleSort}>Activo</SortableTableHeader>
                                        <SortableTableHeader sortKey="currentPrice" currentSort={sort} onSort={handleSort} align="center">Precio</SortableTableHeader>
                                        <SortableTableHeader sortKey="dayChange" currentSort={sort} onSort={handleSort} align="center">Var. Diaria</SortableTableHeader>
                                        <SortableTableHeader sortKey="monthChange" currentSort={sort} onSort={handleSort} align="center">Var. Mensual</SortableTableHeader>
                                        <SortableTableHeader sortKey="yearChange" currentSort={sort} onSort={handleSort} align="center">Var. Anual</SortableTableHeader>
                                        <SortableTableHeader sortKey="stdDev" currentSort={sort} onSort={handleSort} align="center">Volatilidad</SortableTableHeader>
                                        <SortableTableHeader sortKey="sharpeRatio" currentSort={sort} onSort={handleSort} align="center">Ratio Sharpe</SortableTableHeader>
                                        <SortableTableHeader sortKey="lastMonthAvgPriceTarget" currentSort={sort} onSort={handleSort} align="center">Precio Objetivo</SortableTableHeader>
                                        <TableHead className="text-center w-[100px]">Comprar</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortedAssets.map((asset) => (
                                        <TableRow key={asset.symbol}>
                                            <TableCell className="font-medium">
                                                <Link
                                                    to={`/asset/${asset.symbol}`}
                                                    className="flex items-center gap-3 group"
                                                    onMouseEnter={() => prefetchAssetIfNotCached(asset.symbol)}
                                                    onFocus={() => prefetchAssetIfNotCached(asset.symbol)}
                                                >
                                                    <img src={asset.image} alt={asset.companyName} className="w-8 h-8 rounded-full bg-muted object-contain border" />
                                                    <div>
                                                        <div className="flex items-center justify-between gap-2">
                                                            <div className="flex-1 min-w-0">
                                                                <div className="font-bold group-hover:text-primary transition-colors">{asset.symbol}</div>
                                                                <div className="caption text-muted-foreground truncate max-w-[180px]">{asset.companyName}</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </Link>
                                            </TableCell>
                                            <TableCell className="text-center font-semibold">{formatCurrency(asset.currentPrice)}</TableCell>
                                            <TableCell className="text-center">{pctNode(asset.dayChange)}</TableCell>
                                            <TableCell className="text-center">{pctNode(asset.monthChange)}</TableCell>
                                            <TableCell className="text-center">{pctNode(asset.yearChange)}</TableCell>
                                            <TableCell className="text-center">{pctNode(asset.stdDev)}</TableCell>
                                            <TableCell className="text-center font-semibold">{formatNumber(asset.sharpeRatio)}</TableCell>
                                            <TableCell className="text-center font-semibold">
                                                {typeof asset.targetConsensus === 'number' && Number.isFinite(asset.targetConsensus) && asset.targetConsensus > 0
                                                    ? formatCurrency(asset.targetConsensus)
                                                    : ''}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Button variant="ghost" size="icon" onClick={() => setBuyModalInfo({ isOpen: true, ticker: asset.symbol, price: asset.currentPrice })}>
                                                    <ShoppingCart className="w-5 h-5 text-primary" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    {/* --- VISTA MÓVIL --- */}
                    <div className="sm:hidden grid grid-cols-1 gap-3">
                        {sortedAssets.map(asset => (
                            <Card key={asset.symbol} className="p-3">
                                <div className="flex items-start justify-between mb-3">
                                    <Link
                                        to={`/asset/${asset.symbol}`}
                                        className="flex items-center gap-2 font-bold flex-1 min-w-0"
                                        onMouseEnter={() => prefetchAssetIfNotCached(asset.symbol)}
                                        onFocus={() => prefetchAssetIfNotCached(asset.symbol)}
                                    >
                                        <img src={asset.image} className="w-7 h-7 rounded-full bg-muted object-contain border flex-shrink-0" />
                                        <div className="min-w-0 flex-1">
                                            <div className="text-sm flex items-center gap-1.5">
                                                {asset.symbol}
                                            </div>
                                            <div className="text-xs text-muted-foreground font-normal truncate">{asset.companyName}</div>
                                        </div>
                                    </Link>
                                    <span className="font-semibold text-base flex-shrink-0 ml-2">{formatCurrency(asset.currentPrice)}</span>
                                </div>
                                <div className="space-y-1.5 text-xs border-t pt-2.5 mt-2.5">
                                    <div className="flex justify-between"><span className="text-muted-foreground">Var. Diaria</span>{pctNode(asset.dayChange)}</div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">Var. Mensual</span>{pctNode(asset.monthChange)}</div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">Var. Anual</span>{pctNode(asset.yearChange)}</div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">Ratio Sharpe</span>{formatNumber(asset.sharpeRatio)}</div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Precio Objetivo</span>
                                        <span className="font-semibold">
                                            {typeof asset.targetConsensus === 'number' && Number.isFinite(asset.targetConsensus) && asset.targetConsensus > 0
                                                ? formatCurrency(asset.targetConsensus)
                                                : ''}
                                        </span>
                                    </div>
                                </div>
                                <Button variant="outline" size="sm" className="w-full mt-2.5" onClick={() => setBuyModalInfo({ isOpen: true, ticker: asset.symbol, price: asset.currentPrice })}>
                                    <ShoppingCart className="w-3.5 h-3.5 mr-1.5" /> Comprar
                                </Button>
                            </Card>
                        ))}
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