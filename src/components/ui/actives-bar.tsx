// src/components/actives-bar.tsx

import { useEffect, useState, memo } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowDown, ArrowUp, TrendingUp, BookOpen, Lightbulb } from 'lucide-react';
import { fetchGainers, fetchLosers, fetchActives } from '../../features/market-movers/services/market-movers-service';
import type { MarketMover } from '../../features/market-movers/types';

// Lista de símbolos populares para priorizar en la visualización
const KNOWN_SYMBOLS = [
    "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "BRK-B", "LLY", "AVGO", "TSM", "NVO", "V",
    "JPM", "WMT", "XOM", "MA", "UNH", "PG", "JNJ", "COST", "HD", "MRK", "ABBV", "CVX", "CRM", "BAC",
    "AMD", "NFLX", "PEP", "KO", "DIS", "ADBE", "MCD", "CSCO", "TM", "ASML", "ORCL", "NKE", "WFC",
    "QCOM", "ACN", "IBM", "GE", "VZ", "CAT", "INTC", "UBER", "ABNB", "PYPL", "INTU", "AMGN", "TXN",
    "SONY", "PFE", "BA", "SBUX", "HON", "AMAT", "NOW", "GS", "MS", "RTX", "BKNG", "T", "C", "BLK",
    "DE", "MELI", "SHOP", "SPOT", "F", "GM", "AXP", "UPS", "PM", "PLTR", "COIN", "BABA", "PDD",
    "SHEL", "SPY", "QQQ", "DIA", "GLD", "VOO", "SMH"
];

// Tips educativos para mostrar cuando no hay activos o cargando
const educationalTips = [
    { icon: TrendingUp, text: "La diversificación reduce el riesgo: no pongas todos los huevos en la misma canasta." },
    { icon: BookOpen, text: "El interés compuesto es la octava maravilla del mundo - Albert Einstein." },
    { icon: Lightbulb, text: "Invierte a largo plazo: el tiempo en el mercado supera al timing del mercado." },
    { icon: TrendingUp, text: "Warren Buffett: 'El mejor momento para plantar un árbol fue hace 20 años. El segundo mejor momento es ahora.'" },
    { icon: BookOpen, text: "Regla del 72: Divide 72 por el rendimiento anual para saber en cuántos años duplicarás tu inversión." },
    { icon: Lightbulb, text: "No inviertas en lo que no entiendes. La educación financiera es tu mejor activo." },
    { icon: TrendingUp, text: "El S&P 500 ha tenido un retorno promedio del 10% anual en los últimos 100 años." },
    { icon: BookOpen, text: "Dollar Cost Averaging: Invierte montos fijos regularmente para reducir el impacto de la volatilidad." },
    { icon: Lightbulb, text: "Mantén un fondo de emergencia de 6 meses antes de invertir agresivamente." },
    { icon: TrendingUp, text: "Los dividendos reinvertidos representan aproximadamente el 40% del retorno histórico del mercado." },
];

// Componente para un solo item del ticker.
const TickerItem = memo(({ asset }: { asset: MarketMover }) => {
    const isPositive = asset.changesPercentage >= 0;
    const colorClass = isPositive ? "text-green-500" : "text-red-500";
    const Icon = isPositive ? ArrowUp : ArrowDown;

    return (
        <div className="flex items-center flex-shrink-0 px-6 body-sm whitespace-nowrap">
            <span className="font-bold text-foreground">{asset.symbol}</span>
            <div className={`flex items-center ml-2 font-medium ${colorClass}`}>
                <Icon className="w-4 h-4 mr-1" />
                <span>{Math.abs(asset.changesPercentage).toFixed(2)}%</span>
            </div>
        </div>
    );
});
TickerItem.displayName = 'TickerItem';

/**
 * Barra superior que muestra un carrusel infinito con el rendimiento diario de activos.
 * Prioriza activos conocidos y complementa con los mayores movimientos del mercado.
 */
