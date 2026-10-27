// src/services/api/asset-api.ts

import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/logger';
import type {
    AssetData,
    AssetKeyMetrics,
    AssetQuote,
} from '../../types/dashboard';
import type { Config } from '../../types/config';
import type { Profile } from '../../types/auth';
import type { User } from '@supabase/supabase-js';
import { hasApiCallsAvailable, incrementApiCallCounter } from './apiLimiter';
import { toast } from 'sonner';
import { fetchYahooFinanceQuotes, fetchYahooMarketQuotes } from './yahoo-finance-api';
import type { YahooFinanceQuote } from './yahoo-finance-api';
import {
    mapYahooDailyChange,
    mapYahooHistory,
    mapYahooPercentChange,
    mapYahooPeriodChange,
} from './yahoo-finance-mappers';
import {
    buildAnalystEstimates,
    buildFinDashDcf,
    buildFinDashRating,
    buildGradesConsensus,
    buildGradeUpdates,
    buildPeerValuations,
    buildPriceTarget,
    buildPriceTargetConsensus,
    buildStockPriceChange,
    buildYahooFinancials,
} from './yahoo-fundamentals';

const YAHOO_MARKET_INDEX_SYMBOLS = new Set(['SPY', 'QQQ', 'DIA', 'IWM']);
/** Bump when createYahooAssetData adds fields so cached assets are rebuilt. */
export const YAHOO_DATA_VERSION = 2;

function getYahooMarketIndexName(symbol: string, fallback: string | null): string {
    const knownNames: Record<string, string> = {
        SPY: 'SPDR S&P 500 ETF Trust',
        QQQ: 'Invesco QQQ Trust',
        DIA: 'SPDR Dow Jones Industrial Average ETF',
        IWM: 'iShares Russell 2000 ETF',
    };
    return knownNames[symbol] ?? fallback ?? symbol;
}

function normalizeCachedYahooIndex(asset: AssetData): boolean {
    if (!YAHOO_MARKET_INDEX_SYMBOLS.has(asset.profile.symbol)) return false;

    const symbol = asset.profile.symbol;
    const changes = {
        image: '',
        companyName: getYahooMarketIndexName(symbol, asset.profile.companyName),
        quoteName: getYahooMarketIndexName(symbol, asset.quote.name),
        isEtf: true,
        monthChange: mapYahooPeriodChange(asset.historicalReturns, 1),
        yearChange: mapYahooPeriodChange(asset.historicalReturns, 12),
    };
    let updated = false;
    if (asset.profile.image !== changes.image) {
        asset.profile.image = changes.image;
        updated = true;
    }
    if (asset.profile.companyName !== changes.companyName) {
        asset.profile.companyName = changes.companyName;
        updated = true;
    }
    if (asset.quote.name !== changes.quoteName) {
        asset.quote.name = changes.quoteName;
        updated = true;
    }
    if (asset.profile.isEtf !== changes.isEtf) {
        asset.profile.isEtf = changes.isEtf;
        updated = true;
    }
    if (changes.monthChange !== null && asset.stockPriceChange['1M'] !== changes.monthChange) {
        asset.stockPriceChange['1M'] = changes.monthChange;
        updated = true;
    }
    if (changes.yearChange !== null && asset.stockPriceChange['1Y'] !== changes.yearChange) {
        asset.stockPriceChange['1Y'] = changes.yearChange;
        updated = true;
    }
    return updated;
}

function yahooValue(metric: YahooFinanceQuote['price'], fallback = 0): number {
    return metric.value !== null && Number.isFinite(metric.value) ? metric.value : fallback;
}

