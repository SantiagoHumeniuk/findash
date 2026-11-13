// src/features/alerts/hooks/use-alerts.ts

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '../../../hooks/use-auth';
import { supabase } from '../../../lib/supabase';
import { usePlanLimits } from '../../../hooks/use-plan-limits';

export type AlertCondition = 'above' | 'below' | 'move';

export interface PriceAlert {
  id: string;
  symbol: string;
  condition: AlertCondition;
  target: number;
  active: boolean;
  last_triggered_at: string | null;
  created_at: string;
}

export interface AppNotification {
  id: string;
  kind: 'alert' | 'digest';
  symbol: string | null;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

export interface AlertPreferences {
  email_alerts: boolean;
  daily_digest: boolean;
}

const DEFAULT_PREFERENCES: AlertPreferences = { email_alerts: true, daily_digest: false };
const NOTIFICATION_POLL_MS = 2 * 60 * 1000;

export function usePriceAlerts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['price-alerts', user?.id],
    enabled: Boolean(user),
    queryFn: async (): Promise<PriceAlert[]> => {
      const { data, error } = await supabase
        .from('price_alerts')
        .select('id,symbol,condition,target,active,last_triggered_at,created_at')
        .order('created_at', { ascending: false });
      if (error) throw new Error('No se pudieron cargar tus alertas.');
      return data as PriceAlert[];
    },
  });
}

export function useAlertMutations() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ['price-alerts', user?.id];
  const { data: alerts = [] } = usePriceAlerts();
  const activeCount = alerts.filter((alert) => alert.active).length;
  const { isAtLimit, limitMessage } = usePlanLimits('alerts', activeCount);

  const createAlert = useMutation({
    mutationFn: async (input: { symbol: string; condition: AlertCondition; target: number }) => {
      if (!user) throw new Error('Iniciá sesión para crear alertas.');
      if (isAtLimit) throw new Error(limitMessage || 'Alcanzaste el límite de alertas de tu plan.');
      const { error } = await supabase.from('price_alerts').insert({ ...input, user_id: user.id });
      // P0001 is the plan-limit message raised by the database; show it as is.
      if (error) throw new Error(error.code === 'P0001' ? error.message : 'No se pudo crear la alerta.');
    },
    onSuccess: () => {
      toast.success('Alerta creada');
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteAlert = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('price_alerts').delete().eq('id', id);
      if (error) throw new Error('No se pudo eliminar la alerta.');
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey }),
    onError: (error: Error) => toast.error(error.message),
  });

  return { createAlert, deleteAlert, isAtLimit, limitMessage };
}

export function useNotifications() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['notifications', user?.id],
    enabled: Boolean(user),
    refetchInterval: NOTIFICATION_POLL_MS,
    queryFn: async (): Promise<AppNotification[]> => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id,kind,symbol,title,body,read_at,created_at')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw new Error('No se pudieron cargar tus notificaciones.');
      return data as AppNotification[];
    },
  });
}

export function useMarkNotificationsRead() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .is('read_at', null);
      if (error) throw new Error('No se pudieron marcar como leídas.');
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] }),
  });
}

export function useAlertPreferences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ['alert-preferences', user?.id];

  const query = useQuery({
    queryKey,
    enabled: Boolean(user),
    queryFn: async (): Promise<AlertPreferences> => {
      const { data, error } = await supabase
        .from('alert_preferences')
        .select('email_alerts,daily_digest')
        .maybeSingle();
      if (error) throw new Error('No se pudieron cargar tus preferencias.');
      return (data as AlertPreferences | null) ?? DEFAULT_PREFERENCES;
    },
  });

  const update = useMutation({
    mutationFn: async (changes: Partial<AlertPreferences>) => {
      if (!user) throw new Error('Iniciá sesión para cambiar tus preferencias.');
      const { error } = await supabase.from('alert_preferences').upsert({
        user_id: user.id,
        ...(query.data ?? DEFAULT_PREFERENCES),
        ...changes,
        updated_at: new Date().toISOString(),
      });
      if (error) throw new Error('No se pudo guardar el cambio.');
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey }),
    onError: (error: Error) => toast.error(error.message),
  });

  return { preferences: query.data ?? DEFAULT_PREFERENCES, isLoading: query.isLoading, update };
}
