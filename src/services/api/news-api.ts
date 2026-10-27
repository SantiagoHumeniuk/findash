import { logger } from '../../lib/logger';
import type { Config } from '../../types/config';
import type { StockNewsItem, UnifiedNewsItem, NewsCategory } from '../../types/news';
import { fetchYahooNews, type YahooFinanceNewsItem } from './yahoo-finance-api';

function toStockNewsItem(article: YahooFinanceNewsItem, fallbackSymbol = ''): StockNewsItem {
  const publishedDate = article.publishedAt
    ? new Date(article.publishedAt * 1000).toISOString()
    : '';
  return {
    symbol: article.relatedTickers[0] ?? fallbackSymbol,
    publishedDate,
    title: article.title,
    image: article.image,
    site: article.publisher,
    text: '',
    url: article.url,
    publisher: article.publisher,
    tickers: article.relatedTickers.join(','),
  };
}

/**
 * Fetches news for one symbol from Yahoo Finance.
 */
export async function fetchStockNews(
  symbol: string,
  _config: Config,
  page = 0,
  limit = 20,
): Promise<StockNewsItem[]> {
  try {
    const count = Math.min((page + 1) * limit, 50);
    const articles = await fetchYahooNews(symbol.trim().toUpperCase(), count);
    return articles.slice(page * limit, (page + 1) * limit)
      .map((article) => toStockNewsItem(article, symbol.toUpperCase()));
  } catch (error) {
    void logger.error('YAHOO_STOCK_NEWS_FAILED', `Failed to fetch news for ${symbol}`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Fetches the Yahoo Finance news feed for supported news categories.
 */
export async function fetchNewsByCategory(
  category: NewsCategory,
  _config: Config,
  page = 0,
  limit = 20,
  searchQuery?: string,
): Promise<UnifiedNewsItem[]> {
  const normalizedSearchQuery = searchQuery?.trim();
  const query = normalizedSearchQuery ? normalizedSearchQuery : (
    category === 'crypto' ? 'cryptocurrency' :
      category === 'forex' ? 'foreign exchange' :
        category === 'stock' ? 'stock market' :
          'financial markets'
  );
  try {
    const count = Math.min((page + 1) * limit, 50);
    const articles = await fetchYahooNews(query, count);
    return articles.slice(page * limit, (page + 1) * limit).map((article, index) => {
      const item = toStockNewsItem(article);
      return {
        id: item.url || `${item.publishedDate}-${item.title}-${index}`,
        title: item.title,
        date: item.publishedDate,
        url: item.url,
        image: item.image,
        source: item.site,
        summary: item.text,
        symbol: item.symbol.length > 0 ? item.symbol : undefined,
        category,
      };
    });
  } catch (error) {
    void logger.error('YAHOO_NEWS_FETCH_FAILED', `Failed to fetch ${category} news`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}
