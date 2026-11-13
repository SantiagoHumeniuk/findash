// src/features/blog/pages/bookmarked-blogs-page.tsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../../components/ui/button';
import { Card, CardHeader, CardContent, CardFooter } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Avatar, AvatarFallback } from '../../../components/ui/avatar';
import { Heart, MessageCircle, ArrowRight, Bookmark } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/use-auth';

interface BookmarkedBlog {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  featured_image_url?: string;
  created_at: string;
  category?: string;
  tags?: string[];
  user_id: string;
  author: {
    first_name: string;
    last_name: string;
  };
  stats: {
    likes: number;
    comments: number;
  };
  bookmarked_at: string;
}

function BookmarkedBlogsPage() {
  const { user } = useAuth();
  const [blogs, setBlogs] = useState<BookmarkedBlog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadBookmarkedBlogs = async () => {
    if (!user) return;

    try {
      setIsLoading(true);

      // Obtener los bookmarks del usuario con la información del blog
      const { data: bookmarksData, error: bookmarksError } = await supabase
        .from('blog_bookmarks')
        .select(`
          created_at,
          blog:blogs!blog_bookmarks_blog_id_fkey (
            *,
            author:public_profiles!fk_author(first_name, last_name)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (bookmarksError) throw bookmarksError;

      // Cargar estadísticas para cada blog
      const blogsWithStats = await Promise.all(
        (bookmarksData ?? []).map(async (bookmark: Record<string, unknown>) => {
          const blog = bookmark.blog as Record<string, unknown>;
          const blogId = blog.id as string;

          const [likesData, commentsData] = await Promise.all([
            supabase.from('blog_likes').select('id', { count: 'exact' }).eq('blog_id', blogId),
            supabase.from('blog_comments').select('id', { count: 'exact' }).eq('blog_id', blogId)
          ]);

          return {
            ...blog,
            author: blog.author as BookmarkedBlog['author'],
            stats: {
              likes: likesData.count ?? 0,
              comments: commentsData.count ?? 0
            },
            bookmarked_at: bookmark.created_at
          } as BookmarkedBlog;
        })
      );

      setBlogs(blogsWithStats);
    } catch (error) {
      console.error('Error loading bookmarked blogs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      void loadBookmarkedBlogs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleRemoveBookmark = async (blogId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('blog_bookmarks')
        .delete()
        .eq('blog_id', blogId)
        .eq('user_id', user.id);

      if (error) throw error;

      setBlogs(prev => prev.filter(blog => blog.id !== blogId));
    } catch (error) {
      console.error('Error removing bookmark:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="container-wide stack-6">
        <div className="animate-pulse stack-6">
          <div className="h-12 bg-muted rounded w-64" />
          <div className="grid-cards-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-96 bg-muted rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-wide stack-8">
      {/* Header */}
      <div className="flex items-center gap-3 sm:gap-4 pb-4 sm:pb-6 mb-4 sm:mb-6 border-b">
        <div className="p-1.5 sm:p-2 bg-primary/10 rounded-lg">
          <Bookmark className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-1.5 sm:mb-2">Artículos Guardados</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {blogs.length === 0
              ? 'No has guardado ningún artículo todavía'
              : `Tienes ${blogs.length} ${blogs.length === 1 ? 'artículo guardado' : 'artículos guardados'}`}
          </p>
        </div>
      </div>

      {blogs.length === 0 ? (
        <Card className="p-8 sm:p-12 text-center">
          <div className="space-y-3 sm:space-y-4">
            <div className="flex justify-center">
              <Bookmark className="w-12 h-12 sm:w-16 sm:h-16 text-muted-foreground" />
            </div>
            <h3 className="text-lg sm:text-xl lg:text-2xl font-semibold">No tenés artículos guardados</h3>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
              Cuando encuentres artículos interesantes, puedes guardarlos haciendo clic en el ícono de bookmark.
            </p>
            <Link to="/blog">
              <Button>
                Explorar Blog
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {blogs.map((blog) => {
            const authorName = `${blog.author.first_name} ${blog.author.last_name}`.trim();
            const initials = `${blog.author.first_name[0]}${blog.author.last_name?.[0] || ''}`.toUpperCase();

            return (
              <Card key={blog.id} className="flex flex-col overflow-hidden hover:shadow-lg transition-shadow">
                {/* Imagen destacada */}
                {blog.featured_image_url && (
                  <div className="relative w-full h-48 overflow-hidden">
                    <img
                      src={blog.featured_image_url}
                      alt={blog.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <CardHeader>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    {blog.category && (
                      <Badge className="bg-primary">{blog.category}</Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleRemoveBookmark(blog.id)}
                      className="h-8 w-8 p-0"
                    >
                      <Bookmark className="w-4 h-4 fill-current" />
                    </Button>
                  </div>
                  <h3 className="text-base sm:text-lg font-semibold line-clamp-2">
                    {blog.title}
                  </h3>
                </CardHeader>

                <CardContent className="flex-1">
                  {/* Autor */}
                  <div className="flex items-center gap-2 mb-4">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <span className="body-sm font-medium">{authorName}</span>
                  </div>

                  <p className="text-muted-foreground line-clamp-3 mb-4">
                    {blog.excerpt}
                  </p>

                  {/* Tags */}
                  {blog.tags && blog.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {blog.tags.slice(0, 3).map(tag => (
                        <Badge key={tag} variant="secondary" className="caption">
                          {tag}
                        </Badge>
                      ))}
                      {blog.tags.length > 3 && (
                        <Badge variant="secondary" className="caption">
                          +{blog.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* Stats */}
                  <div className="flex items-center gap-4 body-sm text-muted-foreground mb-4">
                    <div className="flex items-center gap-1">
                      <Heart className="w-4 h-4" />
                      <span>{blog.stats.likes}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageCircle className="w-4 h-4" />
                      <span>{blog.stats.comments}</span>
                    </div>
                  </div>

                  {/* Fecha de guardado */}
                  <div className="flex items-center gap-1 caption text-muted-foreground">
                    <Bookmark className="w-3 h-3" />
                    Guardado {formatDistanceToNow(new Date(blog.bookmarked_at), { addSuffix: true, locale: es })}
                  </div>
                </CardContent>

                <CardFooter>
                  <Link to={`/blog/${blog.slug}`} className="w-full">
                    <Button className="w-full">
                      Leer artículo
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default BookmarkedBlogsPage;
