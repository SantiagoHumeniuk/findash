import { ArrowUpRight, BookOpen, Calendar, Heart, MessageCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '../../../components/ui/avatar';
import { getProfileAvatarIndex, getProfileAvatarUrl } from '../../../lib/profile-avatar';

interface FeaturedBlog {
  title: string;
  slug: string;
  excerpt: string;
  featured_image_url?: string;
  created_at: string;
  category?: string;
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
  };
}

interface FeaturedBlogCardProps {
  blog: FeaturedBlog;
}

/** Presenta el artículo más reciente como nota principal del blog. */
export function FeaturedBlogCard({ blog }: FeaturedBlogCardProps) {
  const authorName = `${blog.author.first_name} ${blog.author.last_name}`.trim();
  const authorInitials = authorName.slice(0, 2).toUpperCase();

  return (
    <article className="grid overflow-hidden rounded-sm border border-border bg-card md:grid-cols-2">
      <Link to={`/blog/${blog.slug}`} className="group relative block min-h-64 overflow-hidden bg-primary/10 md:min-h-80" aria-label={`Leer ${blog.title}`}>
        {blog.featured_image_url ? (
          <img
            src={blog.featured_image_url}
            alt=""
            className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[linear-gradient(145deg,hsl(var(--primary)/0.16),hsl(var(--muted)))] text-primary">
            <BookOpen className="size-12" strokeWidth={1.2} aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em]">Ideas para invertir mejor</span>
          </div>
        )}
        <span className="absolute left-4 top-4 inline-flex items-center gap-2 bg-background/95 px-3 py-1.5 text-xs font-semibold text-foreground">
          <span className="size-1.5 rounded-full bg-primary" />
          {blog.category ?? 'Análisis'}
        </span>
      </Link>

      <div className="flex flex-col justify-between gap-8 p-5 sm:p-8 lg:p-10">
        <div>
          <div className="mb-5 flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="size-3.5" aria-hidden="true" />
            <time dateTime={blog.created_at}>
              {formatDistanceToNow(new Date(blog.created_at), { addSuffix: true, locale: es })}
            </time>
            <span aria-hidden="true">·</span>
            <span>Lectura destacada</span>
          </div>
          <h3 className="text-2xl font-bold leading-tight sm:text-3xl">
            <Link to={`/blog/${blog.slug}`} className="transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {blog.title}
            </Link>
          </h3>
          <p className="mt-4 line-clamp-4 text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
            {blog.excerpt}
          </p>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4 border-t border-border pt-5">
          <div className="flex items-center gap-3">
            <Avatar className="size-9">
              {blog.author.can_upload_blog && (
                <AvatarImage src={getProfileAvatarUrl(getProfileAvatarIndex(blog.author.id, blog.author.avatar_index), blog.author.avatar_image)} alt="" />
              )}
              <AvatarFallback>{authorInitials.length > 0 ? authorInitials : 'FD'}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-semibold">{authorName}</p>
            <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><Heart className="size-3.5" aria-hidden="true" />{blog.stats.likes}</span>
              <span className="inline-flex items-center gap-1.5"><MessageCircle className="size-3.5" aria-hidden="true" />{blog.stats.comments}</span>
            </div>
            </div>
          </div>
          <Link to={`/blog/${blog.slug}`} className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
            Leer artículo <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}