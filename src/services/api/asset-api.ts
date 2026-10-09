// src/services/api/asset-api.ts

import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/logger';
import { processAssetData } from '../data/asset-processor';
import type {
    AssetAnalystGradeUpdate,
    AssetData,
    AssetGeography,
    AssetKeyMetrics,
    AssetPeerValuation,
    AssetProduction,
    AssetQuote,
    AssetRating,
} from '../../types/dashboard';
import type { Config } from '../../types/config';
import type { Profile } from '../../types/auth';
import type { User } from '@supabase/supabase-js';
import { hasApiCallsAvailable, incrementApiCallCounter } from './apiLimiter';
import { toast } from 'sonner';
import { fetchYahooFinanceQuotes } from './yahoo-finance-api';
import type { YahooFinanceQuote } from './yahoo-finance-api';
import { mapYahooHistory, mapYahooPercentChange } from './yahoo-finance-mappers';

/**
 * Helper para crear promesas de request con timeout.
 */
function makeRequest(path: string, ticker: string, extraParams = '') {
    return Promise.race([
        supabase.functions.invoke('fmp-proxy', {
            body: { endpointPath: `${path}?symbol=${ticker}${extraParams}` }
        }),
        new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout - el servidor tardó demasiado en responder')), 20000)
        )
    ]);
}

const MAX_PEER_VALUATIONS = 5;

interface YahooSupplementResult {
    response: Awaited<ReturnType<typeof fetchYahooFinanceQuotes>> | null;
    error: Error | null;
}

function yahooValue(metric: YahooFinanceQuote['price'], fallback = 0): number {
    return metric.value !== null && Number.isFinite(metric.value) ? metric.value : fallback;
}

