// src/features/insights/hooks/use-insights-data.ts

import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { supabase } from '../../../lib/supabase';
import { useConfig } from '../../../hooks/use-config';
import { useAuth } from '../../../hooks/use-auth';
import type { InsightsData, InsightItem } from '../types/insights.types';
import type { AssetData } from '../../../types/dashboard';
import { toInsightItem, sortUndervalued, sortOvervalued } from '../lib/helpers';
import { usePlanFeature } from '../../../hooks/use-plan-feature';
import { useRiskPremiumQuery } from '../../risk-premium/hooks/use-risk-premium-query';

/**
 * Hook que arma las listas de insights a partir del cache, sin consumir API.
 * Usa gradesConsensus directamente de AssetData para recomendaciones de analistas.
 * Respeta límites por plan desde runtime config.
 */
export function useInsightsData() {
  const config = useConfig();
  const { profile } = useAuth();
  const role = profile?.role ?? 'basico';
  const insightsCfg = config.insights ?? {
    maxItems: { basico: 5, plus: 20, premium: 100, administrador: 1000 },
    updatedWithinHours: 168,
  };
  const maxItems: number = insightsCfg.maxItems[role] ?? 5;
  const { hasAccess: hasStockGrades } = usePlanFeature('stockGrades');
  const { data: riskPremiumData = [] } = useRiskPremiumQuery();
  const riskPremiumVersion = riskPremiumData
    .map(({ country, countryRiskPremium }) => `${country}:${countryRiskPremium}`)
    .join('|');

  const queryKey = React.useMemo(() => {
    return ['insights', role, maxItems, hasStockGrades, insightsCfg.updatedWithinHours, riskPremiumVersion] as const;
  }, [role, maxItems, hasStockGrades, insightsCfg.updatedWithinHours, riskPremiumVersion]);

  return useQuery<InsightsData>({
    queryKey,
    queryFn: async () => {
      const hours: number = insightsCfg.updatedWithinHours;
      const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

      // Traer filas recientes del cache (excluir stock_grades_)
      const { data, error } = await supabase
        .from('asset_data_cache')
        .select('symbol, data, last_updated_at')
        .gte('last_updated_at', cutoff)
        .not('symbol', 'like', 'stock_grades_%')
        .limit(5000);

      if (error) throw error;

      const allRows = (data ?? []) as { symbol: string; data: unknown; last_updated_at: string }[];

      // Procesar y filtrar AssetData válidos
      const isAssetData = (x: unknown): x is AssetData => {
        if (!x || typeof x !== 'object') return false;
        const obj = x as Record<string, unknown>;
        return 'quote' in obj && 'profile' in obj;
      };

      const items: InsightItem[] = [];
      
      for (const r of allRows) {
        const data = isAssetData(r.data) ? r.data : undefined;
        if (!data) continue;
        
        const item = toInsightItem(data, riskPremiumData);
        if (item) items.push(item);
      }

      // Rankings de valoración (DCF con sanity checks)
      const undervaluedAll = sortUndervalued(items);
      const overvaluedAll = sortOvervalued(items);

      // Rankings de analistas desde gradesConsensus
      const analystBySymbol: InsightItem[] = items
        .filter(item => {
          const assetData = allRows.find(r => r.symbol === item.symbol)?.data as AssetData | undefined;
          return assetData?.gradesConsensus !== undefined;
        })
        .map(item => {
          const assetData = allRows.find(r => r.symbol === item.symbol)?.data as AssetData | undefined;
          const consensus = assetData?.gradesConsensus;
          
          if (!consensus) return item;

          const strongBuy = consensus.strongBuy ?? 0;
          const buy = consensus.buy ?? 0;
          const hold = consensus.hold ?? 0;
          const sell = consensus.sell ?? 0;
          const strongSell = consensus.strongSell ?? 0;

          const total = strongBuy + buy + hold + sell + strongSell;
          const buyCount = strongBuy + buy;
          const sellCount = sell + strongSell;

          return {
            ...item,
            strongBuyCount: strongBuy,
            buyCount,
            holdCount: hold,
            sellCount,
            strongSellCount: strongSell,
            consensus: consensus.consensus ?? 'Neutral',
            buyRatio: total > 0 ? buyCount / total : 0,
            sellRatio: total > 0 ? sellCount / total : 0,
          };
        });

      const analystBuyAll = analystBySymbol
        .filter(i => (i.buyCount ?? 0) > 0)
        .sort((a, b) => {
          // Ordenar por número de recomendaciones de compra, luego por ratio
          const countDiff = (b.buyCount ?? 0) - (a.buyCount ?? 0);
          if (countDiff !== 0) return countDiff;
          return (b.buyRatio ?? 0) - (a.buyRatio ?? 0);
        });

      const analystSellAll = analystBySymbol
        .filter(i => (i.sellCount ?? 0) > 0)
        .sort((a, b) => {
          // Ordenar por número de recomendaciones de venta, luego por ratio
          const countDiff = (b.sellCount ?? 0) - (a.sellCount ?? 0);
          if (countDiff !== 0) return countDiff;
          return (b.sellRatio ?? 0) - (a.sellRatio ?? 0);
        });

      const analystLimit: number = hasStockGrades ? maxItems : Math.min(3, maxItems);

      return {
        undervalued: undervaluedAll.slice(0, maxItems),
        overvalued: overvaluedAll.slice(0, maxItems),
        analystBuys: analystBuyAll.slice(0, analystLimit),
        analystSells: analystSellAll.slice(0, analystLimit),
      } satisfies InsightsData;
    },
    staleTime: 5 * 60 * 1000,
  });
}
