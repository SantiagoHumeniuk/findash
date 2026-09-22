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
import { Briefcase, ChartCandlestick, RefreshCw, Layers, HelpCircle, Search } from "lucide-react";
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
    hidden: { opacity: 0, y: 20, filter: "blur(4px)" },
    show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { type: "spring", stiffness: 300, damping: 24, mass: 0.8 } }
};

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
                    <Card className="bg-background/95 backdrop-blur-xl border-0 rounded-2xl shadow-inner h-full">
                        <CardHeader className="relative z-10">
                            <TickerAddForm onAddTicker={addTicker} />
                            <SelectedTickersList tickers={selectedTickers} onRemoveTicker={removeTicker} />
                        </CardHeader>
                    </Card>
                </div>
            </motion.div>

            {selectedTickers.length === 0 ? (
                <motion.div
                    variants={itemVariants}
                    className="relative flex flex-col items-center text-center py-16 sm:py-24 px-6 border border-white/[0.05] rounded-3xl bg-card/30 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] overflow-hidden group"
                >
                    {/* Glowing background effect */}
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-cyan-400/5 opacity-50 group-hover:opacity-100 transition-opacity duration-700" />
                    
                    <div className="relative p-5 sm:p-6 bg-background/50 rounded-full border border-white/5 mb-6 shadow-inner">
                        <Briefcase className="w-12 h-12 sm:w-16 sm:h-16 text-primary drop-shadow-[0_0_15px_rgba(56,189,248,0.5)] transition-transform duration-500 group-hover:scale-110" />
                    </div>
                    
                    <h2 className="text-xl sm:text-2xl font-bold mb-3 tracking-tight text-foreground/90">
                        Aún no tienes activos en seguimiento
                    </h2>
                    
                    <p className="text-sm sm:text-base text-muted-foreground max-w-md mx-auto mb-4 leading-relaxed font-medium">
                        ¡Empezá a analizar tus activos favoritos!
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground/70 max-w-sm mx-auto">
                        Busca y añade tus primeros activos financieros en la barra superior para comenzar a monitorear su rendimiento en tiempo real.
                    </p>
                </motion.div>
            ) : (
                <motion.div variants={itemVariants} className="stack-6">
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