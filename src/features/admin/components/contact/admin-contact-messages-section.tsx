// src/features/admin/components/contact/admin-contact-messages-section.tsx

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../components/ui/select';
import { Input } from '../../../../components/ui/input';
import { Textarea } from '../../../../components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../components/ui/dialog';
import { Mail, Clock, CheckCircle, MessageSquare, Trash2, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { contactService, type ContactMessage } from '../../../../services/contact-service';
import { toast } from 'sonner';

const ITEMS_PER_PAGE = 12;

interface ContactMessageWithUser extends ContactMessage {
  user_first_name?: string | null;
  user_last_name?: string | null;
  user_role?: string | null;
}

export function AdminContactMessagesSection() {
  const [messages, setMessages] = useState<ContactMessageWithUser[]>([]);
  const [filteredMessages, setFilteredMessages] = useState<ContactMessageWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedMessage, setSelectedMessage] = useState<ContactMessageWithUser | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');

  useEffect(() => {
    void loadMessages();
  }, []);

  useEffect(() => {
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, statusFilter, searchQuery]);

  useEffect(() => {
    // Reset to first page when filters change
    setCurrentPage(1);
  }, [statusFilter, searchQuery]);

  const loadMessages = async () => {
    try {
      setIsLoading(true);
      const data = await contactService.getAllMessages();
      setMessages(data as ContactMessageWithUser[]);
    } catch (error) {
      console.error('Error loading contact messages:', error);
      toast.error('Error al cargar los mensajes');
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...messages];

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(msg => msg.status === statusFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(msg =>
        msg.name.toLowerCase().includes(query) ||
        msg.email.toLowerCase().includes(query) ||
        msg.message.toLowerCase().includes(query)
      );
    }

    setFilteredMessages(filtered);
  };

  const handleMarkAsRead = async (id: string) => {
    const success = await contactService.markAsRead(id);
    if (success) {
      toast.success('Mensaje marcado como leído');
      await loadMessages();
    } else {
      toast.error('Error al marcar como leído');
    }
  };

  const handleMarkAsReplied = async () => {
    if (!selectedMessage) return;

    const success = await contactService.markAsReplied(
      selectedMessage.id,
      adminNotes || undefined
    );

    if (success) {
      toast.success('Mensaje marcado como respondido');
      setIsDetailsOpen(false);
      setAdminNotes('');
      await loadMessages();
    } else {
      toast.error('Error al marcar como respondido');
    }
  };

  const handleDelete = (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este mensaje?')) return;

    // Note: You'll need to add a delete method to contactService
    console.log('Delete message:', id);
    toast.info('Función de eliminación pendiente de implementar');
  };

  const openDetails = (message: ContactMessageWithUser) => {
    setSelectedMessage(message);
    setAdminNotes(message.admin_notes ?? '');
    setIsDetailsOpen(true);

    // Auto-mark as read if pending
    if (message.status === 'pending') {
      void handleMarkAsRead(message.id);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode; label: string }> = {
      pending: { 
        variant: 'outline', 
        icon: <Clock className="w-3 h-3" />,
        label: 'Nuevo'
      },
      read: { 
        variant: 'secondary', 
        icon: <Mail className="w-3 h-3" />,
        label: 'Leído'
      },
      replied: { 
        variant: 'default', 
        icon: <CheckCircle className="w-3 h-3" />,
        label: 'Respondido'
      },
      archived: { 
        variant: 'destructive', 
        icon: <MessageSquare className="w-3 h-3" />,
        label: 'Archivado'
      }
    };

    const config = variants[status] || variants.pending;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  // Pagination
  const totalPages = Math.ceil(filteredMessages.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentMessages = filteredMessages.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 sm:p-12">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-primary"></div>
            <span className="ml-2 sm:ml-3 text-sm sm:text-base text-muted-foreground">Cargando mensajes...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Filters and Search */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col md:flex-row gap-3 sm:gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <Input
                  placeholder="Buscar por nombre, email o mensaje..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 sm:pl-10 text-xs sm:text-sm"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[200px] text-xs sm:text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="pending">Nuevos</SelectItem>
                <SelectItem value="read">Leídos</SelectItem>
                <SelectItem value="replied">Respondidos</SelectItem>
                <SelectItem value="archived">Archivados</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center text-xs sm:text-sm text-muted-foreground">
              Total: {filteredMessages.length}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Messages Grid */}
      {currentMessages.length === 0 ? (
        <Card>
          <CardContent className="p-8 sm:p-12 text-center">
            <Mail className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-muted-foreground mb-3 sm:mb-4" />
            <p className="text-sm sm:text-base text-muted-foreground">
              {searchQuery || statusFilter !== 'all' 
                ? 'No se encontraron mensajes con estos filtros' 
                : 'No hay mensajes de contacto aún'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
            {currentMessages.map((message) => (
              <Card 
                key={message.id} 
                className="hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => openDetails(message)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <CardTitle className="text-base font-semibold">
                        {message.name}
                      </CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {message.email}
                      </CardDescription>
                    </div>
                    {getStatusBadge(message.status)}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {message.message}
                  </p>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {formatDistanceToNow(new Date(message.created_at), { 
                        addSuffix: true, 
                        locale: es 
                      })}
                    </span>
                    {message.user_id && (
                      <Badge variant="outline" className="text-xs">
                        Usuario registrado
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Página {currentPage} de {totalPages}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(page => {
                        // Show first, last, current, and adjacent pages
                        return page === 1 || 
                               page === totalPages || 
                               Math.abs(page - currentPage) <= 1;
                      })
                      .map((page, idx, arr) => {
                        // Add ellipsis if there's a gap
                        const prevPage = arr[idx - 1];
                        const showEllipsis = prevPage && page - prevPage > 1;
                        
                        return (
                          <div key={page} className="flex items-center gap-2">
                            {showEllipsis && <span className="text-muted-foreground">...</span>}
                            <Button
                              variant={page === currentPage ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => goToPage(page)}
                              className="w-10"
                            >
                              {page}
                            </Button>
                          </div>
                        );
                      })}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Details Dialog */}
      {selectedMessage && (
        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalles del Mensaje</DialogTitle>
              <DialogDescription>
                Mensaje de contacto recibido
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Status */}
              <div>
                <label className="text-sm font-medium">Estado</label>
                <div className="mt-1">
                  {getStatusBadge(selectedMessage.status)}
                </div>
              </div>

              {/* Sender Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Nombre</label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedMessage.name}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <a 
                    href={`mailto:${selectedMessage.email}`}
                    className="text-sm text-primary hover:underline mt-1 block"
                  >
                    {selectedMessage.email}
                  </a>
                </div>
              </div>

              {/* User Info */}
              {selectedMessage.user_id && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Usuario Registrado</label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {selectedMessage.user_first_name} {selectedMessage.user_last_name}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Rol</label>
                    <Badge variant="outline" className="mt-1">
                      {selectedMessage.user_role ?? ''}
                    </Badge>
                  </div>
                </div>
              )}

              {/* Message */}
              <div>
                <label className="text-sm font-medium">Mensaje</label>
                <Card className="mt-1">
                  <CardContent className="p-4">
                    <p className="text-sm whitespace-pre-wrap">
                      {selectedMessage.message}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <label className="text-xs text-muted-foreground">Recibido</label>
                  <p className="mt-1">
                    {formatDistanceToNow(new Date(selectedMessage.created_at), { 
                      addSuffix: true, 
                      locale: es 
                    })}
                  </p>
                </div>
                {selectedMessage.read_at && (
                  <div>
                    <label className="text-xs text-muted-foreground">Leído</label>
                    <p className="mt-1">
                      {formatDistanceToNow(new Date(selectedMessage.read_at), { 
                        addSuffix: true, 
                        locale: es 
                      })}
                    </p>
                  </div>
                )}
                {selectedMessage.replied_at && (
                  <div>
                    <label className="text-xs text-muted-foreground">Respondido</label>
                    <p className="mt-1">
                      {formatDistanceToNow(new Date(selectedMessage.replied_at), { 
                        addSuffix: true, 
                        locale: es 
                      })}
                    </p>
                  </div>
                )}
              </div>

              {/* Admin Notes */}
              <div>
                <label className="text-sm font-medium">Notas Internas</label>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Agregar notas sobre este mensaje (solo visible para administradores)..."
                  rows={3}
                  className="mt-1"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-4">
                <Button
                  onClick={() => void handleMarkAsReplied()}
                  disabled={selectedMessage.status === 'replied'}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Marcar como Respondido
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    window.location.href = `mailto:${selectedMessage.email}`;
                  }}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Responder por Email
                </Button>
                <Button
                  variant="outline"
                  className="ml-auto text-destructive hover:text-destructive"
                  onClick={() => void handleDelete(selectedMessage.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
