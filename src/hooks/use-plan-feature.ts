// src/hooks/use-plan-feature.ts

import { useAuth } from './use-auth';

/**
 * Funcionalidades que requieren planes específicos.
 */
export type Feature =
  | 'exportPdf'
  | 'stockGrades'
  | 'revenueGeographic'
  | 'revenueProduct'
  | 'retirementAdvanced'
  | 'api'
  | 'alerts'
  | 'aiPredictions'
  | 'fairValueDetails'
  | 'screenerFull'
  | 'dailyDigest';

/**
 * Resultado de la verificación de acceso a una funcionalidad.
 */
export interface PlanFeatureResult {
  /** Si el usuario tiene acceso a la funcionalidad */
  hasAccess: boolean;
  /** Plan mínimo requerido para acceder */
  requiredPlan: 'plus' | 'premium';
  /** Plan actual del usuario */
  currentPlan: string;
  /** Mensaje descriptivo para mostrar al usuario */
  upgradeMessage: string;
  /** Nombre legible de la funcionalidad */
  featureName: string;
}

/**
 * Hook para verificar si el usuario tiene acceso a una funcionalidad específica
 * según su plan actual.
 * 
 * @example
 * ```tsx
 * const { hasAccess, upgradeMessage } = usePlanFeature('exportPdf');
 * 
 * if (!hasAccess) {
 *   return <UpgradePrompt message={upgradeMessage} />;
 * }
 * ```
 */
export function usePlanFeature(feature: Feature): PlanFeatureResult {
  const { profile } = useAuth();
  const currentRole = profile?.role ?? 'basico';

  // Definir qué plan requiere cada funcionalidad
  const featureRequirements: Record<Feature, 'plus' | 'premium'> = {
    exportPdf: 'plus',
    stockGrades: 'plus',
    revenueGeographic: 'plus',
    revenueProduct: 'plus',
    retirementAdvanced: 'plus',
    api: 'premium',
    alerts: 'premium',
    aiPredictions: 'premium',
    fairValueDetails: 'plus',
    screenerFull: 'plus',
    dailyDigest: 'plus',
  };

  // Nombres legibles de las funcionalidades
  const featureNames: Record<Feature, string> = {
    exportPdf: 'Exportar a PDF',
    stockGrades: 'Calificaciones de Analistas',
    revenueGeographic: 'Segmentación Geográfica',
    revenueProduct: 'Segmentación de Productos',
    retirementAdvanced: 'Calculadora Avanzada de Retiro',
    api: 'Acceso a API',
    alerts: 'Alertas en Tiempo Real',
    aiPredictions: 'Análisis Predictivo con IA',
    fairValueDetails: 'Valor Justo Detallado',
    screenerFull: 'Screener Completo',
    dailyDigest: 'Resumen Diario por Email',
  };

  const requiredPlan = featureRequirements[feature];
  
  // Jerarquía de planes para comparación
  const planHierarchy = ['basico', 'plus', 'premium', 'administrador'];
  const currentIndex = planHierarchy.indexOf(currentRole);
  const requiredIndex = planHierarchy.indexOf(requiredPlan);

  // El usuario tiene acceso si su plan es igual o superior al requerido
  const hasAccess = currentIndex >= requiredIndex;

  const planDisplayNames: Record<string, string> = {
    plus: 'Plus',
    premium: 'Premium',
  };

  const upgradeMessage = hasAccess
    ? ''
    : `${featureNames[feature]} está disponible en el plan ${planDisplayNames[requiredPlan]}.`;

  return {
    hasAccess,
    requiredPlan,
    currentPlan: currentRole,
    upgradeMessage,
    featureName: featureNames[feature],
  };
}
