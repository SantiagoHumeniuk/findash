// src/features/portfolio/components/stats/portfolio-stats.tsx

import { useMemo } from 'react';
import { Card } from "../../../../components/ui/card";
import { Holding, PortfolioContextType } from '../../../../types/portfolio';
import { AssetData } from '../../../../types/dashboard';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../../../components/ui/tooltip';
import { formatCurrency, formatPercent } from '../../../../lib/utils';
import { formatNumber, calculatePortfolioMetrics, calculateDailyPlPercent, getColorClass } from '../../lib/portfolio.utils';
import { PerformanceMetrics } from '../../../../utils/performance-metrics';
import { 
    Wallet, 
    TrendingUp, 
    TrendingDown, 
    Clock, 
    BarChart3, 
    Activity, 
    ArrowUpRight, 
    ArrowDownRight,
    Trophy,
    Target,
    DollarSign,
    Percent,
    Calendar,
    ShieldAlert
} from 'lucide-react';
import { motion } from 'framer-motion';

const StatCard = ({ 
    label, 
    value, 
    icon: Icon,
    colorClass = 'text-foreground', 
    helpText,
    trend,
    delay = 0
}: { 
    label: string, 
    value: React.ReactNode, 
    icon: any,
    colorClass?: string, 
    helpText?: string,
    trend?: number,
    delay?: number
}) => (
    <motion.div
        whileHover={{ y: -4 }}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, delay }}
    >
        <Card className="p-4 bg-card/50 backdrop-blur-sm border-primary/10 hover:border-primary/30 transition-all shadow-premium group">
            <TooltipProvider delayDuration={100}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className="flex flex-row items-center justify-between h-full gap-4">
                            <div className="flex flex-col flex-1 space-y-1.5">
                                <span className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
                                <p className={`text-xl sm:text-2xl font-bold tracking-tight heading-premium ${colorClass}`}>
                                    {value}
                                </p>
                                {trend !== undefined && (
                                    <div className={`flex items-center gap-1 text-xs font-medium mt-1 ${trend >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                        {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                        <span>{Math.abs(trend).toFixed(2)}%</span>
                                        <span className="text-muted-foreground font-normal ml-1">vs previo</span>
                                    </div>
                                )}
                            </div>
                            <div className="p-3 bg-primary/5 rounded-2xl group-hover:bg-primary/10 transition-all group-hover:scale-110 flex-shrink-0">
                                <Icon className="w-8 h-8 sm:w-10 sm:h-10 text-primary opacity-80" strokeWidth={1.5} />
                            </div>
                        </div>
                    </TooltipTrigger>
                    {helpText && <TooltipContent side="top" className="glass-morphism border-none"><p className="text-xs max-w-[200px]">{helpText}</p></TooltipContent>}
                </Tooltip>
            </TooltipProvider>
        </Card>
    </motion.div>
);

interface PortfolioStatsProps {
    holdings: Holding[];
    totalPerformance: PortfolioContextType['totalPerformance'];
    portfolioData: Record<string, AssetData>;
    avgHoldingDays?: number;
    historicalMetrics?: PerformanceMetrics;
}

export function PortfolioStats({ holdings, totalPerformance, portfolioData, avgHoldingDays, historicalMetrics }: PortfolioStatsProps) {

    const metrics = useMemo(() => {
        const baseMetrics = calculatePortfolioMetrics(holdings, portfolioData);
        return { ...baseMetrics, avgHoldingDays: avgHoldingDays ?? 0 };
    }, [holdings, portfolioData, avgHoldingDays]);

    const dailyPlPercent = calculateDailyPlPercent(metrics.currentValue, metrics.dailyPL);

    // Clases de color dinámicas
    const currentPlColor = getColorClass(metrics.currentPL);
    const totalPlColor = getColorClass(totalPerformance.pl);
    const dailyPlColor = getColorClass(metrics.dailyPL);

    // Colores para performers (%)
    const bestPctColor = getColorClass(metrics.bestPerformer.plPercent);
    const worstPctColor = getColorClass(metrics.worstPerformer.plPercent);

    // Colores para performers ($)
    const bestUsdColor = getColorClass(metrics.bestPerformerUsd.plValue);
    const worstUsdColor = getColorClass(metrics.worstPerformerUsd.plValue);

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* --- Fila 1: Estado Actual --- */}
            <StatCard 
                label="Valor Actual" 
                value={formatCurrency(metrics.currentValue)} 
                icon={Wallet}
                helpText="El valor de mercado actual de todas tus posiciones abiertas."
                delay={0}
            />
            <StatCard 
                label="G/P Posiciones" 
                value={formatCurrency(metrics.currentPL)} 
                colorClass={currentPlColor} 
                icon={metrics.currentPL >= 0 ? TrendingUp : TrendingDown}
                helpText="La ganancia o pérdida neta solo de tus posiciones actuales."
                delay={0.05}
            />
            <StatCard 
                label="Rendimiento Actual" 
                value={formatPercent(metrics.currentPLPercent)} 
                colorClass={currentPlColor} 
                icon={Percent}
                helpText="El rendimiento porcentual basado en el costo de tus posiciones actuales."
                delay={0.1}
            />
            <StatCard 
                label="G/P del Día" 
                value={`${formatCurrency(metrics.dailyPL)} (${formatPercent(dailyPlPercent)})`} 
                trend={dailyPlPercent}
                colorClass={dailyPlColor} 
                icon={BarChart3}
                helpText="El cambio de valor de tu portafolio durante el día de hoy."
                delay={0.15}
            />

            {/* --- Fila 2: Histórico y Costos --- */}
            <StatCard 
                label="G/P Total (Histórico)" 
                value={formatCurrency(totalPerformance.pl)} 
                colorClass={totalPlColor}
                icon={Activity}
                helpText="La ganancia o pérdida neta de todo tu historial, incluyendo posiciones cerradas."
                delay={0.2}
            />
            <StatCard 
                label="Rendimiento Total" 
                value={formatPercent(totalPerformance.percent)} 
                colorClass={totalPlColor}
                icon={totalPerformance.percent >= 0 ? TrendingUp : TrendingDown}
                helpText="El rendimiento porcentual total basado en todo el capital que has invertido históricamente."
                delay={0.25}
            />
            <StatCard 
                label="Costo Total Invertido" 
                value={formatCurrency(metrics.totalInvested)} 
                icon={DollarSign}
                helpText="El costo total de adquisición de tus posiciones actuales."
                delay={0.3}
            />
            <StatCard 
                label="Permanencia Promedio" 
                value={`${Math.round(metrics.avgHoldingDays)} días`} 
                icon={Clock}
                helpText="Promedio de días que has mantenido cada posición."
                delay={0.35}
            />

            {/* --- Fila 3: Riesgo --- */}
            <StatCard 
                label="Beta Ponderado" 
                value={formatNumber(metrics.portfolioBeta)} 
                icon={Target}
                helpText="Volatilidad de tu portafolio vs. el mercado. <1 es menos volátil, >1 es más volátil."
                delay={0.4}
            />
            <StatCard 
                label="Máx. Drawdown" 
                value={historicalMetrics?.maxDrawdown ? `${(historicalMetrics.maxDrawdown * 100).toFixed(2)}%` : 'N/A'} 
                colorClass="text-red-500"
                icon={ShieldAlert}
                helpText="La máxima caída desde un pico histórico en el valor del portafolio."
                delay={0.45}
            />
            <StatCard 
                label="Mejor Activo ($)" 
                value={`${metrics.bestPerformerUsd.symbol} (${formatCurrency(metrics.bestPerformerUsd.plValue)})`}
                colorClass={bestUsdColor}
                icon={Trophy}
                helpText="El activo que ha generado la mayor ganancia nominal en dólares."
                delay={0.5}
            />
            <StatCard 
                label="Peor Activo ($)" 
                value={`${metrics.worstPerformerUsd.symbol} (${formatCurrency(metrics.worstPerformerUsd.plValue)})`}
                colorClass={worstUsdColor}
                icon={TrendingDown}
                helpText="El activo que ha generado la mayor pérdida nominal en dólares."
                delay={0.55}
            />

            {/* --- Fila 4: Porcentual y Años --- */}
            <StatCard
                label="Mejor Activo (%)"
                value={`${metrics.bestPerformer.symbol} (${formatPercent(metrics.bestPerformer.plPercent)})`}
                colorClass={bestPctColor}
                icon={TrendingUp}
                helpText="El activo con mayor rendimiento porcentual."
                delay={0.6}
            />
            <StatCard
                label="Peor Activo (%)"
                value={`${metrics.worstPerformer.symbol} (${formatPercent(metrics.worstPerformer.plPercent)})`}
                colorClass={worstPctColor}
                icon={TrendingDown}
                helpText="El activo con menor rendimiento porcentual."
                delay={0.65}
            />

            {historicalMetrics && (
                <>
                    <StatCard
                        label="Mejor Año (Simulado)"
                        value={historicalMetrics.bestYear ? `${historicalMetrics.bestYear.year} (${(historicalMetrics.bestYear.return * 100).toFixed(2)}%)` : 'N/A'}
                        colorClass={historicalMetrics.bestYear && historicalMetrics.bestYear.return > 0 ? "text-green-500" : ""}
                        icon={Calendar}
                        helpText="El mejor año calendario simulado del actual portafolio."
                        delay={0.7}
                    />
                    <StatCard
                        label="Peor Año (Simulado)"
                        value={historicalMetrics.worstYear ? `${historicalMetrics.worstYear.year} (${(historicalMetrics.worstYear.return * 100).toFixed(2)}%)` : 'N/A'}
                        colorClass={historicalMetrics.worstYear && historicalMetrics.worstYear.return < 0 ? "text-red-500" : ""}
                        icon={Calendar}
                        helpText="El peor año calendario simulado del actual portafolio."
                        delay={0.75}
                    />
                </>
            )}
        </div>
    );
}