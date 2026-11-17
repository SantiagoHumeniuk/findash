// src/features/dashboard/pages/dashboard-page.tsx

import { useEffect, useRef, useMemo, useCallback, useState } from "react";
import { useDashboard } from "../../../hooks/use-dashboard";
import { usePortfolio } from "../../../hooks/use-portfolio";
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { useAuth } from "../../../hooks/use-auth";
import { useConfig } from "../../../hooks/use-config";
import { usePlanLimits } from "../../../hooks/use-plan-limits";
import { fetchTickerData } from "../../../services/api/asset-api";
import { fetchYahooAsset } from "../../../services/api/yahoo-finance-api";
import { toast } from "sonner";

import { Card, CardHeader } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Briefcase, ChartCandlestick, RefreshCw, Layers, HelpCircle } from "lucide-react";
import { Skeleton } from "../../../components/ui/skeleton";
import { motion } from "framer-motion";
import { PageHeader } from "../../../components/ui/page-header";
import { TickerAddForm } from "../components/ticker-input/ticker-add-form";
import { SelectedTickersList } from "../components/ticker-input/selected-tickers-list";
import { DashboardTabs } from "../components/tabs/dashboard-tabs";
import { AssetData } from "../../../types/dashboard";
import { ErrorBoundary } from "../../../components/error-boundary";
import { PortfolioSelector } from "../../portfolio/components/portfolio-selector";
import { DashboardGuide } from "../components/onboarding/dashboard-guide";

const containerVariants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
            delayChildren: 0.05
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24, mass: 0.8 } }
};

