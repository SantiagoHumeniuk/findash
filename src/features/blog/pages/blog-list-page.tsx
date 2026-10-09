// src/features/blog/pages/blog-list-page.tsx
import { useState, useEffect, useCallback } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { BlogCard } from '../components/blog-card';
import { FeaturedBlogCard } from '../components/featured-blog-card';
import { Search, Filter, Plus, ChevronLeft, ChevronRight, Newspaper, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/use-auth';

interface Blog {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  featured_image_url?: string;
  created_at: string;
  category?: string;
  tags: string[];
  status: 'draft' | 'pending_review' | 'approved' | 'rejected';
  author: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_index?: number | string | null;
    avatar_image?: string | null;
    can_upload_blog?: boolean | null;
  };
  stats: {
    likes: number;
    comments: number;
    bookmarks: number;
    views: number;
  };
}

function BlogListPage() {
  const { user, profile } = useAuth();
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [filteredBlogs, setFilteredBlogs] = useState<Blog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'popular' | 'trending'>('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const blogsPerPage = 9;
  
  const categories = ['Finanzas', 'Inversiones', 'Análisis', 'Mercados', 'Tutorial'];

  useEffect(() => {
    void loadBlogs();
  }, []);

  const loadBlogs = async () => {
    try {
      setIsLoading(true);
      
      const { data: blogsData, error: blogsError } = await supabase
        .from('blogs')
        .select(`
          *,
          author:profiles!fk_author(id, first_name, last_name, avatar_index:onboarding_profile->avatarIndex, avatar_image:onboarding_profile->avatarImage, can_upload_blog)
        `)
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      if (blogsError) throw blogsError;

      const blogsWithStats = await Promise.all(
        (blogsData ?? []).map(async (blog: Record<string, unknown>) => {
          const blogId = blog.id as string;
          const [likesData, commentsData, bookmarksData] = await Promise.all([
            supabase.from('blog_likes').select('id', { count: 'exact' }).eq('blog_id', blogId),
            supabase.from('blog_comments').select('id', { count: 'exact' }).eq('blog_id', blogId),
            supabase.from('blog_bookmarks').select('id', { count: 'exact' }).eq('blog_id', blogId)
          ]);

          return {
            ...blog,
            author: blog.author as Blog['author'],
            stats: {
              likes: likesData.count ?? 0,
              comments: commentsData.count ?? 0,
              bookmarks: bookmarksData.count ?? 0,
              views: (blog.views as number | undefined) ?? 0
            }
          } as Blog;
        })
      );

      setBlogs(blogsWithStats);
    } catch (error) {
      console.error('Error loading blogs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterAndSortBlogs = useCallback(() => {
    let filtered = [...blogs];

    // Filtrar por búsqueda
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        blog =>
          blog.title.toLowerCase().includes(query) ||
          blog.excerpt.toLowerCase().includes(query) ||
          blog.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Filtrar por categoría
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(blog => blog.category === categoryFilter);
    }

    // Ordenar
    switch (sortBy) {
      case 'popular':
        filtered.sort((a, b) => b.stats.likes - a.stats.likes);
        break;
      case 'trending':
        filtered.sort((a, b) => 
          (b.stats.likes + b.stats.comments * 2 + b.stats.bookmarks) -
          (a.stats.likes + a.stats.comments * 2 + a.stats.bookmarks)
        );
        break;
      case 'newest':
      default:
        filtered.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    }

    setFilteredBlogs(filtered);
    setCurrentPage(1); // Reset a primera página cuando cambian los filtros
  }, [blogs, searchQuery, categoryFilter, sortBy]);
  
  useEffect(() => {
    filterAndSortBlogs();
  }, [filterAndSortBlogs]);

  // Paginación
  const totalPages = Math.ceil(filteredBlogs.length / blogsPerPage);
  const startIndex = (currentPage - 1) * blogsPerPage;
  const endIndex = startIndex + blogsPerPage;
  const currentBlogs = filteredBlogs.slice(startIndex, endIndex);
  const featuredBlog = currentPage === 1 ? currentBlogs[0] : undefined;
  const remainingBlogs = featuredBlog ? currentBlogs.slice(1) : currentBlogs;

  const goToPage = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="container-wide space-y-8 pb-12 sm:space-y-10">
      <header className="border-y border-foreground/15 py-8 sm:py-11">
        <div className="flex flex-col gap-7 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl">
            <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              <Newspaper className="size-4" aria-hidden="true" />
              Findash / Cuaderno de mercados
            </p>
            <h1 className="text-3xl font-bold leading-[1.08] sm:text-5xl">
              El mercado, <span className="text-primary">explicado con criterio.</span>
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Análisis, ideas y perspectivas para entender qué mueve tus inversiones.
            </p>
          </div>
          <div className="flex items-center justify-between gap-5 border-l-2 border-primary pl-4 sm:min-w-40">
            <div>
              <p className="text-2xl font-semibold tabular-nums">{blogs.length.toString().padStart(2, '0')}</p>
              <p className="text-xs text-muted-foreground">artículos publicados</p>
            </div>
            {user && profile?.can_upload_blog && (
              <Link to="/blog/crear">
                <Button size="sm" className="btn-press whitespace-nowrap">
                  <Plus className="mr-2 size-4" />
                  Escribir
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <section aria-label="Buscar y filtrar artículos" className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_190px_190px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder="Buscar análisis, temas o etiquetas"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-11 pl-10"
            aria-label="Buscar artículos"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-11">
            <Filter className="mr-2 size-4 text-muted-foreground" aria-hidden="true" />
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {categories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
          <SelectTrigger className="h-11"><SelectValue placeholder="Ordenar por" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Más recientes</SelectItem>
            <SelectItem value="popular">Más populares</SelectItem>
            <SelectItem value="trending">En tendencia</SelectItem>
          </SelectContent>
        </Select>
      </section>

      {isLoading ? (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-80 animate-pulse rounded-sm border bg-muted" />
          ))}
        </div>
      ) : filteredBlogs.length === 0 ? (
        <section className="border-y border-foreground/15 py-14 text-center sm:py-20">
          <Sparkles className="mx-auto mb-4 size-8 text-primary" aria-hidden="true" />
          <h2 className="text-xl font-semibold">No encontramos artículos</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            {searchQuery || categoryFilter !== 'all'
              ? 'Prueba con otros términos o cambia los filtros.'
              : 'Estamos preparando nuevas ideas y análisis para esta sección.'}
          </p>
        </section>
      ) : (
        <>
          {featuredBlog && (
            <section aria-labelledby="featured-heading" className="space-y-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <span className="size-2 rounded-full bg-primary" />
                <h2 id="featured-heading">En portada</h2>
              </div>
              <FeaturedBlogCard blog={featuredBlog} />
            </section>
          )}

          {remainingBlogs.length > 0 && (
            <section aria-labelledby="latest-heading" className="space-y-4">
              <div className="flex items-end justify-between border-b border-border pb-3">
                <h2 id="latest-heading" className="text-xl font-semibold sm:text-2xl">Últimas publicaciones</h2>
                <span className="text-xs text-muted-foreground">{filteredBlogs.length} artículos</span>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 sm:gap-5">
                {remainingBlogs.map(blog => <BlogCard key={blog.id} {...blog} />)}
              </div>
            </section>
          )}

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="w-full sm:w-auto text-xs sm:text-sm"
              >
                <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                Anterior
              </Button>
              
              <div className="flex items-center gap-1 w-full sm:w-auto justify-center">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                  // Mostrar solo páginas cercanas a la actual
                  if (
                    page === 1 ||
                    page === totalPages ||
                    (page >= currentPage - 1 && page <= currentPage + 1)
                  ) {
                    return (
                      <Button
                        key={page}
                        variant={currentPage === page ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => goToPage(page)}
                        className="min-w-[36px] sm:min-w-[40px] text-xs sm:text-sm"
                      >
                        {page}
                      </Button>
                    );
                  } else if (page === currentPage - 2 || page === currentPage + 2) {
                    return <span key={page} className="px-1 sm:px-2 text-xs sm:text-sm">...</span>;
                  }
                  return null;
                })}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="w-full sm:w-auto text-xs sm:text-sm"
              >
                Siguiente
                <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </Button>
            </div>
          )}

          {/* Contador de resultados */}
          <div className="text-center text-xs text-muted-foreground">
            Mostrando {startIndex + 1}-{Math.min(endIndex, filteredBlogs.length)} de {filteredBlogs.length} artículos
            {filteredBlogs.length !== blogs.length && ` (${blogs.length} total)`}
          </div>
        </>
      )}
    </div>
  );
}

export default BlogListPage;