export function createYahooAssetData(
    symbol: string,
    yahoo: YahooFinanceQuote,
    fetchedAt: string,
    riskFreeRate: number | null = null,
): AssetData {
    const price = yahooValue(yahoo.price);
    const trailingPE = yahooValue(yahoo.trailingPE);
    const dailyChange = mapYahooDailyChange(yahoo.price.value, yahoo.previousClose.value);
    const yahooQuote: AssetQuote = {
        symbol,
        name: getYahooMarketIndexName(symbol, yahoo.name),
        price,
        changePercentage: dailyChange?.changePercent ?? mapYahooPercentChange(yahoo.changePercent.value),
        change: dailyChange?.change ?? yahooValue(yahoo.change),
        volume: yahooValue(yahoo.volume),
        dayLow: yahooValue(yahoo.dayLow),
        dayHigh: yahooValue(yahoo.dayHigh),
        yearHigh: yahooValue(yahoo.yearHigh),
        yearLow: yahooValue(yahoo.yearLow),
        marketCap: yahooValue(yahoo.marketCap),
        priceAvg50: yahooValue(yahoo.priceAvg50),
        priceAvg200: yahooValue(yahoo.priceAvg200),
        exchange: yahoo.exchange ?? '',
        open: yahooValue(yahoo.open),
        previousClose: yahooValue(yahoo.previousClose),
        timestamp: yahoo.marketTimestamp ?? 0,
        pe: trailingPE,
        forwardPE: yahooValue(yahoo.forwardPE),
        trailingEPS: yahooValue(yahoo.trailingEPS),
        forwardEPS: yahooValue(yahoo.forwardEPS),
    };
    const profile = {
        symbol,
        price,
        marketCap: yahooQuote.marketCap,
        beta: yahooValue(yahoo.beta),
        lastDividend: yahooValue(yahoo.lastDividend),
        range: yahoo.yearLow.value !== null && yahoo.yearHigh.value !== null
            ? `${yahooQuote.yearLow} - ${yahooQuote.yearHigh}`
            : '',
        change: yahooQuote.change,
        changePercentage: yahooQuote.changePercentage,
        volume: yahooQuote.volume,
        averageVolume: yahooValue(yahoo.averageVolume),
        companyName: getYahooMarketIndexName(symbol, yahoo.name),
        currency: yahoo.currency ?? 'USD',
        cik: '',
        isin: '',
        cusip: '',
        exchangeFullName: yahoo.exchange ?? '',
        exchange: yahoo.exchange ?? '',
        industry: yahoo.companyProfile.industry ?? '',
        website: yahoo.companyProfile.website ?? '',
        description: yahoo.companyProfile.description ?? 'Datos limitados disponibles para este activo.',
        ceo: yahoo.companyProfile.ceo ?? '',
        sector: yahoo.companyProfile.sector ?? '',
        country: yahoo.companyProfile.country ?? '',
        fullTimeEmployees: yahoo.companyProfile.employees !== null
            ? String(yahoo.companyProfile.employees)
            : '',
        phone: yahoo.companyProfile.phone ?? '',
        address: yahoo.companyProfile.address ?? '',
        city: yahoo.companyProfile.city ?? '',
        state: yahoo.companyProfile.state ?? '',
        zip: yahoo.companyProfile.zip ?? '',
        image: '',
        ipoDate: '',
        defaultImage: true,
        isEtf: yahoo.quoteType === 'ETF' || YAHOO_MARKET_INDEX_SYMBOLS.has(symbol),
        isActivelyTrading: true,
        isAdr: false,
        isFund: yahoo.quoteType === 'MUTUALFUND',
    };

    const financials = buildYahooFinancials(symbol, yahoo, yahooQuote.marketCap > 0 ? yahooQuote.marketCap : null);
    const keyMetrics: AssetKeyMetrics = {
        symbol,
        marketCap: yahooQuote.marketCap,
        enterpriseValueTTM: null,
        evToSalesTTM: null,
        evToOperatingCashFlowTTM: null,
        evToFreeCashFlowTTM: null,
        evToEBITDATTM: null,
        netDebtToEBITDATTM: null,
        currentRatioTTM: null,
        incomeQualityTTM: null,
        grahamNumberTTM: null,
        grahamNetNetTTM: null,
        taxBurdenTTM: null,
        interestBurdenTTM: null,
        workingCapitalTTM: null,
        investedCapitalTTM: null,
        returnOnAssetsTTM: null,
        operatingReturnOnAssetsTTM: null,
        returnOnTangibleAssetsTTM: null,
        returnOnEquityTTM: null,
        returnOnInvestedCapitalTTM: null,
        returnOnCapitalEmployedTTM: null,
        earningsYieldTTM: null,
        freeCashFlowYieldTTM: null,
        capexToOperatingCashFlowTTM: null,
        capexToDepreciationTTM: null,
        capexToRevenueTTM: null,
        salesGeneralAndAdministrativeToRevenueTTM: null,
        researchAndDevelopementToRevenueTTM: null,
        stockBasedCompensationToRevenueTTM: null,
        intangiblesToTotalAssetsTTM: null,
        averageReceivablesTTM: null,
        averagePayablesTTM: null,
        averageInventoryTTM: null,
        daysOfSalesOutstandingTTM: null,
        daysOfPayablesOutstandingTTM: null,
        daysOfInventoryOutstandingTTM: null,
        operatingCycleTTM: null,
        cashConversionCycleTTM: null,
        freeCashFlowToEquityTTM: null,
        freeCashFlowToFirmTTM: null,
        tangibleAssetValueTTM: null,
        netCurrentAssetValueTTM: null,
        ...financials.keyMetricsTTM,
    };
    keyMetrics.earningsYieldTTM ??= trailingPE > 0 ? 1 / trailingPE : null;
    keyMetrics.returnOnEquityTTM ??= yahoo.metrics['financialData.returnOnEquity'] ?? null;
    keyMetrics.returnOnAssetsTTM ??= yahoo.metrics['financialData.returnOnAssets'] ?? null;

    const { dcf, dcfLevered } = buildFinDashDcf({
        symbol,
        price,
        beta: yahoo.beta.value,
        riskFreeRate,
        financials,
        quote: yahoo,
    });
    const dcfValuePerShare = dcf[0]?.equityValuePerShare ?? (dcfLevered.dcf > 0 ? dcfLevered.dcf : null);

    return {
        symbol,
        profile,
        keyMetrics,
        quote: yahooQuote,
        historicalReturns: mapYahooHistory(symbol, yahoo.history),
        priceTarget: buildPriceTarget(symbol, yahoo.analyst),
        dcf,
        rating: buildFinDashRating(symbol, financials.ratios[0], dcfValuePerShare, price),
        priceTargetConsensus: buildPriceTargetConsensus(symbol, yahoo.metrics),
        keyMetricsYearly: financials.keyMetricsYearly,
        dcfLevered,
        stockPriceChange: buildStockPriceChange(
            symbol,
            yahoo.history,
            price,
            dailyChange?.changePercent ?? yahoo.changePercent.value,
        ),
        ratios: financials.ratios,
        analystEstimates: buildAnalystEstimates(symbol, yahoo.analyst),
        gradesConsensus: buildGradesConsensus(
            symbol,
            yahoo.analyst,
            yahoo.metrics['financialData.recommendationMean'] ?? null,
        ),
        peerValuations: buildPeerValuations(yahoo.peers),
        analystGradeUpdates: buildGradeUpdates(symbol, yahoo.analyst),
        dataSource: 'Yahoo Finance',
        yahooDataVersion: YAHOO_DATA_VERSION,
        fundamentalsSource: yahoo.fundamentals.source,
        dataFetchedAt: fetchedAt,
        yahooMetrics: yahoo.metrics,
        yahooAttemptedAt: fetchedAt,
        yahooQuoteAttemptedAt: fetchedAt,
        yahooError: yahoo.error,
    };
}

