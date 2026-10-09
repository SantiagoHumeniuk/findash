// src/features/asset-detail/components/rating/dcf-valuation-card.tsx

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../../../components/ui/card';
import { Scale, TrendingUp, TrendingDown, HelpCircle, AlertTriangle, Calculator, Building2, ShieldAlert, ShieldCheck, Globe, Layers, ChevronDown } from 'lucide-react';
import { formatPrice } from '../../lib/asset-formatters';
import type { AssetData } from '../../../../types/dashboard';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../../../components/ui/tooltip';
import { Badge } from '../../../../components/ui/badge';
import { calculateBlendedFairValue, classifyBusinessProfile } from '../../lib/valuation-models';
import { useRiskPremiumQuery } from '../../../risk-premium/hooks/use-risk-premium-query';

interface DCFValuationCardProps {
  asset: AssetData;
}

export function DCFValuationCard({ asset }: DCFValuationCardProps) {
  const currentPrice = asset.quote?.price ?? 0;
  const { data: riskPremiumData = [] } = useRiskPremiumQuery();

  // Usa el algoritmo robusto multi-modelo calibrado por sector y geografía
  const { fairValue, fairValueRange, modelsUsed, isAnomaly, spread, context } = calculateBlendedFairValue(asset, riskPremiumData);
  const businessProfile = classifyBusinessProfile(asset, context);
  
  const isUndervalued = spread !== null && spread >= 0;

  // Si después de todo no hay valor, salir
  if (fairValue === null || isNaN(fairValue) || currentPrice === 0) {
    return null;
  }

  const riskColor = businessProfile.riskLevel === 'bajo' ? 'text-green-600' : businessProfile.riskLevel === 'moderado' ? 'text-yellow-600' : 'text-red-500';

  // Group models by category for display
  const categoryLabels: Record<string, string> = {
    'intrinsic': 'Intrínseco',
    'relative': 'Relativo',
    'asset-based': 'Activos',
    'analyst': 'Analistas',
  };

  const hasCountryRisk = context.countryRiskPremiumPct > 0 || context.valuationDiscountPct > 0;

  return (
    <Card className="border-l-4 border-l-primary/50 h-full overflow-hidden flex flex-col justify-between">
      <CardHeader className="pb-2">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Scale className="w-5 h-5 text-primary" />
              Valor Justo
            </CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="Información sobre el cálculo del valor justo"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground transition-colors hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <HelpCircle className="h-4 w-4" aria-hidden="true" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-md border-border bg-popover text-popover-foreground">
                  <p className="font-semibold mb-1">Modelo de Valoración Multi-Factor</p>
                  <p className="text-xs text-muted-foreground mb-2">
                    Calibrado para el sector <strong className="text-foreground">{context.sector}</strong> e industria <strong className="text-foreground">{context.industry}</strong> en <strong className="text-foreground">{context.country}</strong>.
                  </p>
                  <div className="space-y-1 border-t border-border pt-2 text-[11px] text-muted-foreground">
                    <p>{modelsUsed.length} modelos válidos participan del valor ponderado.</p>
                    <p>La mediana FMP se usa cuando hay tres o más pares con múltiplos comparables.</p>
                    <p>El precio objetivo de analistas tiene un peso secundario.</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={`Perfil: ${businessProfile.typeLabel}. Riesgo ${businessProfile.riskLevel}. Ver detalles`}
                  className="flex max-w-full flex-wrap items-center gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <Badge variant="outline" className="max-w-full gap-1.5 whitespace-normal border-primary/25 px-2.5 py-1.5 text-xs font-medium text-foreground">
                    <Building2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span>{businessProfile.typeLabel}</span>
                  </Badge>
                  <Badge variant="outline" className={`gap-1.5 px-2.5 py-1.5 text-xs capitalize ${riskColor} border-current/30`}>
                    {businessProfile.riskLevel === 'bajo' ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
                    Riesgo {businessProfile.riskLevel}
                  </Badge>
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                align="start"
                className="w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-xl [&>svg]:bg-popover [&>svg]:fill-popover"
              >
                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary" />
                      <p className="text-sm font-semibold">{businessProfile.typeLabel}</p>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">{businessProfile.description}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 border-t border-border pt-3">
                    <span className="rounded-sm bg-muted px-2 py-1 text-[11px]">{context.sector}</span>
                    <span className="rounded-sm bg-muted px-2 py-1 text-[11px]">{context.country}</span>
                    {asset.profile?.beta > 0 && (
                      <span className="rounded-sm bg-muted px-2 py-1 text-[11px]">Beta {asset.profile.beta.toFixed(2)}</span>
                    )}
                    {hasCountryRisk && (
                      <span className="rounded-sm bg-muted px-2 py-1 text-[11px]">Riesgo país {context.countryRiskPremiumPct.toFixed(1)}%</span>
                    )}
                    {context.forwardEpsGrowthPct !== null && (
                      <span className="rounded-sm bg-muted px-2 py-1 text-[11px]">EPS estimado {context.forwardEpsGrowthPct.toFixed(1)}%</span>
                    )}
                  </div>
                  {businessProfile.riskFactors.length > 0 && (
                    <div className="flex gap-2 border-t border-border pt-3">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold">Riesgos a considerar</p>
                        <p className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">{businessProfile.riskFactors.join('; ')}.</p>
                      </div>
                    </div>
                  )}
                </div>
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
            {fairValueRange && (
              <p className="mt-1 text-[10px] text-muted-foreground">
                Rango entre modelos: {formatPrice(fairValueRange.low)} – {formatPrice(fairValueRange.high)}
              </p>
            )}
          </div>
        </div>

        {/* Info de calibración por sector y país */}
        {!isAnomaly && (
          <div className="flex flex-wrap items-center gap-2 justify-center py-1.5 px-2 bg-muted/30 rounded-md border border-white/[0.02] text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1">
              <Layers className="w-3 h-3 text-primary/70" />
              <span>{context.sector}</span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1">
              <Globe className="w-3 h-3 text-primary/70" />
              <span>{context.country}</span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1">
              <Calculator className="w-3 h-3 text-primary/70" />
              <span>{modelsUsed.length} modelos</span>
            </div>
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
                ? `El activo cotiza un ${Math.abs(spread).toFixed(0)}% por debajo del valor justo estimado por los modelos.`
                : `El activo cotiza un ${Math.abs(spread).toFixed(0)}% por encima del valor justo estimado por los modelos.`}
            </p>
          </div>
        )}

        <details className="group border-t border-border pt-2">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-sm py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            <span>Modelos de inversión <span className="font-normal text-muted-foreground">({modelsUsed.length})</span></span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-1 max-h-80 divide-y divide-border overflow-y-auto border-y border-border">
            {modelsUsed.map((model, index) => (
              <div key={`${model.name}-${index}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{model.name}</p>
                    <Badge variant="outline" className="text-[10px] font-medium">
                      {categoryLabels[model.category] ?? model.category}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{model.description}</p>
                </div>
                <div className="text-right">
                  <p className="whitespace-nowrap text-sm font-bold tabular-nums">{formatPrice(model.value)}</p>
                  <p className="mt-1 whitespace-nowrap text-[10px] text-muted-foreground">Peso {model.weight.toFixed(2)}x</p>
                </div>
              </div>
            ))}
          </div>
        </details>
      </CardContent>
    </Card>
  );
}