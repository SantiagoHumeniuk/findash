// src/features/dashboard/components/analysis/correlation-matrix.tsx

import React, { useMemo, useState } from "react";
import { AssetData } from "../../../../types/dashboard";
import { correlation } from "../../../../utils/math";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../../components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../../../components/ui/tooltip";
import { Download, GitCompareArrows } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../../../components/ui/dropdown-menu";
import { Button } from "../../../../components/ui/button";
import { exportToPdf } from "../../../../utils/export-pdf";
import { toast } from "sonner";
import { indicatorConfig } from "../../../../utils/financial";
import { useTheme } from "../../../../components/ui/theme-provider";
import { usePlanFeature } from "../../../../hooks/use-plan-feature";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../../components/ui/select";
import { getCorrelationCellColors } from "../../lib/correlation-colors";

// --- Props del Componente ---
interface CorrelationMatrixProps {
    assets: AssetData[];
}

// --- Helper: Convertir Historial OHLCV a Retornos Diarios alineados ---
function alignAndCalculateReturns(
    historyA: { date: string; close: number }[],
    historyB: { date: string; close: number }[]
): { returnsA: number[], returnsB: number[] } | null {
    if (!historyA || !historyB || historyA.length < 2 || historyB.length < 2) return null;

    // Crear mapas para acceso rápido por fecha (YYYY-MM-DD)
    const mapA = new Map(historyA.map(h => [h.date.split('T')[0], h.close]));
    const mapB = new Map(historyB.map(h => [h.date.split('T')[0], h.close]));

    // Encontrar fechas comunes
    const commonDates = historyA
        .map(h => h.date.split('T')[0])
        .filter(date => mapB.has(date))
        .sort(); // Orden ascendente

    if (commonDates.length < 2) return null;

    const returnsA: number[] = [];
    const returnsB: number[] = [];

    // Calcular retornos solo en fechas comunes
    for (let i = 1; i < commonDates.length; i++) {
        const datePrev = commonDates[i - 1];
        const dateCurr = commonDates[i];

        const closeAPrev = mapA.get(datePrev)!;
        const closeACurr = mapA.get(dateCurr)!;

        const closeBPrev = mapB.get(datePrev)!;
        const closeBCurr = mapB.get(dateCurr)!;

        if (closeAPrev > 0 && closeBPrev > 0) {
            returnsA.push((closeACurr - closeAPrev) / closeAPrev);
            returnsB.push((closeBCurr - closeBPrev) / closeBPrev);
        }
    }

    return { returnsA, returnsB };
}

