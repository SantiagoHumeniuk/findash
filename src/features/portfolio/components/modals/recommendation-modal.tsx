// src/features/portfolio/components/modals/recommendation-modal.tsx

import { AdvisoryResult } from '../../lib/advisory-engine';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../../../../components/ui/dialog';
import { Info, ThumbsUp, AlertTriangle, AlertCircle, TrendingDown, InfoIcon } from 'lucide-react';
import { Badge } from '../../../../components/ui/badge';

interface RecommendationModalProps {
    symbol: string;
    result: AdvisoryResult;
}

export function RecommendationModal({ symbol, result }: RecommendationModalProps) {
    const getStatusConfig = () => {
        switch (result.status) {
            case 'BUY': return { color: 'bg-green-500/10 text-green-600 border-green-500/30', label: 'Comprar', icon: <ThumbsUp className="w-4 h-4 mr-1" /> };
            case 'SELL': return { color: 'bg-red-500/10 text-red-600 border-red-500/30', label: 'Vender', icon: <AlertTriangle className="w-4 h-4 mr-1" /> };
            default: return { color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30', label: 'Mantener', icon: <AlertCircle className="w-4 h-4 mr-1" /> };
        }
    };

    const config = getStatusConfig();

    return (
        <Dialog>
            <DialogTrigger asChild>
                <div className="flex items-center gap-2 cursor-pointer group">
                    <Badge variant="outline" className={`${config.color} transition-all hover:opacity-80 py-1 font-semibold`}>
                        {config.icon}
                        {config.label}
                    </Badge>
                    <InfoIcon className="w-4 h-4 text-muted-foreground opacity-30 group-hover:opacity-100 transition-opacity" />
                </div>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[450px] glass-morphism border-none shadow-premium">
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="heading-premium">Análisis IA: {symbol}</span>
                            <Badge variant="outline" className={`${config.color}`}>
                                {config.label}
                            </Badge>
                        </div>
                    </DialogTitle>
                    <DialogDescription>
                        Recomendación generada por el algoritmo de datos técnicos fundamentales.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Confianza / Sentimiento */}
                    <div className="space-y-1.5">
                        <div className="flex justify-between text-sm">
                            <span className="font-semibold text-foreground/80">Confianza del Algoritmo</span>
                            <span className="font-bold">{result.confidence}/100</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-1000 ${result.status === 'BUY' ? 'bg-green-500' : result.status === 'SELL' ? 'bg-red-500' : 'bg-yellow-500'}`}
                                style={{ width: `${result.confidence}%` }}
                            />
                        </div>
                    </div>

                    {/* Justificación */}
                    <div className="bg-card/50 border rounded-lg p-3 space-y-3 shadow-xs">
                        <h4 className="text-sm font-semibold flex items-center gap-2 border-b pb-2">
                            <Info className="w-4 h-4 text-primary" />
                            Factores Determinantes
                        </h4>
                        <ul className="space-y-2 text-sm text-foreground/80">
                            {result.reasons.map((r, idx) => (
                                <li key={idx} className="flex gap-2 items-start">
                                    {r.type === 'positive' ? <span className="text-green-500 font-bold mt-0.5">+</span> :
                                        r.type === 'negative' ? <span className="text-red-500 font-bold mt-0.5">-</span> :
                                            <span className="text-muted-foreground font-bold mt-0.5">•</span>}
                                    <span className="leading-tight">{r.text}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Datos Técnicos Mini-Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 bg-muted/30 border rounded flex justify-between items-center">
                            <span className="text-muted-foreground">P/E Ratio:</span>
                            <span className="font-bold">{result.techData.pe ? result.techData.pe.toFixed(2) : 'N/A'}</span>
                        </div>
                        <div className="p-2 bg-muted/30 border rounded flex justify-between items-center">
                            <span className="text-muted-foreground">Deuda/Equity:</span>
                            <span className="font-bold">{result.techData.debtToEquity ? result.techData.debtToEquity.toFixed(2) : 'N/A'}</span>
                        </div>
                        <div className="p-2 bg-muted/30 border rounded flex justify-between items-center">
                            <span className="text-muted-foreground">ROE:</span>
                            <span className="font-bold">{result.techData.roe ? (result.techData.roe * 100).toFixed(1) + '%' : 'N/A'}</span>
                        </div>
                        <div className="p-2 bg-muted/30 border rounded flex justify-between items-center">
                            <span className="text-muted-foreground">Beta:</span>
                            <span className="font-bold">{result.techData.beta ? result.techData.beta.toFixed(2) : 'N/A'}</span>
                        </div>
                    </div>

                    {/* Simulador de Impacto */}
                    <div className="mt-4 p-3 bg-primary/10 border border-primary/20 text-primary-foreground dark:text-primary rounded-lg text-xs leading-relaxed flex gap-2 items-start">
                        <TrendingDown className="w-4 h-4 mt-0.5 shrink-0" />
                        <div>
                            <strong className="font-semibold">Simulador de Riesgo:</strong> Si decides vender este activo, la exposición de tu portafolio al sector <span className="font-bold">"{result.impact.sector}"</span> pasaría del <span className="font-bold underline">{result.impact.currentAllocationPercent.toFixed(1)}%</span> al <span className="font-bold underline">{result.impact.simulatedAllocationPercent.toFixed(1)}%</span>.
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
