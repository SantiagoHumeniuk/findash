// src/services/api/asset-api.ts

import { supabase } from '../../lib/supabase';
import { queryClient } from '../../lib/react-query';
import { logger } from '../../lib/logger';
import type { AssetData } from '../../types/dashboard';
import type { Config } from '../../types/config';
import type { Profile } from '../../types/auth';
import type { User } from '@supabase/supabase-js';
// The server counts each rebuild against the plan; this only avoids asking when the limit is reached.
import { hasApiCallsAvailable } from './apiLimiter';
import { toast } from 'sonner';
import { fetchYahooAsset, fetchYahooMarketQuotes, refreshYahooAssetQuote } from './yahoo-finance-api';
import {
    normalizeCachedYahooIndex,
    refreshAssetMarketQuoteFromYahoo,
    YAHOO_DATA_VERSION,
    YAHOO_MARKET_INDEX_SYMBOLS,
} from './yahoo-asset-builder';

export { YAHOO_DATA_VERSION };

function shouldRefreshYahooData(asset: AssetData, now: number): boolean {
    const attemptedAt = asset.yahooAttemptedAt ? Date.parse(asset.yahooAttemptedAt) : Number.NaN;
    const needsYahooData = asset.dataSource !== 'Yahoo Finance' ||
        (asset.yahooDataVersion ?? 1) < YAHOO_DATA_VERSION ||
        !asset.yahooMetrics ||
        Object.keys(asset.yahooMetrics).length === 0 ||
        (asset.yahooError !== null && asset.yahooError !== undefined);
    return needsYahooData &&
        (!Number.isFinite(attemptedAt) || now - attemptedAt >= 15 * 60 * 1000);
}

function shouldRefreshYahooQuote(asset: AssetData, now: number): boolean {
    const attemptedAt = asset.yahooQuoteAttemptedAt ? Date.parse(asset.yahooQuoteAttemptedAt) : Number.NaN;
    return !Number.isFinite(attemptedAt) || now - attemptedAt >= 2 * 60 * 1000;
}

const STALE_WHILE_REFRESH_MS = 24 * 60 * 60 * 1000;
const backgroundRefreshes = new Set<string>();

/** Runs one refresh per ticker and publishes its result to every view of that asset. */
function runInBackground(ticker: string, refresh: () => Promise<AssetData>): void {
    if (backgroundRefreshes.has(ticker)) return;
    backgroundRefreshes.add(ticker);
    void refresh()
        .then((asset) => queryClient.setQueriesData<AssetData>({ queryKey: ['assetData', ticker] }, asset))
        .catch((error: unknown) => {
            void logger.warn('YAHOO_BACKGROUND_REFRESH_FAILED', `Could not refresh ${ticker} in the background`, {
                ticker,
                errorMessage: error instanceof Error ? error.message : String(error),
            });
        })
        .finally(() => backgroundRefreshes.delete(ticker));
}

/** A visitor's fresh quote stays in the browser: only the server writes the shared cache. */
async function refreshVisitorQuote(ticker: string, cachedAsset: AssetData): Promise<AssetData> {
    const asset = { ...cachedAsset };
    const attemptedAt = new Date().toISOString();
    try {
        const response = await fetchYahooMarketQuotes([ticker]);
        const yahooQuote = response.quotes.find((item) => item.symbol === ticker.toUpperCase());
        if (yahooQuote && refreshAssetMarketQuoteFromYahoo(asset, yahooQuote, response.fetchedAt)) {
            asset.yahooQuoteAttemptedAt = response.fetchedAt;
        } else {
            asset.yahooQuoteAttemptedAt = attemptedAt;
            void logger.warn('YAHOO_MARKET_QUOTE_EMPTY', `Yahoo Finance returned no usable market quote for ${ticker}`, {
                ticker,
                errorMessage: yahooQuote?.error ?? 'Yahoo Finance no devolvió un precio y cierre previo válidos',
            });
        }
    } catch (error) {
        asset.yahooQuoteAttemptedAt = attemptedAt;
        void logger.warn('YAHOO_MARKET_QUOTE_FAILED', `Could not refresh the cached market quote for ${ticker}`, {
            ticker,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
        });
    }

    return asset;
}

