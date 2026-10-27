// src/components/actives-bar.tsx

import { useEffect, useState, memo } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowDown, ArrowUp, TrendingUp, BookOpen, Lightbulb } from 'lucide-react';
import { fetchIndexLeaders } from '../../features/market-movers/services/market-movers-service';
import type { MarketMover } from '../../features/market-movers/types';

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
 * Barra superior con el rendimiento diario de grandes compañías del S&P 500.
 */
export default function ActivesBar() {
    const [activeAssets, setActiveAssets] = useState<MarketMover[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentTipIndex, setCurrentTipIndex] = useState(0);
    const location = useLocation();

    useEffect(() => {
        let isActive = true;
        const loadAssets = async () => {
            try {
                const leaders = await fetchIndexLeaders();
                if (isActive) setActiveAssets(leaders);
            } catch (error) {
                console.error("Error loading market actives:", error);
            } finally {
                if (isActive) setLoading(false);
            }
        };
        void loadAssets();
        const interval = window.setInterval(() => void loadAssets(), 5 * 60 * 1000);
        return () => {
            isActive = false;
            window.clearInterval(interval);
        };
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