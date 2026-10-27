// src/features/asset-detail/components/insights/asset-risk-card.tsx

import { ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Progress } from '../../../../components/ui/progress';
import type { AssetData } from '../../../../types/dashboard';
import { formatCompact, formatDate, formatDecimal, formatFraction } from './insight-formatters';

interface AssetRiskCardProps {
  asset: AssetData;
}

const GOVERNANCE_LABELS = [
  { key: 'overall', label: 'Riesgo general' },
  { key: 'audit', label: 'Auditoría' },
  { key: 'board', label: 'Directorio' },
  { key: 'compensation', label: 'Remuneraciones' },
  { key: 'shareholderRights', label: 'Derechos del accionista' },
] as const;

function riskColor(score: number): string {
  if (score <= 3) return 'text-emerald-600 dark:text-emerald-400';
  if (score <= 6) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

/**
 * Short interest (how many shares are sold short) and ISS governance risk scores.
 */
export function AssetRiskCard({ asset }: AssetRiskCardProps) {
  const metrics = asset.yahooMetrics ?? {};
  const governance = asset.yahooInsights?.governance;
  const shortPercent = metrics['keyStatistics.shortPercentOfFloat'] ?? null;
  const shortRatio = metrics['keyStatistics.shortRatio'] ?? null;
  const sharesShort = metrics['keyStatistics.sharesShort'] ?? null;
  const sharesShortPrior = metrics['keyStatistics.sharesShortPriorMonth'] ?? null;
  const shortChange = sharesShort !== null && sharesShortPrior ? sharesShort / sharesShortPrior - 1 : null;
  const hasShortData = shortPercent !== null || sharesShort !== null;
  const hasGovernance = governance && GOVERNANCE_LABELS.some(({ key }) => governance[key] !== null);

  if (!hasShortData && !hasGovernance) return null;

  return (
    <Card>
      <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldAlert className="h-5 w-5 text-primary" />
          Riesgo y gobierno corporativo
        </CardTitle>
        <CardDescription>Posiciones cortas del mercado y puntajes de gobierno corporativo de ISS.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 p-4 sm:p-6 md:grid-cols-2">
        {hasShortData && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Ventas en corto</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">% del free float</p>
                <p className="text-lg font-semibold tabular-nums">{formatFraction(shortPercent, 2)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Días para cubrir</p>
                <p className="text-lg font-semibold tabular-nums">{formatDecimal(shortRatio, 1)}</p>
              </div>
              <div className="col-span-2 rounded-lg bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Acciones vendidas en corto</p>
                <p className="font-semibold tabular-nums">
                  {formatCompact(sharesShort)}
                  {shortChange !== null && (
                    <span className={`ml-2 text-xs ${shortChange > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {shortChange > 0 ? '+' : ''}{formatFraction(shortChange)} vs. mes anterior
                    </span>
                  )}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Un short interest alto o creciente indica que más inversores apuestan a la baja.
            </p>
          </div>
        )}
        {hasGovernance && governance && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Gobierno corporativo (1 = bajo riesgo, 10 = alto)</h3>
            {GOVERNANCE_LABELS.map(({ key, label }) => {
              const score = governance[key];
              if (score === null) return null;
              return (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{label}</span>
                    <span className={`font-semibold tabular-nums ${riskColor(score)}`}>{score}/10</span>
                  </div>
                  <Progress value={score * 10} className="h-1.5" />
                </div>
              );
            })}
            {governance.asOf && (
              <p className="text-xs text-muted-foreground">Actualizado al {formatDate(governance.asOf)}.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
