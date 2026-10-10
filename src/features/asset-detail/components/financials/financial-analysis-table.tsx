// src/features/asset-detail/components/financials/financial-analysis-table.tsx

import { useState, useMemo } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../../../../components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../../../../components/ui/select";
import { Button } from '../../../../components/ui/button';
import { Plus, X, TrendingUp, TrendingDown } from 'lucide-react';
import { formatLargeNumber, formatPercentage, formatPrice } from '../../lib/asset-formatters';
import { cn } from '../../../../lib/utils';
import { ScrollArea } from '../../../../components/ui/scroll-area';

export interface MetricConfig {
    key: string;
    label: string;
    format: 'currency' | 'number' | 'percent' | 'compact';
    description?: string;
}

interface FinancialAnalysisTableProps {
    data: any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
    defaultMetrics: string[];
    availableMetrics: MetricConfig[];
    dateKey?: string; // 'date' | 'year'
}

export function FinancialAnalysisTable({
    data,
    defaultMetrics,
    availableMetrics,
    dateKey = 'date'
}: FinancialAnalysisTableProps) {
    const [visibleMetrics, setVisibleMetrics] = useState<string[]>(defaultMetrics);

    // 1. Procesar y Ordenar Datos (Más reciente primero: 2024, 2023, 2022...)
    const sortedData = useMemo(() => {
        if (!data || data.length === 0) return [];
        return [...data].sort((a, b) => {
            // Manejo robusto de fechas (string '2024-12-31' o '2024')
            const dateA = new Date(a[dateKey] ?? a.year).getTime();
            const dateB = new Date(b[dateKey] ?? b.year).getTime();
            return dateB - dateA;
        });
    }, [data, dateKey]);

    // Si no hay datos, mostrar estado vacío
    if (sortedData.length === 0) {
        return <div className="p-8 text-center text-muted-foreground text-sm border rounded-lg bg-muted/5">No hay datos históricos disponibles para esta sección.</div>;
    }

    // Extraer años para headers
    const years = sortedData.map(item => {
        const val = item[dateKey] ?? item.year;
        // Si es solo año "2024" o fecha completa
        return typeof val === 'string' && val.length === 4 ? val : new Date(val).getFullYear().toString();
    });

    // Helper para añadir métrica
    const handleAddMetric = (key: string) => {
        if (!visibleMetrics.includes(key)) {
            setVisibleMetrics([...visibleMetrics, key]);
        }
    };

    // Helper para quitar métrica
    const handleRemoveMetric = (key: string) => {
        setVisibleMetrics(visibleMetrics.filter(k => k !== key));
    };

    // Opciones disponibles para el select (filtrando las ya visibles)
    const optionsToAdd = availableMetrics.filter(m => !visibleMetrics.includes(m.key));

    return (
        <div className="space-y-4 animate-in fade-in-50 duration-500">
            {/* Controles Superiores */}
            <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground italic">
                    * Desliza horizontalmente para ver más años
                </p>

                <Select value="" onValueChange={handleAddMetric} disabled={optionsToAdd.length === 0}>
                    <SelectTrigger className="w-[240px] h-9 text-xs font-medium bg-primary/5 border-primary/20 hover:bg-primary/10 transition-colors focus:ring-primary/20">
                        <div className="flex items-center gap-2">
                            <Plus className="w-3.5 h-3.5" />
                            <SelectValue placeholder={optionsToAdd.length > 0 ? "Agregar dato a la tabla..." : "No hay más datos disponibles"} />
                        </div>
                    </SelectTrigger>
                    <SelectContent>
                        <ScrollArea className="h-[200px]">
                            {optionsToAdd.length > 0 ? (
                                optionsToAdd.map((metric) => (
                                    <SelectItem key={metric.key} value={metric.key} className="text-xs cursor-pointer">
                                        {metric.label}
                                    </SelectItem>
                                ))
                            ) : (
                                <div className="p-2 text-xs text-muted-foreground text-center">
                                    No hay más métricas
                                </div>
                            )}
                        </ScrollArea>
                    </SelectContent>
                </Select>
            </div>

            <div className="rounded-xl border shadow-sm bg-card overflow-hidden">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/30 hover:bg-muted/30">
                                <TableHead className="w-[250px] min-w-[200px] font-bold text-primary pl-6">Métrica Financiera</TableHead>
                                {years.map(year => (
                                    <TableHead key={year} className="text-right min-w-[140px] font-bold text-foreground/80 text-sm">
                                        {year}
                                    </TableHead>
                                ))}
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {visibleMetrics.map((metricKey) => {
                                const config = availableMetrics.find(m => m.key === metricKey);
                                if (!config) return null;

                                return (
                                    <TableRow key={metricKey} className="group hover:bg-muted/5 transition-colors border-b last:border-0">
                                        <TableCell className="font-semibold text-sm text-muted-foreground group-hover:text-primary transition-colors pl-6 py-4">
                                            {config.label}
                                        </TableCell>

                                        {sortedData.map((item, index) => {
                                            const value = item[metricKey];
                                            // Calcular YoY (Year over Year)
                                            // Buscamos el año siguiente en el array (que es el año anterior cronológicamente)
                                            const prevItem = sortedData[index + 1];
                                            const prevValue = prevItem ? prevItem[metricKey] : null;

                                            let yoy = null;
                                            if (typeof value === 'number' && typeof prevValue === 'number' && prevValue !== 0) {
                                                yoy = ((value - prevValue) / Math.abs(prevValue)) * 100;
                                            }

                                            // Formateo del valor principal
                                            let displayValue = '';
                                            if (value !== undefined && value !== null) {
                                                const numVal = Number(value);
                                                if (!isNaN(numVal)) {
                                                    if (config.format === 'compact') displayValue = formatLargeNumber(numVal);
                                                    else if (config.format === 'currency') displayValue = formatPrice(numVal);
                                                    else if (config.format === 'percent') displayValue = formatPercentage(numVal * 100);
                                                    else displayValue = numVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                                }
                                            }

                                            return (
                                                <TableCell key={index} className="text-right align-top py-3">
                                                    <div className="flex flex-col items-end gap-1">
                                                        <span className="text-base font-bold tracking-tight text-foreground">
                                                            {displayValue}
                                                        </span>

                                                        {/* Badge de Variación YoY */}
                                                        {yoy !== null && Math.abs(yoy) > 0.5 && Math.abs(yoy) < 1000 && (
                                                            <div className={cn(
                                                                "flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border",
                                                                yoy > 0
                                                                    ? "text-emerald-600 bg-emerald-50 border-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-900/50 dark:text-emerald-400"
                                                                    : "text-rose-600 bg-rose-50 border-rose-100 dark:bg-rose-950/30 dark:border-rose-900/50 dark:text-rose-400"
                                                            )}>
                                                                {yoy > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                                                                <span>{Math.abs(yoy).toFixed(1)}%</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            );
                                        })}

                                        <TableCell className="pr-4">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-all text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                onClick={() => handleRemoveMetric(metricKey)}
                                                title="Quitar fila"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
}