// src/features/blog/pages/edit-blog-page.tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BlogEditorForm } from '../components/blog-editor-form';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/use-auth';

interface BlogFormData {
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  category?: string;
  tags: string[];
  status: 'draft' | 'pending_review' | 'approved' | 'rejected';
  featured_image?: string;
}

interface BlogData {
  id: string;
  user_id: string;
  title?: string;
  slug?: string;
  content?: string;
  excerpt?: string;
  category?: string;
  tags?: string[];
  status?: 'draft' | 'pending_review' | 'approved' | 'rejected';
  featured_image_url?: string;
}

function EditBlogPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [initialData, setInitialData] = useState<BlogData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (slug && user) {
      void loadBlog();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, user]);

  const loadBlog = async () => {
    try {
      const result = await supabase
        .from('blogs')
        .select('*')
        .eq('slug', slug)
        .single();

      if (result.error) throw result.error;

      const typedData = result.data as unknown as BlogData;

      // Verificar que el usuario sea el autor
      if (typedData.user_id !== user?.id) {
        void navigate('/blog');
        return;
      }

      setInitialData(typedData);
    } catch (error) {
      console.error('Error loading blog:', error);
      void navigate('/blog');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (data: BlogFormData) => {
    if (!user || !initialData) return;

    try {
      const { error } = await supabase
        .from('blogs')
        .update({
          title: data.title,
          slug: data.slug,
          content: data.content,
          excerpt: data.excerpt,
          category: data.category,
          tags: data.tags,
          status: data.status,
          featured_image_url: data.featured_image
        })
        .eq('id', initialData.id);

      if (error) throw error;

      void navigate(`/blog/${data.slug}`);
    } catch (error) {
      console.error('Error updating blog:', error);
      alert('Error al actualizar el artículo. Por favor intentá de nuevo.');
    }
  };

  if (isLoading) {
    return (
      <div className="container-narrow stack-6">
        <div className="animate-pulse stack-6">
          <div className="h-12 bg-muted rounded w-1/3" />
          <div className="h-10 bg-muted rounded" />
          <div className="h-10 bg-muted rounded" />
          <div className="h-96 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!initialData) return null;

  return (
    <div className="container-wide stack-8">
      {/* Header mejorado */}
      <div className="section-divider">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-2 bg-primary/10 rounded-lg">
            <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-1.5 sm:mb-2">Editar Artículo</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Actualiza tu artículo y mejora su contenido
            </p>
          </div>
          {initialData.status && (
            <div>
              {initialData.status === 'draft' && (
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-500/10 text-gray-600 dark:text-gray-400 text-xs sm:text-sm">
                  <span className="w-2 h-2 rounded-full bg-gray-500"></span>
                  Borrador
                </span>
              )}
              {initialData.status === 'pending_review' && (
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 text-xs sm:text-sm">
                  <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></span>
                  En Revisión
                </span>
              )}
              {initialData.status === 'approved' && (
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 text-xs sm:text-sm">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  Publicado
                </span>
              )}
              {initialData.status === 'rejected' && (
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 text-xs sm:text-sm">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  Rechazado
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <BlogEditorForm
        initialData={initialData}
        onSubmit={handleSubmit}
        isEditing={true}
      />
    </div>
  );
}

export default EditBlogPage;
