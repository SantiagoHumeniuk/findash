// src/features/portfolio/components/analysis/performance-benchmarks.tsx

import { Card } from "../../../../components/ui/card";
import { formatPercent } from '../../../../lib/utils';
import { TrendingUp, TrendingDown, Target, Info } from 'lucide-react';
import { Badge } from '../../../../components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../../../components/ui/tooltip';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../../../../components/ui/accordion";

interface PerformanceBenchmarksProps {
    portfolioReturn: number;
    spyReturn: number | null;
    qqqReturn: number | null;
    periodLabel: string;
}

/**
 * Displays percentage returns already aligned to the same comparison period.
 */
export function PerformanceBenchmarks({
    portfolioReturn,
    spyReturn,
    qqqReturn,
    periodLabel,
}: PerformanceBenchmarksProps) {
    const alpha = spyReturn === null ? null : portfolioReturn - spyReturn;
    const isBeating = alpha !== null && alpha > 0;

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
                                <p className="text-sm text-muted-foreground">Rendimiento porcentual en {periodLabel}</p>
                            </div>
                            <Badge variant={alpha === null ? "outline" : isBeating ? "default" : "secondary"} className={isBeating ? "bg-green-500 hover:bg-green-600" : ""}>
                                {alpha === null ? "Datos no disponibles" : isBeating ? "Batiendo al Mercado" : "Debajo del Mercado"}
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
                                        <span className="text-2xl font-bold">{spyReturn === null ? 'N/D' : formatPercent(spyReturn)}</span>
                                        {spyReturn !== null && (
                                            <span className={`text-xs flex items-center gap-0.5 ${portfolioReturn >= spyReturn ? 'text-green-500' : 'text-red-500'}`}>
                                                {portfolioReturn >= spyReturn ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                                {formatPercent(Math.abs(portfolioReturn - spyReturn))} diff
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Nasdaq 100 (QQQ) */}
                                <div className="p-4 rounded-xl bg-muted/30 border space-y-2">
                                    <span className="text-xs font-semibold text-muted-foreground uppercase">Nasdaq 100 (QQQ)</span>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-2xl font-bold">{qqqReturn === null ? 'N/D' : formatPercent(qqqReturn)}</span>
                                        {qqqReturn !== null && (
                                            <span className={`text-xs flex items-center gap-0.5 ${portfolioReturn >= qqqReturn ? 'text-green-500' : 'text-red-500'}`}>
                                                {portfolioReturn >= qqqReturn ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                                {formatPercent(Math.abs(portfolioReturn - qqqReturn))} diff
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className={`p-4 rounded-lg flex items-center gap-3 ${alpha === null ? 'bg-muted/30 text-muted-foreground' : isBeating ? 'bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400' : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-700 dark:text-yellow-400'}`}>
                                {alpha === null ? <Info className="w-5 h-5" /> : isBeating ? <TrendingUp className="w-5 h-5" /> : <Info className="w-5 h-5" />}
                                <p className="text-sm font-medium">
                                    {alpha === null
                                        ? 'No hay un retorno del S&P 500 disponible para el período seleccionado.'
                                        : isBeating
                                        ? `¡Felicidades! Estás generando un Alpha de ${alpha.toFixed(2)}% sobre el S&P 500.`
                                        : `Tu portafolio está rindiendo un ${Math.abs(alpha).toFixed(2)}% menos que el S&P 500.`
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
