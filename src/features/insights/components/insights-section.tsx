// src/features/insights/components/insights-section.tsx
import React from 'react';
import { NavLink } from 'react-router-dom';
import type { InsightItem } from '../types/insights.types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Badge } from '../../../components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../../components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

// --- Formateadores robustos ---
const formatCurrency = (value?: number | null): string => {
  // Retorna '-' si el valor no es un número válido y finito
  if (typeof value !== 'number' || !isFinite(value)) {
    return '-';
  }
  return `$${value.toFixed(2)}`;
};

const formatPercentage = (value?: number | null, decimals?: number): string => {
  // Retorna '-' si el valor no es un número válido y finito
  if (typeof value !== 'number' || !isFinite(value)) {
    return '-';
  }
  return `${value.toFixed(decimals)}%`;
};
// ------------------------------

export interface InsightsSectionProps {
  title: string;
  subtitle?: string;
  items: InsightItem[];
  kind: 'undervalued' | 'overvalued' | 'analystBuy' | 'analystSell';
}

/**
 * Sección reutilizable que muestra una lista de insights en forma de tabla compacta.
 */
export const InsightsSection: React.FC<InsightsSectionProps> = ({ title, subtitle, items, kind }) => {
  // Define las columnas basado en 'kind'
  const columns = React.useMemo(() => {
    switch (kind) {
      case 'undervalued':
        return [
          { key: 'asset', label: 'Activo', tooltip: null },
          { key: 'price', label: 'Precio Actual', tooltip: 'Precio de mercado en tiempo real', align: 'center' },
          { key: 'dcf', label: 'Valor Intrínseco', tooltip: 'DCF: Valor calculado mediante flujo de caja descontado', align: 'center' },
          { key: 'metric', label: 'Descuento', tooltip: 'Porcentaje de descuento respecto al valor intrínseco', align: 'center' },
        ];
      case 'overvalued':
        return [
          { key: 'asset', label: 'Activo', tooltip: null },
          { key: 'price', label: 'Precio Actual', tooltip: 'Precio de mercado en tiempo real', align: 'center' },
          { key: 'dcf', label: 'Valor Intrínseco', tooltip: 'DCF: Valor calculado mediante flujo de caja descontado', align: 'center' },
          { key: 'metric', label: 'Sobreprecio', tooltip: 'Porcentaje de sobreprecio respecto al valor intrínseco', align: 'center' },
        ];
      case 'analystBuy':
      case 'analystSell':
        return [
          { key: 'asset', label: 'Activo', tooltip: null },
          { key: 'price', label: 'Precio Actual', tooltip: 'Precio de mercado en tiempo real', align: 'center' },
          { key: 'target', label: 'Precio Objetivo', tooltip: 'Precio objetivo promedio según analistas', align: 'center' },
          { key: 'metric', label: 'Recomendaciones', tooltip: 'C: Compra, M: Mantener, V: Venta', align: 'center' },
        ];
      default:
        return [];
    }
  }, [kind]);

  return (
    <Card>
      {(title || subtitle) && (
        <CardHeader className="p-4 pb-3 sm:p-6 sm:pb-4">
          {title && <CardTitle className="text-lg">{title}</CardTitle>}
          {subtitle && <CardDescription>{subtitle}</CardDescription>}
        </CardHeader>
      )}
      <CardContent className={title || subtitle ? 'p-4 pt-0 sm:p-6 sm:pt-0' : 'p-0 sm:p-2'}>
        <TooltipProvider>
          <div className="max-h-[min(68vh,720px)] overflow-auto border-y sm:border rounded-md">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
                <TableRow>
                  {columns.map((c) => (
                    <TableHead key={c.key} className={`text-xs sm:text-sm font-semibold ${c.align === 'center' ? 'text-center' : ''}`}>
                      <div className={`flex items-center gap-1.5 ${c.align === 'center' ? 'justify-center' : ''}`}>
                        {c.label}
                        {c.tooltip && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                aria-label={`Información sobre ${c.label}`}
                                className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-foreground/80 transition-colors hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                <HelpCircle className="h-4 w-4" aria-hidden="true" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <p>{c.tooltip}</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={columns.length} className="h-28 text-center text-muted-foreground">
                            {kind === 'undervalued' || kind === 'overvalued'
                              ? 'No hay señales de valoración en esta selección.'
                              : 'No hay recomendaciones para esta selección.'}
                        </TableCell>
                    </TableRow>
                ) : (
                    items.map((it) => (
                      <TableRow key={it.symbol} className="hover:bg-accent/50 transition-colors">
                        {/* Columna 1: Activo */}
                        <TableCell className="font-medium">
                          <NavLink to={`/asset/${it.symbol}`} className="group inline-flex items-center gap-2" aria-label={`Ver detalle de ${it.symbol}`}>
                            <Badge variant="secondary" className="font-mono group-hover:bg-primary/20 group-hover:text-primary transition-colors">{it.symbol}</Badge>
                            <span className="hidden sm:inline text-muted-foreground group-hover:text-foreground underline-offset-4 group-hover:underline">{it.companyName}</span>
                          </NavLink>
                        </TableCell>

                        {/* Columna 2: Precio Actual */}
                        <TableCell className="text-center font-semibold tabular-nums">{formatCurrency(it.currentPrice)}</TableCell>

                        {/* Columna 3: Variable (DCF, Target) */}
                        <TableCell className="text-center tabular-nums">
                          {kind === 'undervalued' || kind === 'overvalued'
                            ? formatCurrency(it.dcf)
                            : formatCurrency(it.priceTarget) /* analystBuy/Sell */
                          }
                        </TableCell>

                        {/* Columna 4: Variable (Metric, Recomendaciones) */}
                        <TableCell className="text-center font-bold tabular-nums">
                          {renderAnalystMetric(kind, it)}
                        </TableCell>
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
};

// Función helper SÓLO para las métricas de analistas y valoración (%)
function renderAnalystMetric(kind: InsightsSectionProps['kind'], it: InsightItem) {
  if (kind === 'undervalued' || kind === 'overvalued') {
    const value = it.mispricingPct;
    // Ya usamos un formateador robusto que devuelve '-', no necesitamos verificar aquí
    const color = typeof value === 'number' && value >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
    // Llama al formateador robusto
    return <span className={color}>{formatPercentage(value, 1)}</span>;
  }

  // Para listas de analistas mostramos el desglose C/M/V (Compra/Mantener/Venta)
  if (kind === 'analystBuy' || kind === 'analystSell') {
      if (typeof it.buyCount === 'number' || typeof it.holdCount === 'number' || typeof it.sellCount === 'number') {
        const b = it.buyCount ?? 0; const h = it.holdCount ?? 0; const s = it.sellCount ?? 0;
        return (
          <span className="tabular-nums">
            <span className="text-green-600 dark:text-green-400 font-semibold">{b}</span>
            <span className="text-muted-foreground mx-0.5">/</span>
            <span className="text-yellow-600 dark:text-yellow-400 font-semibold">{h}</span>
            <span className="text-muted-foreground mx-0.5">/</span>
            <span className="text-red-600 dark:text-red-400 font-semibold">{s}</span>
          </span>
        );
      }
      return '-';
  }

  // Si no es ninguno de los anteriores
  return '-';
}