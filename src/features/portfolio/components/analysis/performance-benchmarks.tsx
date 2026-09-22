// src/features/portfolio/components/analysis/performance-benchmarks.tsx

import { useMemo } from 'react';
import { Card } from "../../../../components/ui/card";
import { AssetData } from '../../../../types/dashboard';
import { formatPercent } from '../../../../lib/utils';
import { TrendingUp, TrendingDown, Target, Info } from 'lucide-react';
import { Badge } from '../../../../components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../../../components/ui/tooltip';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../../../../components/ui/accordion";

interface PerformanceBenchmarksProps {
    portfolioReturn: number; // Porcentual, ej: 15.5
    portfolioData: Record<string, AssetData>;
}

export function PerformanceBenchmarks({ portfolioReturn, portfolioData }: PerformanceBenchmarksProps) {
    const benchmarks = useMemo(() => {
        const spyPrice = portfolioData['SPY']?.quote?.price;
        const spyPrevPrice = portfolioData['SPY']?.quote?.previousClose;
        const spyReturn = spyPrice && spyPrevPrice ? ((spyPrice - spyPrevPrice) / spyPrevPrice) * 100 : 5.2;

        const qqqPrice = portfolioData['QQQ']?.quote?.price;
        const qqqPrevPrice = portfolioData['QQQ']?.quote?.previousClose;
        const qqqReturn = qqqPrice && qqqPrevPrice ? ((qqqPrice - qqqPrevPrice) / qqqPrevPrice) * 100 : 8.4;

        const alpha = portfolioReturn - spyReturn;

        return {
            spy: spyReturn,
            qqq: qqqReturn,
            alpha,
            isBeating: alpha > 0
        };
    }, [portfolioReturn, portfolioData]);

    return (
        <Card className="bg-card/50 backdrop-blur-sm border-primary/10 shadow-premium overflow-hidden relative">
            <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="benchmarks" className="border-b-0">
                    <AccordionTrigger className="px-6 py-4 hover:no-underline">
                        <div className="flex items-center justify-between w-full pr-4">
                            <div className="space-y-1 text-left">
                                <h3 className="text-lg font-bold heading-premium flex items-center gap-2">
                                    Performance Benchmarks
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger><Info className="w-4 h-4 text-muted-foreground" /></TooltipTrigger>
                                            <TooltipContent>Comparativa de tu rendimiento contra los principales índices del mercado.</TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </h3>
                                <p className="text-sm text-muted-foreground">Comparativa de retorno total acumulado vs Índices</p>
                            </div>
                            <Badge variant={benchmarks.isBeating ? "default" : "outline"} className={benchmarks.isBeating ? "bg-green-500 hover:bg-green-600" : ""}>
                                {benchmarks.isBeating ? "Batiendo al Mercado" : "Debajo del Mercado"}
                            </Badge>
                        </div>
                    </AccordionTrigger>
                    
                    <AccordionContent className="px-6 pb-6 pt-2">
                        <div className="relative z-10 space-y-6">
                            <div className="absolute -top-10 right-0 p-4 opacity-5 pointer-events-none">
                                <Target className="w-24 h-24" />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Tu Portafolio */}
                                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
                                    <span className="text-xs font-semibold text-primary uppercase">Tu Portafolio</span>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-3xl font-extrabold">{formatPercent(portfolioReturn)}</span>
                                        <span className="text-xs text-muted-foreground">Total</span>
                                    </div>
                                </div>

                                {/* S&P 500 (SPY) */}
                                <div className="p-4 rounded-xl bg-muted/30 border space-y-2">
                                    <span className="text-xs font-semibold text-muted-foreground uppercase">S&P 500 (SPY)</span>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-2xl font-bold">{formatPercent(benchmarks.spy)}</span>
                                        <span className={`text-xs flex items-center gap-0.5 ${portfolioReturn >= benchmarks.spy ? 'text-green-500' : 'text-red-500'}`}>
                                            {portfolioReturn >= benchmarks.spy ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                            {formatPercent(Math.abs(portfolioReturn - benchmarks.spy))} diff
                                        </span>
                                    </div>
                                </div>

                                {/* Nasdaq 100 (QQQ) */}
                                <div className="p-4 rounded-xl bg-muted/30 border space-y-2">
                                    <span className="text-xs font-semibold text-muted-foreground uppercase">Nasdaq 100 (QQQ)</span>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-2xl font-bold">{formatPercent(benchmarks.qqq)}</span>
                                        <span className={`text-xs flex items-center gap-0.5 ${portfolioReturn >= benchmarks.qqq ? 'text-green-500' : 'text-red-500'}`}>
                                            {portfolioReturn >= benchmarks.qqq ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                            {formatPercent(Math.abs(portfolioReturn - benchmarks.qqq))} diff
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className={`p-4 rounded-lg flex items-center gap-3 ${benchmarks.isBeating ? 'bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400' : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-700 dark:text-yellow-400'}`}>
                                {benchmarks.isBeating ? <TrendingUp className="w-5 h-5" /> : <Info className="w-5 h-5" />}
                                <p className="text-sm font-medium">
                                    {benchmarks.isBeating 
                                        ? `¡Felicidades! Estás generando un Alpha de ${benchmarks.alpha.toFixed(2)}% sobre el S&P 500. Tu estrategia está superando el mercado institucional.`
                                        : `Tu portafolio está rindiendo un ${Math.abs(benchmarks.alpha).toFixed(2)}% menos que el S&P 500. Considera revisar tu alocación de activos.`
                                    }
                                </p>
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </Card>
    );
}
