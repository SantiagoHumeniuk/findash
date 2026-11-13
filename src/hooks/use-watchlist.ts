// src/hooks/use-watchlist.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from './use-auth';
import { toast } from 'sonner';
import { logger } from '../lib/logger';
import type { WatchlistItem, CreateWatchlistItemDto, UpdateWatchlistItemDto } from '../types/watchlist';
import { usePlanLimits } from './use-plan-limits';

/**
 * Hook para obtener la watchlist del usuario
 */
export function useWatchlist() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['watchlist', user?.id],
    queryFn: async (): Promise<WatchlistItem[]> => {
      if (!user?.id) {
        return [];
      }

      const { data, error } = await supabase
        .from('watchlist')
        .select('*')
        .eq('user_id', user.id)
        .order('added_at', { ascending: false });

      if (error) {
        void logger.error('WATCHLIST_FETCH_ERROR', 'Error fetching watchlist', { error });
        throw new Error('No se pudo obtener tu watchlist');
      }

      return (data || []) as WatchlistItem[];
    },
    enabled: !!user?.id,
  });
}

/**
 * Hook para verificar si un asset está en watchlist
 */
export function useIsInWatchlist(symbol: string) {
  const { data: watchlist = [] } = useWatchlist();
  
  return watchlist.some(item => item.symbol === symbol);
}

/**
 * Hook para obtener un item específico del watchlist
 */
export function useWatchlistItem(symbol: string) {
  const { data: watchlist = [] } = useWatchlist();
  
  return watchlist.find(item => item.symbol === symbol);
}

/**
 * Hook para las mutaciones del watchlist
 */