function refreshAssetMarketQuoteFromYahoo(
    asset: AssetData,
    yahoo: YahooFinanceQuote,
    fetchedAt: string,
): boolean {
    const price = yahoo.price.value;
    if (price === null || !Number.isFinite(price) || price <= 0) return false;
    const dailyChange = mapYahooDailyChange(price, yahoo.previousClose.value);
    asset.quote = {
        ...asset.quote,
        price,
        change: dailyChange?.change ?? yahooValue(yahoo.change, asset.quote.change),
        changePercentage: dailyChange?.changePercent ??
            (yahoo.changePercent.value !== null
                ? mapYahooPercentChange(yahoo.changePercent.value)
                : asset.quote.changePercentage),
        volume: yahooValue(yahoo.volume, asset.quote.volume),
        dayLow: yahooValue(yahoo.dayLow, asset.quote.dayLow),
        dayHigh: yahooValue(yahoo.dayHigh, asset.quote.dayHigh),
        open: yahooValue(yahoo.open, asset.quote.open),
        previousClose: yahooValue(yahoo.previousClose, asset.quote.previousClose),
        timestamp: yahoo.marketTimestamp ?? asset.quote.timestamp,
    };
    asset.profile = {
        ...asset.profile,
        price,
        change: asset.quote.change,
        changePercentage: asset.quote.changePercentage,
        volume: asset.quote.volume,
    };
    asset.yahooQuoteAttemptedAt = fetchedAt;
    return true;
}

