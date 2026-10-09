// src/providers/portfolio-provider.tsx

import React, { createContext, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Transaction, PortfolioContextType, Holding, Portfolio } from '../types/portfolio';
import { AssetData } from '../types/dashboard';
import { useAuth } from '../hooks/use-auth';
import { useConfig } from '../hooks/use-config';
import { calculateHoldings, calculateTotalPerformance } from '../utils/portfolio-calculations';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePortfolioMutations } from '../features/portfolio/hooks/use-portfolio-mutations';
import { toast } from 'sonner';
import { logger } from '../lib/logger';
import { errorToString } from '../utils/type-guards';
import { fetchTickerData } from '../services/api/asset-api';
import type { Config } from '../types/config';
import type { Profile } from '../types/auth';
import type { User } from '@supabase/supabase-js';


// eslint-disable-next-line react-refresh/only-export-components
export const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

// Define return type for fetch to include portfolios
interface FetchPortfolioResult {
    transactions: Transaction[];
    portfolioData: Record<string, AssetData>;
    portfolios: Portfolio[];
}

const fetchPortfolioData = async (
    user: User | null,
    profile: Profile | null,
    config: Config,
): Promise<FetchPortfolioResult> => {
    if (!user || !profile) {
        return { transactions: [], portfolioData: {}, portfolios: [] };
    }
    const userId = user.id;

    // 1. Fetch User Portfolios
    const portfoliosResult = await supabase
        .from('portfolios')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

    if (portfoliosResult.error) {
        throw new Error('No se pudo obtener tus portafolios.');
    }
    const portfolios = (portfoliosResult.data || []) as Portfolio[];

    // 2. Fetch Transactions
    const transResult = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('purchase_date', { ascending: false });

    if (transResult.error) {
        throw new Error('No se pudo obtener tus transacciones.');
    }

    const transactions = (transResult.data || []) as Transaction[];
    const symbols = [...new Set(transactions.map((t: Transaction) => t.symbol))];
    const portfolioData: Record<string, AssetData> = {};
    const unavailableSymbols: string[] = [];

    // Use shared cache first; only cache misses use a plan-metered asset lookup.
    for (const symbol of symbols) {
        try {
            portfolioData[symbol] = await fetchTickerData({
                queryKey: ['assetData', symbol, config, user, profile],
                fromPortfolio: true,
            });
        } catch (error) {
            unavailableSymbols.push(symbol);
            void logger.error('PORTFOLIO_ASSET_FETCH_FAILED', `Could not load portfolio asset ${symbol}`, {
                symbol,
                error: errorToString(error),
            });
        }
    }

    if (unavailableSymbols.length > 0) {
        toast.warning('No se pudieron cargar algunos activos del portafolio.', {
            description: unavailableSymbols.join(', '),
        });
    }

    return { transactions, portfolioData, portfolios };
};


