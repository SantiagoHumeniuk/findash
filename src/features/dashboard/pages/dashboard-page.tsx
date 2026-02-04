// src/features/dashboard/pages/dashboard-page.tsx

import { useEffect, useRef, useMemo, useCallback, useState } from "react";
import { useDashboard } from "../../../hooks/use-dashboard";
import { usePortfolio } from "../../../hooks/use-portfolio";
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { useAuth } from "../../../hooks/use-auth";
import { useConfig } from "../../../hooks/use-config";
import { fetchTickerData } from "../../../services/api/asset-api";
import { toast } from "sonner";
import { supabase } from "../../../lib/supabase";

import { Card, CardHeader } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Briefcase, ChartCandlestick, RefreshCw, Layers, HelpCircle } from "lucide-react";
import { motion } from "framer-motion";
import { PageHeader } from "../../../components/ui/page-header";
import { TickerAddForm } from "../components/ticker-input/ticker-add-form";
import { SelectedTickersList } from "../components/ticker-input/selected-tickers-list";
import { DashboardTabs } from "../components/tabs/dashboard-tabs";
import { DashboardSkeleton } from "../components/skeleton/dashboard-skeleton";
import { AssetData } from "../../../types/dashboard";
import { ErrorBoundary } from "../../../components/error-boundary";
import { PortfolioSelector } from "../../portfolio/components/portfolio-selector";
import { DashboardGuide } from "../components/onboarding/dashboard-guide";

function DashboardPageContent() {
    const { addTicker, removeTicker, selectedTickers } = useDashboard();
    const { holdings, loading: portfolioLoading, currentPortfolio } = usePortfolio();
    const { user, profile } = useAuth();
    const config = useConfig();
    const queryClient = useQueryClient();
    
    // Estado para controlar la guía del dashboard
    const [showGuide, setShowGuide] = useState(false);

    // Referencia para trackear qué tickers han sido cargados automáticamente de este portfolio
    const loadedPortfolioIdRef = useRef<number | null>(null);

    // Cargar tickers del portfolio actual
    useEffect(() => {
        if (!portfolioLoading && currentPortfolio && holdings.length > 0) {
            // Si cambiamos de portfolio o es la primera carga
            if (loadedPortfolioIdRef.current !== currentPortfolio.id) {
                loadedPortfolioIdRef.current = currentPortfolio.id;
                const portfolioSymbols = holdings.map(h => h.symbol);
                portfolioSymbols.forEach(symbol => {
                    addTicker(symbol);
                });
            }
        }
    }, [portfolioLoading, holdings, currentPortfolio, addTicker]);

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
                staleTime: 1000 * 60 * 10, // 10 minutos
                gcTime: 1000 * 60 * 30, // 30 minutos
                retry: 2,
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
                removeTicker(ticker);
                toast.error(`No se pudo cargar "${ticker}"`, {
                    description: "Verifica el símbolo o intenta más tarde.",
                    duration: 5000,
                });
            });
        }
    }, [failedTickers, removeTicker]);

    const isLoading = assetQueries.some(query => query.isLoading);
    // Solo mostramos loading inicial si no hay NINGÚN activo cargado
    const isInitialLoading = isLoading && assets.length === 0;

    const handleRefresh = useCallback(() => {
        if (selectedTickers.length === 0) return;
        toast.info('Actualizando datos...', { duration: 1500 });

        // Invalidar cache de Supabase (lógica optimista)
        void supabase
            .from('asset_data_cache')
            .update({ last_updated_at: new Date(0).toISOString() })
            .in('symbol', selectedTickers)
            .then(({ error }) => { if (error) console.error(error); });

        void queryClient.invalidateQueries({ queryKey: ['assetData'] });
        void queryClient.invalidateQueries({ queryKey: ['cacheFreshness'] });
    }, [selectedTickers, queryClient]);

    if (isInitialLoading) {
        return <DashboardSkeleton />;
    }

    return (
        <div className="container-wide stack-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b">
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
            </div>

            <Card className="card-static">
                <CardHeader>
                    <TickerAddForm onAddTicker={addTicker} />
                    <SelectedTickersList tickers={selectedTickers} onRemoveTicker={removeTicker} />
                </CardHeader>
            </Card>

            {selectedTickers.length === 0 ? (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="text-center py-12 sm:py-20 px-4 sm:px-6 border-2 border-dashed rounded-lg"
                >
                    <Briefcase className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-muted-foreground mb-3 sm:mb-4" />
                    <h2 className="text-base sm:text-lg font-semibold mb-1.5 sm:mb-2">Tu dashboard está vacío</h2>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                        Activos de "{currentPortfolio?.name}" se mostrarán automáticamente.<br />
                        O comienza añadiendo un activo manualmente.
                    </p>
                    <Button
                        onClick={() => setShowGuide(true)}
                        variant="outline"
                        size="sm"
                        className="mt-4 gap-2"
                    >
                        <HelpCircle className="w-4 h-4" />
                        Ver guía paso a paso
                    </Button>
                </motion.div>
            ) : (
                <>
                    <div className="flex flex-col sm:flex-row items-end sm:items-center justify-end gap-3 mb-4">
                        <Button
                            onClick={handleRefresh}
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
                </>
            )}
            
            {/* Guía del Dashboard */}
            <DashboardGuide 
                isVisible={showGuide} 
                onDismiss={() => setShowGuide(false)} 
            />
        </div>
    );
}

export default function DashboardPage() {
    return (
        <ErrorBoundary level="feature" featureName="Dashboard">
            <DashboardPageContent />
        </ErrorBoundary>
    );
}