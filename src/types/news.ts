// src/types/news.ts

/**
 * Representa un artículo de noticia financiera.
 */
export interface NewsItem {
  symbol: string;
  newsTitle: string;
  newsURL: string;
  publishedDate: string;
  gradingCompany?: string;
  analystCompany?: string;
  newsPublisher: string;
  newGrade?: string;
  previousGrade?: string;
  priceTarget?: number;
  analystName?: string;
}

/**
 * Represents a stock news article returned by Yahoo Finance.
 */
export interface StockNewsItem {
  symbol: string;
  publishedDate: string;
  title: string;
  image: string;
  site: string;
  text: string;
  url: string;
  publisher?: string;
  tickers?: string;
  content?: string;
}

export type NewsCategory = 'general' | 'stock' | 'crypto' | 'forex';

// Tipo unificado para usar en la UI
export interface UnifiedNewsItem {
  id: string; // url o combinación única
  title: string;
  date: string;
  url: string;
  image?: string;
  source: string;
  summary: string;
  symbol?: string; // Puede ser null en general news
  category: NewsCategory;

  // Campos específicos opcionales para compatibilidad
  priceTarget?: number;
  grade?: string;
}