export function createYahooAssetData(
    symbol: string,
    yahoo: YahooFinanceQuote,
    fetchedAt: string,
): AssetData {
    const price = yahooValue(yahoo.price);
    const trailingPE = yahooValue(yahoo.trailingPE);
    const yahooQuote: AssetQuote = {
        symbol,
        name: yahoo.name ?? symbol,
        price,
        changePercentage: mapYahooPercentChange(yahoo.changePercent.value),
        change: yahooValue(yahoo.change),
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
            : 'N/A',
        change: yahooQuote.change,
        changePercentage: yahooQuote.changePercentage,
        volume: yahooQuote.volume,
        averageVolume: yahooValue(yahoo.averageVolume),
        companyName: yahoo.name ?? symbol,
        currency: yahoo.currency ?? 'USD',
        cik: '',
        isin: '',
        cusip: '',
        exchangeFullName: yahoo.exchange ?? '',
        exchange: yahoo.exchange ?? '',
        industry: yahoo.companyProfile.industry ?? '',
        website: yahoo.companyProfile.website ?? '',
        description: yahoo.companyProfile.description ?? 'Datos limitados obtenidos de Yahoo Finance; FMP no está disponible.',
        ceo: '',
        sector: yahoo.companyProfile.sector ?? '',
        country: yahoo.companyProfile.country ?? '',
        fullTimeEmployees: yahoo.companyProfile.employees !== null
            ? String(yahoo.companyProfile.employees)
            : '',
        phone: '',
        address: '',
        city: '',
        state: '',
        zip: '',
        image: '',
        ipoDate: '',
        defaultImage: true,
        isEtf: false,
        isActivelyTrading: true,
        isAdr: false,
        isFund: false,
    };

    const keyMetrics: AssetKeyMetrics = {
        symbol,
        marketCap: yahooQuote.marketCap,
        enterpriseValueTTM: 0,
        evToSalesTTM: 0,
        evToOperatingCashFlowTTM: 0,
        evToFreeCashFlowTTM: 0,
        evToEBITDATTM: 0,
        netDebtToEBITDATTM: 0,
        currentRatioTTM: 0,
        incomeQualityTTM: 0,
        grahamNumberTTM: 0,
        grahamNetNetTTM: 0,
        taxBurdenTTM: 0,
        interestBurdenTTM: 0,
        workingCapitalTTM: 0,
        investedCapitalTTM: 0,
        returnOnAssetsTTM: 0,
        operatingReturnOnAssetsTTM: 0,
        returnOnTangibleAssetsTTM: 0,
        returnOnEquityTTM: 0,
        returnOnInvestedCapitalTTM: 0,
        returnOnCapitalEmployedTTM: 0,
        earningsYieldTTM: trailingPE > 0 ? 1 / trailingPE : 0,
        freeCashFlowYieldTTM: 0,
        capexToOperatingCashFlowTTM: 0,
        capexToDepreciationTTM: 0,
        capexToRevenueTTM: 0,
        salesGeneralAndAdministrativeToRevenueTTM: 0,
        researchAndDevelopementToRevenueTTM: 0,
        stockBasedCompensationToRevenueTTM: 0,
        intangiblesToTotalAssetsTTM: 0,
        averageReceivablesTTM: 0,
        averagePayablesTTM: 0,
        averageInventoryTTM: 0,
        daysOfSalesOutstandingTTM: 0,
        daysOfPayablesOutstandingTTM: 0,
        daysOfInventoryOutstandingTTM: 0,
        operatingCycleTTM: 0,
        cashConversionCycleTTM: 0,
        freeCashFlowToEquityTTM: 0,
        freeCashFlowToFirmTTM: 0,
        tangibleAssetValueTTM: 0,
        netCurrentAssetValueTTM: 0,
    };

    const emptyGeographicData: AssetGeography = {
        symbol,
        fiscalYear: 0,
        period: '',
        reportedCurrency: yahoo.currency ?? 'USD',
        date: '',
        data: {},
    };
    const emptyProductionData: AssetProduction = { ...emptyGeographicData };
    const emptyRating: AssetRating = {
        symbol,
        rating: '',
        overallScore: 0,
        discountedCashFlowScore: 0,
        returnOnEquityScore: 0,
        returnOnAssetsScore: 0,
        debtToEquityScore: 0,
        priceToEarningsScore: 0,
        priceToBookScore: 0,
    };

    return {
        symbol,
        profile,
        keyMetrics,
        quote: yahooQuote,
        historicalReturns: mapYahooHistory(symbol, yahoo.history),
        priceTarget: {
            symbol,
            lastMonthCount: 0,
            lastMonthAvgPriceTarget: 0,
            lastQuarterCount: 0,
            lastQuarterAvgPriceTarget: 0,
            lastYearCount: 0,
            lastYearAvgPriceTarget: 0,
            allTimeCount: 0,
            allTimeAvgPriceTarget: 0,
            publishers: [],
        },
        dcf: [],
        rating: emptyRating,
        geography: emptyGeographicData,
        production: emptyProductionData,
        priceTargetConsensus: {
            symbol,
            targetHigh: 0,
            targetLow: 0,
            targetConsensus: 0,
            targetMedian: 0,
        },
        keyMetricsYearly: [],
        dcfLevered: { symbol, date: '', dcf: 0, 'Stock Price': price },
        stockPriceChange: {
            symbol,
            '1D': 0,
            '5D': 0,
            '1M': 0,
            '3M': 0,
            '6M': 0,
            ytd: 0,
            '1Y': 0,
            '3Y': 0,
            '5Y': 0,
            '10Y': 0,
            max: 0,
        },
        ratios: [],
        analystEstimates: [],
        gradesConsensus: {
            symbol,
            strongBuy: 0,
            buy: 0,
            hold: 0,
            sell: 0,
            strongSell: 0,
            consensus: '',
        },
        peerValuations: [],
        analystGradeUpdates: [],
        dataSource: 'Yahoo Finance',
        dataFetchedAt: fetchedAt,
        yahooMetrics: yahoo.metrics,
        yahooAttemptedAt: fetchedAt,
        yahooError: yahoo.error,
    };
}

