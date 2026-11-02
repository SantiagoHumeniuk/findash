// src/features/admin/components/stats/retention-card.tsx

import { useQuery } from '@tanstack/react-query';
import { Activity } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/card';
import { supabase } from '../../../../lib/supabase';

interface RetentionMetrics {
  since: string | null;
  totalUsers: number;
  newUsers30d: number;
  dau: number;
  wau: number;
  mau: number;
  retention: Partial<Record<'d1' | 'd7' | 'd30', { eligible: number; retained: number }>>;
}

function Metric({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Active users and how many new users come back after 1, 7 and 30 days. */
export function RetentionCard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-retention'],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<RetentionMetrics> => {
      const { data: metrics, error } = await supabase.rpc('retention_metrics');
      if (error) throw new Error(error.message);
      return metrics as RetentionMetrics;
    },
  });

  const retentionValue = (key: 'd1' | 'd7' | 'd30') => {
    const item = data?.retention[key];
    if (!item || item.eligible === 0) return { value: 'Sin datos', hint: 'Todavía no pasó el plazo' };
    return {
      value: `${Math.round((item.retained / item.eligible) * 100)}%`,
      hint: `${item.retained} de ${item.eligible} usuarios`,
    };
  };

  return (
    <Card className="mb-6">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4 text-primary" />
          Uso y retención
        </CardTitle>
        <CardDescription>
          {data?.since
            ? `Se mide desde el ${new Date(`${data.since}T00:00:00`).toLocaleDateString('es-AR')}. La retención cuenta solo a quienes se registraron desde entonces.`
            : 'La medición empieza con la primera visita de un usuario con sesión.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isError ? (
          <p className="text-sm text-destructive">No se pudieron cargar las métricas.</p>
        ) : isLoading || !data ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            <Metric label="Activos hoy" value={data.dau} />
            <Metric label="Activos 7 días" value={data.wau} />
            <Metric label="Activos 30 días" value={data.mau} />
            <Metric label="Nuevos 30 días" value={data.newUsers30d} hint={`${data.totalUsers} en total`} />
            <Metric label="Vuelven día 1" {...retentionValue('d1')} />
            <Metric label="Vuelven día 7" {...retentionValue('d7')} />
            <Metric label="Vuelven día 30" {...retentionValue('d30')} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
