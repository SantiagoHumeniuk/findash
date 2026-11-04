// src/types/watchlist.ts

/**
 * Watchlist item - Asset favorito del usuario
 */
export interface WatchlistItem {
  id: string;
  user_id: string;
  symbol: string;
  added_at: string;
  notes?: string | null;
  list_name: string;
}

/**
 * Datos para crear un nuevo watchlist item
 */
export interface CreateWatchlistItemDto {
  symbol: string;
  notes?: string;
  list_name?: string;
}

/**
 * Datos para actualizar un watchlist item existente
 */
export interface UpdateWatchlistItemDto {
  notes?: string;
}

/**
 * Watchlist item con datos del asset enriquecidos
 */
export interface WatchlistItemWithAssetData extends WatchlistItem {
  assetData?: {
    symbol: string;
    companyName: string;
    currentPrice?: number;
    change?: number;
    changePercent?: number;
    currency?: string;
    industry?: string;
  };
}
