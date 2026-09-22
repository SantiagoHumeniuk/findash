// src/features/asset-detail/components/rating/dcf-valuation-card.tsx

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../../../components/ui/card';
import { Scale, TrendingUp, TrendingDown, HelpCircle, AlertTriangle, Calculator } from 'lucide-react';
import { formatPrice } from '../../lib/asset-formatters';
import type { AssetData } from '../../../../types/dashboard';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../../../components/ui/tooltip';
import { Badge } from '../../../../components/ui/badge';
import { calculateBlendedFairValue } from '../../lib/valuation-models';

interface DCFValuationCardProps {
  asset: AssetData;
}

export function DCFValuationCard({ asset }: DCFValuationCardProps) {
  const currentPrice = asset.quote?.price ?? 0;

  // Usa el nuevo algoritmo robusto de promedios ponderados
  const { fairValue, modelsUsed, isAnomaly, spread } = calculateBlendedFairValue(asset);
  
  const isUndervalued = spread !== null && spread >= 0;

  // Si después de todo no hay valor, salir
  if (fairValue === null || isNaN(fairValue) || currentPrice === 0) {
    return null;
  }

  return (
    <Card className="border-l-4 border-l-primary/50 h-full overflow-hidden flex flex-col justify-between">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Scale className="w-5 h-5 text-primary" />
            Valor Justo (InvestingPro Style)
          </CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-sm">
                <p className="font-semibold mb-1">Modelo Blended Valuation</p>
                <p className="text-sm mb-2">Calcula un precio objetivo filtrando errores de moneda y promediando los siguientes modelos financieros confiables:</p>
                <ul className="text-xs space-y-1 list-disc pl-4 text-muted-foreground">
                  {modelsUsed.map((m, i) => (
                    <li key={i}>{m.name}: <span className="font-medium text-foreground">{formatPrice(m.value)}</span> (Peso: {m.weight}x)</li>
                  ))}
                </ul>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 h-full flex flex-col justify-center">
        {/* Bloque Principal de Precios */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">Precio Mercado</p>
            <p className="text-3xl font-bold tracking-tighter">
              {formatPrice(currentPrice)}
            </p>
          </div>

          <div className="flex-1 px-4 text-center pb-2 hidden sm:block">
            <p className="text-[10px] text-muted-foreground font-medium mb-1">Spread</p>
            <div className="h-px w-full bg-border relative">
              <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${isUndervalued ? 'bg-green-500' : 'bg-red-500'}`} />
            </div>
          </div>

          <div className="text-right">
            <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider flex items-center justify-end gap-1">
              Valor Teórico
              {isAnomaly && <AlertTriangle className="w-3 h-3 text-yellow-500" />}
            </p>
            <p className={`text-3xl font-bold tracking-tighter ${isAnomaly ? 'text-yellow-600 decoration-yellow-600/30 line-through decoration-2' : 'text-primary'}`}>
              {formatPrice(fairValue)}
            </p>
          </div>
        </div>

        {/* Info adicional de modelos */}
        {!isAnomaly && modelsUsed.length > 0 && (
          <div className="flex items-center gap-1.5 justify-center py-1 bg-muted/30 rounded-md border border-white/[0.02]">
            <Calculator className="w-3 h-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground uppercase font-medium tracking-wide">
              Promedio de {modelsUsed.length} modelo{modelsUsed.length > 1 ? 's' : ''} financiero{modelsUsed.length > 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Tarjeta de Resultado / Anomalía */}
        {isAnomaly ? (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-md p-3 flex gap-3 items-start">
            <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-yellow-700 dark:text-yellow-400">Datos Inconsistentes (+{spread?.toFixed(0)}%)</p>
              <p className="text-xs text-muted-foreground mt-1 leading-snug">
                El modelo detectó un desajuste extremo en la conversión de divisas de la API. Este valor justo está basado en la moneda local y no debe compararse con el precio en dólares.
              </p>
            </div>
          </div>
        ) : spread !== null && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Badge
                variant={isUndervalued ? "default" : "destructive"}
                className={`text-sm px-3 py-1 shadow-sm ${isUndervalued ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
              >
                {isUndervalued ? <TrendingUp className="w-4 h-4 mr-2" /> : <TrendingDown className="w-4 h-4 mr-2" />}
                {isUndervalued ? "Infravalorada" : "Sobrevalorada"}
              </Badge>

              <span className={`text-2xl font-bold tabular-nums ${isUndervalued ? 'text-green-600' : 'text-red-600'}`}>
                {spread > 0 ? '+' : ''}{spread.toFixed(2)}%
              </span>
            </div>

            <div className="relative h-2 w-full bg-secondary rounded-full overflow-hidden">
              <div
                className={`absolute top-0 bottom-0 transition-all duration-1000 ease-out rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)] ${isUndervalued ? 'bg-green-500 left-0' : 'bg-red-500 right-0'}`}
                style={{ width: `${Math.min(Math.abs(spread), 100)}%` }}
              />
            </div>

            <p className="text-xs text-muted-foreground text-center pt-1 font-medium">
              {isUndervalued
                ? `El activo cotiza un ${Math.abs(spread).toFixed(0)}% por debajo de su valor teórico real.`
                : `El activo cotiza un ${Math.abs(spread).toFixed(0)}% por encima de su valor teórico real.`}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}