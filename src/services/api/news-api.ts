// src/services/api/news-api.ts

import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/logger';
import type { Config } from '../../types/config';
import type { StockNewsItem, UnifiedNewsItem, NewsCategory } from '../../types/news';

/**
 * Busca noticias específicas de un activo usando la API de FMP (vía proxy).
 */
export async function fetchStockNews(
    symbol: string,
    config: Config,
    page = 0,
    limit = 20
): Promise<StockNewsItem[]> {
    const { stockNews } = config.api.fmpProxyEndpoints;
    // FMP usa normalmente 'v3/stock_news'
    const endpoint = stockNews;

    // FMP usa 'tickers' para noticias específicas
    const queryParams = `symbols=${symbol}&page=${page}&limit=${limit}`;
    const fullPath = `${endpoint}?${queryParams}`;

    try {
        const { data, error } = await supabase.functions.invoke('fmp-proxy', {
            body: { endpointPath: fullPath }
        });

        if (error) throw error;
        if (!data || !Array.isArray(data)) return [];

        return data;
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error fetching news';
        void logger.error('NEWS_FETCH_ERROR', `Failed to fetch news for ${symbol}`, { error: msg });
        return [];
    }
}

/**
 * Obtiene noticias por categoría unificada.
 */
export async function fetchNewsByCategory(
    category: NewsCategory,
    config: Config,
    page = 0,
    limit = 20,
    searchQuery?: string
): Promise<UnifiedNewsItem[]> {
    const baseEndpoints: Record<NewsCategory, string> = {
        'general': config.api.fmpProxyEndpoints.generalNews,
        'stock': config.api.fmpProxyEndpoints.stockNews,
        'crypto': config.api.fmpProxyEndpoints.cryptoNews,
        'forex': config.api.fmpProxyEndpoints.forexNews,
        'press-releases': config.api.fmpProxyEndpoints.pressReleases,
        'fmp-articles': config.api.fmpProxyEndpoints.fmpArticles
    };

    let endpointPath = baseEndpoints[category];

    if (!endpointPath) {
        return [];
    }

    let queryParams = `page=${page}&limit=${limit}`;
    const searchableCategories: NewsCategory[] = ['stock', 'crypto', 'forex', 'press-releases'];

    if (searchQuery && searchQuery.trim() !== '' && searchableCategories.includes(category)) {
        // Modo Búsqueda
        queryParams += `&symbols=${encodeURIComponent(searchQuery.toUpperCase())}`;
    } else {
        // Modo Feed (General)
        if (searchableCategories.includes(category)) {
            endpointPath += '-latest'; // Convención: endpoint base + '-latest' para feed general
        }
    }

    try {
        const { data, error } = await supabase.functions.invoke('fmp-proxy', {
            body: { endpointPath: `${endpointPath}?${queryParams}` }
        });

        if (error) throw error;
        if (!data || !Array.isArray(data)) return [];

        return data.map((item: Record<string, unknown>) => mapToUnifiedItem(item, category));
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error fetching category news';
        void logger.error('NEWS_FETCH_ERROR', `Failed to fetch ${category} news`, { error: msg });
        return [];
    }
}

function mapToUnifiedItem(raw: Record<string, unknown>, category: NewsCategory): UnifiedNewsItem {
    const isFmpArticle = category === 'fmp-articles';
    const dateStr = (isFmpArticle ? raw.date : raw.publishedDate) as string;

    // Fallback image if missing
    let image = raw.image as string | undefined;
    if (!image && raw.symbol) {
        image = `https://images.financialmodelingprep.com/symbol/${raw.symbol as string}.jpg`;
    }

    return {
        id: (raw.url as string | undefined) ?? (raw.link as string | undefined) ?? `${dateStr}-${raw.title as string}`,
        title: raw.title as string,
        date: dateStr,
        url: ((raw.url as string | undefined) ?? (raw.link as string | undefined)) ?? '',
        image: image,
        source: (raw.site as string | undefined) ?? (raw.publisher as string | undefined) ?? '',
        summary: (raw.text as string | undefined) ?? (raw.content as string | undefined) ?? '',
        symbol: ((raw.symbol as string | undefined) ?? ((raw.tickers as string | undefined)?.split(':')[1])) ?? undefined,
        category,
        grade: raw.newGrade as string | undefined
    };
}