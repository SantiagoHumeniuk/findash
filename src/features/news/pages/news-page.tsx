// src/features/news/pages/news-page.tsx

import { AnimatePresence, motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useConfig } from "../../../hooks/use-config";
import { Newspaper, Search } from "lucide-react";
import PaginationDemo from "../../../components/ui/pagination-demo";
import { NewsSkeleton } from "../components";
import { NewsCard } from "../components/card/news-card";
import { Tabs, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import { Input } from "../../../components/ui/input";
import { fetchNewsByCategory } from "../../../services/api/news-api";
import type { UnifiedNewsItem, NewsCategory } from "../../../types/news";

// Simple debounce hook
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
}

const CATEGORIES: { id: NewsCategory | 'all'; label: string }[] = [
    { id: 'general', label: 'General' },
    { id: 'stock', label: 'Mercado de Valores' },
    { id: 'fmp-articles', label: 'Artículos' },
    { id: 'crypto', label: 'Criptomonedas' },
    { id: 'forex', label: 'Divisas' },
    { id: 'press-releases', label: 'Comunicados' },
];

export default function NewsPage() {
    const config = useConfig();
    const [news, setNews] = useState<UnifiedNewsItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [currentCategory, setCurrentCategory] = useState<NewsCategory>('general');
    const [searchQuery, setSearchQuery] = useState("");
    const debouncedSearchQuery = useDebounce(searchQuery, 500);

    // Pagination config: Reduced to 9 as requested to minimize scrolling
    const itemsPerPage = 6;

    useEffect(() => {
        let mounted = true;

        async function loadNews() {
            setLoading(true);
            try {
                // If searching, we reset page to 0 (API page 0) on query change, 
                // but if page changed via pagination, use currentPage-1
                const data = await fetchNewsByCategory(
                    currentCategory,
                    config,
                    currentPage - 1,
                    itemsPerPage,
                    debouncedSearchQuery
                );

                if (mounted) {
                    setNews(data);
                }
            } catch (error) {
                console.error("Error loading news", error);
                if (mounted) setNews([]);
            } finally {
                if (mounted) setLoading(false);
            }
        }

        void loadNews();

        return () => { mounted = false; };
    }, [config, currentCategory, currentPage, debouncedSearchQuery]);

    // Reset pagination when category or search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [currentCategory, debouncedSearchQuery]);

    const handleCategoryChange = (category: string) => {
        setCurrentCategory(category as NewsCategory);
    };

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="min-h-screen bg-background text-foreground">
            <div className="container-wide stack-8">
                {/* Header */}
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-4 sm:pb-6 mb-4 sm:mb-6 border-b">
                        <div className="flex items-center gap-3 sm:gap-4">
                            <div className="p-1.5 sm:p-2 bg-primary/10 rounded-lg">
                                <Newspaper className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
                            </div>
                            <div>
                                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Últimas Noticias Financieras</h1>
                                <p className="text-muted-foreground text-xs sm:text-sm">
                                    Mantente informado con las últimas novedades del mundo financiero.
                                </p>
                            </div>
                        </div>

                        {/* Search Bar */}
                        <div className="w-full md:w-72 relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Buscar por símbolo (ej. AAPL, BTCUSD)..."
                                className="pl-9"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </motion.div>

                {/* Tabs */}
                <Tabs defaultValue="general" value={currentCategory} onValueChange={handleCategoryChange} className="w-full">
                    <TabsList className="w-full sm:w-auto grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-wrap h-auto p-1 mb-8 gap-1">
                        {CATEGORIES.map((cat) => (
                            <TabsTrigger key={cat.id} value={cat.id} className="text-xs sm:text-sm py-2">
                                {cat.label}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>

                {/* Content */}
                {loading ? (
                    <NewsSkeleton />
                ) : (
                    <div className="min-h-[500px]">
                        <AnimatePresence mode="wait">
                            {news.length > 0 ? (
                                <motion.div
                                    key={`${currentCategory}-${currentPage}-${debouncedSearchQuery}`}
                                    className="grid-cards-3 gap-8"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    {news.map((item, index) => (
                                        <NewsCard key={item.id} news={item} index={index} />
                                    ))}
                                </motion.div>
                            ) : (
                                <div className="py-20 text-center text-muted-foreground flex flex-col items-center">
                                    <Search className="w-10 h-10 mb-4 opacity-20" />
                                    <p className="text-lg font-medium">No se encontraron noticias</p>
                                    <p className="text-sm opacity-70">
                                        {debouncedSearchQuery
                                            ? `No hay resultados para "${debouncedSearchQuery}" en esta categoría.`
                                            : "No hay noticias disponibles en este momento."}
                                    </p>
                                </div>
                            )}
                        </AnimatePresence>
                    </div>
                )}

                {/* Simple Pagination Control */}
                {!loading && news.length > 0 && (
                    <div className="flex justify-center mt-8">
                        <PaginationDemo
                            currentPage={currentPage}
                            totalPages={100} // FMP pagination limit
                            onPageChange={handlePageChange}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}