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
import { fetchLocalMarket, type LocalMarket } from '../services/api/local-market-api';
import {
    fetchIolMarketData,
    getIolMarketDataRequestKey,
    type IolMarketDataRequest,
} from '../services/api/iol-market-data-api';
import { fetchCclRate } from '../hooks/use-ccl-rate';
import {
    buildCedearUnderlyingAsset,
    buildLocalAsset,
    getIolMarketForExchange,
    getReliableIolPrice,
    isLocalPortfolioSymbol,
    mergeCedearQuote,
    normalizeLegacyPortfolioSymbol,
} from '../features/portfolio/lib/local-assets';
import {
    getCedearTickersForUnderlying,
    getCedearUnderlyingTicker,
} from '../data/cedear-ratio-lookup';
import { useCedearRatios } from '../hooks/use-cedear-ratios';
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
    cedearRatios: Record<string, number>,
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

    const transactions = ((transResult.data || []) as Transaction[]).map((transaction) => {
        const symbol = normalizeLegacyPortfolioSymbol(transaction.symbol);
        return symbol === transaction.symbol ? transaction : { ...transaction, symbol };
    });
    const symbols = [...new Set(transactions.map((t: Transaction) => t.symbol))];
    const portfolioData: Record<string, AssetData> = {};
    const unavailableSymbols: string[] = [];

    // Use shared cache first; only cache misses use a plan-metered asset lookup.
    // A few at a time: concurrent enough to be fast, gentle enough on the Edge Function.
    // Local stocks, bonds and CEDEARs use Buenos Aires quotes (one request for all of them).
    const localSymbols = symbols.filter(isLocalPortfolioSymbol);
    const cedearSymbols = symbols.filter((symbol) =>
        !isLocalPortfolioSymbol(symbol) && getCedearTickersForUnderlying(symbol, cedearRatios).length > 0
    );
    const localCedearAssets: Record<string, AssetData> = {};
    let market: LocalMarket = { fetchedAt: new Date().toISOString(), quotes: new Map() };
    let cclRate = 0;
    if (localSymbols.length > 0 || cedearSymbols.length > 0) {
        const [localMarketResult, cclResult] = await Promise.allSettled([
            fetchLocalMarket(),
            fetchCclRate(),
        ]);
        if (localMarketResult.status === 'fulfilled') {
            market = localMarketResult.value;
        } else {
            void logger.warn('PORTFOLIO_DATA912_PRICES_FAILED', errorToString(localMarketResult.reason));
        }
        if (cclResult.status === 'fulfilled') {
            cclRate = cclResult.value.rate;
        } else {
            void logger.warn('PORTFOLIO_CCL_RATE_FAILED', errorToString(cclResult.reason));
        }

        const localQuoteKinds = new Map<string, 'stock' | 'cedear'>();
        for (const symbol of localSymbols) {
            const ticker = symbol.toUpperCase().replace(/\.BA$/, '');
            if (market.quotes.get(ticker)?.kind === 'stock') localQuoteKinds.set(ticker, 'stock');
        }

        for (const symbol of cedearSymbols) {
            const candidates = getCedearTickersForUnderlying(symbol, cedearRatios);
            const alreadyListed = candidates.filter((ticker) => market.quotes.get(ticker)?.kind === 'cedear');
            const orderedCandidates = [
                ...alreadyListed,
                ...candidates.filter((ticker) => !alreadyListed.includes(ticker)),
            ];
            for (const ticker of orderedCandidates) {
                if (!localQuoteKinds.has(ticker)) localQuoteKinds.set(ticker, 'cedear');
            }
        }

        const localIolRequests: IolMarketDataRequest[] = [...localQuoteKinds.keys()].map((symbol) => ({
            symbol,
            market: 'BCBA',
            term: 'T0',
        }));
        if (localIolRequests.length > 0) {
            try {
                const results = await fetchIolMarketData(localIolRequests);
                for (const result of results) {
                    if ('error' in result) {
                        void logger.warn('IOL_LOCAL_QUOTE_FAILED', `IOL no devolvió ${result.request.symbol}`, {
                            symbol: result.request.symbol,
                            errorMessage: result.error,
                        });
                        continue;
                    }
                    const reliablePrice = getReliableIolPrice(result);
                    if (!reliablePrice) continue;
                    const symbol = result.request.symbol;
                    const quote = {
                        symbol,
                        price: reliablePrice.price,
                        changePercent: result.quote.changePercent,
                        kind: localQuoteKinds.get(symbol) ?? 'cedear',
                        source: 'IOL' as const,
                        lastUpdated: new Date(reliablePrice.timestamp).toISOString(),
                        bid: result.topOfBook.bid?.price ?? null,
                        ask: result.topOfBook.ask?.price ?? null,
                        bookUpdatedAt: result.topOfBook.lastUpdated,
                    };
                    market.quotes.set(symbol, quote);
                }
            } catch (error) {
                void logger.error('PORTFOLIO_IOL_LOCAL_PRICES_FAILED', errorToString(error));
            }
        }

        if (cclRate > 0) {
            for (const symbol of localSymbols) {
                const asset = buildLocalAsset(symbol, market, cclRate);
                if (asset) portfolioData[symbol] = asset;
            }
            for (const symbol of cedearSymbols) {
                const asset = buildCedearUnderlyingAsset(symbol, market, cclRate, cedearRatios);
                if (asset) localCedearAssets[symbol] = asset;
            }
        }
    }

    const loadSymbol = async (symbol: string) => {
        if (portfolioData[symbol]) return;
        if (isLocalPortfolioSymbol(symbol) && localSymbols.length > 0 && !portfolioData[symbol]) {
            // Not listed today (e.g. a matured bond): shown at cost rather than as a total loss.
            unavailableSymbols.push(symbol);
            return;
        }
        const localCedearAsset = localCedearAssets[symbol];
        try {
            const asset = await fetchTickerData({
                queryKey: ['assetData', symbol, config, user, profile],
                fromPortfolio: true,
            });
            portfolioData[symbol] = localCedearAsset ? mergeCedearQuote(asset, localCedearAsset) : asset;
        } catch (error) {
            if (localCedearAsset) {
                portfolioData[symbol] = localCedearAsset;
                return;
            }
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

    const underlyingRequestsBySymbol = new Map<string, IolMarketDataRequest>();
    for (const symbol of cedearSymbols) {
        const asset = portfolioData[symbol];
        const marketName = asset ? getIolMarketForExchange(asset.profile.exchange) : null;
        if (!marketName) continue;
        const request: IolMarketDataRequest = {
            symbol: getCedearUnderlyingTicker(symbol, cedearRatios),
            market: marketName,
            term: 'T1',
        };
        underlyingRequestsBySymbol.set(symbol, request);
    }

    if (underlyingRequestsBySymbol.size > 0) {
        try {
            const results = await fetchIolMarketData([...underlyingRequestsBySymbol.values()]);
            const resultsByKey = new Map(
                results.map((result) => [getIolMarketDataRequestKey(result.request), result]),
            );
            for (const [symbol, request] of underlyingRequestsBySymbol) {
                const result = resultsByKey.get(getIolMarketDataRequestKey(request));
                if (!result || 'error' in result) {
                    if (result && 'error' in result) {
                        void logger.warn('IOL_UNDERLYING_QUOTE_FAILED', `IOL no devolvió ${request.symbol}`, {
                            symbol: request.symbol,
                            errorMessage: result.error,
                        });
                    }
                    continue;
                }
                const asset = portfolioData[symbol];
                if (!asset) continue;
                portfolioData[symbol] = mergeCedearQuote(
                    asset,
                    localCedearAssets[symbol] ?? asset,
                    result,
                );
            }
        } catch (error) {
            void logger.error('PORTFOLIO_IOL_UNDERLYING_PRICES_FAILED', errorToString(error));
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
    const { ratios: cedearRatios } = useCedearRatios();
    const queryClient = useQueryClient();

    // Local state for selected portfolio ID
    const [currentPortfolioId, setCurrentPortfolioId] = useState<number | null>(null);

    const { data, isLoading, isError, error, refetch } = useQuery({
        queryKey: ['portfolio', user?.id, cedearRatios],
        queryFn: () => fetchPortfolioData(user, profile, config, cedearRatios),
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