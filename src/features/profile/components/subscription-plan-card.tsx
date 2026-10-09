import { useEffect, useState } from 'react';
import { BadgeCheck, Clock3, Crown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { paymentService, type SubscriptionRequest } from '../../../services/payment-service';
import type { Profile } from '../../../types/auth';

const SUBSCRIPTION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const SECOND_MS = 1000;

interface SubscriptionPlanCardProps {
  profile: Profile | null;
}

/** Shows the current plan and, for Plus/Premium, the remaining time from payment approval. */
export function SubscriptionPlanCard({ profile }: SubscriptionPlanCardProps) {
  const role = profile?.role ?? 'basico';
  const isPaidPlan = role === 'plus' || role === 'premium';
  const [approvedRequest, setApprovedRequest] = useState<SubscriptionRequest | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(isPaidPlan);

  useEffect(() => {
    let active = true;

    if (!isPaidPlan) {
      setApprovedRequest(null);
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    void paymentService.getUserRequests().then((requests) => {
      if (!active) return;

      const latestApproval = requests
        .filter((request) => request.status === 'approved' && request.plan === role && request.reviewed_at)
        .sort((left, right) => new Date(right.reviewed_at!).getTime() - new Date(left.reviewed_at!).getTime())[0] ?? null;

      setApprovedRequest(latestApproval);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [isPaidPlan, role]);

  useEffect(() => {
    if (!approvedRequest?.reviewed_at) return;

    const timer = window.setInterval(() => setNow(Date.now()), SECOND_MS);
    return () => window.clearInterval(timer);
  }, [approvedRequest]);

  const expiration = approvedRequest?.reviewed_at
    ? new Date(new Date(approvedRequest.reviewed_at).getTime() + SUBSCRIPTION_DURATION_MS)
    : null;
  const remainingMs = expiration ? expiration.getTime() - now : null;
  const expired = remainingMs !== null && remainingMs <= 0;
  const remainingSeconds = remainingMs !== null && remainingMs > 0 ? Math.floor(remainingMs / SECOND_MS) : 0;
  const days = Math.floor(remainingSeconds / 86400);
  const hours = Math.floor((remainingSeconds % 86400) / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="p-4 sm:p-6">
        <div className="flex items-center gap-2">
          <Crown className="h-4 w-4 text-muted-foreground sm:h-5 sm:w-5" />
          <CardTitle className="text-base font-semibold sm:text-lg">Plan</CardTitle>
        </div>
        <CardDescription className="text-xs sm:text-sm">Estado de tu suscripción</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 p-4 pt-0 sm:p-6 sm:pt-0">
        <div className="flex items-center gap-2">
          <Badge variant={isPaidPlan ? 'default' : 'secondary'} className="capitalize">
            {role === 'basico' ? 'Básico' : role}
          </Badge>
          {isPaidPlan && !expired && <BadgeCheck className="h-4 w-4 text-emerald-600" aria-label="Plan activo" />}
        </div>

        {!isPaidPlan && <p className="text-sm text-muted-foreground">Estás usando el plan gratuito.</p>}
        {isPaidPlan && loading && <p className="text-sm text-muted-foreground">Consultando vigencia...</p>}
        {isPaidPlan && !loading && !expiration && (
          <p className="text-sm text-muted-foreground">
            No encontramos una fecha de aprobación para este plan. Contacta al soporte para verificar tu suscripción.
          </p>
        )}
        {expiration && remainingMs !== null && (
          <div className="space-y-2">
            <div className={`flex items-center gap-2 text-sm font-medium ${expired ? 'text-destructive' : 'text-foreground'}`}>
              <Clock3 className="h-4 w-4" />
              {expired ? 'Suscripción vencida' : 'Tiempo restante'}
            </div>
            {!expired && (
              <div className="grid max-w-sm grid-cols-4 gap-2 text-center" aria-live="off" aria-label={`${days} días, ${hours} horas, ${minutes} minutos y ${seconds} segundos restantes`}>
                {[
                  ['Días', days],
                  ['Horas', hours],
                  ['Min', minutes],
                  ['Seg', seconds],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-md bg-muted px-2 py-2">
                    <div className="font-mono text-lg font-semibold tabular-nums">{String(value).padStart(2, '0')}</div>
                    <div className="text-[11px] text-muted-foreground">{label}</div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {expired ? 'Venció el ' : 'Vence el '}
              <time dateTime={expiration.toISOString()}>
                {expiration.toLocaleString('es-AR', { dateStyle: 'long', timeStyle: 'short' })}
              </time>
            </p>
          </div>
        )}
      </CardContent>

    </Card>
  );
}