export function PortfolioProvider({ children }: { children: React.ReactNode }) {
    const { user, profile } = useAuth();
    const config = useConfig();
    const queryClient = useQueryClient();

    // Local state for selected portfolio ID
    const [currentPortfolioId, setCurrentPortfolioId] = useState<number | null>(null);

    const { data, isLoading, isError, error, refetch } = useQuery({
        queryKey: ['portfolio', user?.id],
        queryFn: () => fetchPortfolioData(user, profile, config),
        enabled: !!user && !!profile,
        staleTime: 2 * 60 * 60 * 1000,
        gcTime: 2 * 60 * 60 * 1000,
    });
    const isPortfolioLoading = !!user && !!profile && isLoading;

    const { addTransaction: addTransactionMutation } = usePortfolioMutations();

    const portfolios = useMemo(() => data?.portfolios ?? [], [data?.portfolios]);
    const allTransactions = useMemo(() => data?.transactions ?? [], [data?.transactions]);
    const portfolioData = useMemo(() => data?.portfolioData ?? {}, [data?.portfolioData]);

    // Initialize current portfolio - REMOVED auto-select to default to "All" (null)
    // useEffect(() => { ... }, []); 

    // Derived state based on current selection
    const currentPortfolio = useMemo(() =>
        portfolios.find(p => p.id === currentPortfolioId) ?? null,
        [portfolios, currentPortfolioId]);

    const transactions = useMemo(() =>
        currentPortfolioId === null
            ? allTransactions
            : allTransactions.filter(t => t.portfolio_id === currentPortfolioId),
        [allTransactions, currentPortfolioId]);

    const holdings: Holding[] = useMemo(() => calculateHoldings(transactions, portfolioData), [transactions, portfolioData]);
    const totalPerformance = useMemo(() => calculateTotalPerformance(transactions, holdings), [transactions, holdings]);
    // Actions
    const selectPortfolio = (portfolioId: number | null) => {
        setCurrentPortfolioId(portfolioId);
    };

    const createPortfolio = async (name: string): Promise<Portfolio> => {
        if (!user) throw new Error("No user");

        const result = await supabase
            .from('portfolios')
            .insert({ user_id: user.id, name })
            .select()
            .single();

        if (result.error) throw result.error;

        const newPortfolio = result.data as Portfolio;
        await queryClient.invalidateQueries({ queryKey: ['portfolio', user.id] });
        setCurrentPortfolioId(newPortfolio.id); // Switch to new
        return newPortfolio;
    };

    const deletePortfolio = async (portfolioId: number) => {
        if (!user) return;

        const { error } = await supabase
            .from('portfolios')
            .delete()
            .eq('id', portfolioId);

        if (error) throw error;

        await queryClient.invalidateQueries({ queryKey: ['portfolio', user.id] });
        // Reset selection if deleted current
        if (currentPortfolioId === portfolioId) {
            setCurrentPortfolioId(null);
        }
    };

    const addTransaction = (transaction: Omit<Transaction, 'id' | 'user_id'>) => {
        if (!user) {
            toast.error("Debes iniciar sesión para agregar una transacción.");
            return Promise.resolve(null);
        };

        // Ensure we have a target portfolio
        const targetPortfolioId = transaction.portfolio_id ?? currentPortfolioId;

        // If still null (All Portfolios view and no specific portfolio passed), error
        if (!targetPortfolioId) {
            toast.error("No se ha seleccionado ningún portafolio.");
            return Promise.resolve(null);
        }

        addTransactionMutation.mutate({
            ...transaction,
            userId: user.id,
            portfolio_id: targetPortfolioId
        });
        return Promise.resolve(null);
    };

    const deleteAsset = async (symbol: string) => {
        if (!user) {
            toast.error("Debes iniciar sesión.");
            return;
        }

        const toastId = toast.loading(`Eliminando ${symbol}...`);
        try {
            // Find transactions to delete
            let transactionsToDelete = [];

            if (currentPortfolioId) {
                transactionsToDelete = allTransactions
                    .filter(t => t.portfolio_id === currentPortfolioId && t.symbol === symbol);
            } else {
                // Delete from ALL portfolios
                transactionsToDelete = allTransactions
                    .filter(t => t.symbol === symbol);
            }

            if (transactionsToDelete.length === 0) {
                toast.dismiss(toastId);
                return;
            }

            const idsToDelete = transactionsToDelete.map(t => t.id);

            const { error } = await supabase
                .from('transactions')
                .delete()
                .in('id', idsToDelete);

            if (error) throw error;

            await queryClient.invalidateQueries({ queryKey: ['portfolio', user.id] });
            toast.success(`${symbol} eliminado correctamente`, { id: toastId });
        } catch {
            toast.error('Error al eliminar el activo', { id: toastId });
        }
    };

    const value: PortfolioContextType = {
        transactions,
        holdings,
        totalPerformance,
        portfolioData,
        portfolios,
        currentPortfolio,
        loading: isPortfolioLoading,
        error: isError ? error.message : null,
        selectPortfolio,
        createPortfolio,
        deletePortfolio,
        addTransaction,
        deleteAsset,
        refreshPortfolio: async () => {
            await refetch();
        },
    };

    return (
        <PortfolioContext.Provider value={value}>
            {children}
        </PortfolioContext.Provider>
    );
}