function enrichAssetWithYahoo(
    asset: AssetData,
    yahoo: YahooFinanceQuote,
    fetchedAt: string,
): AssetData {
    const yahooTimestamp = yahoo.marketTimestamp ?? 0;
    const rawFmpTimestamp = asset.quote.timestamp ?? 0;
    const fmpTimestamp = rawFmpTimestamp > 1_000_000_000_000
        ? Math.floor(rawFmpTimestamp / 1000)
        : rawFmpTimestamp;
    const yahooIsNewer = yahooTimestamp > 0 && yahooTimestamp > fmpTimestamp;
    const metric = (value: YahooFinanceQuote['price']) => value.value;
    const prefer = (current: number, value: YahooFinanceQuote['price']) =>
        value.value ?? current;
    const trailingPE = yahoo.trailingPE.value;
    const earningsYield = trailingPE !== null && trailingPE > 0 ? 1 / trailingPE : null;

    if (yahooIsNewer && metric(yahoo.price) !== null) {
        asset.quote = {
            ...asset.quote,
            price: prefer(asset.quote.price, yahoo.price),
            change: prefer(asset.quote.change, yahoo.change),
            changePercentage: yahoo.changePercent.value !== null
                ? mapYahooPercentChange(yahoo.changePercent.value)
                : asset.quote.changePercentage,
            volume: prefer(asset.quote.volume, yahoo.volume),
            dayLow: prefer(asset.quote.dayLow, yahoo.dayLow),
            dayHigh: prefer(asset.quote.dayHigh, yahoo.dayHigh),
            yearLow: prefer(asset.quote.yearLow, yahoo.yearLow),
            yearHigh: prefer(asset.quote.yearHigh, yahoo.yearHigh),
            priceAvg50: prefer(asset.quote.priceAvg50, yahoo.priceAvg50),
            priceAvg200: prefer(asset.quote.priceAvg200, yahoo.priceAvg200),
            open: prefer(asset.quote.open, yahoo.open),
            previousClose: prefer(asset.quote.previousClose, yahoo.previousClose),
            timestamp: yahooTimestamp,
        };
        asset.profile = {
            ...asset.profile,
            price: asset.quote.price,
            change: asset.quote.change,
            changePercentage: asset.quote.changePercentage,
            volume: asset.quote.volume,
        };
    }

    asset.quote = {
        ...asset.quote,
        name: yahoo.name ?? asset.quote.name,
        pe: metric(yahoo.trailingPE) ?? asset.quote.pe,
        forwardPE: metric(yahoo.forwardPE) ?? asset.quote.forwardPE,
        trailingEPS: metric(yahoo.trailingEPS) ?? asset.quote.trailingEPS,
        forwardEPS: metric(yahoo.forwardEPS) ?? asset.quote.forwardEPS,
        marketCap: metric(yahoo.marketCap) ?? asset.quote.marketCap,
    };
    asset.profile = {
        ...asset.profile,
        companyName: yahoo.name ?? asset.profile.companyName,
        marketCap: metric(yahoo.marketCap) ?? asset.profile.marketCap,
        beta: metric(yahoo.beta) ?? asset.profile.beta,
        lastDividend: metric(yahoo.lastDividend) ?? asset.profile.lastDividend,
        sector: yahoo.companyProfile.sector ?? asset.profile.sector,
        industry: yahoo.companyProfile.industry ?? asset.profile.industry,
        country: yahoo.companyProfile.country ?? asset.profile.country,
        website: yahoo.companyProfile.website ?? asset.profile.website,
        description: yahoo.companyProfile.description ?? asset.profile.description,
        fullTimeEmployees: yahoo.companyProfile.employees !== null
            ? String(yahoo.companyProfile.employees)
            : asset.profile.fullTimeEmployees,
    };
    asset.keyMetrics = {
        ...asset.keyMetrics,
        marketCap: metric(yahoo.marketCap) ?? asset.keyMetrics.marketCap,
        enterpriseValueTTM: yahoo.metrics['keyStatistics.enterpriseValue'] ?? asset.keyMetrics.enterpriseValueTTM,
        evToSalesTTM: yahoo.metrics['keyStatistics.enterpriseToRevenue'] ?? asset.keyMetrics.evToSalesTTM,
        evToEBITDATTM: yahoo.metrics['keyStatistics.enterpriseToEbitda'] ?? asset.keyMetrics.evToEBITDATTM,
        returnOnEquityTTM: yahoo.metrics['financialData.returnOnEquity'] ?? asset.keyMetrics.returnOnEquityTTM,
        returnOnAssetsTTM: yahoo.metrics['financialData.returnOnAssets'] ?? asset.keyMetrics.returnOnAssetsTTM,
        earningsYieldTTM: earningsYield ?? asset.keyMetrics.earningsYieldTTM,
        freeCashFlowYieldTTM: yahoo.metrics['financialData.freeCashflow'] !== null &&
            yahoo.metrics['financialData.freeCashflow'] !== undefined && asset.profile.marketCap > 0
            ? yahoo.metrics['financialData.freeCashflow'] / asset.profile.marketCap
            : asset.keyMetrics.freeCashFlowYieldTTM,
    };
    if (asset.ratios.length > 0) {
        const ratio = asset.ratios[0];
        asset.ratios[0] = {
            ...ratio,
            priceToEarningsRatio: trailingPE ?? ratio.priceToEarningsRatio,
            priceToBookRatio: yahoo.metrics['summaryDetail.priceToBook'] ?? ratio.priceToBookRatio,
            priceToSalesRatio: yahoo.metrics['summaryDetail.priceToSalesTrailing12Months'] ?? ratio.priceToSalesRatio,
            grossProfitMargin: yahoo.metrics['financialData.grossMargins'] ?? ratio.grossProfitMargin,
            operatingProfitMargin: yahoo.metrics['financialData.operatingMargins'] ?? ratio.operatingProfitMargin,
            netProfitMargin: yahoo.metrics['financialData.profitMargins'] ?? ratio.netProfitMargin,
            dividendYield: yahoo.metrics['summaryDetail.dividendYield'] ?? ratio.dividendYield,
            dividendYieldPercentage: yahoo.metrics['summaryDetail.dividendYield'] !== null &&
                yahoo.metrics['summaryDetail.dividendYield'] !== undefined
                ? yahoo.metrics['summaryDetail.dividendYield'] * 100
                : ratio.dividendYieldPercentage,
        };
    }
    const targetMeanPrice = yahoo.metrics['financialData.targetMeanPrice'];
    if (targetMeanPrice !== null && targetMeanPrice !== undefined) {
        asset.priceTargetConsensus = {
            ...asset.priceTargetConsensus,
            targetConsensus: targetMeanPrice,
            targetMedian: yahoo.metrics['financialData.targetMedianPrice'] ?? asset.priceTargetConsensus.targetMedian,
            targetHigh: yahoo.metrics['financialData.targetHighPrice'] ?? asset.priceTargetConsensus.targetHigh,
            targetLow: yahoo.metrics['financialData.targetLowPrice'] ?? asset.priceTargetConsensus.targetLow,
        };
    }

    asset.dataSource = 'FMP + Yahoo Finance';
    asset.dataFetchedAt = fetchedAt;
    asset.yahooMetrics = yahoo.metrics;
    asset.yahooAttemptedAt = fetchedAt;
    asset.yahooError = yahoo.error;
    if (yahoo.history.length > 0) {
        asset.historicalReturns = mapYahooHistory(asset.symbol, yahoo.history);
    }
    return asset;
}

