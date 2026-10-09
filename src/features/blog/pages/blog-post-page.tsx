// src/features/blog/pages/blog-post-page.tsx
import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../../../components/ui/avatar';
import { Card, CardHeader, CardContent } from '../../../components/ui/card';
import { BlogInteractions } from '../components/blog-interactions';
import { BlogComments } from '../components/blog-comments';
import { Calendar, ArrowLeft, Edit, Eye, Heart, MessageCircle, TrendingUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/use-auth';
import { getProfileAvatarIndex, getProfileAvatarUrl } from '../../../lib/profile-avatar';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  featured_image_url?: string;
  created_at: string;
  category?: string;
  tags?: string[];
  user_id: string;
  status: 'draft' | 'pending_review' | 'approved' | 'rejected';
  author: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_index?: number | string | null;
    avatar_image?: string | null;
    can_upload_blog?: boolean | null;
  };
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  parent_comment_id?: string | null;
  author: {
    first_name: string;
    last_name: string;
  };
}

function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  
  const [blog, setBlog] = useState<BlogPost | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [likesCount, setLikesCount] = useState(0);
  const [userHasLiked, setUserHasLiked] = useState(false);
  const [userHasBookmarked, setUserHasBookmarked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [relatedBlogs, setRelatedBlogs] = useState<{
    id: string;
    title: string;
    slug: string;
    featured_image_url?: string;
    category?: string;
    created_at: string;
    stats: { likes: number; comments: number; views: number };
  }[]>([]);
  
  // Ref para evitar doble incremento de vistas (React Strict Mode)
  const viewIncrementedRef = useRef(false);

  useEffect(() => {
    if (slug) {
      void loadBlogPost();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const loadBlogPost = async () => {
    try {
      setIsLoading(true);

      const blogResult = await supabase
        .from('blogs')
        .select(`
          *,
          author:profiles!fk_author(id, first_name, last_name, avatar_index:onboarding_profile->avatarIndex, avatar_image:onboarding_profile->avatarImage, can_upload_blog)
        `)
        .eq('slug', slug)
        .single();

      if (blogResult.error) throw blogResult.error;
      if (!blogResult.data) {
        return;
      }

      const typedBlog = blogResult.data as unknown as BlogPost;
      
      // Verificar permisos de acceso si el blog no está aprobado
      if (typedBlog.status !== 'approved') {
        // Permitir acceso solo al autor o administrador
        if (!user) {
          alert('Este artículo no está disponible.');
          window.location.href = '/blog';
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        const isAuthor = user.id === typedBlog.user_id;
        const isAdmin = profile?.role === 'administrador';

        if (!isAuthor && !isAdmin) {
          alert('Este artículo no está disponible.');
          window.location.href = '/blog';
          return;
        }
      }
      
      setBlog(typedBlog);

      // Incrementar contador de vistas (solo una vez por sesión)
      const viewKey = `blog_view_${typedBlog.id}`;
      const hasViewed = sessionStorage.getItem(viewKey);
      
      if (!hasViewed && !viewIncrementedRef.current) {
        await supabase.rpc('increment_blog_views', { blog_id: typedBlog.id });
        sessionStorage.setItem(viewKey, 'true');
        viewIncrementedRef.current = true;
      }

      // Cargar likes
      const { count: likesCount } = await supabase
        .from('blog_likes')
        .select('id', { count: 'exact' })
        .eq('blog_id', typedBlog.id);

      setLikesCount(likesCount ?? 0);

      // Verificar si el usuario dio like
      if (user) {
        const { data: likeData } = await supabase
          .from('blog_likes')
          .select('id')
          .eq('blog_id', typedBlog.id)
          .eq('user_id', user.id)
          .maybeSingle();

        setUserHasLiked(!!likeData);

        const { data: bookmarkData } = await supabase
          .from('blog_bookmarks')
          .select('id')
          .eq('blog_id', typedBlog.id)
          .eq('user_id', user.id)
          .maybeSingle();

        setUserHasBookmarked(!!bookmarkData);
      }

      // Cargar comentarios
      const { data: commentsData } = await supabase
        .from('blog_comments')
        .select(`
          *,
          author:profiles!blog_comments_user_id_fkey(first_name, last_name)
        `)
        .eq('blog_id', typedBlog.id)
        .order('created_at', { ascending: true });

      setComments((commentsData as unknown as Comment[]) ?? []);

      // Cargar blogs relacionados (misma categoría)
      void loadRelatedBlogs(typedBlog.id, typedBlog.category);
    } catch (error) {
      console.error('Error loading blog post:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadRelatedBlogs = async (currentBlogId: string, category?: string) => {
    try {
      let query = supabase
        .from('blogs')
        .select('*')
        .eq('status', 'approved')
        .neq('id', currentBlogId)
        .limit(4);

      // Priorizar blogs de la misma categoría
      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching related blogs:', error);
        return;
      }

      if (data) {
        // Cargar stats para cada blog relacionado
        const blogsWithStats = await Promise.all(
          data.map(async (blog: Record<string, unknown>) => {
            const blogId = blog.id as string;
            const [likesData, commentsData] = await Promise.all([
              supabase.from('blog_likes').select('id', { count: 'exact' }).eq('blog_id', blogId),
              supabase.from('blog_comments').select('id', { count: 'exact' }).eq('blog_id', blogId)
            ]);

            return {
              id: blogId,
              title: blog.title as string,
              slug: blog.slug as string,
              featured_image_url: blog.featured_image_url as string | undefined,
              category: blog.category as string | undefined,
              created_at: blog.created_at as string,
              stats: {
                likes: likesData.count ?? 0,
                comments: commentsData.count ?? 0,
                views: (blog.views as number | undefined) ?? 0
              }
            };
          })
        );

        setRelatedBlogs(blogsWithStats);
      }
    } catch (error) {
      console.error('Error loading related blogs:', error);
    }
  };

  const handleLike = () => {
    if (!user || !blog) return;

    void (async () => {
      try {
        if (userHasLiked) {
          await supabase
            .from('blog_likes')
            .delete()
            .eq('blog_id', blog.id)
            .eq('user_id', user.id);
          setLikesCount(prev => prev - 1);
          setUserHasLiked(false);
        } else {
          await supabase
            .from('blog_likes')
            .insert({ blog_id: blog.id, user_id: user.id });
          setLikesCount(prev => prev + 1);
          setUserHasLiked(true);
        }
      } catch (error) {
        console.error('Error toggling like:', error);
      }
    })();
  };

  const handleBookmark = () => {
    if (!user || !blog) return;

    void (async () => {
      try {
        if (userHasBookmarked) {
          await supabase
            .from('blog_bookmarks')
            .delete()
            .eq('blog_id', blog.id)
            .eq('user_id', user.id);
          setUserHasBookmarked(false);
        } else {
          await supabase
            .from('blog_bookmarks')
            .insert({ blog_id: blog.id, user_id: user.id });
          setUserHasBookmarked(true);
        }
      } catch (error) {
        console.error('Error toggling bookmark:', error);
      }
    })();
  };

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) {
      void navigator.share({
        title: blog?.title,
        url
      });
    } else {
      void navigator.clipboard.writeText(url);
    }
  };

  if (isLoading) {
    return (
      <div className="container-narrow stack-6">
        <div className="animate-pulse stack-6">
          <div className="h-96 bg-muted rounded-lg" />
          <div className="h-12 bg-muted rounded w-3/4" />
          <div className="h-6 bg-muted rounded w-1/2" />
          <div className="stack-4">
            <div className="h-4 bg-muted rounded" />
            <div className="h-4 bg-muted rounded" />
            <div className="h-4 bg-muted rounded w-5/6" />
          </div>
        </div>
      </div>
    );
  }

  if (!blog) return null;

  const authorName = `${blog.author.first_name} ${blog.author.last_name}`.trim();
  const initials = `${blog.author.first_name[0]}${blog.author.last_name?.[0] || ''}`.toUpperCase();
  const isAuthor = user?.id === blog.user_id;

  return (
    <div className="container-wide">
      {/* Botón volver */}
      <div className="mb-6">
        <Link to="/blog" className="inline-block">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver al Blog
          </Button>
        </Link>
      </div>

      {/* Layout principal con sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8"  >
        {/* Contenido principal */}
        <div className="lg:col-span-2 stack-6">

      {/* Imagen destacada */}
      {blog.featured_image_url && (
        <div className="relative w-full h-96 rounded-lg overflow-hidden mb-8">
          <img
            src={blog.featured_image_url}
            alt={blog.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Título y metadatos */}
      <div className="mb-8">
        <div className="flex flex-wrap gap-2 mb-4">
          {blog.category && (
            <Badge className="bg-primary">{blog.category}</Badge>
          )}
          {(blog.tags ?? []).map(tag => (
            <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
          ))}
        </div>

        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4 sm:mb-6">{blog.title}</h1>

        <div className="flex items-center justify-between flex-wrap gap-3 sm:gap-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              {blog.author.can_upload_blog && (
                <AvatarImage src={getProfileAvatarUrl(getProfileAvatarIndex(blog.author.id, blog.author.avatar_index), blog.author.avatar_image)} alt="" />
              )}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{authorName}</p>
              <div className="flex items-center gap-1 body-sm text-muted-foreground">
                <Calendar className="w-3 h-3" />
                {formatDistanceToNow(new Date(blog.created_at), { addSuffix: true, locale: es })}
              </div>
            </div>
          </div>

          {isAuthor && (
            <Link to={`/blog/editar/${blog.slug}`}>
              <Button variant="outline" size="sm">
                <Edit className="w-4 h-4 mr-2" />
                Editar
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Contenido */}
      <div className="prose prose-lg dark:prose-invert max-w-none mb-12">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw, rehypeSanitize]}
          components={{
            img: ({ ...props }) => (
              <img
                {...props}
                className="rounded-lg shadow-md my-4 mx-auto max-w-full h-auto"
                loading="lazy"
                alt={props.alt ?? ''}
              />
            ),
            a: ({ ...props }) => (
              <a
                {...props}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              />
            ),
            code: ({ className, children, ...props }) => {
              const isInline = !className;
              return isInline ? (
                <code className="bg-muted px-1.5 py-0.5 rounded text-sm" {...props}>
                  {children}
                </code>
              ) : (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            },
            blockquote: ({ ...props }) => (
              <blockquote
                {...props}
                className="border-l-4 border-primary bg-primary/5 pl-4 py-2 my-4 italic"
              />
            ),
          }}
        >
          {blog.content}
        </ReactMarkdown>
      </div>

      {/* Interacciones */}
      <div className="border-y py-6 mb-8">
        <BlogInteractions
          likesCount={likesCount}
          commentsCount={comments.length}
          userHasLiked={userHasLiked}
          userHasBookmarked={userHasBookmarked}
          onLike={handleLike}
          onBookmark={handleBookmark}
          onShare={handleShare}
        />
      </div>

      {/* Comentarios */}
      <BlogComments
        comments={comments}
      />
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          {/* Otras notas relevantes */}
          {relatedBlogs.length > 0 && (
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  Otras Notas Relevantes
                </h3>
              </CardHeader>
              <CardContent className="space-y-2 sm:space-y-3 p-4 sm:p-6">
                {relatedBlogs.map((relatedBlog) => (
                  <Link
                    key={relatedBlog.id}
                    to={`/blog/${relatedBlog.slug}`}
                    className="block group"
                  >
                    <div className="flex gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                      {relatedBlog.featured_image_url ? (
                        <img
                          src={relatedBlog.featured_image_url}
                          alt={relatedBlog.title}
                          className="w-20 h-20 rounded object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded bg-muted flex items-center justify-center flex-shrink-0">
                          <Eye className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="body-sm font-semibold line-clamp-2 group-hover:text-primary transition-colors mb-1">
                          {relatedBlog.title}
                        </h4>
                        {relatedBlog.category && (
                          <Badge variant="secondary" className="caption mb-2">
                            {relatedBlog.category}
                          </Badge>
                        )}
                        <div className="flex items-center gap-3 caption text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Heart className="w-3 h-3" />
                            {relatedBlog.stats.likes}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageCircle className="w-3 h-3" />
                            {relatedBlog.stats.comments}
                          </span>
                          <span className="flex items-center gap-1">
                            <Eye className="w-3 h-3" />
                            {relatedBlog.stats.views}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Info del autor */}
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold">Sobre el Autor</h3>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-3 mb-3">
                <Avatar className="h-12 w-12">
                  {blog.author.can_upload_blog && (
                    <AvatarImage src={getProfileAvatarUrl(getProfileAvatarIndex(blog.author.id, blog.author.avatar_index), blog.author.avatar_image)} alt="" />
                  )}
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{authorName}</p>
                  <p className="caption text-muted-foreground">Autor</p>
                </div>
              </div>
              {isAuthor && (
                <Link to={`/blog/editar/${blog.slug}`} className="w-full block">
                  <Button variant="outline" size="sm" className="w-full">
                    <Edit className="w-4 h-4 mr-2" />
                    Editar Artículo
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

export default BlogPostPage;
