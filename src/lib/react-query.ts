// src/lib/react-query.ts
import { QueryClient } from '@tanstack/react-query';

/**
 * Función de retry inteligente con exponential backoff
 * @param failureCount - Número de intentos fallidos
 * @param error - Error que causó el fallo
 * @returns boolean - Si debe reintentar o no
 */
const shouldRetry = (failureCount: number, error: unknown): boolean => {
  // No reintentar si ya se intentó 3 veces
  if (failureCount >= 3) {
    return false;
  }

  // Reintentar solo en errores de red o servidor
  if (error instanceof Error) {
    // Errores 5xx (server errors) - siempre reintentar
    if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503')) {
      return true;
    }
    
    // Errores 4xx (client errors) - no reintentar (excepto 408, 429)
    if (error.message.includes('400') || error.message.includes('401') || error.message.includes('403') || error.message.includes('404')) {
      return false;
    }

    // 408 (Request Timeout) - reintentar
    if (error.message.includes('408')) {
      return true;
    }

    // 429 (Too Many Requests) - reintentar con más delay
    if (error.message.includes('429')) {
      return true;
    }

    // Network errors - siempre reintentar
    if (error.message.includes('Network') || error.message.includes('Failed to fetch') || error.message.includes('network')) {
      return true;
    }
  }

  // Por defecto, reintentar
  return true;
};

/**
 * Delay con exponential backoff
 * @param attemptIndex - Índice del intento (0-based)
 * @returns number - Milisegundos a esperar
 */
const retryDelay = (attemptIndex: number): number => {
  // Exponential backoff: 1s, 2s, 4s
  const baseDelay = 1000;
  const delay = Math.min(baseDelay * Math.pow(2, attemptIndex), 10000); // Max 10s
  
  // Agregar jitter aleatorio (±25%) para evitar thundering herd
  const jitter = delay * 0.25 * (Math.random() - 0.5);
  
  return Math.floor(delay + jitter);
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache & Staleness
      staleTime: 1000 * 60 * 5, // 5 minutos - Datos considerados frescos
      gcTime: 1000 * 60 * 10, // 10 minutos - Tiempo antes de garbage collection
      
      // Deduplication Settings
      // TanStack Query automáticamente deduplica requests con la misma key
      // Estos settings optimizan el comportamiento:
      refetchOnWindowFocus: false, // ❌ NO refetch al cambiar de pestaña (mejora UX en dashboards)
      refetchOnReconnect: false, // NO refetch al recuperar conexión (usa datos cacheados)
      refetchOnMount: true, // Refetch solo si los datos están stale al montar
      
      // Network Optimization
      networkMode: 'online', // Solo hacer requests cuando hay conexión
      
      // Retry Logic
      retry: shouldRetry, // Lógica inteligente de retry (evita requests inútiles)
      retryDelay, // Exponential backoff con jitter (reduce thundering herd)
      
      // Performance
      structuralSharing: true, // Evita re-renders innecesarios si los datos no cambiaron
    },
    mutations: {
      retry: 1, // Mutations solo 1 reintento (son operaciones críticas)
      retryDelay: 1000, // 1 segundo fijo para mutations
      networkMode: 'online', // Solo ejecutar mutations cuando hay conexión
    },
  },
});

// ✅ Listener para cancelar queries pendientes al ocultar la pestaña
if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      // Cancelar todas las queries pendientes al cambiar de pestaña
      void queryClient.cancelQueries();
    } else {
      // Al volver, reanudar las queries activas que se cancelaron antes de recibir datos;
      // con refetchOnWindowFocus desactivado quedarían vacías hasta remontar el componente.
      void queryClient.refetchQueries({
        type: 'active',
        predicate: (query) => query.state.data === undefined && query.state.fetchStatus === 'idle',
      });
    }
  });
}