function hasUsableYahooData(quote: YahooFinanceQuote): boolean {
    return (quote.price.value !== null && quote.price.value > 0) ||
        quote.history.length > 0 ||
        Object.values(quote.metrics).some((value) => value !== null);
}

function shouldRefreshYahooData(asset: AssetData, now: number): boolean {
    const attemptedAt = asset.yahooAttemptedAt ? Date.parse(asset.yahooAttemptedAt) : Number.NaN;
    const needsYahooData = asset.dataSource !== 'FMP + Yahoo Finance' ||
        !asset.yahooMetrics ||
        Object.keys(asset.yahooMetrics).length === 0 ||
        (asset.yahooError !== null && asset.yahooError !== undefined);
    return needsYahooData &&
        (!Number.isFinite(attemptedAt) || now - attemptedAt >= 15 * 60 * 1000);
}

function getRecords(result: unknown): Record<string, unknown>[] {
    if (!result || typeof result !== 'object' || !('data' in result) || !Array.isArray(result.data)) return [];
    return result.data.filter((record): record is Record<string, unknown> =>
        Boolean(record) && typeof record === 'object' && !Array.isArray(record)
    );
}

function getPositiveNumber(record: Record<string, unknown>, ...keys: string[]): number {
    for (const key of keys) {
        const value = record[key];
        if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
    }
    return 0;
}

