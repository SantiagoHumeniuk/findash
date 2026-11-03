// src/features/admin/components/blogs/admin-blogs-section.tsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../../../components/ui/button';
import { Card, CardHeader, CardContent, CardFooter } from '../../../../components/ui/card';
import { Badge } from '../../../../components/ui/badge';
import { Input } from '../../../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../components/ui/select';
import { Avatar, AvatarFallback } from '../../../../components/ui/avatar';
import { Eye, Check, X, Trash2, Search, Calendar, Heart, MessageCircle, User, RefreshCcw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../hooks/use-auth';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../../components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../components/ui/dialog';
import { Textarea } from '../../../../components/ui/textarea';

interface AdminBlog {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  status: 'draft' | 'pending_review' | 'approved' | 'rejected';
  created_at: string;
  published_at?: string;
  featured_image_url?: string;
  category?: string;
  user_id: string;
  author: {
    first_name: string;
    last_name: string;
  };
  stats: {
    likes: number;
    comments: number;
    views: number;
  };
}

interface ReviewAction {
  blogId: string;
  action: 'approve' | 'reject';
}

interface StatusChangeDialog {
  blogId: string;
  currentStatus: AdminBlog['status'];
}

export function AdminBlogsSection() {
  const { user } = useAuth();
  const [blogs, setBlogs] = useState<AdminBlog[]>([]);
  const [filteredBlogs, setFilteredBlogs] = useState<AdminBlog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('pending_review');
  const [blogToDelete, setBlogToDelete] = useState<string | null>(null);
  const [reviewAction, setReviewAction] = useState<ReviewAction | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [statusChangeDialog, setStatusChangeDialog] = useState<StatusChangeDialog | null>(null);
  const [newStatus, setNewStatus] = useState<AdminBlog['status']>('pending_review');

  useEffect(() => {
    if (user) {
      void loadAllBlogs();
    }
  }, [user]);

  useEffect(() => {
    let filtered = [...blogs];

    // Filtrar por búsqueda
    if (searchQuery) {
      filtered = filtered.filter(blog =>
        blog.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        blog.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
        `${blog.author.first_name} ${blog.author.last_name}`.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filtrar por estado
    if (statusFilter !== 'all') {
      filtered = filtered.filter(blog => blog.status === statusFilter);
    }

    setFilteredBlogs(filtered);
  }, [blogs, searchQuery, statusFilter]);

  const loadAllBlogs = async () => {
    try {
      setIsLoading(true);

      const { data: blogsData, error: blogsError } = await supabase
        .from('blogs')
        .select(`
          *,
          author:profiles!fk_author(first_name, last_name)
        `)
        .order('created_at', { ascending: false });

      if (blogsError) throw blogsError;

      const blogsWithStats = await Promise.all(
        (blogsData ?? []).map(async (blog: Record<string, unknown>) => {
          const blogId = blog.id as string;
          const [likesData, commentsData] = await Promise.all([
            supabase.from('blog_likes').select('id', { count: 'exact' }).eq('blog_id', blogId),
            supabase.from('blog_comments').select('id', { count: 'exact' }).eq('blog_id', blogId)
          ]);

          return {
            ...blog,
            author: blog.author as AdminBlog['author'],
            stats: {
              likes: likesData.count ?? 0,
              comments: commentsData.count ?? 0,
              views: (blog.views as number | undefined) ?? 0
            }
          } as AdminBlog;
        })
      );

      setBlogs(blogsWithStats);
    } catch (error) {
      console.error('Error loading blogs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReview = async () => {
    if (!reviewAction) return;

    try {
      const updateData: { status: AdminBlog['status']; published_at?: string } = {
        status: reviewAction.action === 'approve' ? 'approved' : 'rejected'
      };

      if (reviewAction.action === 'approve') {
        updateData.published_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('blogs')
        .update(updateData)
        .eq('id', reviewAction.blogId);

      if (error) throw error;

      // TODO: Enviar notificación al autor (implementar sistema de notificaciones)

      await loadAllBlogs();
      setReviewAction(null);
      setRejectionReason('');
    } catch (error) {
      console.error('Error reviewing blog:', error);
      alert('Error al procesar la revisión. Por favor intenta nuevamente.');
    }
  };

  const handleDelete = async (blogId: string) => {
    try {
      const { error } = await supabase
        .from('blogs')
        .delete()
        .eq('id', blogId);

      if (error) throw error;

      setBlogs(prev => prev.filter(b => b.id !== blogId));
      setBlogToDelete(null);
    } catch (error) {
      console.error('Error deleting blog:', error);
      alert('Error al eliminar el artículo. Por favor intenta nuevamente.');
    }
  };

  const handleStatusChange = async () => {
    if (!statusChangeDialog) return;

    try {
      const updateData: { status: AdminBlog['status']; published_at?: string } = {
        status: newStatus
      };

      if (newStatus === 'approved' && statusChangeDialog.currentStatus !== 'approved') {
        updateData.published_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('blogs')
        .update(updateData)
        .eq('id', statusChangeDialog.blogId);

      if (error) throw error;

      await loadAllBlogs();
      setStatusChangeDialog(null);
      setNewStatus('pending_review');
    } catch (error) {
      console.error('Error changing status:', error);
      alert('Error al cambiar el estado. Por favor intenta nuevamente.');
    }
  };

  const getStatusBadge = (status: AdminBlog['status']) => {
    const variants = {
      draft: { label: 'Borrador', variant: 'secondary' as const },
      pending_review: { label: 'En Revisión', variant: 'default' as const },
      approved: { label: 'Aprobado', variant: 'default' as const },
      rejected: { label: 'Rechazado', variant: 'destructive' as const }
    };
    const config = variants[status];
    return <Badge variant={config.variant} className={status === 'approved' ? 'bg-green-600' : status === 'pending_review' ? 'bg-yellow-600' : ''}>{config.label}</Badge>;
  };

  const statusCounts = {
    all: blogs.length,
    draft: blogs.filter(b => b.status === 'draft').length,
    pending_review: blogs.filter(b => b.status === 'pending_review').length,
    approved: blogs.filter(b => b.status === 'approved').length,
    rejected: blogs.filter(b => b.status === 'rejected').length
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4 sm:space-y-6">
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 sm:h-24 bg-muted rounded-lg" />
          ))}
        </div>
        <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-56 sm:h-64 bg-muted rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Estadísticas rápidas */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2 sm:pb-3 p-3 sm:p-4">
            <div className="text-xs sm:text-sm font-medium text-muted-foreground">Total</div>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="text-2xl sm:text-3xl font-bold">{statusCounts.all}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 sm:pb-3 p-3 sm:p-4">
            <div className="text-xs sm:text-sm font-medium text-muted-foreground">En Revisión</div>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="text-2xl sm:text-3xl font-bold text-yellow-600">{statusCounts.pending_review}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 sm:pb-3 p-3 sm:p-4">
            <div className="text-xs sm:text-sm font-medium text-muted-foreground">Aprobados</div>
          </CardHeader>
          <CardContent className="p-3 sm:p-4">
            <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-green-600">{statusCounts.approved}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 sm:pb-3 p-3 sm:p-4">
            <div className="text-xs sm:text-sm font-medium text-muted-foreground">Rechazados</div>
          </CardHeader>
          <CardContent className="p-3 sm:p-4">
            <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-red-600">{statusCounts.rejected}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros y búsqueda */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Buscar por título, contenido o autor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-56">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos ({statusCounts.all})</SelectItem>
            <SelectItem value="pending_review">En Revisión ({statusCounts.pending_review})</SelectItem>
            <SelectItem value="approved">Aprobados ({statusCounts.approved})</SelectItem>
            <SelectItem value="rejected">Rechazados ({statusCounts.rejected})</SelectItem>
            <SelectItem value="draft">Borradores ({statusCounts.draft})</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid de artículos */}
      {filteredBlogs.length === 0 ? (
        <Card className="p-8 sm:p-12 text-center">
          <div className="space-y-3 sm:space-y-4">
            <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold">No hay artículos</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {searchQuery || statusFilter !== 'all'
                ? 'No se encontraron artículos con los filtros aplicados.'
                : 'No hay artículos para revisar en este momento.'}
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredBlogs.map((blog) => {
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
                    {getStatusBadge(blog.status)}
                    {blog.category && (
                      <Badge variant="outline" className="text-xs">{blog.category}</Badge>
                    )}
                  </div>
                  <h3 className="text-lg sm:text-xl lg:text-2xl font-semibold line-clamp-2">
                    {blog.title}
                  </h3>
                </CardHeader>

                <CardContent className="flex-1">
                  {/* Autor */}
                  <div className="flex items-center gap-2 mb-4 pb-4 border-b">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 text-xs sm:text-sm">
                        <User className="w-3 h-3 text-muted-foreground" />
                        <span className="font-medium truncate">{authorName}</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-muted-foreground line-clamp-3 mb-4">
                    {blog.excerpt}
                  </p>

                  <div className="flex items-center gap-4 text-xs sm:text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Heart className="w-4 h-4" />
                      <span>{blog.stats.likes}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageCircle className="w-4 h-4" />
                      <span>{blog.stats.comments}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      <span>{blog.stats.views}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 body-sm text-muted-foreground mt-4">
                    <Calendar className="w-3 h-3" />
                    {formatDistanceToNow(new Date(blog.created_at), { addSuffix: true, locale: es })}
                  </div>
                </CardContent>

                <CardFooter className="flex flex-col gap-2">
                  <div className="flex gap-2 w-full">
                    <Link to={`/blog/${blog.slug}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        <Eye className="w-4 h-4 mr-2" />
                        Ver
                      </Button>
                    </Link>
                    
                    {blog.status === 'pending_review' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setReviewAction({ blogId: blog.id, action: 'approve' })}
                          className="text-green-600 hover:bg-green-50 dark:hover:bg-green-500/10"
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setReviewAction({ blogId: blog.id, action: 'reject' })}
                          className="text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setBlogToDelete(blog.id)}
                      className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setStatusChangeDialog({ blogId: blog.id, currentStatus: blog.status });
                      setNewStatus(blog.status);
                    }}
                  >
                    <RefreshCcw className="w-4 h-4 mr-2" />
                    Cambiar Estado
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog de revisión */}
      <Dialog open={!!reviewAction} onOpenChange={() => setReviewAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewAction?.action === 'approve' ? '¿Aprobar artículo?' : '¿Rechazar artículo?'}
            </DialogTitle>
            <DialogDescription>
              {reviewAction?.action === 'approve'
                ? 'El artículo será publicado y visible para todos los usuarios.'
                : 'El artículo será rechazado y el autor será notificado.'}
            </DialogDescription>
          </DialogHeader>
          
          {reviewAction?.action === 'reject' && (
            <div className="space-y-2">
              <label className="body-sm font-medium">Motivo del rechazo (opcional)</label>
              <Textarea
                placeholder="Explica por qué el artículo fue rechazado..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
              />
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewAction(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => void handleReview()}
              className={reviewAction?.action === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {reviewAction?.action === 'approve' ? 'Aprobar' : 'Rechazar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmación de eliminación */}
      <AlertDialog open={!!blogToDelete} onOpenChange={() => setBlogToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El artículo será eliminado permanentemente
              junto con todos sus comentarios, likes y bookmarks.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => blogToDelete && void handleDelete(blogToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de cambio de estado */}
      <Dialog open={!!statusChangeDialog} onOpenChange={() => setStatusChangeDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar Estado del Artículo</DialogTitle>
            <DialogDescription>
              Selecciona el nuevo estado para el artículo.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="body-sm font-medium">Estado Actual</label>
              <div className="p-3 bg-muted rounded-md">
                {statusChangeDialog && getStatusBadge(statusChangeDialog.currentStatus)}
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="body-sm font-medium">Nuevo Estado</label>
              <Select value={newStatus} onValueChange={(value) => setNewStatus(value as AdminBlog['status'])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Borrador</SelectItem>
                  <SelectItem value="pending_review">En Revisión</SelectItem>
                  <SelectItem value="approved">Aprobado</SelectItem>
                  <SelectItem value="rejected">Rechazado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusChangeDialog(null)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleStatusChange()}>
              Cambiar Estado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
