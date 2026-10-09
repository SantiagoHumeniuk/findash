// src/types/portfolio.ts

import { AssetData } from './dashboard';

/**
 * Representa una única transacción de compra o venta.
 */
export interface Transaction {
    id: number;
    user_id: string;
    portfolio_id: number; // Linked to portfolios table
    symbol: string;
    quantity: number;
    purchase_price: number;
    purchase_date: string; // Fecha en formato ISO string
    transaction_type: 'buy' | 'sell';
}

/**
 * Representa un portafolio de inversión.
 */
export interface Portfolio {
    id: number;
    user_id: string;
    name: string;
    created_at: string;
}

/**
 * Representa una posición consolidada (tenencia) de un activo en el portafolio.
 * Usa la estructura completa de AssetData del dashboard para máxima compatibilidad.
 */
export interface Holding {
    symbol: string;
    quantity: number;
    totalCost: number;
    avgPurchasePrice: number;
    assetData: AssetData;
}

/**
 * Extiende `Holding` con métricas calculadas para la UI.
 */
export type HoldingWithMetrics = Holding & {
    currentPrice: number;
    marketValue: number;
    pl: number;
    plPercent: number;
    holdingDays: number; // Días desde la primera compra
};

/**
 * Define la estructura del contexto del Portafolio.
 */
export interface PortfolioContextType {
    // State
    portfolios: Portfolio[];
    currentPortfolio: Portfolio | null;
    transactions: Transaction[];
    holdings: Holding[];
    totalPerformance: {
        pl: number;
        percent: number;
    };
    portfolioData: Record<string, AssetData>;
    loading: boolean;
    error: string | null;

    // Actions
    selectPortfolio: (portfolioId: number | null) => void;
    createPortfolio: (name: string) => Promise<Portfolio>;
    deletePortfolio: (portfolioId: number) => Promise<void>;
    addTransaction: (transaction: Omit<Transaction, 'id' | 'user_id'>) => Promise<Transaction[] | null>;
    importTransactions: (transactions: Omit<Transaction, 'id' | 'user_id'>[]) => Promise<Transaction[]>;
    deleteAsset: (symbol: string) => Promise<void>;
    refreshPortfolio: () => Promise<void>;
}

export interface AddTransactionModalProps {
    isOpen: boolean;
    onClose: () => void;
    ticker: string | null;
    currentPrice: number | null;
}

export interface SellTransactionModalProps {
    isOpen: boolean;
    onClose: () => void;
    holding: HoldingWithMetrics | null;
}

export interface AddModalInfo {
    isOpen: boolean;
    ticker: string | null;
    price: number | null;
}

export interface PortfolioViewProps {
    holdings: HoldingWithMetrics[];
    onDeleteAsset: (symbol: string) => void;
    onAddMore: (ticker: string, price: number) => void;
    onSell: (holding: HoldingWithMetrics) => void;
}

export interface AllocationDatum {
    name: string;
    value: number;
    percentage: number;
    [key: string]: string | number;
}

export interface PlDatum {
    symbol: string;
    pl: number;
    plValue: number;
}

export type ChartConfigFixed = Record<
    string,
    { label?: React.ReactNode; color?: string; icon?: React.ComponentType }
>;

/**
 * Métricas calculadas del portfolio
 * Actualizado: Eliminado Sharpe, Agregado Best/Worst USD
 */
export interface PortfolioMetrics {
    totalInvested: number;
    currentValue: number;
    currentPL: number;
    currentPLPercent: number;
    dailyPL: number;
    bestPerformer: { symbol: string; plPercent: number };
    worstPerformer: { symbol: string; plPercent: number };
    // Nuevas métricas nominales
    bestPerformerUsd: { symbol: string; plValue: number };
    worstPerformerUsd: { symbol: string; plValue: number };

    positionsCount: number;
    portfolioBeta: number | "N/A";
    avgHoldingDays: number;
}