async function fetchPeerValuations(
    ticker: string,
    endpoints: Config['api']['fmpProxyEndpoints'],
): Promise<AssetPeerValuation[]> {
    try {
        const peerResponse = await makeRequest(endpoints.stockPeers ?? 'stable/stock-peers', ticker);
        const peers = getRecords(peerResponse)
            .filter((peer) => typeof peer.symbol === 'string' && peer.symbol.toUpperCase() !== ticker.toUpperCase())
            .slice(0, MAX_PEER_VALUATIONS);

        const valuations = await Promise.allSettled(peers.map(async (peer) => {
            const peerSymbol = peer.symbol as string;
            const [ratiosResponse, metricsResponse] = await Promise.all([
                makeRequest(endpoints.ratiosTtm ?? 'stable/ratios-ttm', peerSymbol),
                makeRequest(endpoints.keyMetrics, peerSymbol),
            ]);
            const ratios = getRecords(ratiosResponse)[0];
            const metrics = getRecords(metricsResponse)[0];
            if (!ratios || !metrics) return null;

            return {
                symbol: peerSymbol,
                companyName: typeof peer.companyName === 'string' ? peer.companyName : peerSymbol,
                price: getPositiveNumber(peer, 'price'),
                marketCap: getPositiveNumber(peer, 'mktCap', 'marketCap') || getPositiveNumber(metrics, 'marketCap'),
                priceToEarningsRatio: getPositiveNumber(ratios, 'priceToEarningsRatioTTM'),
                priceToBookRatio: getPositiveNumber(ratios, 'priceToBookRatioTTM'),
                priceToSalesRatio: getPositiveNumber(ratios, 'priceToSalesRatioTTM'),
                priceToFreeCashFlowRatio: getPositiveNumber(ratios, 'priceToFreeCashFlowRatioTTM'),
                ebitMargin: getPositiveNumber(ratios, 'ebitMarginTTM'),
                returnOnEquity: getPositiveNumber(metrics, 'returnOnEquityTTM'),
                debtToEquity: getPositiveNumber(ratios, 'debtToEquityRatioTTM'),
                evToEBITDA: getPositiveNumber(metrics, 'evToEBITDATTM') || getPositiveNumber(ratios, 'enterpriseValueMultipleTTM'),
                evToEBIT: getPositiveNumber(metrics, 'evToSalesTTM') > 0 && getPositiveNumber(ratios, 'ebitMarginTTM') > 0
                    ? getPositiveNumber(metrics, 'evToSalesTTM') / getPositiveNumber(ratios, 'ebitMarginTTM')
                    : 0,
                evToSales: getPositiveNumber(metrics, 'evToSalesTTM'),
            } satisfies AssetPeerValuation;
        }));

        return valuations.flatMap((valuation) =>
            valuation.status === 'fulfilled' && valuation.value ? [valuation.value] : []
        );
    } catch (error) {
        void logger.warn('PEER_VALUATION_FETCH_FAILED', `Could not load peer valuation data for ${ticker}`, {
            ticker,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
        });
        return [];
    }
}

