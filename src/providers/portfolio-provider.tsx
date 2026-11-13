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
import { fetchLocalMarket } from '../services/api/local-market-api';
import { fetchCclRate } from '../hooks/use-ccl-rate';
import { buildLocalAsset, isLocalPortfolioSymbol } from '../features/portfolio/lib/local-assets';
import type { Config } from '../types/config';
import type { Profile } from '../types/auth';
import type { User } from '@supabase/supabase-js';


// eslint-disable-next-line react-refresh/only-export-components
export const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

const PORTFOLIO_LOAD_CONCURRENCY = 4;

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
    // A few at a time: concurrent enough to be fast, gentle enough on the Edge Function.
    // Local stocks and bonds are priced with Buenos Aires quotes (one request for all of them).
    const localSymbols = symbols.filter(isLocalPortfolioSymbol);
    if (localSymbols.length > 0) {
        try {
            const [market, ccl] = await Promise.all([fetchLocalMarket(), fetchCclRate()]);
            for (const symbol of localSymbols) {
                const asset = buildLocalAsset(symbol, market, ccl.rate);
                if (asset) portfolioData[symbol] = asset;
            }
        } catch (error) {
            void logger.error('PORTFOLIO_LOCAL_PRICES_FAILED', errorToString(error));
        }
    }

    const loadSymbol = async (symbol: string) => {
        if (portfolioData[symbol]) return;
        if (isLocalPortfolioSymbol(symbol) && localSymbols.length > 0 && !portfolioData[symbol]) {
            // Not listed today (e.g. a matured bond): shown at cost rather than as a total loss.
            unavailableSymbols.push(symbol);
            return;
        }
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
    };
    for (let index = 0; index < symbols.length; index += PORTFOLIO_LOAD_CONCURRENCY) {
        await Promise.all(symbols.slice(index, index + PORTFOLIO_LOAD_CONCURRENCY).map(loadSymbol));
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
        if (!user) throw new Error('Debes iniciar sesión para eliminar un portafolio.');

        const portfolioResult = await supabase
            .from('portfolios')
            .select('id')
            .eq('id', portfolioId)
            .eq('user_id', user.id)
            .maybeSingle();

        if (portfolioResult.error) {
            throw new Error(`No se pudo verificar el portafolio: ${portfolioResult.error.message}`);
        }
        if (!portfolioResult.data) {
            throw new Error('El portafolio no existe o no tenés permiso para eliminarlo.');
        }

        const transactionsResult = await supabase
            .from('transactions')
            .delete()
            .eq('user_id', user.id)
            .eq('portfolio_id', portfolioId);

        if (transactionsResult.error) {
            throw new Error(`No se pudieron eliminar las transacciones del portafolio: ${transactionsResult.error.message}`);
        }

        const deleteResult = await supabase
            .from('portfolios')
            .delete()
            .eq('id', portfolioId)
            .eq('user_id', user.id)
            .select('id')
            .maybeSingle();

        if (deleteResult.error) {
            throw new Error(`No se pudo eliminar el portafolio: ${deleteResult.error.message}`);
        }
        if (!deleteResult.data) {
            throw new Error('No se eliminó el portafolio. Verifica los permisos de borrado en Supabase.');
        }

        await queryClient.invalidateQueries({ queryKey: ['portfolio', user.id] });
        // Reset selection if deleted current
        if (currentPortfolioId === portfolioId) {
            setCurrentPortfolioId(null);
        }
    };

    const addTransaction = async (transaction: Omit<Transaction, 'id' | 'user_id'>) => {
        if (!user) {
            toast.error("Debes iniciar sesión para agregar una transacción.");
            return null;
        }

        // Ensure we have a target portfolio
        const targetPortfolioId = transaction.portfolio_id ?? currentPortfolioId;

        // If still null (All Portfolios view and no specific portfolio passed), error
        if (!targetPortfolioId) {
            toast.error("No se ha seleccionado ningún portafolio.");
            return null;
        }

        // Awaited so callers only report success once the database accepted it.
        await addTransactionMutation.mutateAsync({
            ...transaction,
            userId: user.id,
            portfolio_id: targetPortfolioId
        });
        return null;
    };

    const importTransactions = async (
        transactionsToImport: Omit<Transaction, 'id' | 'user_id'>[],
        options: { replacePortfolioId?: number } = {},
    ) => {
        if (!user) throw new Error('Debes iniciar sesión para importar transacciones.');
        if (transactionsToImport.length === 0) return [];

        // Importing the same account twice used to double every position; a snapshot replaces it.
        let removed: Transaction[] = [];
        if (options.replacePortfolioId !== undefined) {
            const deletion = await supabase
                .from('transactions')
                .delete()
                .eq('user_id', user.id)
                .eq('portfolio_id', options.replacePortfolioId)
                .select();
            if (deletion.error) throw new Error(`No se pudo vaciar el portafolio: ${deletion.error.message}`);
            removed = (deletion.data ?? []) as Transaction[];
        }

        const result = await supabase
            .from('transactions')
            .insert(transactionsToImport.map((transaction) => ({
                ...transaction,
                user_id: user.id,
            })))
            .select();

        if (result.error) {
            // Put back what was removed, so a failed import never leaves the portfolio empty.
            if (removed.length > 0) {
                await supabase.from('transactions').insert(removed.map(({ id: _id, ...transaction }) => transaction));
            }
            await queryClient.invalidateQueries({ queryKey: ['portfolio', user.id] });
            throw new Error(result.error.message);
        }

        await queryClient.invalidateQueries({ queryKey: ['portfolio', user.id] });
        return (result.data ?? []) as Transaction[];
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
        importTransactions,
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