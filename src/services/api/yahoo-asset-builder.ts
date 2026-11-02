// src/services/api/yahoo-asset-builder.ts
// Builds the shared AssetData rows. The Edge Function runs this same code: after
// changing it, run `npm run build:asset-builder`.

import type {
    AssetData,
    AssetKeyMetrics,
    AssetQuote,
} from '../../types/dashboard';
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

export const YAHOO_MARKET_INDEX_SYMBOLS = new Set(['SPY', 'QQQ', 'DIA', 'IWM']);
/** Bump when createYahooAssetData adds fields so cached assets are rebuilt. */
export const YAHOO_DATA_VERSION = 3;

function getYahooMarketIndexName(symbol: string, fallback: string | null): string {
    const knownNames: Record<string, string> = {
        SPY: 'SPDR S&P 500 ETF Trust',
        QQQ: 'Invesco QQQ Trust',
        DIA: 'SPDR Dow Jones Industrial Average ETF',
        IWM: 'iShares Russell 2000 ETF',
    };
    return knownNames[symbol] ?? fallback ?? symbol;
}

export function normalizeCachedYahooIndex(asset: AssetData): boolean {
    if (!YAHOO_MARKET_INDEX_SYMBOLS.has(asset.profile.symbol)) return false;

    const symbol = asset.profile.symbol;
    const changes = {
        image: asset.profile.image ?? '',
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
        image: yahoo.logoUrl ?? '',
        ipoDate: '',
        defaultImage: !yahoo.logoUrl,
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
        yahooInsights: {
            ownership: yahoo.ownership,
            nextEarnings: yahoo.nextEarnings,
            governance: yahoo.governance,
            earningsHistory: yahoo.analyst.earningsHistory,
            annualStatements: yahoo.fundamentals.annual,
            quarterlyStatements: yahoo.fundamentals.quarterly,
            dividendHistory: yahoo.dividendHistory,
        },
        dataFetchedAt: fetchedAt,
        yahooMetrics: yahoo.metrics,
        yahooAttemptedAt: fetchedAt,
        yahooQuoteAttemptedAt: fetchedAt,
        yahooError: yahoo.error,
    };
}

export function refreshAssetMarketQuoteFromYahoo(
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

export function hasUsableYahooData(quote: YahooFinanceQuote): boolean {
    return quote.price.value !== null && Number.isFinite(quote.price.value) && quote.price.value > 0;
}
