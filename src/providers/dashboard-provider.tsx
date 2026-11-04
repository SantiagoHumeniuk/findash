// src/providers/dashboard-provider.tsx

import React, { useCallback, useEffect, useRef, useState, useMemo, createContext } from "react";
import { toast } from "sonner";
import { useAuth } from "../hooks/use-auth";
import { useConfig } from "../hooks/use-config";
import { DashboardContextType } from "../types/dashboard";
import { indicatorConfig } from "../utils/financial";
import { logger } from "../lib/logger";
import { usePlanLimits } from "../hooks/use-plan-limits";
import { getSymbolRestrictionMessage } from "../utils/plan-validators";
import {
    normalizeSavedTickers,
    readLocalTickers,
    saveAccountTickers,
    writeLocalTickers,
} from "../features/dashboard/lib/saved-tickers";

const ACCOUNT_SAVE_DELAY_MS = 1000;

// eslint-disable-next-line react-refresh/only-export-components
export const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
    const { profile } = useAuth();
    const config = useConfig();
    
    const [selectedTickers, setSelectedTickers] = useState<string[]>([]);
    const [tickersRestored, setTickersRestored] = useState(false);
    // Saved tickers that failed this session stay saved: the failure may be temporary.
    const restoredTickersRef = useRef(new Set<string>());
    const failedTickersRef = useRef(new Set<string>());
    
    // Hook para verificar límite de comparación
    const { isAtLimit, limit, limitMessage } = usePlanLimits('comparison', selectedTickers.length);

    const profileId = profile?.id;
    useEffect(() => {
        restoredTickersRef.current = new Set();
        failedTickersRef.current = new Set();
        if (!profileId || !profile) {
            setSelectedTickers([]);
            setTickersRestored(false);
            return;
        }
        // This device's list is the most recent; the account's list covers new devices.
        const saved = readLocalTickers(profileId) ?? normalizeSavedTickers(profile.onboarding_profile?.dashboardTickers);
        // A downgraded plan may no longer allow everything that was saved.
        const allowed = (profile.role ?? 'basico') === 'basico'
            ? saved.filter((ticker) => config.plans.freeTierSymbols.includes(ticker))
            : saved;
        const restored = limit > 0 ? allowed.slice(0, limit) : allowed;
        restoredTickersRef.current = new Set(restored);
        setSelectedTickers(restored);
        setTickersRestored(true);
        // Restore once per user, not on every profile or plan refresh.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profileId]);

    useEffect(() => {
        if (!tickersRestored || !profileId) return;
        const tickers = [...selectedTickers, ...failedTickersRef.current];
        writeLocalTickers(profileId, tickers);
        const timer = window.setTimeout(() => void saveAccountTickers(profileId, tickers), ACCOUNT_SAVE_DELAY_MS);
        return () => window.clearTimeout(timer);
    }, [selectedTickers, tickersRestored, profileId]);

    const addTicker = useCallback((tickerRaw: string) => {
        const ticker = tickerRaw.trim().toUpperCase();
        if (!ticker) return;

        if (selectedTickers.includes(ticker)) return;

        const role = profile?.role ?? 'basico';
        
        /**
         * LÍMITE DE PLANES: dashboard.maxTickersToCompare
         * 
         * Aplicación: Número máximo de activos que el usuario puede comparar simultáneamente
         * en el dashboard.
         * 
         * Valores por plan (config.dashboard.maxTickersToCompare):
         * - basico: 3 activos
         * - plus: 5 activos
         * - premium: 10 activos
         * - administrador: 20 activos
         * 
         * Dónde se aplica: DashboardProvider.addTicker()
         * Impacto: Limita la cantidad de columnas en las tablas comparativas
         */
        // Verificar límite de comparación
        if (isAtLimit) {
            void logger.warn('DASHBOARD_MAX_TICKERS_REACHED', `User attempted to add more than ${limit} tickers`, {
                role,
                maxTickers: limit,
                currentCount: selectedTickers.length,
            });
            toast.error(`Límite de comparación alcanzado`, {
                description: limitMessage || `Podés comparar hasta ${limit} activos a la vez en tu plan.`,
            });
            return;
        }

        /**
         * LÍMITE DE PLANES: plans.freeTierSymbols
         * 
         * Aplicación: Lista de símbolos de activos permitidos para el plan Básico.
         * Los usuarios del plan Básico solo pueden analizar activos en esta lista.
         * 
         * Dónde se aplica: DashboardProvider.addTicker()
         * Impacto: Restringe el acceso a solo ~90 activos populares para el plan gratuito
         * 
         * Nota: Los planes superiores (plus, premium, administrador) no tienen esta restricción.
         */
        if (role === 'basico' && !config.plans.freeTierSymbols.includes(ticker)) {
            void logger.warn('DASHBOARD_RESTRICTED_TICKER', `User in basico plan attempted to add restricted ticker: ${ticker}`, {
                role,
                ticker,
            });
            const message = getSymbolRestrictionMessage(ticker);
            toast.error(`Símbolo no disponible`, {
                description: message,
            });
            return;
        }
        
        void logger.info('DASHBOARD_TICKER_ADDED', `Ticker ${ticker} added to comparison`, {
            ticker,
            role,
            totalTickers: selectedTickers.length + 1,
        });
        failedTickersRef.current.delete(ticker);
        setSelectedTickers(prev => prev.includes(ticker) ? prev : [...prev, ticker]);

    }, [config, profile?.role, selectedTickers, isAtLimit, limit, limitMessage]);

    const removeTicker = useCallback((ticker: string) => {
        void logger.info('DASHBOARD_TICKER_REMOVED', `Ticker ${ticker} removed from comparison`, {
            ticker,
        });
        failedTickersRef.current.delete(ticker);
        restoredTickersRef.current.delete(ticker);
        setSelectedTickers(prev => prev.filter(t => t !== ticker));
    }, []);

    const dropFailedTicker = useCallback((ticker: string) => {
        if (restoredTickersRef.current.has(ticker)) failedTickersRef.current.add(ticker);
        setSelectedTickers(prev => prev.filter(t => t !== ticker));
    }, []);
    
    const value: DashboardContextType = useMemo(() => ({
        indicatorConfig,
        selectedTickers,
        addTicker,
        removeTicker,
        dropFailedTicker,
        tickersRestored,
    }), [selectedTickers, addTicker, removeTicker, dropFailedTicker, tickersRestored]);

    return (
        <DashboardContext.Provider value={value}>
            {children}
        </DashboardContext.Provider>
    );
}