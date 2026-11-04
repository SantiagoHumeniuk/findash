// src/features/blog/components/rich-text-editor.tsx
import { useState, useRef, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { Button } from '../../../components/ui/button';
import { 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  Link as LinkIcon, 
  Image as ImageIcon,
  Quote,
  Code,
  Heading2,
  Eye,
  FileEdit,
  Upload,
  Loader2
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/use-auth';
import { toast } from 'sonner';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function RichTextEditor({ value, onChange, placeholder = "Escribí el contenido de tu blog..." }: RichTextEditorProps) {
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { profile } = useAuth();

  const insertMarkdown = useCallback((before: string, after = '') => {
    const textarea = textareaRef.current ?? document.getElementById('blog-content') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    const newText = value.substring(0, start) + before + selectedText + after + value.substring(end);
    
    onChange(newText);
    
    // Restaurar el foco y la selección
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, end + before.length);
    }, 0);
  }, [value, onChange]);

  const uploadImageToSupabase = useCallback(async (file: File): Promise<string | null> => {
    if (!profile?.id) {
      toast.error('Debes iniciar sesión para subir imágenes');
      return null;
    }

    try {
      setIsUploading(true);
      
      // Validar tipo de archivo
      if (!file.type.startsWith('image/')) {
        toast.error('Solo se permiten archivos de imagen');
        return null;
      }

      // Validar tamaño (máx 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('La imagen no debe superar 5MB');
        return null;
      }

      // Crear nombre único para el archivo
      const fileExt = file.name.split('.').pop();
      const fileName = `inline-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${profile.id}/${fileName}`;

      // Subir a Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('blog-images')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        toast.error('Error al subir la imagen');
        return null;
      }

      // Obtener URL pública
      const { data: urlData } = supabase.storage
        .from('blog-images')
        .getPublicUrl(filePath);

      if (urlData.publicUrl) {
        toast.success('Imagen subida correctamente');
        return urlData.publicUrl;
      }

      return null;
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Error al subir la imagen');
      return null;
    } finally {
      setIsUploading(false);
    }
  }, [profile?.id]);

  const handleImageUpload = useCallback(async (file: File) => {
    const imageUrl = await uploadImageToSupabase(file);
    if (imageUrl) {
      insertMarkdown(`![Imagen](${imageUrl})`);
    }
  }, [uploadImageToSupabase, insertMarkdown]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void handleImageUpload(file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [handleImageUpload]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          void handleImageUpload(file);
        }
        break;
      }
    }
  }, [handleImageUpload]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        void handleImageUpload(file);
      } else {
        toast.error('Solo se permiten archivos de imagen');
      }
    }
  }, [handleImageUpload]);

  const toolbarButtons = [
    { icon: Bold, action: () => insertMarkdown('**', '**'), label: 'Negrita' },
    { icon: Italic, action: () => insertMarkdown('*', '*'), label: 'Cursiva' },
    { icon: Heading2, action: () => insertMarkdown('\n## '), label: 'Título' },
    { icon: Quote, action: () => insertMarkdown('\n> '), label: 'Cita' },
    { icon: Code, action: () => insertMarkdown('`', '`'), label: 'Código' },
    { icon: List, action: () => insertMarkdown('\n- '), label: 'Lista' },
    { icon: ListOrdered, action: () => insertMarkdown('\n1. '), label: 'Lista numerada' },
    { icon: LinkIcon, action: () => insertMarkdown('[', '](url)'), label: 'Enlace' },
    { icon: ImageIcon, action: () => insertMarkdown('![alt](', ')'), label: 'Imagen por URL' },
  ];



  return (
    <div className="space-y-3 sm:space-y-4">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'edit' | 'preview')} className="w-full">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-0 sm:justify-between mb-2">
          <TabsList className="grid w-full sm:w-fit grid-cols-2">
            <TabsTrigger value="edit" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <FileEdit className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Editar</span>
              <span className="sm:hidden">Edit</span>
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Vista Previa</span>
              <span className="sm:hidden">Preview</span>
            </TabsTrigger>
          </TabsList>
          
          {activeTab === 'edit' && (
            <div className="flex items-center gap-0.5 sm:gap-1 flex-wrap w-full sm:w-auto justify-start sm:justify-end">
              {toolbarButtons.map((btn, idx) => (
                <Button
                  key={idx}
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={btn.action}
                  title={btn.label}
                  className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                >
                  <btn.icon className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
              ))}
              {/* Botón para subir archivo */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                title="Subir imagen desde archivo"
                className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                disabled={isUploading}
              >
                {isUploading ? (
                  <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                ) : (
                  <Upload className="h-3 w-3 sm:h-4 sm:w-4" />
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Input oculto para seleccionar archivos */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileInputChange}
          className="hidden"
        />

        <TabsContent value="edit" className="mt-0">
          <textarea
            ref={textareaRef}
            id="blog-content"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onPaste={handlePaste}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            placeholder={placeholder}
            className={cn(
              "w-full min-h-[300px] sm:min-h-[400px] p-3 sm:p-4 rounded-lg border bg-background",
              "focus:outline-none focus:ring-2 focus:ring-ring",
              "font-mono text-xs sm:text-sm resize-y transition-colors",
              isDragging && "border-primary border-2 bg-primary/5"
            )}
          />
          <p className="text-xs sm:text-sm text-muted-foreground mt-2">
            💡 Tip: Usa Markdown para dar formato. Puedes <strong>pegar imágenes</strong> (Ctrl+V) o <strong>arrastrar y soltar</strong> archivos.
          </p>
        </TabsContent>

        <TabsContent value="preview" className="mt-0">
          <div className={cn(
            "w-full min-h-[300px] sm:min-h-[400px] p-4 sm:p-6 rounded-lg border bg-background",
            "prose prose-sm sm:prose-lg dark:prose-invert max-w-none"
          )}>
            {value ? (
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
                {value}
              </ReactMarkdown>
            ) : (
              <p className="text-muted-foreground italic">El contenido aparecerá aquí...</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
