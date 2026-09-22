import React from "react";
import { Target } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../../components/ui/card";
import { AssetData } from "../../../../../types/dashboard";
import { IndicatorConfig } from "../../../../../utils/financial";
import { motion } from "framer-motion";

interface CategoryLeadersProps {
    categoryWinners: Record<string, { symbol: string; score: number; metrics: string[] }>;
    categories: Record<string, { label: string; icon: React.ReactNode }>;
    assets: AssetData[];
    indicatorConfig: IndicatorConfig;
}

export default function CategoryLeaders({ categoryWinners, categories, assets, indicatorConfig }: CategoryLeadersProps) {

    // Función robusta para resolver valores usando la configuración (API Fields)
    const resolveLocalValue = (asset: AssetData | undefined, metric: string): number | null => {
        if (!asset) return null;

        // 1. Caso especial: Upside Potential
        if (metric === 'upsidePotential') {
            const p = asset.quote?.price;
            const t = asset.priceTargetConsensus?.targetConsensus;
            return (p && t) ? (t - p) / p : null;
        }

        // 2. Buscar configuración
        const config = indicatorConfig[metric];
        if (!config) return null;

        // 3. Buscar en fuentes de datos (KeyMetrics, Profile, Quote) usando los campos API correctos
        const sources = [asset.keyMetrics, asset.profile, asset.quote];
        let value: number | null = null;

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

        // 4. Intentar cálculo manual (compute) si no se encontró dato directo
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

        // 5. Ajustar porcentajes si es necesario (para visualización, algunos datos vienen en 0.15 y otros en 15)
        // Nota: Asumimos que resolveValue devuelve el dato crudo. El formateo se hace abajo.
        return value;
    };

    const formatMetricValue = (value: number, metric: string) => {
        if (metric === 'upsidePotential') return `${(value * 100).toFixed(2)}%`;

        const config = indicatorConfig[metric];
        if (!config) return value.toFixed(2);

        // Si es porcentaje, multiplicar por 100 si el valor es pequeño (< 5 suele indicar decimal)
        if (config.asPercent) {
            // Lógica heurística: si es un ratio tipo 0.05, lo mostramos como 5.00%
            // Si ya viene como 5.0, lo mostramos como 5.00%
            const valToFormat = (Math.abs(value) <= 1.5 && value !== 0) ? value * 100 : value;
            return `${valToFormat.toFixed(2)}%`;
        }

        if (config.isLargeNumber) {
            if (Math.abs(value) >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
            if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
            if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
        }
        return value.toFixed(2);
    };

    const getMetricLabel = (metric: string) => {
        if (metric === 'upsidePotential') return 'Potencial Upside';
        return indicatorConfig[metric]?.label || metric;
    }

    return (
        <Card>
            <CardHeader className="p-4 sm:p-6">
                <CardTitle className="flex items-center gap-1.5 sm:gap-2 text-lg sm:text-xl">
                    <Target className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                    Líderes por Categoría
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                    Activos que destacan en áreas específicas
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-4 sm:p-6 pt-0">
                {Object.entries(categoryWinners).map(([catKey, winner], index) => {
                    const category = categories[catKey];
                    const winnerAsset = assets.find(a => a.profile.symbol === winner.symbol);

                    return (
                        <motion.div
                            key={catKey}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                                delay: index * 0.08,
                                type: "spring",
                                stiffness: 350,
                                damping: 25,
                            }}
                            whileHover={{ scale: 1.01 }}
                            className="p-3 border rounded-lg hover:bg-muted/30 transition-colors"
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-muted rounded-md text-primary">{category.icon}</div>
                                    <div>
                                        <span className="block font-semibold text-sm leading-none">{category.label}</span>
                                        <span className="text-[10px] text-muted-foreground">Ganador</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold text-base text-primary">{winner.symbol}</div>
                                </div>
                            </div>

                            {/* Métricas principales destacadas */}
                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-dashed">
                                {winner.metrics.slice(0, 2).map(metric => {
                                    const value = resolveLocalValue(winnerAsset, metric);
                                    const displayValue = (value !== null && Number.isFinite(value))
                                        ? formatMetricValue(value, metric)
                                        : 'N/A';

                                    return (
                                        <div key={metric} className="flex flex-col">
                                            <span className="text-[10px] text-muted-foreground truncate">
                                                {getMetricLabel(metric)}
                                            </span>
                                            <span className={`font-semibold text-xs ${displayValue === 'N/A' ? 'text-muted-foreground' : ''}`}>
                                                {displayValue}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </motion.div>
                    );
                })}
            </CardContent>
        </Card>
    );
}