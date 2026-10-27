// src/features/asset-detail/components/insights/asset-statements-section.tsx

import { useState } from 'react';
import { FileSpreadsheet, PieChart } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '../../../../components/ui/tabs';
import type { YahooStatementPeriod } from '../../../../services/api/yahoo-finance-api';
import type { AssetData } from '../../../../types/dashboard';
import { formatCompact, formatDecimal, formatFraction } from './insight-formatters';

interface AssetStatementsSectionProps {
  asset: AssetData;
}

type StatementKind = 'income' | 'balance' | 'cashflow';

/** Yahoo field → label, in reading order. `eps` rows are per-share and not abbreviated. */
const STATEMENT_ROWS: Record<StatementKind, { field: string; label: string; eps?: boolean; strong?: boolean }[]> = {
  income: [
    { field: 'TotalRevenue', label: 'Ingresos totales', strong: true },
    { field: 'CostOfRevenue', label: 'Costo de ventas' },
    { field: 'GrossProfit', label: 'Resultado bruto', strong: true },
    { field: 'ResearchAndDevelopment', label: 'Investigación y desarrollo' },
    { field: 'SellingGeneralAndAdministration', label: 'Gastos de venta y administración' },
    { field: 'OperatingExpense', label: 'Gastos operativos totales' },
    { field: 'OperatingIncome', label: 'Resultado operativo', strong: true },
    { field: 'EBITDA', label: 'EBITDA' },
    { field: 'InterestExpense', label: 'Gastos por intereses' },
    { field: 'PretaxIncome', label: 'Resultado antes de impuestos' },
    { field: 'TaxProvision', label: 'Impuesto a las ganancias' },
    { field: 'NetIncome', label: 'Resultado neto', strong: true },
    { field: 'DilutedEPS', label: 'EPS diluido', eps: true },
    { field: 'DilutedAverageShares', label: 'Acciones diluidas promedio' },
  ],
  balance: [
    { field: 'TotalAssets', label: 'Activo total', strong: true },
    { field: 'CurrentAssets', label: 'Activo corriente' },
    { field: 'CashCashEquivalentsAndShortTermInvestments', label: 'Caja e inversiones de corto plazo' },
    { field: 'AccountsReceivable', label: 'Cuentas por cobrar' },
    { field: 'Inventory', label: 'Inventarios' },
    { field: 'NetPPE', label: 'Propiedad, planta y equipo neto' },
    { field: 'GoodwillAndOtherIntangibleAssets', label: 'Llave de negocio e intangibles' },
    { field: 'TotalLiabilitiesNetMinorityInterest', label: 'Pasivo total', strong: true },
    { field: 'CurrentLiabilities', label: 'Pasivo corriente' },
    { field: 'AccountsPayable', label: 'Cuentas por pagar' },
    { field: 'TotalDebt', label: 'Deuda total' },
    { field: 'LongTermDebt', label: 'Deuda de largo plazo' },
    { field: 'NetDebt', label: 'Deuda neta' },
    { field: 'StockholdersEquity', label: 'Patrimonio neto', strong: true },
    { field: 'WorkingCapital', label: 'Capital de trabajo' },
    { field: 'OrdinarySharesNumber', label: 'Acciones en circulación' },
  ],
  cashflow: [
    { field: 'OperatingCashFlow', label: 'Flujo de caja operativo', strong: true },
    { field: 'CapitalExpenditure', label: 'Inversiones de capital (capex)' },
    { field: 'FreeCashFlow', label: 'Flujo de caja libre', strong: true },
    { field: 'DepreciationAndAmortization', label: 'Depreciación y amortización' },
    { field: 'StockBasedCompensation', label: 'Compensación en acciones' },
    { field: 'CashDividendsPaid', label: 'Dividendos pagados' },
    { field: 'RepurchaseOfCapitalStock', label: 'Recompra de acciones' },
  ],
};

const STATEMENT_LABELS: Record<StatementKind, string> = {
  income: 'Estado de resultados',
  balance: 'Balance',
  cashflow: 'Flujo de efectivo',
};

