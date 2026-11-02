// src/features/alerts/pages/alerts-page.tsx

import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bell, BellRing, Plus, Trash2 } from 'lucide-react';
import { AssetLogo } from '../../../components/ui/asset-logo';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Label } from '../../../components/ui/label';
import { PageHeader } from '../../../components/ui/page-header';
import { Skeleton } from '../../../components/ui/skeleton';
import { Switch } from '../../../components/ui/switch';
import { UpgradeHint } from '../../../components/shared/upgrade-hint';
import { usePlanFeature } from '../../../hooks/use-plan-feature';
import { CreateAlertDialog } from '../components/create-alert-dialog';
import {
  type PriceAlert,
  useAlertMutations,
  useAlertPreferences,
  useMarkNotificationsRead,
  useNotifications,
  usePriceAlerts,
} from '../hooks/use-alerts';

function describeAlert(alert: PriceAlert): string {
  if (alert.condition === 'move') return `Se mueve ${alert.target}% o más en el día`;
  return `${alert.condition === 'above' ? 'Sube a' : 'Baja a'} ${alert.target}`;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function AlertsPage() {
  const { data: alerts = [], isLoading: alertsLoading } = usePriceAlerts();
  const { data: notifications = [], isLoading: notificationsLoading } = useNotifications();
  const { deleteAlert } = useAlertMutations();
  const { preferences, isLoading: preferencesLoading, update } = useAlertPreferences();
  const { mutate: markRead } = useMarkNotificationsRead();
  const { hasAccess: canUseDigest } = usePlanFeature('dailyDigest');
  const hasUnread = notifications.some((item) => !item.read_at);

  // Opening the page counts as reading what is listed.
  useEffect(() => {
    if (hasUnread) markRead();
  }, [hasUnread, markRead]);

  return (
    <div className="container-wide stack-6">
      <PageHeader
        icon={<Bell className="w-8 h-8 text-primary" />}
        title="Alertas"
        description="Enterate a tiempo de lo que pasa con tus activos, sin tener que entrar a mirar."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
            <div>
              <CardTitle className="text-base">Mis alertas</CardTitle>
              <CardDescription>Las de precio se desactivan al cumplirse; las de movimiento avisan una vez por día.</CardDescription>
            </div>
            <CreateAlertDialog trigger={<Button size="sm" className="shrink-0 gap-1.5"><Plus className="h-4 w-4" />Nueva</Button>} />
          </CardHeader>
          <CardContent>
            {alertsLoading ? <Skeleton className="h-24 w-full" /> : alerts.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Todavía no creaste alertas. Probá con un precio que quieras comprar o vender.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {alerts.map((alert) => (
                  <li key={alert.id} className="flex items-center gap-3 py-2.5">
                    <Link to={`/asset/${alert.symbol}`} className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-80">
                      <AssetLogo symbol={alert.symbol} className="size-7" />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{alert.symbol}</span>
                        <span className="block truncate text-xs text-muted-foreground">{describeAlert(alert)}</span>
                      </span>
                    </Link>
                    <Badge variant={alert.active ? 'outline' : 'secondary'}>{alert.active ? 'Activa' : 'Cumplida'}</Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Eliminar alerta de ${alert.symbol}`}
                      disabled={deleteAlert.isPending}
                      onClick={() => deleteAlert.mutate(alert.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Avisos por email</CardTitle>
              <CardDescription>También los vas a ver siempre dentro de FinDash.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="email-alerts" className="font-normal">
                  <span className="block font-medium">Alertas de precio</span>
                  <span className="block text-xs text-muted-foreground">Un email cuando se activa una alerta.</span>
                </Label>
                <Switch
                  id="email-alerts"
                  checked={preferences.email_alerts}
                  disabled={preferencesLoading || update.isPending}
                  onCheckedChange={(checked) => update.mutate({ email_alerts: checked })}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="daily-digest" className="font-normal">
                  <span className="block font-medium">Resumen diario</span>
                  <span className="block text-xs text-muted-foreground">
                    De lunes a viernes a la mañana: movimientos, próximas fechas y cambios de analistas de tus activos.
                  </span>
                </Label>
                <Switch
                  id="daily-digest"
                  checked={canUseDigest && preferences.daily_digest}
                  disabled={!canUseDigest || preferencesLoading || update.isPending}
                  onCheckedChange={(checked) => update.mutate({ daily_digest: checked })}
                />
              </div>
              {!canUseDigest && <UpgradeHint message="El resumen diario por email está disponible en el plan Plus." />}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <BellRing className="h-4 w-4 text-primary" />
                Últimos avisos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {notificationsLoading ? <Skeleton className="h-24 w-full" /> : notifications.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Cuando se active una alerta, la vas a ver acá.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {notifications.map((item) => (
                    <li key={item.id} className="py-2.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-sm font-medium">{item.title}</p>
                        <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(item.created_at)}</span>
                      </div>
                      {item.body && <p className="text-xs text-muted-foreground">{item.body}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