function DashboardPageContent() {
    const { addTicker, removeTicker, dropFailedTicker, selectedTickers, tickersRestored, hasSavedSelection } = useDashboard();
    const { holdings, loading: portfolioLoading, currentPortfolio } = usePortfolio();
    const { user, profile } = useAuth();
    const config = useConfig();
    const queryClient = useQueryClient();
    const { limit: comparisonLimit } = usePlanLimits('comparison', selectedTickers.length);
    
    // Estado para controlar la guía del dashboard
    const [showGuide, setShowGuide] = useState(false);

    // Referencia para trackear qué tickers han sido cargados automáticamente de este portfolio
    const loadedPortfolioIdRef = useRef<number | null>(null);

    const handleLoadPortfolioTickers = useCallback(() => {
        const existingSymbols = new Set(selectedTickers);
        const candidates = [...new Set(holdings.map(holding => holding.symbol))]
            .filter(symbol => !existingSymbols.has(symbol));
        const role = profile?.role ?? 'basico';
        const restrictedSymbols = role === 'basico'
            ? candidates.filter(symbol => !config.plans.freeTierSymbols.includes(symbol))
            : [];
        const allowedCandidates = candidates.filter(symbol => !restrictedSymbols.includes(symbol));
        const availableSlots = Math.max(0, comparisonLimit - selectedTickers.length);
        const symbolsToAdd = allowedCandidates.slice(0, availableSlots);
        symbolsToAdd.forEach(addTicker);
        if (restrictedSymbols.length > 0) {
            const displayedSymbols = restrictedSymbols.slice(0, 3).join(', ');
            const remaining = restrictedSymbols.length - 3;
            toast.error('Algunos activos no están disponibles en tu plan', {
                description: `${displayedSymbols}${remaining > 0 ? ` y ${remaining} más` : ''}.`,
            });
        }
        if (symbolsToAdd.length < allowedCandidates.length) {
            toast.error('Se alcanzó el límite de comparación', {
                description: `Se agregaron hasta ${comparisonLimit} activos según tu plan.`,
            });
        }
    }, [addTicker, comparisonLimit, config.plans.freeTierSymbols, holdings, profile?.role, selectedTickers]);

    // Cargar tickers del portfolio actual
    useEffect(() => {
        if (tickersRestored && !portfolioLoading && currentPortfolio && holdings.length > 0) {
            // Si cambiamos de portfolio o es la primera carga
            if (loadedPortfolioIdRef.current !== currentPortfolio.id) {
                const isFirstLoad = loadedPortfolioIdRef.current === null;
                loadedPortfolioIdRef.current = currentPortfolio.id;
                // Preserve an intentionally empty list as well as a non-empty saved selection.
                if (isFirstLoad && (selectedTickers.length > 0 || hasSavedSelection)) return;
                handleLoadPortfolioTickers();
            }
        }
        // The ref prevents duplicate imports as selection state changes.
    }, [tickersRestored, portfolioLoading, holdings, currentPortfolio, selectedTickers, hasSavedSelection, handleLoadPortfolioTickers]);

    // [CORREGIDO]: Eliminado el useEffect que borraba localStorage en cada montaje.
    // Esto causaba pérdida de estado al navegar entre páginas.

    // Estabilizar valores para las query keys
    const userId = user?.id ?? null;
    const profileId = profile?.id ?? null;
    const useMockData = config?.useMockData ?? false;
    const isConfigReady = !!config && !!config.api; // Validación de configuración

    const assetQueries = useQueries({
        queries: selectedTickers.map(ticker => {
            return {
                queryKey: ['assetData', ticker, userId, profileId, useMockData] as const,
                queryFn: () => {
                    if (!config) throw new Error("Config not loaded");
                    return fetchTickerData({
                        queryKey: ['assetData', ticker, config, user, profile]
                    });
                },
                // Configuración de Caché Agresiva para evitar recargas al cambiar tabs
                staleTime: 1000 * 60, // 1 minuto
                gcTime: 1000 * 60 * 30, // 30 minutos
                retry: 2,
                refetchInterval: 1000 * 60 * 2,
                refetchOnWindowFocus: false,
                refetchOnReconnect: false,
                refetchOnMount: false, // Importante: no recargar al volver a la página si está en caché
                enabled: !!ticker && isConfigReady,
            };
        }),
    });

    const assets = useMemo(() =>
        assetQueries
            .map(query => query.data)
            .filter((asset): asset is AssetData => asset !== undefined),
        [assetQueries]
    );

    // Detectar activos con error
    const failedTickers = useMemo(() =>
        assetQueries
            .map((query, index) => query.isError ? selectedTickers[index] : null)
            .filter((ticker): ticker is string => ticker !== null),
        [assetQueries, selectedTickers]
    );

    useEffect(() => {
        if (failedTickers.length > 0) {
            failedTickers.forEach(ticker => {
                dropFailedTicker(ticker);
                toast.error(`No se pudo cargar "${ticker}"`, {
                    description: "Verificá el símbolo o intentá más tarde.",
                    duration: 5000,
                });
            });
        }
    }, [failedTickers, dropFailedTicker]);

    const isLoading = assetQueries.some(query => query.isLoading);
    const handleRefresh = useCallback(async () => {
        if (selectedTickers.length === 0) return;
        toast.info('Actualizando datos...', { duration: 1500 });

        // The server rebuilds and saves each asset (the browser cannot write the shared cache).
        const results = await Promise.allSettled(selectedTickers.map((ticker) => fetchYahooAsset(ticker)));
        const failed = results.flatMap((result) => result.status === 'rejected' ? [result.reason] : []);
        if (failed.length > 0) {
            const reason = failed[0] instanceof Error ? failed[0].message : 'Intentá de nuevo en unos minutos.';
            toast.error(failed.length === results.length ? 'No se pudieron actualizar los activos.' : 'Algunos activos no se actualizaron.', { description: reason });
        }

        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['assetData'] }),
            queryClient.invalidateQueries({ queryKey: ['cacheFreshness'] }),
        ]);
    }, [selectedTickers, queryClient]);
    return (
        <motion.div 
            className="container-wide stack-6"
            variants={containerVariants}
            initial="hidden"
            animate="show"
        >
            <motion.div variants={itemVariants} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b">
                <PageHeader
                    icon={<ChartCandlestick className="w-8 h-8 text-primary" />}
                    title="Dashboard de Análisis"
                    description="Monitorea y analiza tus activos financieros."
                    className="mb-0 border-b-0 pb-0"
                />
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="hidden sm:flex items-center text-sm text-muted-foreground mr-2">
                        <Layers className="w-4 h-4 mr-1.5" />
                        <span>Viendo:</span>
                    </div>
                    <PortfolioSelector />
                    <Button
                        onClick={() => setShowGuide(true)}
                        variant="outline"
                        size="sm"
                        className="gap-2 whitespace-nowrap"
                        title="Ver guía de uso"
                    >
                        <HelpCircle className="w-4 h-4" />
                        <span className="hidden sm:inline">Guía</span>
                    </Button>
                </div>
            </motion.div>

            <motion.div variants={itemVariants}>
                <div id="ticker-search-container" className="relative p-[1.5px] rounded-2xl bg-gradient-to-br from-primary/30 via-blue-500/10 to-cyan-400/30 overflow-hidden group hover:from-primary/50 hover:to-cyan-400/50 transition-all duration-500">
                    <Card className="bg-background/95 border-0 rounded-2xl shadow-inner h-full">
                        <CardHeader className="relative z-10">
                            <TickerAddForm onAddTicker={addTicker} />
                            <SelectedTickersList tickers={selectedTickers} onRemoveTicker={removeTicker} />
                        </CardHeader>
                    </Card>
                </div>
            </motion.div>

            {!tickersRestored ? (
                <Skeleton className="h-48 w-full rounded-2xl" />
            ) : selectedTickers.length === 0 ? (
                <motion.div
                    variants={itemVariants}
                    className="relative overflow-hidden rounded-2xl border bg-card/60 px-4 py-6 shadow-sm sm:p-8"
                >
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-cyan-400/5" />
                    <div className="relative">
                        <div className="flex items-center gap-3">
                            <div className="rounded-xl border bg-background p-2.5 text-primary">
                                <Briefcase className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-lg font-semibold tracking-tight sm:text-xl">Empezá con un activo</h2>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Buscá un símbolo arriba o cargá las posiciones de tu cartera cuando quieras.
                                </p>
                            </div>
                        </div>
                        <div className="mt-5 grid gap-2 sm:grid-cols-3">
                            <div className="rounded-lg border bg-background/60 p-3">
                                <p className="text-sm font-medium">1. Elegí</p>
                                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Agregá el activo que te interesa.</p>
                            </div>
                            <div className="rounded-lg border bg-background/60 p-3">
                                <p className="text-sm font-medium">2. Entendé</p>
                                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Empezá por el precio y su evolución.</p>
                            </div>
                            <div className="rounded-lg border bg-background/60 p-3">
                                <p className="text-sm font-medium">3. Profundizá</p>
                                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Abrí ratios o compará activos cuando lo necesites.</p>
                            </div>
                        </div>
                        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-xs text-muted-foreground">
                                Ejemplos: AAPL, YPF, SPY
                            </p>
                            <div className="flex flex-col gap-2 sm:flex-row">
                                {holdings.length > 0 && (
                                    <Button onClick={handleLoadPortfolioTickers} size="sm" className="w-full gap-2 sm:w-auto">
                                        <Briefcase className="h-4 w-4" />
                                        Cargar activos de cartera
                                    </Button>
                                )}
                                <Button onClick={() => setShowGuide(true)} variant="outline" size="sm" className="w-full gap-2 sm:w-auto">
                                    <HelpCircle className="h-4 w-4" />
                                    Guía rápida
                                </Button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            ) : (
                <motion.div variants={itemVariants} className="stack-6">
                    <div className="flex flex-col sm:flex-row items-end sm:items-center justify-end gap-3 mb-4">
                        <Button
                            onClick={() => void handleRefresh()}
                            disabled={isLoading}
                            variant="outline"
                            size="sm"
                            className="gap-2"
                        >
                            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                            <span className="hidden sm:inline">Actualizar datos</span>
                            <span className="sm:hidden">Actualizar</span>
                        </Button>
                    </div>

                    <DashboardTabs assets={assets} isLoading={isLoading} />
                </motion.div>
            )}
            
            {/* Guía del Dashboard */}
            <DashboardGuide 
                isVisible={showGuide} 
                onDismiss={() => setShowGuide(false)} 
            />
        </motion.div>
    );
}

export default function DashboardPage() {
    return (
        <ErrorBoundary level="feature" featureName="Dashboard">
            <DashboardPageContent />
        </ErrorBoundary>
    );
}