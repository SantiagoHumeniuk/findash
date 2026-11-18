// src/hooks/use-portfolio-limits.ts

import { useAuth } from './use-auth';
import { useConfig } from './use-config';

/**
 * Hook para validar el límite de activos simultáneos en un portfolio.
 * Reutiliza el límite de comparación del dashboard (maxTickersToCompare).
 * 
 * Límites por plan:
 * - Básico: 3 activos
 * - Plus: 10 activos
 * - Premium: 25 activos
 * - Admin: 50 activos
 */
export function usePortfolioLimits(currentAssetCount: number) {
  const { profile } = useAuth();
  const config = useConfig();
  const currentRole = profile?.role ?? 'basico';
  
  // Reutilizar límite de dashboard para coherencia
  const maxAssets = config.dashboard?.maxTickersToCompare?.[currentRole] ?? 3;
  const isAtLimit = currentAssetCount >= maxAssets;
  
  // Capitalizar nombre del plan para UI
  const planName = currentRole.charAt(0).toUpperCase() + currentRole.slice(1);
  
  const limitMessage = `Tu plan ${planName} permite hasta ${maxAssets} activos simultáneos en tu portfolio.`;
  const upgradeMessage = `Actualiza a un plan superior para agregar más activos a tu portfolio. Actualmente tienes ${currentAssetCount} de ${maxAssets} activos.`;
  
  return {
    maxAssets,
    isAtLimit,
    currentAssetCount,
    limitMessage,
    upgradeMessage,
    usagePercentage: (currentAssetCount / maxAssets) * 100,
  };
}
