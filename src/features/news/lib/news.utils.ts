// src/features/news/lib/news.utils.ts

import type { NewsItem } from '../../../types/news';

/**
 * Formatea una fecha en formato localizado español
 */
export const formatNewsDate = (date: string): string => {
  return new Date(date).toLocaleString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Obtiene el nombre de la compañía desde una noticia
 */
export const getCompanyName = (news: NewsItem): string => {
  return news.gradingCompany ?? news.analystCompany ?? '';
};

/**
 * Filtra noticias por símbolo y compañía
 */
export const filterNews = (
  news: NewsItem[],
  symbolFilter: string,
  companyFilter: string
): NewsItem[] => {
  return news.filter((item) => {
    const symbolMatch = symbolFilter
      ? item.symbol.toLowerCase().includes(symbolFilter.toLowerCase())
      : true;
    const company = getCompanyName(item);
    const companyMatch = companyFilter
      ? company.toLowerCase().includes(companyFilter.toLowerCase())
      : true;
    return symbolMatch && companyMatch;
  });
};

/**
 * Calcula la paginación de items
 */
export const paginateItems = <T>(
  items: T[],
  currentPage: number,
  itemsPerPage: number
): T[] => {
  const pageSize = typeof itemsPerPage === 'number' ? itemsPerPage : Number(itemsPerPage) || 20;
  const indexOfLastItem = currentPage * pageSize;
  const indexOfFirstItem = indexOfLastItem - pageSize;
  return items.slice(indexOfFirstItem, indexOfLastItem);
};

/**
 * Calcula el número total de páginas
 */
export const calculateTotalPages = (totalItems: number, itemsPerPage: number): number => {
  const pageSize = typeof itemsPerPage === 'number' ? itemsPerPage : Number(itemsPerPage) || 20;
  return Math.ceil(totalItems / pageSize);
};

/**
 * Valida si el caché es reciente (menos de 6 horas)
 */
export const isCacheValid = (lastUpdated: string): boolean => {
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
  return new Date(lastUpdated) > sixHoursAgo;
};

/**
 * Ordena noticias por fecha de publicación (más recientes primero)
 */
export const sortNewsByDate = (news: NewsItem[]): NewsItem[] => {
  return [...news].sort(
    (a, b) => new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime()
  );
};

/**
 * Combina resultados de múltiples endpoints de noticias
 */
export const combineNewsResults = (
  results: { data?: unknown; error?: unknown }[]
): NewsItem[] => {
  const newsItems: NewsItem[] = [];
  
  results.forEach((res) => {
    if (res && typeof res === 'object' && 'data' in res && Array.isArray(res.data)) {
      res.data.forEach((item) => {
        // Validación básica del tipo NewsItem
        if (
          item &&
          typeof item === 'object' &&
          'symbol' in item &&
          'newsTitle' in item &&
          'newsURL' in item &&
          'publishedDate' in item
        ) {
          newsItems.push(item as NewsItem);
        }
      });
    }
  });
  
  return newsItems;
};
