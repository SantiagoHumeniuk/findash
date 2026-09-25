// src/features/admin/components/subscriptions/admin-subscriptions-section.tsx

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';
import { Input } from '../../../../components/ui/input';
import { Textarea } from '../../../../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../components/ui/dialog';
import { 
  CreditCard, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Search, 
  Eye, 
  ChevronLeft, 
  ChevronRight, 
  DollarSign, 
  Trash2,
  Crown,
  Rocket
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { paymentService, type SubscriptionRequest } from '../../../../services/payment-service';
import { toast } from 'sonner';

const ITEMS_PER_PAGE = 10;

export function AdminSubscriptionsSection() {
  const [requests, setRequests] = useState<SubscriptionRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<SubscriptionRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Modal states
  const [selectedRequest, setSelectedRequest] = useState<SubscriptionRequest | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    void loadRequests();
  }, []);

  useEffect(() => {
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requests, statusFilter, searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchQuery]);

  const loadRequests = async () => {
    try {
      setIsLoading(true);
      const data = await paymentService.getAllRequests();
      setRequests(data);
    } catch (error) {
      console.error('Error loading subscription requests:', error);
      toast.error('Error al cargar las solicitudes de suscripción');
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...requests];

    if (statusFilter !== 'all') {
      filtered = filtered.filter((req) => req.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (req) =>
          req.user_email.toLowerCase().includes(query) ||
          req.sender_name.toLowerCase().includes(query) ||
          (req.receipt_reference && req.receipt_reference.toLowerCase().includes(query)) ||
          req.plan.toLowerCase().includes(query)
      );
    }

    setFilteredRequests(filtered);
  };

  const handleApprove = async (request: SubscriptionRequest) => {
    setActionLoading(true);
    try {
      const res = await paymentService.approveRequest(request.id, adminNotes || undefined);
      if (res.success) {
        toast.success(`Plan ${request.plan.toUpperCase()} activado para ${request.user_email}`);
        setIsDetailsOpen(false);
        await loadRequests();
      } else {
        toast.error('Error al aprobar', { description: res.error });
      }
    } catch {
      toast.error('Error al procesar la aprobación');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (request: SubscriptionRequest) => {
    setActionLoading(true);
    try {
      const res = await paymentService.rejectRequest(request.id, adminNotes || undefined);
      if (res.success) {
        toast.info(`Solicitud de ${request.user_email} rechazada`);
        setIsDetailsOpen(false);
        await loadRequests();
      } else {
        toast.error('Error al rechazar', { description: res.error });
      }
    } catch {
      toast.error('Error al procesar el rechazo');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta solicitud del registro?')) return;
    const ok = await paymentService.deleteRequest(id);
    if (ok) {
      toast.success('Solicitud eliminada');
      await loadRequests();
    } else {
      toast.error('Error al eliminar');
    }
  };

  const openDetails = (request: SubscriptionRequest) => {
    setSelectedRequest(request);
    setAdminNotes(request.admin_notes ?? '');
    setIsDetailsOpen(true);
  };

  // Stats calculation
  const totalAmountApproved = requests
    .filter((r) => r.status === 'approved')
    .reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const approvedCount = requests.filter((r) => r.status === 'approved').length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Pendiente
          </Badge>
        );
      case 'approved':
        return (
          <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> Aprobada
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <XCircle className="w-3 h-3" /> Rechazada
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Pagination
  const totalPages = Math.ceil(filteredRequests.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentRequests = filteredRequests.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <span className="mt-3 block text-sm text-muted-foreground">Cargando pagos y solicitudes...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Solicitudes Totales</p>
              <p className="text-2xl font-bold mt-1">{requests.length}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Pendientes de Revisión</p>
              <p className="text-2xl font-bold mt-1 text-amber-500">{pendingCount}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Planes Aprobados</p>
              <p className="text-2xl font-bold mt-1 text-green-500">{approvedCount}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center">
              <CheckCircle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Recaudación Total</p>
              <p className="text-2xl font-bold mt-1 text-foreground">
                ${totalAmountApproved.toLocaleString('es-AR')}
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar por email, titular, comprobante o plan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs sm:text-sm"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[220px] text-xs sm:text-sm">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="pending">Pendientes ({pendingCount})</SelectItem>
                <SelectItem value="approved">Aprobadas ({approvedCount})</SelectItem>
                <SelectItem value="rejected">Rechazadas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Requests Table / List */}
      {currentRequests.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center space-y-3">
            <CreditCard className="w-12 h-12 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">
              {searchQuery || statusFilter !== 'all'
                ? 'No se encontraron transferencias con esos filtros.'
                : 'No hay solicitudes de suscripción registradas aún.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-3 font-semibold">Fecha</th>
                  <th className="text-left p-3 font-semibold">Usuario</th>
                  <th className="text-left p-3 font-semibold">Plan Solicitado</th>
                  <th className="text-left p-3 font-semibold">Monto</th>
                  <th className="text-left p-3 font-semibold">Titular Transferencia</th>
                  <th className="text-left p-3 font-semibold">Comprobante</th>
                  <th className="text-center p-3 font-semibold">Estado</th>
                  <th className="text-center p-3 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {currentRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-muted/40 transition-colors">
                    <td className="p-3 whitespace-nowrap text-muted-foreground">
                      {format(new Date(req.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-foreground">{req.user_email}</div>
                      {(req.user_first_name || req.user_last_name) && (
                        <div className="text-[11px] text-muted-foreground">
                          {req.user_first_name} {req.user_last_name}
                        </div>
                      )}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <Badge
                        variant="secondary"
                        className={`capitalize font-bold ${
                          req.plan === 'plus'
                            ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                            : 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
                        }`}
                      >
                        {req.plan === 'plus' ? <Crown className="w-3 h-3 mr-1" /> : <Rocket className="w-3 h-3 mr-1" />}
                        {req.plan}
                      </Badge>
                    </td>
                    <td className="p-3 font-mono font-semibold whitespace-nowrap">
                      ${Number(req.amount).toLocaleString('es-AR')}
                    </td>
                    <td className="p-3 font-medium">{req.sender_name}</td>
                    <td className="p-3">
                      {req.receipt_reference ? (
                        <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded border">
                          {req.receipt_reference}
                        </span>
                      ) : req.receipt_image ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs gap-1"
                          onClick={() => setPreviewImage(req.receipt_image ?? null)}
                        >
                          <Eye className="w-3 h-3" /> Ver Imagen
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">{getStatusBadge(req.status)}</td>
                    <td className="p-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => openDetails(req)}
                        >
                          Revisar
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          onClick={() => void handleDelete(req.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-3 border-t flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Página {currentPage} de {totalPages}
              </span>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage === 1}
                  onClick={() => goToPage(currentPage - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage === totalPages}
                  onClick={() => goToPage(currentPage + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Review Request Modal */}
      {selectedRequest && (
        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle className="text-lg">Revisar Solicitud de Suscripción</DialogTitle>
                {getStatusBadge(selectedRequest.status)}
              </div>
              <DialogDescription>
                Transferencia para activar el plan{' '}
                <strong className="capitalize">{selectedRequest.plan}</strong>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm bg-muted/40 p-3 rounded-lg border">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Usuario / Email</span>
                  <span className="font-semibold">{selectedRequest.user_email}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Monto Transferido</span>
                  <span className="font-semibold font-mono text-primary">
                    ${Number(selectedRequest.amount).toLocaleString('es-AR')} ARS
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Titular que transfirió</span>
                  <span className="font-medium">{selectedRequest.sender_name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">N° Operación / Referencia</span>
                  <span className="font-mono font-medium">
                    {selectedRequest.receipt_reference || 'No especificado'}
                  </span>
                </div>
              </div>

              {selectedRequest.notes && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Comentario del Usuario
                  </label>
                  <p className="text-xs bg-background p-2.5 rounded border text-muted-foreground">
                    {selectedRequest.notes}
                  </p>
                </div>
              )}

              {selectedRequest.receipt_image && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Comprobante Adjunto
                  </label>
                  <div className="border rounded-lg p-1 bg-muted/20 text-center">
                    <img
                      src={selectedRequest.receipt_image}
                      alt="Comprobante"
                      className="max-h-64 object-contain mx-auto rounded cursor-pointer hover:opacity-95"
                      onClick={() => setPreviewImage(selectedRequest.receipt_image ?? null)}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  Notas del Administrador (Opcional)
                </label>
                <Textarea
                  placeholder="Notas internas o motivo de rechazo..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="text-xs resize-none"
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setIsDetailsOpen(false)}
                disabled={actionLoading}
              >
                Cerrar
              </Button>
              {selectedRequest.status !== 'rejected' && (
                <Button
                  variant="destructive"
                  onClick={() => void handleReject(selectedRequest)}
                  disabled={actionLoading}
                >
                  <XCircle className="w-4 h-4 mr-1.5" />
                  Rechazar
                </Button>
              )}
              {selectedRequest.status !== 'approved' && (
                <Button
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => void handleApprove(selectedRequest)}
                  disabled={actionLoading}
                >
                  <CheckCircle className="w-4 h-4 mr-1.5" />
                  {actionLoading ? 'Actualizando...' : `Aprobar y Asignar Plan ${selectedRequest.plan.toUpperCase()}`}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Image Preview Lightbox */}
      {previewImage && (
        <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
          <DialogContent className="max-w-3xl p-2 bg-black/90 border-none">
            <img
              src={previewImage}
              alt="Comprobante Completo"
              className="max-h-[80vh] w-auto mx-auto object-contain rounded"
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