export function useWatchlistMutations() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ['watchlist', user?.id];

  // Obtener watchlist actual para validar límites
  const { data: currentWatchlist = [] } = useWatchlist();
  const { isAtLimit, limit } = usePlanLimits('watchlist', currentWatchlist.length);

  // Agregar a watchlist
  const addToWatchlist = useMutation({
    mutationFn: async (dto: CreateWatchlistItemDto): Promise<WatchlistItem> => {
      if (!user?.id) {
        throw new Error('Usuario no autenticado');
      }

      // ✅ VALIDAR LÍMITE DEL PLAN ANTES DE AGREGAR
      if (isAtLimit) {
        throw new Error(`Has alcanzado el límite de ${limit} activos en tu watchlist. Actualizá tu plan para agregar más.`);
      }

      const result = await supabase
        .from('watchlist')
        .insert({
          user_id: user.id,
          symbol: dto.symbol,
          notes: dto.notes,
          list_name: dto.list_name ?? 'General',
        })
        .select()
        .single();

      if (result.error) {
        void logger.error('WATCHLIST_ADD_ERROR', 'Error adding to watchlist', { error: result.error, dto });
        
        // Si es duplicado, mostrar mensaje específico
        if (result.error.code === '23505') {
          throw new Error('Este asset ya está en tu watchlist');
        }
        // Plan limit raised by the database.
        if (result.error.code === 'P0001') {
          throw new Error(result.error.message);
        }
        
        throw new Error('No se pudo agregar a watchlist');
      }

      return result.data as WatchlistItem;
    },
    // ✨ OPTIMISTIC UPDATE: Actualizar UI instantáneamente
    onMutate: async (dto) => {
      // Cancelar refetch en curso para evitar race conditions
      await queryClient.cancelQueries({ queryKey });

      // Snapshot del estado actual (para rollback)
      const previousWatchlist = queryClient.getQueryData<WatchlistItem[]>(queryKey);

      // Crear item optimista
      const optimisticItem: WatchlistItem = {
        id: `temp-${Date.now()}`, // ID temporal
        user_id: user?.id ?? '',
        symbol: dto.symbol,
        notes: dto.notes,
        list_name: dto.list_name ?? 'General',
        added_at: new Date().toISOString(),
      };

      // Actualizar caché optimistamente
      queryClient.setQueryData<WatchlistItem[]>(queryKey, (old = []) => [optimisticItem, ...old]);

      // Mostrar feedback instantáneo
      toast.success(`${dto.symbol} agregado a watchlist`);

      // Retornar context para rollback
      return { previousWatchlist };
    },
    onSuccess: (data) => {
      // Reemplazar item optimista con datos reales del servidor
      queryClient.setQueryData<WatchlistItem[]>(queryKey, (old = []) => 
        old.map(item => item.id.toString().startsWith('temp-') && item.symbol === data.symbol ? data : item)
      );
      void logger.info('WATCHLIST_ADDED', 'Asset added to watchlist', { symbol: data.symbol });
    },
    onError: (error: Error, _variables, context) => {
      // Rollback: Restaurar estado anterior
      if (context?.previousWatchlist) {
        queryClient.setQueryData(queryKey, context.previousWatchlist);
      }
      toast.error(error.message || 'Error al agregar a watchlist');
    },
    // Siempre refetch después de settled (success o error) para sincronizar
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  // Remover de watchlist
  const removeFromWatchlist = useMutation({
    mutationFn: async (symbol: string): Promise<void> => {
      if (!user?.id) {
        throw new Error('Usuario no autenticado');
      }

      const { error } = await supabase
        .from('watchlist')
        .delete()
        .eq('user_id', user.id)
        .eq('symbol', symbol);

      if (error) {
        void logger.error('WATCHLIST_REMOVE_ERROR', 'Error removing from watchlist', { error, symbol });
        throw new Error('No se pudo eliminar de watchlist');
      }
    },
    // ✨ OPTIMISTIC UPDATE: Remover de UI instantáneamente
    onMutate: async (symbol) => {
      // Cancelar refetch en curso
      await queryClient.cancelQueries({ queryKey });

      // Snapshot del estado actual
      const previousWatchlist = queryClient.getQueryData<WatchlistItem[]>(queryKey);

      // Remover optimistamente
      queryClient.setQueryData<WatchlistItem[]>(queryKey, (old = []) => 
        old.filter(item => item.symbol !== symbol)
      );

      // Feedback instantáneo
      toast.success(`${symbol} eliminado de watchlist`);

      // Retornar context para rollback
      return { previousWatchlist };
    },
    onSuccess: (_data, symbol) => {
      void logger.info('WATCHLIST_REMOVED', 'Asset removed from watchlist', { symbol });
    },
    onError: (error: Error, _symbol, context) => {
      // Rollback: Restaurar estado anterior
      if (context?.previousWatchlist) {
        queryClient.setQueryData(queryKey, context.previousWatchlist);
      }
      toast.error(error.message || 'Error al eliminar de watchlist');
    },
    // Refetch para sincronizar
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  // Actualizar notas
  const updateWatchlistItem = useMutation({
    mutationFn: async ({ symbol, dto }: { symbol: string; dto: UpdateWatchlistItemDto }): Promise<WatchlistItem> => {
      if (!user?.id) {
        throw new Error('Usuario no autenticado');
      }

      const result = await supabase
        .from('watchlist')
        .update({ notes: dto.notes })
        .eq('user_id', user.id)
        .eq('symbol', symbol)
        .select()
        .single();

      if (result.error) {
        void logger.error('WATCHLIST_UPDATE_ERROR', 'Error updating watchlist item', { error: result.error, symbol, dto });
        throw new Error('No se pudo actualizar el item');
      }

      return result.data as WatchlistItem;
    },
    // ✨ OPTIMISTIC UPDATE: Actualizar notas instantáneamente
    onMutate: async ({ symbol, dto }) => {
      // Cancelar refetch en curso
      await queryClient.cancelQueries({ queryKey });

      // Snapshot del estado actual
      const previousWatchlist = queryClient.getQueryData<WatchlistItem[]>(queryKey);

      // Actualizar optimistamente
      queryClient.setQueryData<WatchlistItem[]>(queryKey, (old = []) => 
        old.map(item => item.symbol === symbol ? { ...item, notes: dto.notes } : item)
      );

      // Feedback instantáneo
      toast.success('Notas actualizadas');

      // Retornar context para rollback
      return { previousWatchlist };
    },
    onSuccess: (data) => {
      // Asegurar que los datos del servidor estén sincronizados
      queryClient.setQueryData<WatchlistItem[]>(queryKey, (old = []) => 
        old.map(item => item.symbol === data.symbol ? data : item)
      );
      void logger.info('WATCHLIST_UPDATED', 'Watchlist item updated', { symbol: data.symbol });
    },
    onError: (error: Error, _variables, context) => {
      // Rollback: Restaurar estado anterior
      if (context?.previousWatchlist) {
        queryClient.setQueryData(queryKey, context.previousWatchlist);
      }
      toast.error(error.message || 'Error al actualizar');
    },
    // Refetch para sincronizar
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  // Toggle watchlist (agregar o remover)
  const toggleWatchlist = useMutation({
    mutationFn: async (symbol: string): Promise<'added' | 'removed'> => {
      if (!user?.id) {
        throw new Error('Usuario no autenticado');
      }

      // Verificar si ya está en watchlist
      const { data: existing } = await supabase
        .from('watchlist')
        .select('id')
        .eq('user_id', user.id)
        .eq('symbol', symbol)
        .maybeSingle();

      if (existing) {
        // Remover
        const { error } = await supabase
          .from('watchlist')
          .delete()
          .eq('user_id', user.id)
          .eq('symbol', symbol);

        if (error) throw new Error('No se pudo eliminar de watchlist');
        return 'removed';
      } else {
        // ✅ VALIDAR LÍMITE DEL PLAN ANTES DE AGREGAR
        if (isAtLimit) {
          throw new Error(`Has alcanzado el límite de ${limit} activos en tu watchlist. Actualizá tu plan para agregar más.`);
        }

        // Agregar
        const result = await supabase
          .from('watchlist')
          .insert({
            user_id: user.id,
            symbol,
            notes: null,
          })
          .select()
          .single();

        if (result.error) {
          throw new Error(result.error.code === 'P0001' ? result.error.message : 'No se pudo agregar a watchlist');
        }
        return 'added';
      }
    },
    // ✨ OPTIMISTIC UPDATE: Toggle instantáneo
    onMutate: async (symbol) => {
      // Cancelar refetch en curso
      await queryClient.cancelQueries({ queryKey });

      // Snapshot del estado actual
      const previousWatchlist = queryClient.getQueryData<WatchlistItem[]>(queryKey);

      // Determinar acción optimista
      const currentWatchlist = previousWatchlist ?? [];
      const isInWatchlist = currentWatchlist.some(item => item.symbol === symbol);

      if (isInWatchlist) {
        // Remover optimistamente
        queryClient.setQueryData<WatchlistItem[]>(queryKey, (old = []) => 
          old.filter(item => item.symbol !== symbol)
        );
        toast.success(`${symbol} eliminado de watchlist`);
      } else {
        // Agregar optimistamente
        const optimisticItem: WatchlistItem = {
          id: `temp-${Date.now()}`,
          user_id: user?.id ?? '',
          symbol,
          notes: null,
          list_name: 'General',
          added_at: new Date().toISOString(),
        };
        queryClient.setQueryData<WatchlistItem[]>(queryKey, (old = []) => [optimisticItem, ...old]);
        toast.success(`${symbol} agregado a watchlist`);
      }

      // Retornar context para rollback
      return { previousWatchlist };
    },
    onSuccess: (action, symbol) => {
      void logger.info('WATCHLIST_TOGGLED', `Asset ${action} watchlist`, { symbol, action });
    },
    onError: (error: Error, _symbol, context) => {
      // Rollback: Restaurar estado anterior
      if (context?.previousWatchlist) {
        queryClient.setQueryData(queryKey, context.previousWatchlist);
      }
      toast.error(error.message || 'Error al actualizar watchlist');
      void logger.error('WATCHLIST_TOGGLE_ERROR', 'Error toggling watchlist', { error });
    },
    // Refetch para sincronizar
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  // Mover a otra lista
  const moveToList = useMutation({
    mutationFn: async ({ symbol, listName }: { symbol: string; listName: string }): Promise<void> => {
      if (!user?.id) {
        throw new Error('Usuario no autenticado');
      }
      const { error } = await supabase
        .from('watchlist')
        .update({ list_name: listName })
        .eq('user_id', user.id)
        .eq('symbol', symbol);
      if (error) {
        void logger.error('WATCHLIST_MOVE_ERROR', 'Error moving watchlist item', { error, symbol, listName });
        throw new Error('No se pudo mover el activo de lista');
      }
    },
    onMutate: async ({ symbol, listName }) => {
      await queryClient.cancelQueries({ queryKey });
      const previousWatchlist = queryClient.getQueryData<WatchlistItem[]>(queryKey);
      queryClient.setQueryData<WatchlistItem[]>(queryKey, (old = []) =>
        old.map(item => item.symbol === symbol ? { ...item, list_name: listName } : item)
      );
      return { previousWatchlist };
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previousWatchlist) {
        queryClient.setQueryData(queryKey, context.previousWatchlist);
      }
      toast.error(error.message);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    addToWatchlist,
    removeFromWatchlist,
    updateWatchlistItem,
    toggleWatchlist,
    moveToList,
  };
}
