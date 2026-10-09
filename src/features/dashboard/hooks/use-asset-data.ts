// src/features/dashboard/hooks/use-asset-data.ts

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../hooks/use-auth';
import { useConfig } from '../../../hooks/use-config';
import { fetchTickerData } from '../../../services/api/asset-api';
import { AssetData } from '../../../types/dashboard';

export function useAssetData(ticker: string) {
  const { user, profile } = useAuth();
  const config = useConfig();

  const userId = user?.id ?? null;
  const profileId = profile?.id ?? null;
  const useMockData = config?.useMockData ?? false;
  const queryClient = useQueryClient();
  const queryKey = ['assetData', ticker, userId, profileId, useMockData] as const;

  // Asegurar que la configuración está lista antes de intentar fetch
  const isConfigReady = !!config && !!config.api;

  const assetQuery = useQuery<AssetData, Error, AssetData, readonly [string, string, string | null, string | null, boolean]>({
    queryKey,

    queryFn: async () => {
      if (!config) throw new Error("Config not ready");
      return fetchTickerData({ queryKey: ['assetData', ticker, config, user, profile] });
    },

    enabled: !!ticker && ticker.length > 0 && isConfigReady,

    // Caché robusta para evitar recargas al cambiar de vista
    staleTime: 1000 * 60 * 10, // 10 mins
    gcTime: 1000 * 60 * 30, // 30 mins

    refetchOnWindowFocus: true,
    refetchOnMount: false, // Si está en caché, no recargar
    refetchOnReconnect: false,

    retry: 2,
    retryDelay: 1000,
  });

  const refreshAssetData = () => {
    if (!config) throw new Error('Config not ready');

    return queryClient.fetchQuery({
      queryKey,
      queryFn: () => fetchTickerData({
        queryKey: ['assetData', ticker, config, user, profile],
        forceRefresh: true,
      }),
      staleTime: 0,
    });
  };

  return { ...assetQuery, refreshAssetData };
}