export default function ActivesBar() {
    const [activeAssets, setActiveAssets] = useState<MarketMover[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentTipIndex, setCurrentTipIndex] = useState(0);
    const location = useLocation();

    useEffect(() => {
        const loadAssets = async () => {
            setLoading(true);
            try {
                // 1. Cargar datos de múltiples fuentes en paralelo
                const [gainers, losers, actives] = await Promise.all([
                    fetchGainers(),
                    fetchLosers(),
                    fetchActives()
                ]);

                // 2. Unificar y eliminar duplicados
                const allAssets = [...gainers, ...losers, ...actives];
                const uniqueMap = new Map<string, MarketMover>();

                allAssets.forEach(asset => {
                    if (!uniqueMap.has(asset.symbol)) {
                        uniqueMap.set(asset.symbol, asset);
                    }
                });

                const uniqueAssets = Array.from(uniqueMap.values());

                // 3. Estrategia de Priorización
                // A. Encontrar los símbolos "famosos" en los resultados
                const knownAssets = uniqueAssets.filter(a => KNOWN_SYMBOLS.includes(a.symbol));

                // B. Tomar el resto de activos
                const otherAssets = uniqueAssets.filter(a => !KNOWN_SYMBOLS.includes(a.symbol));

                // C. Ordenar los "otros" por volatilidad absoluta (para mostrar cosas interesantes)
                otherAssets.sort((a, b) => Math.abs(b.changesPercentage) - Math.abs(a.changesPercentage));

                // 4. Construir lista final: Conocidos primero + Top 20 del resto para rellenar
                const finalAssets = [...knownAssets, ...otherAssets.slice(0, 25)];

                setActiveAssets(finalAssets);
            } catch (error) {
                console.error("Error loading market actives:", error);
            } finally {
                setLoading(false);
            }
        };
        void loadAssets();
    }, []);

    // Rotar tips cada 8 segundos cuando no hay activos
    useEffect(() => {
        if (!loading && activeAssets.length === 0) {
            const interval = setInterval(() => {
                setCurrentTipIndex((prev) => (prev + 1) % educationalTips.length);
            }, 8000);
            return () => clearInterval(interval);
        }
    }, [loading, activeAssets.length]);

    const isHomePage = location.pathname === '/' || location.pathname === '/inicio';
    const containerClass = isHomePage 
       ? "relative w-full h-10 overflow-hidden border-b bg-transparent border-white/[0.02]"
       : "relative w-full h-10 overflow-hidden border-b bg-background/80 backdrop-blur-xl border-border/40 transition-all duration-300";

    // Renderiza un placeholder si está cargando
    if (loading) {
        return <div className={containerClass} aria-hidden="true" />;
    }

    // Si no hay activos (fallback), mostrar tips educativos
    if (activeAssets.length === 0) {
        const currentTip = educationalTips[currentTipIndex];
        const TipIcon = currentTip.icon;

        return (
            <div className={containerClass}>
                <div className="flex items-center justify-center h-full px-4 transition-opacity duration-500">
                    <TipIcon className="w-4 h-4 mr-2 text-primary flex-shrink-0" />
                    <span className="body-sm text-muted-foreground text-center">
                        {currentTip.text}
                    </span>
                </div>
                {/* Indicador de progreso */}
                <div className="absolute bottom-0 left-0 h-0.5 bg-primary/20 w-full">
                    <div
                        className="h-full bg-primary transition-all duration-[8000ms] ease-linear"
                        style={{ width: '100%' }}
                        key={currentTipIndex}
                    />
                </div>
            </div>
        );
    }

    // Para un bucle perfecto, duplicamos los items si son pocos
    const items = activeAssets.length > 15 ? activeAssets : [...activeAssets, ...activeAssets];

    return (
        <div className={containerClass}>
            <div className="absolute top-0 left-0 flex items-center h-full animate-scroll-infinite hover:pause-animation">
                {/* Renderizamos el contenido duplicado para el efecto de bucle infinito */}
                {items.map((asset, index) => (
                    <TickerItem key={`${asset.symbol}-${index}`} asset={asset} />
                ))}
                {items.map((asset, index) => (
                    <TickerItem key={`${asset.symbol}-duplicate-${index}`} asset={asset} />
                ))}
            </div>
            {/* Degradado en los bordes para un efecto de desvanecimiento suave */}
            <div className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-r from-background via-transparent to-background" />
        </div>
    );
}