// src/features/asset-detail/components/insights/asset-ownership-tab.tsx

import { Building2, Landmark, UserCheck, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Progress } from '../../../../components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/ui/table';
import type { YahooHolder } from '../../../../services/api/yahoo-finance-api';
import type { AssetData } from '../../../../types/dashboard';
import { formatCompact, formatDate, formatFraction } from './insight-formatters';

interface AssetOwnershipTabProps {
  asset: AssetData;
}

function HoldersTable({ holders, currency }: { holders: YahooHolder[]; currency: string }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tenedor</TableHead>
            <TableHead className="text-right">% del total</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="hidden text-right sm:table-cell">Reporte</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {holders.map((holder) => (
            <TableRow key={holder.name}>
              <TableCell className="max-w-[220px] truncate font-medium" title={holder.name}>{holder.name}</TableCell>
              <TableCell className="text-right tabular-nums">{formatFraction(holder.pctHeld, 2)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCompact(holder.shares)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCompact(holder.value, currency)}</TableCell>
              <TableCell className="hidden text-right text-muted-foreground sm:table-cell">{formatDate(holder.reportDate)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * Who owns the company: insider and institutional shares, the largest holders
 * and recent insider trades (Yahoo Finance ownership modules).
 */
export function AssetOwnershipTab({ asset }: AssetOwnershipTabProps) {
  const ownership = asset.yahooInsights?.ownership;
  const currency = asset.profile.currency || 'USD';

  if (!ownership) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center text-muted-foreground">
          Yahoo Finance no publica datos de accionistas para este activo.
        </CardContent>
      </Card>
    );
  }

  const net = ownership.netInsiderActivity;
  const breakdown = [
    { label: 'Instituciones', value: ownership.institutionsPercent, icon: Landmark },
    { label: 'Insiders (directivos y accionistas internos)', value: ownership.insidersPercent, icon: UserCheck },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-primary" />
              Composición accionaria
            </CardTitle>
            <CardDescription>Porcentaje de las acciones en circulación.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {breakdown.map(({ label, value, icon: Icon }) => (
              <div key={label} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2"><Icon className="h-4 w-4 text-muted-foreground" />{label}</span>
                  <span className="font-semibold tabular-nums">{formatFraction(value)}</span>
                </div>
                <Progress value={value !== null ? Math.min(value * 100, 100) : 0} className="h-2" />
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              {ownership.institutionsCount !== null && `${formatCompact(ownership.institutionsCount)} instituciones reportan posiciones. `}
              {ownership.institutionsFloatPercent !== null && `Poseen el ${formatFraction(ownership.institutionsFloatPercent)} del free float.`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCheck className="h-4 w-4 text-primary" />
              Actividad de insiders
            </CardTitle>
            <CardDescription>
              Compras y ventas de directivos{net?.period ? ` en los últimos ${net.period.replace('m', ' meses')}` : ''}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {net ? (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Compras</p>
                  <p className="text-lg font-semibold text-emerald-600 tabular-nums">{formatCompact(net.buyShares)}</p>
                  <p className="text-xs text-muted-foreground">{net.buyCount ?? 0} operaciones</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Ventas</p>
                  <p className="text-lg font-semibold text-rose-600 tabular-nums">{formatCompact(net.sellShares)}</p>
                  <p className="text-xs text-muted-foreground">{net.sellCount ?? 0} operaciones</p>
                </div>
                <div className="col-span-2 rounded-lg bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Saldo neto</p>
                  <p className={`text-lg font-semibold tabular-nums ${(net.netShares ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {(net.netShares ?? 0) >= 0 ? '+' : ''}{formatCompact(net.netShares)} acciones
                    {net.netPercentInsiderShares !== null && ` (${formatFraction(net.netPercentInsiderShares, 2)} de su tenencia)`}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sin datos de actividad neta.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {ownership.topInstitutions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Landmark className="h-4 w-4 text-primary" />
              Principales tenedores institucionales
            </CardTitle>
          </CardHeader>
          <CardContent><HoldersTable holders={ownership.topInstitutions} currency={currency} /></CardContent>
        </Card>
      )}

      {ownership.topFunds.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-primary" />
              Principales fondos
            </CardTitle>
          </CardHeader>
          <CardContent><HoldersTable holders={ownership.topFunds} currency={currency} /></CardContent>
        </Card>
      )}

      {ownership.insiderTransactions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCheck className="h-4 w-4 text-primary" />
              Últimas operaciones de insiders
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Persona</TableHead>
                  <TableHead className="hidden md:table-cell">Operación</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ownership.insiderTransactions.map((transaction, index) => (
                  <TableRow key={`${transaction.name}-${transaction.date}-${index}`}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(transaction.date)}</TableCell>
                    <TableCell>
                      <p className="font-medium">{transaction.name}</p>
                      <p className="text-xs text-muted-foreground">{transaction.relation}</p>
                    </TableCell>
                    <TableCell className="hidden max-w-[280px] text-xs text-muted-foreground md:table-cell">
                      {transaction.text || 'Sin descripción'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCompact(transaction.shares)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {transaction.value ? formatCompact(transaction.value, currency) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