export async function fetchTickerData({
    queryKey,
    forceRefresh = false,
    fromPortfolio = false,
}: {
    queryKey: [string, string, Config, User | null, Profile | null];
    forceRefresh?: boolean;
    fromPortfolio?: boolean;
}): Promise<AssetData> {
    const [, ticker, config, user, profile] = queryKey;

    // 1. Consultar caché de Supabase
    const { data: cached, error: cacheReadError } = await supabase
        .from('asset_data_cache')
        .select('data, last_updated_at')
        .eq('symbol', ticker)
        .maybeSingle();
    if (cacheReadError) {
        void logger.warn('ASSET_CACHE_READ_FAILED', `Could not read cached data for ${ticker}`, {
            ticker,
            errorMessage: cacheReadError.message,
        });
    }

    // Visitors without an account see what is already saved, with a fresh quote. Each uncached asset
    // costs about ten Yahoo requests, so only signed-in users (with their plan limits) can trigger them.
    if (!user) {
        const saved = cached?.data as AssetData | undefined;
        if (saved?.dataSource !== 'Yahoo Finance') {
            throw new Error('Creá tu cuenta gratis para analizar este activo.');
        }
        if (shouldRefreshYahooQuote(saved, Date.now())) {
            runInBackground(ticker, () => refreshVisitorQuote(ticker, saved));
        }
        return saved;
    }

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    if (
        !forceRefresh &&
        cached &&
        new Date(cached.last_updated_at as string) > twoHoursAgo &&
        (cached.data as AssetData).dataSource === 'Yahoo Finance'
    ) {
        const cachedAsset = cached.data as AssetData;
        normalizeCachedYahooIndex(cachedAsset);
        const shouldRefreshFundamentals = shouldRefreshYahooData(cachedAsset, Date.now());

        if (shouldRefreshFundamentals && await hasApiCallsAvailable(user, profile, config)) {
            try {
                const refreshedAsset = await fetchYahooAsset(ticker.trim().toUpperCase());
                return refreshedAsset;
            } catch (error) {
                const yahooError = error instanceof Error ? error.message : String(error);
                cachedAsset.yahooAttemptedAt = new Date().toISOString();
                cachedAsset.yahooError = yahooError;
                void logger.warn('YAHOO_SUPPLEMENT_FAILED', `Could not refresh cached Yahoo data for ${ticker}`, {
                    ticker,
                    errorMessage: yahooError,
                });
            }
        }

        // The saved data shows immediately; a newer quote replaces it when it arrives.
        if (shouldRefreshYahooQuote(cachedAsset, Date.now())) {
            runInBackground(ticker, () => refreshYahooAssetQuote(ticker.trim().toUpperCase()));
        }
        return cachedAsset;
    }

    // Fundamentals under a day old are still good: show them with a fresh quote (free) instead of a
    // rebuild in the background, which would spend the user's daily requests without them asking.
    if (
        !forceRefresh &&
        cached &&
        (cached.data as AssetData).dataSource === 'Yahoo Finance' &&
        ((cached.data as AssetData).yahooDataVersion ?? 1) >= YAHOO_DATA_VERSION &&
        Date.now() - new Date(cached.last_updated_at as string).getTime() < STALE_WHILE_REFRESH_MS
    ) {
        const cachedAsset = cached.data as AssetData;
        if (shouldRefreshYahooQuote(cachedAsset, Date.now())) {
            runInBackground(ticker, () => refreshYahooAssetQuote(ticker.trim().toUpperCase()));
        }
        return cachedAsset;
    }

    if (forceRefresh && cached && new Date(cached.last_updated_at as string) > twoHoursAgo) {
        toast.info(`Forzando actualización de ${ticker}...`, { duration: 2000 });
    }

    // 2. Verificar límites de API
    const hasApiAvailable = await hasApiCallsAvailable(user, profile, config);

    if (!hasApiAvailable) {
        if (cached?.data && (cached.data as AssetData).dataSource === 'Yahoo Finance') {
            const cacheDate = new Date(cached.last_updated_at as string);
            const hoursOld = Math.floor((Date.now() - cacheDate.getTime()) / (1000 * 60 * 60));
            toast.warning(`Límite de API de tu plan alcanzado. Usando datos de hace ${hoursOld}h.`);
            return cached.data as AssetData;
        }
        if (!fromPortfolio) {
            toast.error('Límite de API de tu plan alcanzado y sin datos en caché.');
        }
        throw new Error('Se alcanzó el límite diario de consultas del plan.');
    }

    const normalizedTicker = ticker.trim().toUpperCase();
    if (YAHOO_MARKET_INDEX_SYMBOLS.has(normalizedTicker)) {
        try {
            const indexData = await fetchYahooAsset(normalizedTicker);
            return indexData;
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Error desconocido';
            void logger.error('YAHOO_INDEX_FETCH_FAILED', `Could not load index data for ${normalizedTicker}`, {
                ticker: normalizedTicker,
                errorMessage: message,
            });
            if (cached?.data && (cached.data as AssetData).dataSource === 'Yahoo Finance') {
                return cached.data as AssetData;
            }
            throw new Error(`No se pudieron cargar los datos del índice ${normalizedTicker}.`);
        }
    }

    try {
        const yahooAsset = await fetchYahooAsset(normalizedTicker);
        return yahooAsset;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        void logger.error('YAHOO_ASSET_FETCH_FAILED', `Could not load Yahoo Finance data for ${normalizedTicker}`, {
            ticker: normalizedTicker,
            errorMessage: message,
        });
        if (cached?.data && (cached.data as AssetData).dataSource === 'Yahoo Finance') {
            toast.warning(`No se pudo actualizar ${normalizedTicker}. Se muestran datos guardados.`);
            return cached.data as AssetData;
        }
        if (!fromPortfolio) {
            toast.error(`Error al cargar ${normalizedTicker}`, { description: message });
        }
        throw error;
    }

}