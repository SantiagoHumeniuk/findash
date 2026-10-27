// src/features/asset-detail/components/insights/asset-earnings-section.tsx

import { CalendarClock, Target, TrendingUp } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge } from '../../../../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/card';
import type { AssetData } from '../../../../types/dashboard';
import { formatCompact, formatDate, formatDecimal, formatFraction, quarterLabel } from './insight-formatters';

interface AssetEarningsSectionProps {
  asset: AssetData;
}

/**
 * Next earnings report, EPS beats/misses of the last quarters and the quarterly
 * revenue and profit trend (Yahoo calendarEvents, earningsHistory and quarterly statements).
 */
export function AssetEarningsSection({ asset }: AssetEarningsSectionProps) {
  const insights = asset.yahooInsights;
  const currency = asset.profile.currency || 'USD';
  if (!insights) return null;

  const next = insights.nextEarnings;
  const surprises = [...insights.earningsHistory]
    .sort((left, right) => left.quarter.localeCompare(right.quarter))
    .map((entry) => ({
      quarter: quarterLabel(entry.quarter),
      estimado: entry.epsEstimate,
      real: entry.epsActual,
      sorpresa: entry.surprisePercent,
    }));
  const quarterly = [...insights.quarterlyStatements]
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((period) => ({
      quarter: quarterLabel(period.date),
      ingresos: period.values.TotalRevenue ?? null,
      operativo: period.values.OperatingIncome ?? null,
      neto: period.values.NetIncome ?? null,
      margenNeto: period.values.TotalRevenue ? (period.values.NetIncome ?? 0) / period.values.TotalRevenue : null,
      eps: period.values.DilutedEPS ?? null,
      fcf: period.values.FreeCashFlow ?? null,
    }));

  const daysToEarnings = next?.date
    ? Math.ceil((Date.parse(`${next.date}T00:00:00`) - Date.now()) / 86_400_000)
    : null;

  return (
    <div className="space-y-6">
      {next && (next.date || next.exDividendDate) && (
        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="h-4 w-4 text-primary" />
              Próximo reporte de resultados
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Fecha</p>
              <p className="text-lg font-semibold">{formatDate(next.date)}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {daysToEarnings !== null && daysToEarnings >= 0 && (
                  <Badge variant="outline">{daysToEarnings === 0 ? 'Hoy' : `En ${daysToEarnings} días`}</Badge>
                )}
                {next.isEstimate && <Badge variant="secondary">Fecha estimada</Badge>}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">EPS esperado (consenso)</p>
              <p className="text-lg font-semibold tabular-nums">{formatDecimal(next.epsAvg)}</p>
              <p className="text-xs text-muted-foreground">Rango {formatDecimal(next.epsLow)} – {formatDecimal(next.epsHigh)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ingresos esperados</p>
              <p className="text-lg font-semibold tabular-nums">{formatCompact(next.revenueAvg, currency)}</p>
              <p className="text-xs text-muted-foreground">
                Rango {formatCompact(next.revenueLow)} – {formatCompact(next.revenueHigh)}
              </p>
            </div>
            {(next.exDividendDate || next.dividendDate) && (
              <p className="text-xs text-muted-foreground sm:col-span-3">
                Último dividendo: ex-dividendo {formatDate(next.exDividendDate)}, pago {formatDate(next.dividendDate)}.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {surprises.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4 text-primary" />
              EPS real vs. estimado
            </CardTitle>
            <CardDescription>
              {surprises.filter((entry) => (entry.sorpresa ?? 0) > 0).length} de {surprises.length} trimestres superaron el consenso.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={surprises}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                  <XAxis dataKey="quarter" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} width={48} />
                  <Tooltip
                    formatter={(value, name) => [formatDecimal(Number(value)), name === 'real' ? 'Real' : 'Estimado']}
                    contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                  />
                  <Legend formatter={(value) => (value === 'real' ? 'Real' : 'Estimado')} />
                  <Bar dataKey="estimado" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="real" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {surprises.map((entry) => (
                <Badge
                  key={entry.quarter}
                  variant="outline"
                  className={(entry.sorpresa ?? 0) >= 0 ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400' : 'border-rose-500/40 text-rose-700 dark:text-rose-400'}
                >
                  {entry.quarter}: {entry.sorpresa !== null ? `${entry.sorpresa >= 0 ? '+' : ''}${formatFraction(entry.sorpresa)}` : 'N/D'}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {quarterly.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-primary" />
              Evolución trimestral
            </CardTitle>
            <CardDescription>Ingresos, resultado operativo y neto de los últimos trimestres reportados.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={quarterly}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                  <XAxis dataKey="quarter" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(value: number) => formatCompact(value)} tick={{ fontSize: 12 }} width={56} />
                  <Tooltip
                    formatter={(value, name) => [formatCompact(Number(value), currency), String(name)]}
                    contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                  />
                  <Legend />
                  <Bar dataKey="ingresos" name="Ingresos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="operativo" name="Resultado operativo" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="neto" name="Resultado neto" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Trimestre</th>
                    <th className="py-2 pr-4 text-right font-medium">Ingresos</th>
                    <th className="py-2 pr-4 text-right font-medium">Margen neto</th>
                    <th className="py-2 pr-4 text-right font-medium">EPS</th>
                    <th className="py-2 text-right font-medium">Flujo de caja libre</th>
                  </tr>
                </thead>
                <tbody>
                  {[...quarterly].reverse().map((row) => (
                    <tr key={row.quarter} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">{row.quarter}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{formatCompact(row.ingresos)}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{formatFraction(row.margenNeto)}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{formatDecimal(row.eps)}</td>
                      <td className="py-2 text-right tabular-nums">{formatCompact(row.fcf)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
