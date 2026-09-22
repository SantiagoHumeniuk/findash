// src/providers/auth-provider.tsx

import React, { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Session, User } from '@supabase/supabase-js';
import { AuthContextType, Profile } from '../types/auth';
import { logger } from '../lib/logger';
import { toast } from 'sonner';
import { LoadingScreen } from '../components/ui/loading-screen';
import { ErrorScreen } from '../components/ui/error-screen';
import { queryClient } from '../lib/react-query';

// ✅ Mejora: Contexto con guard que lanza si se usa fuera del Provider
const authContextGuard = new Proxy({}, {
  get: () => {
    throw new Error('useAuth debe ser utilizado dentro de un AuthProvider');
  }
}) as AuthContextType;

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextType>(authContextGuard);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null); // ✅ Cancelar requests pendientes
  const fetchInProgressRef = useRef(false); // ✅ Prevenir llamadas concurrentes
  const initPromiseRef = useRef<Promise<unknown> | null>(null); // ✅ Evitar doble inicialización

  const fetchProfile = useCallback(async (user: User | null, signal?: AbortSignal) => {
    if (!user) {
      setProfile(null);
      return;
    }

    // ✅ Prevenir múltiples llamadas concurrentes
    if (fetchInProgressRef.current) {
      return;
    }

    fetchInProgressRef.current = true;

    try {
      const resp = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      // ✅ Si la request fue abortada, no actualizar el estado
      if (signal?.aborted) {
        return;
      }

      if (resp.error) {
        // Si el perfil no existe aún (ej: primer login con Google OAuth sin trigger de DB)
        if (resp.error.code === 'PGRST116') {
          const userMeta = user.user_metadata || {};
          const fullName = String(userMeta.full_name || userMeta.name || '').trim();
          const parts = fullName ? fullName.split(/\s+/) : [];
          const firstName = parts[0] || null;
          const lastName = parts.slice(1).join(' ') || null;

          const defaultProfile = {
            id: user.id,
            email: user.email ?? '',
            role: 'basico',
            first_name: firstName,
            last_name: lastName,
            api_calls_made: 0,
            onboarding_completed: false,
            onboarding_step: 0,
          };

          const { data: createdProfile, error: insertError } = await supabase
            .from('profiles')
            .upsert(defaultProfile, { onConflict: 'id' })
            .select('*')
            .single();

          if (!insertError && createdProfile) {
            setProfile(createdProfile as unknown as Profile);
            return;
          }
        }
        throw resp.error;
      }

      const dataUnknown = resp.data as unknown;
      if (dataUnknown && typeof dataUnknown === 'object') {
        setProfile(dataUnknown as Profile);
      } else {
        setProfile(null);
      }
    } catch (error: unknown) {
      // ✅ No loggear errores si fue cancelación intencional
      if (signal?.aborted) {
        return;
      }
      const msg = error instanceof Error ? error.message : 'Fallo al obtener perfil';
      void logger.error('AUTH_PROFILE_FETCH_FAILED', msg);
      setProfile(null);
    } finally {
      fetchInProgressRef.current = false;
    }
  }, []);

  useEffect(() => {
    // ✅ Si ya hay una inicialización en progreso, no iniciar otra
    if (initPromiseRef.current) {
      return;
    }

    // ✅ Crear AbortController para cancelar requests al desmontar
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const initializeAndListen = async () => {
      setLoading(true);
      setError(null);
      try {
        // 1. Carga la sesión inicial de forma silenciosa.
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        // ✅ Verificar si fue abortado antes de continuar
        if (abortController.signal.aborted) {
          return;
        }
        
        setSession(initialSession);
        await fetchProfile(initialSession?.user ?? null, abortController.signal);
        
        if (abortController.signal.aborted) {
          return;
        }
        setIsLoaded(true);
      } catch (err: unknown) {
        if (abortController.signal.aborted) {
          return;
        }
        const msg = err instanceof Error ? err.message : 'Fallo inicializando autenticación';
        void logger.error('AUTH_INIT_FAILED', msg);
        setError('No pudimos inicializar la sesión.');
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }

      // 2. Se suscribe a los cambios de autenticación.
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (_event, newSession) => {
          // ✅ Verificar si el componente sigue montado
          if (abortController.signal.aborted) return;
          
          // Cada vez que la sesión cambie (login/logout), se actualiza todo.
          setLoading(true);
          setError(null);
          try {
            setSession(newSession);
            await fetchProfile(newSession?.user ?? null, abortController.signal);
            
            if (abortController.signal.aborted) return;
            setIsLoaded(true);
          } catch (err: unknown) {
            if (abortController.signal.aborted) return;
            const msg = err instanceof Error ? err.message : 'Fallo al manejar cambio de autenticación';
            void logger.error('AUTH_STATE_CHANGE_FAILED', msg);
            setError('Ocurrió un problema actualizando tu sesión.');
          } finally {
            if (!abortController.signal.aborted) {
              setLoading(false);
            }
          }
        }
      );
      
      return subscription;
    };

  // ✅ Guardar la promesa para evitar doble inicialización
    const initPromise = initializeAndListen();
    initPromiseRef.current = initPromise;

    const subscriptionPromise = initPromise;

    // ✅ Limpieza mejorada: cancelar requests pendientes y desuscribirse
    return () => {
      abortController.abort(); // Cancela todas las requests pendientes
      initPromiseRef.current = null; // ✅ Reset para permitir nueva inicialización
      void subscriptionPromise.then(subscription => subscription?.unsubscribe());
    };
  }, [fetchProfile]);

  const signOut = async (): Promise<void> => {
    try {
      const toastId = toast.loading('Cerrando sesión...');
      
      // 1. Limpiar estado local PRIMERO (antes de intentar signOut)
      setProfile(null);
      setSession(null);
      setIsLoaded(false);
      
      // 2. Limpiar cache de React Query
      queryClient.clear();
      
      // 3. Limpiar localStorage manualmente (incluyendo tokens de Supabase)
      try {
        const keysToRemove = Object.keys(localStorage).filter(key => 
          key.includes('supabase') || key.includes('sb-')
        );
        keysToRemove.forEach(key => localStorage.removeItem(key));
      } catch {
        // Ignorar errores de storage
      }
      
      // 4. Intentar cerrar sesión en Supabase (sin bloquear si falla)
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch (error) {
        // Loggear pero no bloquear - la limpieza local ya está hecha
        void logger.error('AUTH_SIGNOUT_SUPABASE_FAILED', error instanceof Error ? error.message : 'Unknown error');
      }
      
      toast.dismiss(toastId);
      toast.success('Sesión cerrada correctamente');
      
      // 5. Pequeño delay para asegurar que todo se limpió
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 6. Redirect a login con reload forzado para limpiar estado de React
      window.location.href = '/login';
    } catch (error) {
      // Incluso si hay error, intentar limpiar y redirect
      const msg = error instanceof Error ? error.message : 'Error desconocido';
      toast.error('Cerrando sesión de todas formas...', { description: msg });
      void logger.error('AUTH_SIGNOUT_FAILED', msg);
      
      // Forzar limpieza y redirect de todas formas
      setProfile(null);
      setSession(null);
      queryClient.clear();
      
      setTimeout(() => {
        window.location.href = '/login';
      }, 500);
    }
  };

  const refreshProfile = useCallback(async () => {
    if (session?.user) {
      // ✅ Crear nuevo AbortController para el refresh
      const refreshAbortController = new AbortController();
      await fetchProfile(session.user, refreshAbortController.signal);
    }
  }, [session, fetchProfile]);

  // ✅ Manejar visibilidad de la página para prevenir requests clavadas
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && session?.user) {
        // Cuando vuelves a la pestaña, refrescar el perfil
        void refreshProfile();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [session, refreshProfile]);

  const retryInit = async () => {
    // ✅ Mejora: permitir reintento desde ErrorScreen
    initPromiseRef.current = null; // Reset para permitir nueva inicialización
    setError(null);
    setIsLoaded(false);
    setLoading(true);
    
    // ✅ Cancelar cualquier request anterior y crear nuevo AbortController
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const retryAbortController = new AbortController();
    abortControllerRef.current = retryAbortController;
    
    try {
      const { data: { session: initialSession } } = await supabase.auth.getSession();
      
      if (retryAbortController.signal.aborted) return;
      
      setSession(initialSession);
      await fetchProfile(initialSession?.user ?? null, retryAbortController.signal);
      
      if (retryAbortController.signal.aborted) return;
      setIsLoaded(true);
    } catch (err: unknown) {
      if (retryAbortController.signal.aborted) return;
      const msg = err instanceof Error ? err.message : 'Fallo reintentando autenticación';
      void logger.error('AUTH_RETRY_FAILED', msg);
      setError('No pudimos reintentar la inicialización.');
    } finally {
      if (!retryAbortController.signal.aborted) {
        setLoading(false);
      }
    }
  };

  const value: AuthContextType = {
    session,
    user: session?.user ?? null,
    profile,
    isLoaded,
    loading,
    error,
    signOut,
    refreshProfile,
  };

  // ✅ Timeout de seguridad: si pasa más de 10s en loading, mostrar error
  useEffect(() => {
    if (!loading || isLoaded) return;

    const timeoutId = setTimeout(() => {
      if (loading && !isLoaded) {
        setError('La inicialización está tomando demasiado tiempo. Por favor, recarga la página.');
        setLoading(false);
      }
    }, 10000); // 10 segundos

    return () => {
      clearTimeout(timeoutId);
    };
  }, [loading, isLoaded]);

  // ✅ Mejora: Evitar pantallas en blanco y manejar errores de forma genérica
  if (loading && !isLoaded) {
    return <LoadingScreen message="Inicializando sesión..." />;
  }
  if (error) {
    return (
      <ErrorScreen
        title="Error de autenticación"
        message={error}
        onRetry={() => { void retryInit(); }}
      />
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};