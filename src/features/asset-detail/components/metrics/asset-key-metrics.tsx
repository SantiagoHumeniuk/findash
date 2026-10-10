// src/features/asset-detail/components/metrics/asset-key-metrics.tsx

import { useMemo } from 'react';
import { Card, CardContent } from '../../../../components/ui/card';
import { KeyMetricItem } from './key-metric-item';
import { formatLargeNumber } from '../../lib/asset-formatters';
import type { AssetData } from '../../../../types/dashboard';
import { calculatePerformanceMetrics } from '../../../../utils/performance-metrics';

interface AssetKeyMetricsProps {
  asset: AssetData;
}

export function AssetKeyMetrics({ asset }: AssetKeyMetricsProps) {
  // Usamos profile y historicalReturns según la nueva estructura de AssetData
  const { profile, historicalReturns } = asset;

  const metrics = useMemo(() => {
    // Usamos el array historicalReturns que ya está ordenado por asset-processor
    return calculatePerformanceMetrics(historicalReturns || []);
  }, [historicalReturns]);

  const formatYearMetric = (m: { year: number; return: number } | null) => {
    if (!m) return '';
    return `${m.year} (${(m.return * 100).toFixed(2)}%)`;
  };

  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          <KeyMetricItem
            label="Market Cap"
            value={formatLargeNumber(profile?.marketCap)}
            tooltip="Valor total de mercado de las acciones en circulación de la empresa."
          />
          <KeyMetricItem
            label="Volumen"
            value={formatLargeNumber(profile?.volume)}
            tooltip="Cantidad de acciones negociadas durante el último día de mercado."
          />
          <KeyMetricItem
            label="Vol. Promedio"
            value={formatLargeNumber(profile?.averageVolume)}
            tooltip="Promedio de acciones negociadas diariamente en los últimos 3 meses."
          />
          <KeyMetricItem
            label="Beta"
            value={typeof profile?.beta === 'number' && Number.isFinite(profile.beta) ? profile.beta.toFixed(2) : ''}
            tooltip="Mide la volatilidad de la acción respecto al mercado. Beta > 1 es más volátil."
          />
          <KeyMetricItem
            label="Rango 52 Semanas"
            value={profile?.range && profile.range !== 'N/A' ? profile.range : ''}
            tooltip="El precio más bajo y más alto registrado en el último año."
          />

          {/* Eliminado "Último Dividendo" como se solicitó */}

          {/* Métricas calculadas desde el historial */}
          <KeyMetricItem
            label="Mejor Año"
            value={formatYearMetric(metrics.bestYear)}
            className={metrics.bestYear && metrics.bestYear.return > 0 ? "text-green-500" : ""}
            tooltip="El año calendario con mejor rendimiento porcentual en el historial disponible."
          />
          <KeyMetricItem
            label="Peor Año"
            value={formatYearMetric(metrics.worstYear)}
            className={metrics.worstYear && metrics.worstYear.return < 0 ? "text-red-500" : ""}
            tooltip="El año calendario con peor rendimiento porcentual en el historial disponible."
          />
          <KeyMetricItem
            label="Max Drawdown"
            value={metrics.maxDrawdown !== null ? `${(metrics.maxDrawdown * 100).toFixed(2)}%` : ''}
            className="text-red-500"
            tooltip="La mayor caída porcentual desde un pico histórico hasta el fondo siguiente."
          />
        </div>
      </CardContent>
    </Card>
  );
}