function hasUsableYahooData(quote: YahooFinanceQuote): boolean {
    return quote.price.value !== null && Number.isFinite(quote.price.value) && quote.price.value > 0;
}

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
        .single();
    if (cacheReadError && cacheReadError.code !== 'PGRST116') {
        void logger.warn('ASSET_CACHE_READ_FAILED', `Could not read cached data for ${ticker}`, {
            ticker,
            errorMessage: cacheReadError.message,
        });
    }

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    if (
        !forceRefresh &&
        cached &&
        new Date(cached.last_updated_at as string) > twoHoursAgo &&
        (cached.data as AssetData).dataSource === 'Yahoo Finance'
    ) {
        const cachedAsset = cached.data as AssetData;
        if (normalizeCachedYahooIndex(cachedAsset)) {
            const { error: cacheError } = await supabase.from('asset_data_cache').upsert({
                symbol: ticker,
                data: cachedAsset,
                last_updated_at: cached.last_updated_at,
            });
            if (cacheError) {
                void logger.warn('ASSET_CACHE_WRITE_FAILED', `Could not update cached index metadata for ${ticker}`, {
                    ticker,
                    errorMessage: cacheError.message,
                });
            }
        }
        const shouldRefreshFundamentals = shouldRefreshYahooData(cachedAsset, Date.now());

        if (shouldRefreshFundamentals && await hasApiCallsAvailable(user, profile, config)) {
            const attemptedAt = new Date().toISOString();
            try {
                const response = await fetchYahooFinanceQuotes([ticker]);
                const yahooQuote = response.quotes.find((item) => item.symbol === ticker.toUpperCase());
                if (yahooQuote && hasUsableYahooData(yahooQuote)) {
                    const refreshedAsset = createYahooAssetData(
                        ticker.trim().toUpperCase(),
                        yahooQuote,
                        response.fetchedAt,
                        response.riskFreeRate,
                    );
                    if (user?.id) await incrementApiCallCounter(user.id);
                    const { error: cacheError } = await supabase.from('asset_data_cache').upsert({
                        symbol: ticker,
                        data: refreshedAsset,
                        last_updated_at: refreshedAsset.dataFetchedAt,
                    });
                    if (cacheError) {
                        void logger.warn('ASSET_CACHE_WRITE_FAILED', `Could not cache Yahoo data for ${ticker}`, {
                            ticker,
                            errorMessage: cacheError.message,
                        });
                    }
                    return refreshedAsset;
                }

                const yahooError = yahooQuote?.error ?? 'Yahoo Finance no devolvió métricas ni cotización utilizables';
                cachedAsset.yahooAttemptedAt = attemptedAt;
                cachedAsset.yahooError = yahooError;
                void logger.warn('YAHOO_SUPPLEMENT_EMPTY', `Yahoo Finance returned no usable data for ${ticker}`, {
                    ticker,
                    errorMessage: yahooError,
                });
            } catch (error) {
                const yahooError = error instanceof Error ? error.message : String(error);
                cachedAsset.yahooAttemptedAt = attemptedAt;
                cachedAsset.yahooError = yahooError;
                void logger.warn('YAHOO_SUPPLEMENT_FAILED', `Could not refresh cached Yahoo data for ${ticker}`, {
                    ticker,
                    errorMessage: yahooError,
                });
            }

            const { error: cacheError } = await supabase.from('asset_data_cache').upsert({
                symbol: ticker,
                data: cachedAsset,
                last_updated_at: cached.last_updated_at,
            });
            if (cacheError) {
                void logger.warn('ASSET_CACHE_WRITE_FAILED', `Could not cache Yahoo refresh status for ${ticker}`, {
                    ticker,
                    errorMessage: cacheError.message,
                });
            }
        }

        if (shouldRefreshYahooQuote(cachedAsset, Date.now())) {
            const attemptedAt = new Date().toISOString();
            try {
                const response = await fetchYahooMarketQuotes([ticker]);
                const yahooQuote = response.quotes.find((item) => item.symbol === ticker.toUpperCase());
                if (yahooQuote && refreshAssetMarketQuoteFromYahoo(cachedAsset, yahooQuote, response.fetchedAt)) {
                    cachedAsset.yahooQuoteAttemptedAt = response.fetchedAt;
                } else {
                    cachedAsset.yahooQuoteAttemptedAt = attemptedAt;
                    void logger.warn('YAHOO_MARKET_QUOTE_EMPTY', `Yahoo Finance returned no usable market quote for ${ticker}`, {
                        ticker,
                        errorMessage: yahooQuote?.error ?? 'Yahoo Finance no devolvió un precio y cierre previo válidos',
                    });
                }
            } catch (error) {
                cachedAsset.yahooQuoteAttemptedAt = attemptedAt;
                void logger.warn('YAHOO_MARKET_QUOTE_FAILED', `Could not refresh the cached market quote for ${ticker}`, {
                    ticker,
                    errorMessage: error instanceof Error ? error.message : 'Unknown error',
                });
            }

            const { error: cacheError } = await supabase.from('asset_data_cache').upsert({
                symbol: ticker,
                data: cachedAsset,
                last_updated_at: cached.last_updated_at,
            });
            if (cacheError) {
                void logger.warn('ASSET_CACHE_WRITE_FAILED', `Could not cache Yahoo market quote for ${ticker}`, {
                    ticker,
                    errorMessage: cacheError.message,
                });
            }
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
            const response = await fetchYahooFinanceQuotes([normalizedTicker]);
            const quote = response.quotes.find((item) => item.symbol === normalizedTicker);
            if (!quote) throw new Error(`Yahoo Finance no devolvió datos para ${normalizedTicker}.`);
            if (quote.price.value === null || !Number.isFinite(quote.price.value) || quote.price.value <= 0) {
                throw new Error(quote.error ?? `Yahoo Finance no devolvió una cotización válida para ${normalizedTicker}.`);
            }

            const indexData = createYahooAssetData(normalizedTicker, quote, response.fetchedAt, response.riskFreeRate);
            if (user?.id) await incrementApiCallCounter(user.id);
            const { error: cacheError } = await supabase.from('asset_data_cache').upsert({
                symbol: normalizedTicker,
                data: indexData,
                last_updated_at: indexData.dataFetchedAt,
            });
            if (cacheError) {
                void logger.warn('ASSET_CACHE_WRITE_FAILED', `Could not cache Yahoo index data for ${normalizedTicker}`, {
                    ticker: normalizedTicker,
                    errorMessage: cacheError.message,
                });
            }
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
        const response = await fetchYahooFinanceQuotes([normalizedTicker]);
        const quote = response.quotes.find((item) => item.symbol === normalizedTicker);
        if (!quote || !hasUsableYahooData(quote)) {
            throw new Error(quote?.error ?? `Yahoo Finance no devolvió una cotización válida para ${normalizedTicker}.`);
        }

        const yahooAsset = createYahooAssetData(normalizedTicker, quote, response.fetchedAt, response.riskFreeRate);
        if (user?.id) await incrementApiCallCounter(user.id);
        const { error: cacheError } = await supabase.from('asset_data_cache').upsert({
            symbol: normalizedTicker,
            data: yahooAsset,
            last_updated_at: yahooAsset.dataFetchedAt,
        });
        if (cacheError) {
            void logger.warn('ASSET_CACHE_WRITE_FAILED', `Could not cache Yahoo data for ${normalizedTicker}`, {
                ticker: normalizedTicker,
                errorMessage: cacheError.message,
            });
        }
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