// --- Lógica de Estilo para Celdas ---
// --- Componente Principal ---
export const CorrelationMatrix = React.memo(function CorrelationMatrix({ assets }: CorrelationMatrixProps) {
    const { theme } = useTheme();
    const { hasAccess: canExportPdf, upgradeMessage } = usePlanFeature('exportPdf');
    const [mobileSymbol, setMobileSymbol] = useState(assets[0]?.profile.symbol ?? "");

    const correlationMatrix = useMemo(() => {
        const matrix: (number | null)[][] = [];
        if (assets.length < 2) return [];

        for (let i = 0; i < assets.length; i++) {
            matrix[i] = [];
            for (let j = 0; j < assets.length; j++) {
                if (i === j) {
                    matrix[i][j] = 1;
                } else if (j > i) {
                    // Calcular solo el triángulo superior y espejar para optimizar
                    const aligned = alignAndCalculateReturns(
                        assets[i].historicalReturns,
                        assets[j].historicalReturns
                    );

                    if (aligned && aligned.returnsA.length > 10) { // Mínimo 10 puntos en común
                        matrix[i][j] = correlation(aligned.returnsA, aligned.returnsB);
                    } else {
                        matrix[i][j] = null;
                    }
                } else {
                    // Espejar triángulo inferior
                    matrix[i][j] = matrix[j][i];
                }
            }
        }
        return matrix;
    }, [assets]);
    const selectedMobileIndex = Math.max(0, assets.findIndex(asset => asset.profile.symbol === mobileSymbol));
    const selectedMobileAsset = assets[selectedMobileIndex];

    const handlePdfExport = () => {
        const title = "Matriz de Correlación";
        const subtitle = "Análisis de correlación entre los retornos históricos de los activos seleccionados.";

        const head = [['Activo', ...assets.map(asset => asset.profile.symbol)]];

        const body = assets.map((rowAsset, i) => [
            rowAsset.profile.symbol,
            ...assets.map((_, j) => {
                const value = correlationMatrix[i]?.[j];
                return typeof value === 'number' ? value.toFixed(2) : 'N/D';
            })
        ]);

        void exportToPdf({
            title,
            subtitle,
            sections: [{
                title: 'Matriz de Correlación',
                head,
                body,
                isCorrelation: true
            }],
            assets,
            theme,
            indicatorConfig,
        }).catch((error: unknown) => {
            console.error('Error durante la exportación a PDF:', error);
            toast.error(`Error al exportar el PDF: ${error instanceof Error ? error.message : 'Error desconocido'}`);
        });
    };

    if (assets.length < 2) {
        return (
            <Card className="flex items-center justify-center h-64 sm:h-96">
                <div className="text-center text-muted-foreground px-4">
                    <GitCompareArrows className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-2 sm:mb-3" />
                    <p className="font-semibold text-sm sm:text-base">Necesitas al menos 2 activos</p>
                    <p className="text-xs sm:text-sm mt-1">Agregá otro activo para calcular la correlación.</p>
                </div>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-2">
                    <div className="flex items-center gap-2 sm:gap-3">
                        <GitCompareArrows className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                        <div>
                            <CardTitle className="text-lg sm:text-xl">Matriz de Correlación</CardTitle>
                            <CardDescription className="text-xs sm:text-sm">
                                Verde: relación lineal débil. Rojo: correlación intensa; el signo indica si se mueven en la misma dirección (+) o en direcciones opuestas (−).
                            </CardDescription>
                        </div>
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
                                            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
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
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
                <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
                    <span className="font-medium">Intensidad:</span>
                    <span>Débil</span>
                    <div className="h-2 w-24 rounded-full bg-gradient-to-r from-emerald-500 via-yellow-400 to-red-600" aria-hidden="true" />
                    <span>Fuerte</span>
                    <span className="basis-full sm:basis-auto">Un rojo intenso puede ser correlación positiva o inversa; mirá el valor para distinguirlas.</span>
                </div>
                <div className="space-y-3 sm:hidden">
                    <Select value={selectedMobileAsset?.profile.symbol ?? ""} onValueChange={setMobileSymbol}>
                        <SelectTrigger aria-label="Activo para consultar correlaciones" className="h-11 w-full">
                            <SelectValue placeholder="Elegí un activo" />
                        </SelectTrigger>
                        <SelectContent>
                            {assets.map(asset => (
                                <SelectItem key={asset.profile.symbol} value={asset.profile.symbol}>{asset.profile.symbol}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <div className="space-y-2">
                        {assets.map((asset, index) => {
                            if (index === selectedMobileIndex) return null;
                            const value = correlationMatrix[selectedMobileIndex]?.[index] ?? null;
                            return (
                                <div
                                    key={asset.profile.symbol}
                                    className="flex min-h-14 items-center justify-between gap-3 rounded-lg border px-3 py-2"
                                    style={getCorrelationCellColors(value)}
                                >
                                    <span className="min-w-0 break-words text-sm font-medium">
                                        {selectedMobileAsset?.profile.symbol} vs {asset.profile.symbol}
                                    </span>
                                    <span className="shrink-0 text-sm font-bold">
                                        {typeof value === 'number' ? value.toFixed(2) : 'Sin datos'}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div className="hidden overflow-x-auto border rounded-lg -mx-4 sm:mx-0 sm:block">
                    <Table className="min-w-full">
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead className="sticky left-0 z-10 bg-muted/50 font-semibold w-[100px]">Activo</TableHead>
                                {assets.map(asset => (
                                    <TableHead key={asset.profile.symbol} className="text-center font-semibold min-w-[80px]">{asset.profile.symbol}</TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {assets.map((rowAsset, i) => (
                                <TableRow key={rowAsset.profile.symbol}>
                                    <TableHead className="font-bold sticky left-0 z-10 bg-background">{rowAsset.profile.symbol}</TableHead>
                                    {assets.map((colAsset, j) => {
                                        const value = correlationMatrix[i]?.[j];
                                        return (
                                            <TableCell key={colAsset.profile.symbol} className="text-center p-1">
                                                <TooltipProvider delayDuration={0}>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div
                                                                className="w-full h-10 flex items-center justify-center rounded-md text-sm transition-colors hover:opacity-80 cursor-default"
                                                                style={getCorrelationCellColors(value ?? null)}
                                                            >
                                                                {typeof value === 'number' ? value.toFixed(2) : '—'}
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p className="font-semibold mb-1">
                                                                {i === j
                                                                    ? 'Correlación del activo consigo mismo: 1.000'
                                                                    : value != null ? `Correlación: ${value.toFixed(3)}` : 'Sin datos suficientes'}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {rowAsset.profile.symbol} vs {colAsset.profile.symbol}
                                                                {(value === null || value === undefined) && ' · Se necesitan al menos 10 retornos diarios coincidentes.'}
                                                            </p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </TableCell>
                                        );
                                    })}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
});