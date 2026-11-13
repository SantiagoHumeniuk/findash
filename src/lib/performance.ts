// src/lib/performance.ts

import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from 'web-vitals';
import { logger } from './logger';

/**
 * Tipos de métricas de performance
 */
export type PerformanceMetricType = 
  | 'CLS'    // Cumulative Layout Shift
  | 'FCP'    // First Contentful Paint
  | 'INP'    // Interaction to Next Paint (reemplaza FID)
  | 'LCP'    // Largest Contentful Paint
  | 'TTFB'   // Time to First Byte
  | 'ROUTE'  // Route change timing
  | 'API';   // API response timing

/**
 * Interfaz para métricas personalizadas
 */
export interface CustomMetric {
  name: string;
  value: number;
  metadata?: Record<string, unknown>;
}

/**
 * Umbral de buena performance según Web Vitals
 */
const THRESHOLDS = {
  CLS: 0.1,    // Cumulative Layout Shift
  FCP: 1800,   // First Contentful Paint (ms)
  INP: 200,    // Interaction to Next Paint (ms)
  LCP: 2500,   // Largest Contentful Paint (ms)
  TTFB: 800,   // Time to First Byte (ms)
} as const;

/**
 * Determina si una métrica está dentro del umbral "bueno"
 */
function isGoodMetric(name: string, value: number): boolean {
  const threshold = THRESHOLDS[name as keyof typeof THRESHOLDS];
  if (!threshold) return true;
  return value <= threshold;
}

/**
 * Calcula el rating de una métrica (good, needs-improvement, poor)
 */
function getRating(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  if (name === 'CLS') {
    if (value <= 0.1) return 'good';
    if (value <= 0.25) return 'needs-improvement';
    return 'poor';
  }
  if (name === 'FCP') {
    if (value <= 1800) return 'good';
    if (value <= 3000) return 'needs-improvement';
    return 'poor';
  }
  if (name === 'INP') {
    if (value <= 200) return 'good';
    if (value <= 500) return 'needs-improvement';
    return 'poor';
  }
  if (name === 'LCP') {
    if (value <= 2500) return 'good';
    if (value <= 4000) return 'needs-improvement';
    return 'poor';
  }
  if (name === 'TTFB') {
    if (value <= 800) return 'good';
    if (value <= 1800) return 'needs-improvement';
    return 'poor';
  }
  return 'good';
}

/**
 * Envía una métrica de Web Vitals al sistema de logging
 */
function sendToAnalytics(metric: Metric) {
  const { name, value, rating, delta, id } = metric;
  const isGood = isGoodMetric(name, value);
  
  // Log en consola para desarrollo
  if (import.meta.env.DEV) {
    console.log(`[Performance] ${name}:`, {
      value: Math.round(value),
      rating,
      isGood,
      delta: Math.round(delta),
      id,
    });
  }

  // Only slow loads are worth a database row; good ones were most of the log table.
  if (isGood) return;
  void logger.info('PERFORMANCE_METRIC', `${name} metric recorded`, {
    metric: name,
    value: Math.round(value * 100) / 100, // 2 decimales
    rating,
    isGood,
    delta: Math.round(delta * 100) / 100,
    metricId: id,
    url: window.location.pathname,
    timestamp: Date.now(),
  });
}

/**
 * Inicializa el monitoreo de Web Vitals
 */
export function initPerformanceMonitoring() {
  // Solo en producción o si está explícitamente habilitado
  const isEnabled = import.meta.env.PROD || import.meta.env.VITE_ENABLE_PERFORMANCE === 'true';
  
  if (!isEnabled) {
    console.log('[Performance] Monitoring disabled in development');
    return;
  }

  // Monitorear Core Web Vitals
  onCLS(sendToAnalytics);
  onFCP(sendToAnalytics);
  onINP(sendToAnalytics);
  onLCP(sendToAnalytics);
  onTTFB(sendToAnalytics);

  console.log('[Performance] Monitoring initialized');
}

/**
 * Registra el tiempo de carga de una ruta
 */
