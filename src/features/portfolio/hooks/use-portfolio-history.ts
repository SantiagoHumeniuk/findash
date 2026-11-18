import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AssetHistorical } from '../../../types/dashboard';
import type { Holding } from '../../../types/portfolio';
import { fetchYahooHistory } from '../../../services/api/yahoo-finance-api';
import { mapYahooHistory } from '../../../services/api/yahoo-finance-mappers';
import { calculatePerformanceMetrics, type PerformanceMetrics } from '../../../utils/performance-metrics';

interface FetchedLocalHistory {
    history: AssetHistorical[];
    currency: string | null;
    error?: string;
}

export type LocalHistoryBySymbol = Record<string, FetchedLocalHistory>;

interface PortfolioHistoryResult {
    portfolioHistory: AssetHistorical[];
    historyCoveragePercent: number;
    historyUnavailableSymbols: string[];
}

/**
 * Reconstructs the current holdings over the dates where each included asset has historical prices.
 * Local-stock Yahoo prices in ARS are converted at the current CCL; historical FX changes are not modeled.
 */
export function buildPortfolioHistory(
    holdings: Holding[],
    fetchedLocalHistory: LocalHistoryBySymbol = {},
): PortfolioHistoryResult {
    const totalCurrentValue = holdings.reduce((total, holding) => {
        const price = holding.assetData?.quote?.price ?? 0;
        return total + holding.quantity * (Number.isFinite(price) ? price : 0);
    }, 0);

    const histories = holdings.flatMap((holding) => {
        const savedHistory = holding.assetData?.historicalReturns ?? [];
        const localMarket = holding.assetData?.localMarket;
        const fetched = localMarket?.kind === 'stock' && savedHistory.length < 2
            ? fetchedLocalHistory[holding.symbol]
            : undefined;
        const sourceHistory = savedHistory.length >= 2 ? savedHistory : fetched?.history ?? [];
        const shouldConvertFromArs = fetched !== undefined && fetched.currency?.toUpperCase() !== 'USD';
        const ccl = localMarket?.ccl ?? 0;

        if (shouldConvertFromArs && !(ccl > 0)) return [];

        const pointsByDate = new Map<string, AssetHistorical>();
        for (const point of sourceHistory) {
            const date = point.date.slice(0, 10);
            const close = shouldConvertFromArs ? point.close / ccl : point.close;
            if (!date || !Number.isFinite(Date.parse(date)) || !Number.isFinite(close) || close <= 0) continue;
            pointsByDate.set(date, { ...point, date, close });
        }
        const history = [...pointsByDate.values()].sort((a, b) => a.date.localeCompare(b.date));
        if (history.length < 2) return [];

        return [{ holding, history }];
    });

    const includedSymbols = new Set(histories.map(({ holding }) => holding.symbol));
    const historyUnavailableSymbols = holdings
        .filter((holding) => !includedSymbols.has(holding.symbol))
        .map(({ symbol }) => symbol);
    const coveredCurrentValue = histories.reduce((total, { holding }) => {
        const price = holding.assetData?.quote?.price ?? 0;
        return total + holding.quantity * (Number.isFinite(price) ? price : 0);
    }, 0);
    const historyCoveragePercent = totalCurrentValue > 0
        ? Math.min(100, (coveredCurrentValue / totalCurrentValue) * 100)
        : 0;

    if (histories.length === 0) {
        return { portfolioHistory: [], historyCoveragePercent, historyUnavailableSymbols };
    }

    const dates = [...new Set(histories.flatMap(({ history }) => history.map(({ date }) => date)))]
        .sort((a, b) => a.localeCompare(b));
    const latestStartDate = histories.reduce(
        (latest, { history }) => Math.max(latest, Date.parse(history[0].date)),
        -Infinity,
    );
    const cursors = histories.map(() => 0);
    const portfolioHistory: AssetHistorical[] = [];

    for (const date of dates) {
        if (Date.parse(date) < latestStartDate) continue;

        let totalValue = 0;
        let hasPriceForEveryIncludedHolding = true;
        histories.forEach(({ holding, history }, index) => {
            while (cursors[index] + 1 < history.length && history[cursors[index] + 1].date <= date) {
                cursors[index] += 1;
            }
            const point = history[cursors[index]];
            if (point.date > date) {
                hasPriceForEveryIncludedHolding = false;
                return;
            }
            totalValue += holding.quantity * point.close;
        });

        if (!hasPriceForEveryIncludedHolding) continue;
        portfolioHistory.push({
            symbol: 'PORTFOLIO',
            date,
            close: totalValue,
            open: totalValue,
            high: totalValue,
            low: totalValue,
            volume: 0,
            change: 0,
            changePercent: 0,
            vwap: totalValue,
        });
    }

    return { portfolioHistory, historyCoveragePercent, historyUnavailableSymbols };
}

/** Builds a historical series for the current holdings, including local shares when Yahoo history is available. */
export function usePortfolioHistory(holdings: Holding[]) {
    const localStockSymbols = useMemo(
        () => [...new Set(
            holdings
                .filter((holding) =>
                    holding.assetData?.localMarket?.kind === 'stock' &&
                    (holding.assetData?.historicalReturns?.length ?? 0) < 2,
                )
                .map(({ symbol }) => symbol),
        )].sort(),
        [holdings],
    );
    const localHistoryQuery = useQuery({
        queryKey: ['portfolio-local-history', localStockSymbols] as const,
        enabled: localStockSymbols.length > 0,
        staleTime: 60 * 60 * 1000,
        queryFn: async ({ queryKey: [, symbols] }): Promise<LocalHistoryBySymbol> => {
            const results = await Promise.all(symbols.map(async (symbol) => {
                try {
                    const response = await fetchYahooHistory(symbol, '5y', '1wk');
                    return [symbol, {
                        history: mapYahooHistory(symbol, response.history),
                        currency: response.currency,
                    }] as const;
                } catch (error) {
                    return [symbol, {
                        history: [],
                        currency: null,
                        error: error instanceof Error ? error.message : 'Error desconocido',
                    }] as const;
                }
            }));
            return Object.fromEntries(results);
        },
    });

    const historyResult = useMemo(
        () => buildPortfolioHistory(holdings, localHistoryQuery.data),
        [holdings, localHistoryQuery.data],
    );
    const metrics: PerformanceMetrics = useMemo(
        () => calculatePerformanceMetrics(historyResult.portfolioHistory),
        [historyResult.portfolioHistory],
    );

    return {
        ...historyResult,
        metrics,
        isLoading: localHistoryQuery.isLoading,
    };
}
