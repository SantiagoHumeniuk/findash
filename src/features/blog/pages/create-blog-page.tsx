// src/features/blog/pages/create-blog-page.tsx
import { useNavigate } from 'react-router-dom';
import { BlogEditorForm } from '../components/blog-editor-form';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/use-auth';
import { useEffect } from 'react';

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

function CreateBlogPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  useEffect(() => {
    if (!user || !profile?.can_upload_blog) {
      void navigate('/blog');
    }
  }, [user, profile, navigate]);

  const handleSubmit = async (data: BlogFormData) => {
    if (!user) return;

    try {
      const result = await supabase
        .from('blogs')
        .insert({
          title: data.title,
          slug: data.slug,
          content: data.content,
          excerpt: data.excerpt,
          category: data.category,
          tags: data.tags,
          status: data.status,
          featured_image_url: data.featured_image,
          user_id: user.id
        })
        .select()
        .single();

      if (result.error) throw result.error;

      const typedBlogData = result.data as unknown as { slug: string };
      void navigate(`/blog/${typedBlogData.slug}`);
    } catch (error) {
      console.error('Error creating blog:', error);
      alert('Error al crear el artículo. Por favor intentá de nuevo.');
    }
  };

  const handleSaveDraft = async (data: BlogFormData) => {
    if (!user) return;

    try {
      await supabase
        .from('blogs')
        .insert({
          title: data.title,
          slug: data.slug,
          content: data.content,
          excerpt: data.excerpt,
          category: data.category,
          tags: data.tags,
          featured_image_url: data.featured_image,
          user_id: user.id,
          status: 'draft'
        });

      void navigate('/blog');
    } catch (error) {
      console.error('Error saving draft:', error);
      alert('Error al guardar el borrador. Por favor intentá de nuevo.');
    }
  };

  if (!user || !profile?.can_upload_blog) {
    return null;
  }

  return (
    <div className="container-wide space-y-6 sm:space-y-8">
      {/* Header mejorado */}
      <div className="pb-4 sm:pb-6 border-b">
        <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
          <div className="p-1.5 sm:p-2 bg-primary/10 rounded-lg flex-shrink-0">
            <svg className="w-6 h-6 sm:w-8 sm:h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-1">Crear Nuevo Artículo</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Comparte tus conocimientos y análisis con la comunidad financiera
            </p>
          </div>
        </div>
      </div>

      {/* Tips card */}
      <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-primary/20 rounded-lg p-4 sm:p-6 mb-3 sm:mb-4">
        <h3 className="text-sm sm:text-base font-semibold mb-2 sm:mb-3 flex items-center gap-2">
          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Consejos para un buen artículo
        </h3>
        <ul className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="text-primary font-semibold flex-shrink-0">•</span>
            <span><strong>Título claro:</strong> Hazlo descriptivo y atractivo</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary font-semibold flex-shrink-0">•</span>
            <span><strong>Extracto conciso:</strong> Resume tu artículo en 2-3 líneas</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary font-semibold flex-shrink-0">•</span>
            <span><strong>Categorías:</strong> Usa Finanzas, Inversiones, Análisis, Mercados o Tutorial</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary font-semibold flex-shrink-0">•</span>
            <span><strong>Tags relevantes:</strong> Ayuda a otros a encontrar tu contenido</span>
          </li>
        </ul>
      </div>

      <BlogEditorForm
        onSubmit={handleSubmit}
        onSaveDraft={handleSaveDraft}
        isEditing={false}
      />
    </div>
  );
}

export default CreateBlogPage;