async function fetchLatestAnalystGradeUpdates(
    ticker: string,
    endpoint: string,
): Promise<AssetAnalystGradeUpdate[]> {
    try {
        const response = await makeRequest(endpoint, ticker);
        return getRecords(response)
            .filter((record) =>
                typeof record.symbol === 'string' &&
                typeof record.date === 'string' &&
                typeof record.gradingCompany === 'string' &&
                typeof record.newGrade === 'string' &&
                typeof record.action === 'string'
            )
            .map((record) => ({
                symbol: record.symbol as string,
                date: record.date as string,
                gradingCompany: record.gradingCompany as string,
                previousGrade: typeof record.previousGrade === 'string' ? record.previousGrade : '',
                newGrade: record.newGrade as string,
                action: record.action as string,
            }))
            .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())
            .slice(0, 10);
    } catch (error) {
        void logger.warn('ANALYST_GRADES_FETCH_FAILED', `Could not load recent analyst grades for ${ticker}`, {
            ticker,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
        });
        return [];
    }
}

async function fallbackToYahooOrCache(
    ticker: string,
    fmpError: unknown,
    cached: { data: unknown; last_updated_at: unknown } | null,
    yahooSupplement: Promise<YahooSupplementResult>,
    userId: string | undefined,
    suppressFailureToast = false,
): Promise<AssetData> {
    const fmpMessage = fmpError instanceof Error ? fmpError.message : String(fmpError);
    try {
        const yahooResult = await yahooSupplement;
        if (yahooResult.error) throw yahooResult.error;
        if (!yahooResult.response) throw new Error('Yahoo Finance no devolvió una respuesta');
        const symbol = ticker.trim().toUpperCase();
        const yahooQuote = yahooResult.response.quotes.find((item) => item.symbol === symbol);
        if (!yahooQuote) throw new Error(`Yahoo Finance no devolvió resultados para ${symbol}`);
        if (
            yahooQuote.price.value === null ||
            !Number.isFinite(yahooQuote.price.value) ||
            yahooQuote.price.value <= 0
        ) {
            throw new Error(yahooQuote.error ?? `Yahoo Finance no devolvió un precio válido para ${symbol}`);
        }
        const yahooData = createYahooAssetData(symbol, yahooQuote, yahooResult.response.fetchedAt);
        toast.warning(`FMP no respondió para ${ticker}. Se muestran datos de Yahoo Finance.`, {
            description: yahooQuote.error
                ? `${yahooQuote.error}. Se usa el último cierre histórico disponible.`
                : 'La información disponible es limitada y puede tener demora de mercado.',
        });
        if (userId) {
            await incrementApiCallCounter(userId);
        }
        const { error: cacheError } = await supabase.from('asset_data_cache').upsert({
            symbol: ticker,
            data: yahooData,
            last_updated_at: yahooData.dataFetchedAt,
        });
        if (cacheError) {
            void logger.warn('ASSET_CACHE_WRITE_FAILED', `Could not cache Yahoo fallback data for ${ticker}`, {
                ticker,
                errorMessage: cacheError.message,
            });
        }
        return yahooData;
    } catch (yahooError) {
        const yahooMessage = yahooError instanceof Error ? yahooError.message : String(yahooError);
        void logger.error('YAHOO_FALLBACK_FAILED', `Yahoo Finance fallback failed for ${ticker}`, {
            ticker,
            fmpError: fmpMessage,
            yahooError: yahooMessage,
        });
        if (cached?.data) {
            const cacheDate = new Date(cached.last_updated_at as string);
            const hoursOld = Math.floor((Date.now() - cacheDate.getTime()) / (1000 * 60 * 60));
            toast.warning(`Fallaron FMP y Yahoo para ${ticker}. Se usan datos guardados de hace ${hoursOld}h.`);
            return cached.data as AssetData;
        }

        const message = `FMP falló (${fmpMessage}) y Yahoo Finance también falló (${yahooMessage}).`;
        if (!suppressFailureToast) {
            toast.error(`Error al cargar ${ticker}`, { description: message });
        }
        throw new Error(message);
    }
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

    if (!forceRefresh && cached && new Date(cached.last_updated_at as string) > twoHoursAgo) {
        const cachedAsset = cached.data as AssetData;
        if (!shouldRefreshYahooData(cachedAsset, Date.now())) return cachedAsset;

        if (await hasApiCallsAvailable(user, profile, config)) {
            const attemptedAt = new Date().toISOString();
            try {
                const response = await fetchYahooFinanceQuotes([ticker]);
                const yahooQuote = response.quotes.find((item) => item.symbol === ticker.toUpperCase());
                if (yahooQuote && hasUsableYahooData(yahooQuote)) {
                    const refreshedAsset = enrichAssetWithYahoo(cachedAsset, yahooQuote, response.fetchedAt);
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
        return cachedAsset;
    }

    if (forceRefresh && cached && new Date(cached.last_updated_at as string) > twoHoursAgo) {
        toast.info(`Forzando actualización de ${ticker}...`, { duration: 2000 });
    }

    // 2. Verificar límites de API
    const hasApiAvailable = await hasApiCallsAvailable(user, profile, config);

    if (!hasApiAvailable) {
        if (cached?.data) {
            const cacheDate = new Date(cached.last_updated_at as string);
            const hoursOld = Math.floor((Date.now() - cacheDate.getTime()) / (1000 * 60 * 60));
            toast.warning(`Límite de API de tu plan alcanzado. Usando datos de hace ${hoursOld}h.`);
            return cached.data as AssetData;
        }
        if (!fromPortfolio) {
            toast.error('Límite de API de tu plan alcanzado y sin datos en caché.');
        }
        throw new Error('Límite de API de FMP alcanzado para tu plan; el fallback no se ejecuta por límites de cuenta.');
    }

    // 3. Preparar endpoints
    const { fmpProxyEndpoints } = config.api;

    // Endpoints estándar (sin parámetros extra)
    // Nota: Asegúrate de que las claves existan en tu config.ts, si no usa strings fallback
    const endpointsGroup1 = [
        fmpProxyEndpoints.profile,              // 0
        fmpProxyEndpoints.keyMetrics,           // 1
        fmpProxyEndpoints.quote,                // 2
        fmpProxyEndpoints.historical,           // 3
        fmpProxyEndpoints.priceTarget,          // 4
        fmpProxyEndpoints.dcf,                  // 5
        fmpProxyEndpoints.rating,               // 6
        fmpProxyEndpoints.revenueGeographic,    // 7
        fmpProxyEndpoints.revenueProduct,       // 8
        fmpProxyEndpoints.priceTargetConsensus, // 9
        fmpProxyEndpoints.gradesConsensus || 'grade', // 10
    ];

    // Endpoints grupo 2 (después de estimates)
    const endpointsGroup2 = [
        fmpProxyEndpoints.ratios, // 12
        fmpProxyEndpoints.keyMetricsYear, // 13 (asumiendo anual)
        fmpProxyEndpoints.leveredDiscountedCashFlow, // 14
        fmpProxyEndpoints.stockPriceChange // 15
    ];

    const yahooSupplementPromise: Promise<YahooSupplementResult> = fetchYahooFinanceQuotes([ticker])
        .then((response) => ({ response, error: null }))
        .catch((error: unknown) => ({
            response: null,
            error: error instanceof Error ? error : new Error(String(error)),
        }));
    const peerValuationsPromise = fetchPeerValuations(ticker, fmpProxyEndpoints);
    const analystGradeUpdatesPromise = fetchLatestAnalystGradeUpdates(
        ticker,
        fmpProxyEndpoints.stockGrades || 'stable/grades',
    );
    let processedAsset: AssetData;

    try {
        // Construimos el array de promesas en el orden exacto que espera el destructuring
        const promises = [
            ...endpointsGroup1.map(path => makeRequest(path, ticker)),

            // 11. Analyst Estimates (Con parámetros personalizados)
            makeRequest(
                fmpProxyEndpoints.analystEstimates || 'analyst-estimates',
                ticker,
                '&period=annual&limit=10'
            ),

            ...endpointsGroup2.map(path => makeRequest(path, ticker))
        ];

        const results = await Promise.all(promises);

        // Verificar errores
        for (const result of results) {
            if (result && typeof result === 'object' && 'error' in result && result.error) {
                console.error(`Error fetching endpoint for ${ticker}:`, result.error);
                throw result.error;
            }
        }

        // Extraer datos (mapeando a undefined si falló algo específico pero no lanzó error)
        const allData = results.map(r => (r && typeof r === 'object' && 'data' in r) ? r.data : undefined);

        const [
            profileRes,             // 0
            keyMetricsRes,          // 1
            quoteRes,               // 2
            historicalRes,          // 3
            priceTargetRes,         // 4
            dcfRes,                 // 5
            ratingRes,              // 6
            geoRes,                 // 7
            prodRes,                // 8
            consensusRes,           // 9
            gradesConsensusRes,     // 10
            analystEstimatesRes,    // 11 (Ahora está en la posición correcta)
            ratiosRes,              // 12
            keyMetricsYearRes,      // 13
            leveredDiscountedCashFlowRes, // 14
            stockPriceChangeRes     // 15
        ] = allData;

        // Procesar datos
        // Nota: Asegúrate de que tu función processAssetData en asset-processor.ts 
        // acepte todos estos argumentos.
        processedAsset = processAssetData(
            ticker,
            profileRes,
            keyMetricsRes,
            quoteRes,
            historicalRes,
            priceTargetRes,
            dcfRes,
            ratingRes,
            geoRes,
            prodRes,
            consensusRes,
            // Nuevos argumentos
            gradesConsensusRes,
            analystEstimatesRes,
            ratiosRes,
            keyMetricsYearRes,
            leveredDiscountedCashFlowRes,
            stockPriceChangeRes
        );
        if (
            !processedAsset.quote ||
            !processedAsset.keyMetrics ||
            typeof processedAsset.quote.price !== 'number' ||
            !Number.isFinite(processedAsset.quote.price) ||
            processedAsset.quote.price <= 0
        ) {
            throw new Error(`FMP devolvió datos incompletos para ${ticker}`);
        }
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Error al consultar datos del activo.';
        void logger.error('API_FETCH_FAILED', `Failed to fetch data for ${ticker}`, { ticker, errorMessage: msg });

        return fallbackToYahooOrCache(
            ticker,
            e,
            cached,
            yahooSupplementPromise,
            user?.id,
            fromPortfolio,
        );
    }

    processedAsset.peerValuations = await peerValuationsPromise;
    processedAsset.analystGradeUpdates = await analystGradeUpdatesPromise;
    processedAsset.dataSource = 'FMP';
    processedAsset.dataFetchedAt = new Date().toISOString();
    const yahooSupplement = await yahooSupplementPromise;
    if (yahooSupplement.response) {
        const yahooQuote = yahooSupplement.response.quotes.find(
            (item) => item.symbol === ticker.toUpperCase(),
        );
        if (yahooQuote && hasUsableYahooData(yahooQuote)) {
            enrichAssetWithYahoo(processedAsset, yahooQuote, yahooSupplement.response.fetchedAt);
        } else {
            processedAsset.yahooAttemptedAt = yahooSupplement.response.fetchedAt;
            processedAsset.yahooError = yahooQuote?.error ?? 'Yahoo Finance no devolvió métricas ni cotización utilizables';
            void logger.warn('YAHOO_SUPPLEMENT_EMPTY', `Yahoo Finance returned no usable data for ${ticker}`, {
                ticker,
                errorMessage: processedAsset.yahooError,
            });
        }
    } else {
        processedAsset.yahooAttemptedAt = new Date().toISOString();
        processedAsset.yahooError = yahooSupplement.error instanceof Error
            ? yahooSupplement.error.message
            : String(yahooSupplement.error);
        void logger.warn('YAHOO_SUPPLEMENT_FAILED', `Could not supplement ${ticker} with Yahoo Finance data`, {
            ticker,
            errorMessage: processedAsset.yahooError,
        });
    }

    if (user?.id) {
        await incrementApiCallCounter(user.id);
    }

    const { error: cacheError } = await supabase.from('asset_data_cache').upsert({
        symbol: ticker,
        data: processedAsset,
        last_updated_at: processedAsset.dataFetchedAt
    });
    if (cacheError) {
        void logger.warn('ASSET_CACHE_WRITE_FAILED', `Could not cache fetched data for ${ticker}`, {
            ticker,
            errorMessage: cacheError.message,
        });
    }

    return processedAsset;
}