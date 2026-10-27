// src/services/data/asset-processor.ts

import {
    AssetData,
    AssetProfile,
    AssetKeyMetrics,
    AssetQuote,
    AssetHistorical,
    AssetPriceTarget,
    AssetDCF,
    AssetRating,
    AssetGeography,
    AssetProduction,
    AssetPriceTargetConsensus,
    AssetRatios,
    AssetGradesConsensus,
    AssetAnalystEstimates,
    AssetStockPriceChange,
    AssetKeyMetricsYearly,
    AssetDCFLevered
} from '../../types/dashboard';

/**
 * Helper genérico para extraer el primer elemento.
 */
function getFirst<T>(data: unknown): T | null {
    if (Array.isArray(data) && data.length > 0) {
        return data[0] as T;
    }
    return null;
}

/**
 * Procesa las respuestas crudas de la API y construye el objeto AssetData.
 * Ordena el historial de forma ASCENDENTE (Index 0 = Fecha más antigua).
 */
export function processAssetData(
    symbol: string,
    profileRes: unknown,
    keyMetricsRes: unknown,
    quoteRes: unknown,
    historicalRes: unknown,
    priceTargetRes: unknown,
    dcfRes: unknown,
    ratingRes: unknown,
    geoRes: unknown,
    prodRes: unknown,
    consensusRes: unknown,
    gradesConsensusRes: unknown,
    analystEstimatesRes: unknown,
    ratiosRes: unknown,
    keyMetricsYearRes: unknown,
    leveredDiscountedCashFlowRes: unknown,
    stockPriceChangeRes: unknown
): AssetData {

    // 1. Validar Perfil
    const profile = getFirst<AssetProfile>(profileRes);
    if (!profile) {
        throw new Error(`El símbolo "${symbol}" no fue encontrado.`);
    }

    // 2. Extraer datos singulares
    const keyMetrics = getFirst<AssetKeyMetrics>(keyMetricsRes);
    const quote = getFirst<AssetQuote>(quoteRes);
    const priceTarget = getFirst<AssetPriceTarget>(priceTargetRes);
    const rating = getFirst<AssetRating>(ratingRes);
    const geography = getFirst<AssetGeography>(geoRes);
    const production = getFirst<AssetProduction>(prodRes);
    const priceTargetConsensus = getFirst<AssetPriceTargetConsensus>(consensusRes);
    const gradesConsensus = getFirst<AssetGradesConsensus>(gradesConsensusRes);

    const leveredDiscountedCashFlow = getFirst<AssetDCFLevered>(leveredDiscountedCashFlowRes);
    const stockPriceChange = getFirst<AssetStockPriceChange>(stockPriceChangeRes);

    // 3. Procesar Historial de Precios
    let historicalData: AssetHistorical[] = [];
    if (historicalRes && typeof historicalRes === 'object') {
        if ('historical' in historicalRes && Array.isArray((historicalRes as {historical?: unknown}).historical)) {
            historicalData = (historicalRes as {historical: AssetHistorical[]}).historical;
        } else if (Array.isArray(historicalRes)) {
            historicalData = historicalRes as AssetHistorical[];
        }
    }

    // ORDENAMIENTO CRÍTICO: De Antiguo a Nuevo
    // Mapeamos 'adjClose' a 'close' si existe, para que los cálculos de rendimiento
    // incluyan dividendos y splits (estándar de la industria).
    const historicalSorted = [...historicalData]
        .map(h => ({
            ...h,
            // Prefer adjusted close when the provider includes it.
            close: Number((h as {adjClose?: unknown}).adjClose ?? h.close)
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // 4. Procesar DCF
    const dcf = Array.isArray(dcfRes) ? (dcfRes as AssetDCF[]) : [];

    const keyMetricsYearly = Array.isArray(keyMetricsYearRes) ? (keyMetricsYearRes as AssetKeyMetricsYearly[]) : [];
    const ratiosParsed = Array.isArray(ratiosRes) ? (ratiosRes as AssetRatios[]) : [];
    const analystEstimatesParsed = Array.isArray(analystEstimatesRes) ? (analystEstimatesRes as AssetAnalystEstimates[]) : [];
    // 5. Construir Objeto
    return {
        symbol: profile.symbol,
        profile,
        keyMetrics: keyMetrics!,
        quote: quote!,
        historicalReturns: historicalSorted,
        priceTarget: priceTarget!,
        dcf,
        rating: rating!,
        geography: geography!,
        production: production!,
        priceTargetConsensus: priceTargetConsensus!,
        gradesConsensus: gradesConsensus!,
        analystEstimates: analystEstimatesParsed,
        ratios: ratiosParsed,
        keyMetricsYearly: keyMetricsYearly,
        dcfLevered: leveredDiscountedCashFlow!,
        stockPriceChange: stockPriceChange!
    };
}