export function measureRouteChange(routeName: string, startTime: number) {
  const duration = performance.now() - startTime;
  const rating = getRating('FCP', duration);

  if (import.meta.env.DEV) {
    console.log(`[Performance] Route change to ${routeName}:`, {
      duration: Math.round(duration),
      rating,
    });
  }

  void logger.info('ROUTE_CHANGE', `Route loaded: ${routeName}`, {
    route: routeName,
    duration: Math.round(duration),
    rating,
    url: window.location.pathname,
    timestamp: Date.now(),
  });
}

/**
 * Mide el tiempo de respuesta de una API
 */
export function measureApiCall(
  endpoint: string,
  method: string,
  startTime: number,
  success: boolean,
  statusCode?: number
) {
  const duration = performance.now() - startTime;
  const rating = duration <= 1000 ? 'good' : duration <= 3000 ? 'needs-improvement' : 'poor';

  if (import.meta.env.DEV) {
    console.log(`[Performance] API ${method} ${endpoint}:`, {
      duration: Math.round(duration),
      success,
      statusCode,
      rating,
    });
  }

  void logger.info('API_CALL', `API call: ${method} ${endpoint}`, {
    endpoint,
    method,
    duration: Math.round(duration),
    success,
    statusCode,
    rating,
    timestamp: Date.now(),
  });
}

/**
 * Hook para medir el tiempo de una operación personalizada
 */
export class PerformanceTimer {
  private startTime: number;
  private name: string;

  constructor(name: string) {
    this.name = name;
    this.startTime = performance.now();
  }

  /**
   * Finaliza el timer y envía la métrica
   */
  end(metadata?: Record<string, unknown>) {
    const duration = performance.now() - this.startTime;
    
    if (import.meta.env.DEV) {
      console.log(`[Performance] ${this.name}:`, {
        duration: Math.round(duration),
        ...metadata,
      });
    }

    void logger.info('CUSTOM_METRIC', `Custom metric: ${this.name}`, {
      metricName: this.name,
      duration: Math.round(duration),
      ...metadata,
      timestamp: Date.now(),
    });

    return duration;
  }
}

interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface PerformanceWithMemory extends Performance {
  memory?: PerformanceMemory;
}

/**
 * Monitorea el uso de memoria (si está disponible)
 */
export function measureMemoryUsage() {
  const perf = performance as PerformanceWithMemory;
  
  if (perf.memory) {
    const { usedJSHeapSize, totalJSHeapSize, jsHeapSizeLimit } = perf.memory;
    const usedMB = Math.round(usedJSHeapSize / 1048576);
    const totalMB = Math.round(totalJSHeapSize / 1048576);
    const limitMB = Math.round(jsHeapSizeLimit / 1048576);
    const percentage = Math.round((usedJSHeapSize / jsHeapSizeLimit) * 100);

    if (import.meta.env.DEV) {
      console.log('[Performance] Memory usage:', {
        used: `${usedMB}MB`,
        total: `${totalMB}MB`,
        limit: `${limitMB}MB`,
        percentage: `${percentage}%`,
      });
    }

    void logger.info('MEMORY_USAGE', 'Memory usage snapshot', {
      usedMB,
      totalMB,
      limitMB,
      percentage,
      timestamp: Date.now(),
    });

    return { usedMB, totalMB, limitMB, percentage };
  }

  return null;
}

/**
 * Exporta el resumen de métricas de performance
 */
export function getPerformanceSummary() {
  const entries = performance.getEntriesByType('navigation');
  if (entries.length === 0) return null;

  const navigation = entries[0];

  return {
    dns: Math.round(navigation.domainLookupEnd - navigation.domainLookupStart),
    tcp: Math.round(navigation.connectEnd - navigation.connectStart),
    ttfb: Math.round(navigation.responseStart - navigation.requestStart),
    download: Math.round(navigation.responseEnd - navigation.responseStart),
    domInteractive: Math.round(navigation.domInteractive - navigation.fetchStart),
    domComplete: Math.round(navigation.domComplete - navigation.fetchStart),
    loadComplete: Math.round(navigation.loadEventEnd - navigation.fetchStart),
  };
}
