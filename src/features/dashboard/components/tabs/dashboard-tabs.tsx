// src/features/dashboard/components/tabs/dashboard-tabs.tsx

import { Tabs, TabsList, TabsTrigger } from "../../../../components/ui/tabs";
import { AssetData } from "../../../../types/dashboard";
import { PriceAnalysisTable } from "../analysis/price-analysis-table";
import { FundamentalsTable } from "../analysis/fundamentals-table";
import { CorrelationMatrix } from "../analysis/correlation-matrix";
import { RadarComparison } from "../analysis/radar-comparison";
import { HistoricalPerformanceChart } from "../charts/historical-performance-chart";
import SummaryAnalysis from "../analysis/summary-analysis";
import { indicatorConfig } from "../../../../utils/financial";
import {
    BarChart2,
    LayoutGrid,
    GitCompareArrows,
    Zap,
    AreaChart,
    BrainCircuit
} from "lucide-react";
import { Skeleton } from "../../../../components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../../components/ui/select";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { useState } from "react";
import { Card, CardContent } from "../../../../components/ui/card";

interface DashboardTabsProps {
    assets: AssetData[];
    isLoading: boolean;
}

const tabContentVariants: Variants = {
    hidden: {
        opacity: 0,
        y: 8,
        scale: 0.995,
    },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: {
            duration: 0.2,
            ease: [0.22, 1, 0.36, 1],
        },
    },
    exit: {
        opacity: 0,
        y: -6,
        scale: 0.995,
        transition: {
            duration: 0.08,
            ease: [0.4, 0, 1, 1],
        },
    },
};

export function DashboardTabs({ assets, isLoading }: DashboardTabsProps) {
    const [activeTab, setActiveTab] = useState("prices");

    // Si está cargando y no hay activos previos, mostrar skeleton
    // Esto evita mostrar pestañas vacías mientras se cargan los datos iniciales
    if (isLoading && assets.length === 0) {
        return <Skeleton className="h-96 w-full rounded-xl" />;
    }
    if (assets.length === 0) {
        return (
            <Card className="flex min-h-64 items-center justify-center">
                <CardContent className="p-6 text-center">
                    <p className="font-medium">Todavía no hay datos para analizar</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Reintentá la carga o verificá los símbolos seleccionados.
                    </p>
                </CardContent>
            </Card>
        );
    }

    // Definición de las pestañas para mantener el código limpio y mantenible
    const tabs = [
        { value: "prices", label: "Precios", icon: BarChart2 },
        { value: "fundamentals", label: "Fundamentales", icon: LayoutGrid },
        { value: "correlation", label: "Correlación", icon: GitCompareArrows },
        { value: "radar", label: "Perfiles", icon: Zap },
        { value: "charts", label: "Evolución", icon: AreaChart },
        { value: "summary", label: "Resumen", icon: BrainCircuit },
    ];

    const renderTabContent = () => {
        switch (activeTab) {
            case "prices":
                return <PriceAnalysisTable assets={assets} />;
            case "fundamentals":
                return <FundamentalsTable assets={assets} />;
            case "correlation":
                return <CorrelationMatrix assets={assets} />;
            case "radar":
                return <RadarComparison assets={assets} />;
            case "charts":
                return <HistoricalPerformanceChart assets={assets} />;
            case "summary":
                return <SummaryAnalysis assets={assets} indicatorConfig={indicatorConfig} />;
            default:
                return null;
        }
    };

    return (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-3">
            <div className="flex items-center justify-between gap-3 px-1">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Panel de análisis
                </p>
                <p className="text-xs text-muted-foreground">
                    {assets.length} activo{assets.length === 1 ? '' : 's'}
                </p>
            </div>
            <div className="sm:hidden">
                <Select value={activeTab} onValueChange={setActiveTab}>
                    <SelectTrigger aria-label="Tipo de análisis" className="h-11 w-full rounded-xl bg-card shadow-sm">
                        <SelectValue placeholder="Elegí un análisis" />
                    </SelectTrigger>
                    <SelectContent>
                        {tabs.map((tab) => (
                            <SelectItem key={tab.value} value={tab.value}>{tab.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="hidden w-full overflow-x-auto pb-2 sm:block">
                <TabsList className="flex h-auto min-w-max items-center justify-start gap-1 rounded-xl border bg-muted/40 p-1 sm:w-fit">
                    {tabs.map((tab, index) => (
                        <motion.div
                            key={tab.value}
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                                delay: index * 0.05,
                                type: "spring",
                                stiffness: 400,
                                damping: 25,
                            }}
                        >
                            <TabsTrigger
                                value={tab.value}
                                className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-border"
                            >
                                <tab.icon className="h-4 w-4" />
                                <span>{tab.label}</span>
                            </TabsTrigger>
                        </motion.div>
                    ))}
                </TabsList>
            </div>

            {/* Mantiene estable el layout al cambiar análisis sin agregar demasiado espacio vacío. */}
            <div className="min-h-[320px]">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        variants={tabContentVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="mt-0 space-y-4 focus-visible:outline-none"
                    >
                        {renderTabContent()}
                    </motion.div>
                </AnimatePresence>
            </div>
        </Tabs>
    );
}