/** Where each sale goes: costs, operating expenses, taxes and interest, and profit. */
function compositionRow(period: YahooStatementPeriod) {
  const values = period.values;
  const revenue = values.TotalRevenue;
  if (!revenue || revenue <= 0) return null;
  const cost = Math.abs(values.CostOfRevenue ?? (revenue - (values.GrossProfit ?? revenue)));
  const research = Math.abs(values.ResearchAndDevelopment ?? 0);
  const selling = Math.abs(values.SellingGeneralAndAdministration ?? 0);
  const operating = values.OperatingIncome ?? (revenue - cost - research - selling);
  const otherOperating = Math.max(revenue - cost - research - selling - operating, 0);
  const net = values.NetIncome ?? 0;
  const belowOperating = operating - net;
  const share = (value: number) => value / revenue;
  return {
    year: period.date.slice(0, 4),
    costo: share(cost),
    id: share(research),
    sga: share(selling),
    otrosOperativos: share(otherOperating),
    impuestosIntereses: share(Math.max(belowOperating, 0)),
    neto: share(Math.max(net, 0)),
  };
}

const COMPOSITION_SERIES = [
  { key: 'costo', name: 'Costo de ventas', color: '#94a3b8' },
  { key: 'id', name: 'Investigación y desarrollo', color: '#6366f1' },
  { key: 'sga', name: 'Venta y administración', color: '#0ea5e9' },
  { key: 'otrosOperativos', name: 'Otros gastos operativos', color: '#f59e0b' },
  { key: 'impuestosIntereses', name: 'Impuestos, intereses y otros', color: '#f43f5e' },
  { key: 'neto', name: 'Resultado neto', color: '#10b981' },
];

/**
 * Full annual statements and a breakdown of each year's revenue into costs and
 * profit. Yahoo has no product/geographic segments, so this cost structure view
 * replaces FMP's segmentation charts.
 */
export function AssetStatementsSection({ asset }: AssetStatementsSectionProps) {
  const [kind, setKind] = useState<StatementKind>('income');
  const periods = asset.yahooInsights?.annualStatements ?? [];
  if (periods.length === 0) return null;

  const currency = periods[0].currency ?? asset.profile.currency ?? 'USD';
  const columns = [...periods].sort((left, right) => left.date.localeCompare(right.date));
  const composition = columns.flatMap((period) => {
    const row = compositionRow(period);
    return row ? [row] : [];
  });
  const rows = STATEMENT_ROWS[kind].filter(({ field }) => columns.some((period) => period.values[field] !== undefined));

  return (
    <div className="space-y-6">
      {composition.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <PieChart className="h-4 w-4 text-primary" />
              ¿A dónde va cada venta?
            </CardTitle>
            <CardDescription>
              Composición de los ingresos de cada año: costos, gastos y resultado neto (en % de las ventas).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={composition} layout="vertical" stackOffset="expand">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
                  <XAxis type="number" tickFormatter={(value: number) => formatFraction(value, 0)} tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="year" tick={{ fontSize: 12 }} width={44} />
                  <Tooltip
                    formatter={(value, name) => [formatFraction(Number(value)), String(name)]}
                    contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {COMPOSITION_SERIES.map((series) => (
                    <Bar key={series.key} dataKey={series.key} name={series.name} stackId="revenue" fill={series.color} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileSpreadsheet className="h-4 w-4 text-primary" />
                Estados financieros anuales
              </CardTitle>
              <CardDescription>
                Cifras en {currency}, fuente {asset.fundamentalsSource ?? 'Yahoo Finance'}.
              </CardDescription>
            </div>
            <Tabs value={kind} onValueChange={(value) => setKind(value as StatementKind)}>
              <TabsList>
                {(Object.keys(STATEMENT_LABELS) as StatementKind[]).map((key) => (
                  <TabsTrigger key={key} value={key} className="text-xs sm:text-sm">{STATEMENT_LABELS[key]}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="py-2 pr-4 text-left font-medium">Concepto</th>
                {columns.map((period) => (
                  <th key={period.date} className="py-2 pl-4 text-right font-medium">{period.date.slice(0, 7)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.field} className={`border-b last:border-0 ${row.strong ? 'font-semibold' : ''}`}>
                  <td className="py-2 pr-4">{row.label}</td>
                  {columns.map((period) => {
                    const value = period.values[row.field];
                    return (
                      <td key={period.date} className={`py-2 pl-4 text-right tabular-nums ${(value ?? 0) < 0 ? 'text-rose-600 dark:text-rose-400' : ''}`}>
                        {row.eps ? formatDecimal(value) : formatCompact(value)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
