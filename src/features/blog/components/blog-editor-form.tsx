// src/features/blog/components/blog-editor-form.tsx
import { useState, useEffect } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Card } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { RichTextEditor } from './rich-text-editor';
import { Save, Eye, X, Upload, Tag } from 'lucide-react';
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

interface BlogEditorFormProps {
  initialData?: Partial<BlogFormData>;
  onSubmit: (data: BlogFormData) => Promise<void>;
  onSaveDraft?: (data: BlogFormData) => Promise<void>;
  isEditing?: boolean;
  categories?: string[];
}

export function BlogEditorForm({
  initialData = {},
  onSubmit,
  onSaveDraft,
  isEditing = false,
  categories = ['Finanzas', 'Inversiones', 'Análisis', 'Mercados', 'Tutorial']
}: BlogEditorFormProps) {
  const [formData, setFormData] = useState<BlogFormData>({
    title: initialData.title ?? '',
    slug: initialData.slug ?? '',
    content: initialData.content ?? '',
    excerpt: initialData.excerpt ?? '',
    category: initialData.category ?? '',
    tags: initialData.tags ?? [],
    status: initialData.status ?? 'draft',
    featured_image: initialData.featured_image ?? ''
  });
  
  const [tagInput, setTagInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [imagePreview, setImagePreview] = useState<string | null>(initialData.featured_image ?? null);

  // Auto-generar slug desde título
  useEffect(() => {
    if (!isEditing && formData.title) {
      const generatedSlug = formData.title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
      setFormData(prev => ({ ...prev, slug: generatedSlug }));
    }
  }, [formData.title, isEditing]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.title.trim()) {
      newErrors.title = 'El título es obligatorio';
    }
    if (!formData.slug.trim()) {
      newErrors.slug = 'El slug es obligatorio';
    } else if (!/^[a-z0-9-]+$/.test(formData.slug)) {
      newErrors.slug = 'El slug solo puede contener letras minúsculas, números y guiones';
    }
    if (!formData.content.trim()) {
      newErrors.content = 'El contenido es obligatorio';
    }
    if (!formData.excerpt.trim()) {
      newErrors.excerpt = 'El resumen es obligatorio';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent, isDraft = false) => {
    e.preventDefault();
    
    if (!validateForm() && !isDraft) return;
    
    setIsSubmitting(true);
    const submitData = isDraft 
      ? { ...formData, status: 'draft' as const }
      : formData;
    
    const submitFn = isDraft && onSaveDraft ? onSaveDraft : onSubmit;
    
    void submitFn(submitData)
      .finally(() => setIsSubmitting(false));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Aquí irías a Supabase storage en producción
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setImagePreview(result);
      setFormData(prev => ({ ...prev, featured_image: result }));
    };
    reader.readAsDataURL(file);
  };

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !formData.tags.includes(tag)) {
      setFormData(prev => ({ ...prev, tags: [...prev.tags, tag] }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  return (
    <form className="space-y-4 sm:space-y-6">
      {/* Título */}
      <div className="space-y-1.5 sm:space-y-2">
        <Label htmlFor="title" className="text-sm">Título *</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          placeholder="Título del artículo"
          className={`text-sm ${errors.title ? 'border-red-500' : ''}`}
        />
        {errors.title && (
          <p className="text-xs sm:text-sm text-red-500">{errors.title}</p>
        )}
      </div>

      {/* Slug */}
      <div className="space-y-1.5 sm:space-y-2">
        <Label htmlFor="slug" className="text-sm">Slug (URL) *</Label>
        <Input
          id="slug"
          value={formData.slug}
          onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
          placeholder="titulo-del-articulo"
          className={`text-sm ${errors.slug ? 'border-red-500' : ''}`}
        />
        {errors.slug && (
          <p className="text-xs sm:text-sm text-red-500">{errors.slug}</p>
        )}
        <p className="text-xs text-muted-foreground">
          URL: /blog/{formData.slug || 'titulo-del-articulo'}
        </p>
      </div>

      {/* Resumen */}
      <div className="space-y-1.5 sm:space-y-2">
        <Label htmlFor="excerpt" className="text-sm">Resumen *</Label>
        <Input
          id="excerpt"
          value={formData.excerpt}
          onChange={(e) => setFormData(prev => ({ ...prev, excerpt: e.target.value }))}
          placeholder="Breve descripción del artículo (max 160 caracteres)"
          maxLength={160}
          className={`text-sm ${errors.excerpt ? 'border-red-500' : ''}`}
        />
        {errors.excerpt && (
          <p className="text-xs sm:text-sm text-red-500">{errors.excerpt}</p>
        )}
        <p className="text-xs text-muted-foreground">
          {formData.excerpt.length}/160 caracteres
        </p>
      </div>

      {/* Categoría y Estado */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="space-y-1.5 sm:space-y-2">
          <Label htmlFor="category" className="text-sm">Categoría</Label>
          <Select
            value={formData.category}
            onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
          >
            <SelectTrigger id="category" className="text-sm">
              <SelectValue placeholder="Seleccioná una categoría" />
            </SelectTrigger>
            <SelectContent>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat} className="text-sm">{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5 sm:space-y-2">
          <Label htmlFor="status" className="text-sm">Estado</Label>
          <Select
            value={formData.status}
            onValueChange={(value) => setFormData(prev => ({ ...prev, status: value as BlogFormData['status'] }))}
          >
            <SelectTrigger id="status" className="text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft" className="text-sm">Borrador</SelectItem>
              <SelectItem value="pending_review" className="text-sm">Pendiente de Revisión</SelectItem>
              {/* Solo administradores pueden aprobar artículos */}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tags */}
      <div className="space-y-1.5 sm:space-y-2">
        <Label htmlFor="tags" className="text-sm">Etiquetas</Label>
        <div className="flex gap-2">
          <Input
            id="tags"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddTag();
              }
            }}
            placeholder="Agregar etiqueta (Enter)"
            className="text-sm"
          />
          <Button type="button" onClick={handleAddTag} variant="outline" size="icon" className="flex-shrink-0">
            <Tag className="w-4 h-4" />
          </Button>
        </div>
        {formData.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-2">
            {formData.tags.map(tag => (
              <Badge key={tag} variant="secondary" className="gap-1 text-xs">
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Imagen destacada */}
      <div className="space-y-1.5 sm:space-y-2">
        <Label htmlFor="featured_image" className="text-sm">Imagen Destacada</Label>
        <Card className="p-3 sm:p-4">
          <div className="space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
              <Input
                id="featured_image"
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => document.getElementById('featured_image')?.click()}
                className="w-full sm:w-auto text-xs sm:text-sm"
              >
                <Upload className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                Subir Imagen
              </Button>
              {imagePreview && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setImagePreview(null);
                    setFormData(prev => ({ ...prev, featured_image: '' }));
                  }}
                  className="w-full sm:w-auto text-xs sm:text-sm"
                >
                  <X className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                  Eliminar
                </Button>
              )}
            </div>
            {imagePreview && (
              <div className="relative w-full h-40 sm:h-48 rounded-md overflow-hidden">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Editor de contenido */}
      <div className="space-y-1.5 sm:space-y-2">
        <Label htmlFor="content" className="text-sm">Contenido *</Label>
        <RichTextEditor
          value={formData.content}
          onChange={(value) => setFormData(prev => ({ ...prev, content: value }))}
        />
        {errors.content && (
          <p className="text-xs sm:text-sm text-red-500">{errors.content}</p>
        )}
      </div>

      {/* Alerta de estado */}
      {formData.status === 'draft' && (
        <Card className="p-3 sm:p-4 bg-muted">
          <p className="text-xs sm:text-sm text-muted-foreground">
            Este artículo está guardado como borrador. Cambia el estado a "Pendiente de Revisión" cuando esté listo para publicar. Un administrador revisará y aprobará tu artículo antes de que sea visible públicamente.
          </p>
        </Card>
      )}
      
      {formData.status === 'pending_review' && (
        <Card className="p-3 sm:p-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
          <p className="text-xs sm:text-sm text-blue-900 dark:text-blue-100">
            Este artículo está pendiente de revisión por un administrador. Te notificaremos cuando sea aprobado o si necesita cambios.
          </p>
        </Card>
      )}

      {/* Botones de acción */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-3 sm:pt-4">
        {onSaveDraft && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(e) => handleSubmit(e, true)}
            disabled={isSubmitting}
            className="text-xs sm:text-sm"
          >
            <Save className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            Guardar Borrador
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => window.history.back()}
          disabled={isSubmitting}
          className="text-xs sm:text-sm"
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          size="sm"
          onClick={(e) => handleSubmit(e, false)}
          disabled={isSubmitting}
          className="sm:ml-auto text-xs sm:text-sm"
        >
          <Eye className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
          {isSubmitting ? 'Guardando...' : isEditing ? 'Actualizar' : 'Publicar'}
        </Button>
      </div>
    </form>
  );
}
