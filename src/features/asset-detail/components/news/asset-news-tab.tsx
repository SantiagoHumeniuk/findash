// src/features/asset-detail/components/news/asset-news-tab.tsx

import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useConfig } from '../../../../hooks/use-config';
import { fetchStockNews } from '../../../../services/api/news-api';
import { Card, CardContent, CardFooter } from '../../../../components/ui/card';
import { Skeleton } from '../../../../components/ui/skeleton';
import { Badge } from '../../../../components/ui/badge';
import { CalendarDays, ExternalLink, Newspaper, ImageOff, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '../../../../components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../../../components/ui/tooltip';

interface AssetNewsTabProps {
    symbol: string;
}

const ITEMS_PER_PAGE = 3;

export function AssetNewsTab({ symbol }: AssetNewsTabProps) {
    const config = useConfig();
    const [page, setPage] = useState(0);

    const {
        data: news,
        isLoading,
        isError,
        isPlaceholderData
    } = useQuery({
        queryKey: ['asset-news', symbol, page],
        queryFn: async () => {
            if (!config) return [];
            return fetchStockNews(symbol, config, page, ITEMS_PER_PAGE);
        },
        enabled: !!config && !!symbol && symbol !== 'UNKNOWN',
        placeholderData: keepPreviousData, // Mantiene los datos anteriores mientras carga los nuevos
        staleTime: 1000 * 60 * 15,
    });

    // --- Loading State ---
    if (isLoading) {
        return <NewsSkeletonGrid count={ITEMS_PER_PAGE} />;
    }

    // --- Error State ---
    if (isError) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-red-200 bg-red-50/50 dark:border-red-500/30 dark:bg-red-500/10 rounded-xl">
                <AlertTriangle className="w-8 h-8 text-red-400 mb-2" />
                <p className="text-sm font-medium text-red-600 dark:text-red-400">No se pudieron cargar las noticias</p>
                <Button variant="link" onClick={() => window.location.reload()} className="text-red-500">
                    Reintentar
                </Button>
            </div>
        );
    }

    // --- Empty State ---
    if (!news || news.length === 0) {
        if (page > 0) {
            // Si estamos en una página vacía (ej: página 10), volver atrás
            return (
                <div className="flex flex-col items-center justify-center py-12">
                    <p className="text-muted-foreground mb-4">No hay más noticias antiguas.</p>
                    <Button onClick={() => setPage((p) => Math.max(0, p - 1))} variant="outline">
                        <ChevronLeft className="w-4 h-4 mr-2" /> Volver
                    </Button>
                </div>
            );
        }
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed rounded-xl bg-muted/5">
                <div className="bg-muted p-4 rounded-full mb-3">
                    <Newspaper className="w-8 h-8 text-muted-foreground/50" />
                </div>
                <h3 className="text-lg font-semibold mb-1">Sin noticias recientes</h3>
                <p className="text-muted-foreground text-sm max-w-sm">
                    No hay artículos recientes disponibles para {symbol}.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in-50">
            {/* Grid de Noticias */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {news.map((item, index) => (
                    <NewsCard key={`${item.publishedDate}-${index}`} item={item} />
                ))}
            </div>

            {/* Controles de Paginación */}
            <div className="flex items-center justify-between border-t pt-4">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="w-28"
                >
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Anterior
                </Button>

                <span className="text-xs text-muted-foreground font-medium">
                    Página {page + 1}
                </span>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={isPlaceholderData || news.length < ITEMS_PER_PAGE}
                    className="w-28"
                >
                    Siguiente
                    <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
            </div>
        </div>
    );
}

// --- Sub-componente: Tarjeta de Noticia ---

function NewsCard({ item }: { item: any }) { // eslint-disable-line @typescript-eslint/no-explicit-any
    const [imageError, setImageError] = useState(false);

    let dateObj = new Date();
    try {
        dateObj = typeof item.date === 'string' ? parseISO(item.date) : new Date(item.date);
        if (isNaN(dateObj.getTime())) throw new Error("Invalid date");
    } catch {
        dateObj = new Date();
    }

    const timeAgo = formatDistanceToNow(dateObj, { addSuffix: true, locale: es });
    const fullDate = dateObj.toLocaleDateString('es-ES', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    return (
        <Card className="flex flex-col h-full overflow-hidden hover:shadow-md transition-shadow group border-muted/60">
            <div className="relative aspect-video w-full overflow-hidden bg-muted">
                {!imageError && item.image ? (
                    <img
                        src={item.image}
                        alt={item.title}
                        className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105"
                        onError={() => setImageError(true)}
                        loading="lazy"
                    />
                ) : (
                    <div className="flex items-center justify-center w-full h-full bg-secondary/30 text-muted-foreground">
                        <ImageOff className="w-8 h-8 opacity-20" />
                    </div>
                )}

                <div className="absolute top-3 left-3">
                    <Badge variant="secondary" className="bg-background/90 backdrop-blur-sm shadow-sm text-[10px] font-semibold uppercase tracking-wide">
                        {item.site ?? 'Noticia'}
                    </Badge>
                </div>
            </div>

            <CardContent className="flex-1 p-4 sm:p-5 flex flex-col gap-3">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-help w-fit">
                                <CalendarDays className="w-3.5 h-3.5" />
                                <span className="capitalize">{timeAgo}</span>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>{fullDate}</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block group-hover:text-primary transition-colors"
                >
                    <h3 className="font-bold text-lg leading-tight line-clamp-3">
                        {item.title}
                    </h3>
                </a>

                <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                    {item.text}
                </p>
            </CardContent>

            <CardFooter className="p-4 sm:p-5 pt-0 mt-auto">
                <Button variant="outline" size="sm" className="w-full gap-2 group/btn" asChild>
                    <a href={item.url} target="_blank" rel="noopener noreferrer">
                        Leer completo
                        <ExternalLink className="w-3.5 h-3.5 transition-transform group-hover/btn:-translate-y-0.5 group-hover/btn:translate-x-0.5" />
                    </a>
                </Button>
            </CardFooter>
        </Card>
    );
}

// --- Sub-componente: Skeleton ---

function NewsSkeletonGrid({ count = 3 }: { count?: number }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: count }).map((_, i) => (
                <Card key={i} className="flex flex-col h-full overflow-hidden">
                    <Skeleton className="aspect-video w-full" />
                    <CardContent className="flex-1 p-5 space-y-4">
                        <Skeleton className="h-4 w-24" />
                        <div className="space-y-2">
                            <Skeleton className="h-5 w-full" />
                            <Skeleton className="h-5 w-[90%]" />
                        </div>
                        <div className="space-y-2 pt-2">
                            <Skeleton className="h-3 w-full" />
                            <Skeleton className="h-3 w-full" />
                        </div>
                    </CardContent>
                    <CardFooter className="p-5 pt-0">
                        <Skeleton className="h-9 w-full rounded-md" />
                    </CardFooter>
                </Card>
            ))}
        </div>
    );
}