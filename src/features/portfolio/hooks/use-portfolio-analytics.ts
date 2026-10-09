// src/features/portfolio/hooks/use-portfolio-analytics.ts

import { usePortfolio } from '../../../hooks/use-portfolio';
import { AssetData } from '../../../types/dashboard';
import { useMemo } from 'react';

/**
 * Builds sector and country allocations from the portfolio's already-loaded asset data.
 */
export function usePortfolioAnalytics() {
    const { holdings, loading: portfolioLoading } = usePortfolio();

    const analyticsData = useMemo(() => {
        if (portfolioLoading) return null;
        const assets = holdings
            .map(holding => holding.assetData)
            .filter((asset): asset is AssetData => !!asset);

        const assetMap = new Map<string, AssetData>();
        assets.forEach(a => {
            if (a.profile?.symbol) assetMap.set(a.profile.symbol, a);
        });

        const sectorAllocation: Record<string, number> = {};
        const countryAllocation: Record<string, number> = {};
        let totalValueAnalyzed = 0;

        holdings.forEach(h => {
            const asset = assetMap.get(h.symbol);
            // Si no tenemos datos completos, intentamos usar datos básicos del holding si existen
            const currentPrice = asset?.quote?.price ?? asset?.profile?.price ?? h.assetData.quote?.price ?? 0;

            const value = h.quantity * currentPrice;
            totalValueAnalyzed += value;

            // Datos de perfil
            const sector = asset?.profile?.sector ?? 'Otros';
            const country = asset?.profile?.country ?? 'Otros';

            sectorAllocation[sector] = (sectorAllocation[sector] || 0) + value;
            countryAllocation[country] = (countryAllocation[country] || 0) + value;
        });

        const formatData = (map: Record<string, number>) => {
            return Object.entries(map)
                .map(([name, value]) => ({
                    name,
                    value,
                    percentage: totalValueAnalyzed > 0 ? (value / totalValueAnalyzed) * 100 : 0
                }))
                .sort((a, b) => b.value - a.value);
        };

        const result = {
            sectorAllocation: formatData(sectorAllocation),
            countryAllocation: formatData(countryAllocation),
            totalValue: totalValueAnalyzed,
            assetsLoaded: assets.length,
            totalAssets: holdings.length
        };

        return result;
    }, [holdings, portfolioLoading]);

    return {
        data: analyticsData,
        isLoading: portfolioLoading
    };
}