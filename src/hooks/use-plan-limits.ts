// src/hooks/use-plan-limits.ts

import { useAuth } from './use-auth';
import { useConfig } from './use-config';

/**
 * Tipo de límite numérico según el plan.
 */
export type LimitType = 'watchlist' | 'portfolios' | 'comparison' | 'alerts';

/**
 * Resultado de la verificación de límites.
 */
export interface PlanLimitResult {
  /** Cantidad actual utilizada */
  current: number;
  /** Límite máximo según el plan */
  limit: number;
  /** Si el usuario ha alcanzado el límite */
  isAtLimit: boolean;
  /** Si el usuario está cerca del límite (>80%) */
  isNearLimit: boolean;
  /** Porcentaje de uso (0-100) */
  usagePercentage: number;
  /** Plan actual del usuario */
  currentPlan: string;
  /** Mensaje descriptivo del límite */
  limitMessage: string;
}

/**
 * Hook para verificar límites numéricos según el plan del usuario.
 * 
 * @example
 * ```tsx
 * const { isAtLimit, limit, limitMessage } = usePlanLimits('portfolios', currentCount);
 * 
 * if (isAtLimit) {
 *   return <Alert>{limitMessage}</Alert>;
 * }
 * ```
 */
export function usePlanLimits(
  limitType: LimitType,
  currentCount: number
): PlanLimitResult {
  const { profile } = useAuth();
  const config = useConfig();
  const currentRole = profile?.role ?? 'basico';

  // Obtener el límite según el tipo y plan
  let limit = 0;
  let featureName = '';

  switch (limitType) {
    case 'watchlist':
      limit = config.plans?.roleLimits?.[currentRole] ?? 5;
      featureName = 'activos en seguimiento';
      break;
    case 'portfolios':
      limit = config.plans?.portfolioLimits?.[currentRole] ?? 1;
      featureName = 'portfolios';
      break;
    case 'alerts':
      limit = config.plans?.alertLimits?.[currentRole] ?? 3;
      featureName = 'alertas activas';
      break;
    case 'comparison':
      limit = config.dashboard?.maxTickersToCompare?.[currentRole] ?? 3;
      featureName = 'activos para comparar';
      break;
  }

  const isAtLimit = currentCount >= limit;
  const usagePercentage = Math.min((currentCount / limit) * 100, 100);
  const isNearLimit = usagePercentage >= 80;

  const planNames: Record<string, string> = {
    basico: 'Básico',
    plus: 'Plus',
    premium: 'Premium',
    administrador: 'Administrador',
  };

  const nextPlanLimits: Record<string, { plan: string; limit: number }> = {
    basico: {
      plan: 'Plus',
      limit: limitType === 'watchlist' ? 25 : limitType === 'alerts' ? 20 : 5,
    },
    plus: {
      plan: 'Premium',
      limit: limitType === 'watchlist' ? 50 : limitType === 'alerts' ? 100 : 10,
    },
  };

  let limitMessage = '';
  if (isAtLimit) {
    const nextPlan = nextPlanLimits[currentRole];
    if (nextPlan) {
      limitMessage = `Has alcanzado el límite de ${limit} ${featureName} del plan ${planNames[currentRole]}. Actualiza a ${nextPlan.plan} para obtener hasta ${nextPlan.limit}.`;
    } else {
      limitMessage = `Has alcanzado el límite de ${limit} ${featureName}.`;
    }
  } else if (isNearLimit) {
    limitMessage = `Estás usando ${currentCount} de ${limit} ${featureName} disponibles.`;
  }

  return {
    current: currentCount,
    limit,
    isAtLimit,
    isNearLimit,
    usagePercentage,
    currentPlan: currentRole,
    limitMessage,
  };
}
