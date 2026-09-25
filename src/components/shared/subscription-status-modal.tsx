// src/components/shared/subscription-status-modal.tsx

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  Crown, 
  Rocket, 
  CheckCircle2, 
  XCircle, 
  Sparkles, 
  ArrowRight,
  ShieldCheck,
  HelpCircle
} from 'lucide-react';
import { useAuth } from '../../hooks/use-auth';
import { paymentService, type SubscriptionRequest } from '../../services/payment-service';
import { useNavigate } from 'react-router-dom';

export function SubscriptionStatusModal() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [request, setRequest] = useState<SubscriptionRequest | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!user) return;

    const checkStatus = async () => {
      try {
        const unnotified = await paymentService.getUnnotifiedUserRequest();
        if (unnotified) {
          setRequest(unnotified);
          setIsOpen(true);
          // Si fue aprobado, refrescar el perfil en tiempo real para que tome los nuevos permisos
          if (unnotified.status === 'approved') {
            await refreshProfile();
          }
        }
      } catch (err) {
        console.error('Error checking subscription notification status:', err);
      }
    };

    // Verificar al montar o cuando cambia el usuario
    const timeout = setTimeout(() => {
      void checkStatus();
    }, 1200);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleClose = async () => {
    if (request) {
      await paymentService.markRequestAsNotified(request.id);
    }
    setIsOpen(false);
  };

  const handleAction = async () => {
    if (!request) return;
    await handleClose();

    if (request.status === 'approved') {
      navigate('/dashboard');
    } else {
      navigate('/plans');
    }
  };

  if (!request) return null;

  const isApproved = request.status === 'approved';
  const planName = request.plan === 'plus' ? 'Plus' : 'Premium';
  const PlanIcon = request.plan === 'plus' ? Crown : Rocket;

  const plusPerks = [
    'Acceso ilimitado a más de 8.000 símbolos y activos',
    'Hasta 5 portfolios de inversión personalizados',
    'Exportación de portafolio y balances a PDF',
    'Análisis de segmentación geográfica y de ingresos',
    'Stock Grades y calificaciones de analistas',
  ];

  const premiumPerks = [
    'Todo lo incluido en el Plan Plus',
    'Hasta 10 portfolios de inversión simultáneos',
    'Alertas en tiempo real y análisis predictivo con IA',
    'Publicación de artículos y posts en el Blog',
    'Soporte prioritario y acceso anticipado a novedades',
  ];

  const perks = request.plan === 'plus' ? plusPerks : premiumPerks;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && void handleClose()}>
      <DialogContent className="sm:max-w-[540px] p-0 overflow-hidden border-border/80 shadow-2xl">
        {isApproved ? (
          <div>
            {/* Header con gradiente festivo */}
            <div className={`p-6 text-white text-center relative overflow-hidden bg-gradient-to-br ${
              request.plan === 'plus' 
                ? 'from-purple-600 via-pink-600 to-indigo-700' 
                : 'from-amber-500 via-orange-600 to-red-600'
            }`}>
              <div className="absolute top-2 right-3 opacity-20">
                <Sparkles className="w-24 h-24" />
              </div>

              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center mx-auto mb-3 shadow-lg">
                <PlanIcon className="w-9 h-9 text-white animate-bounce" />
              </div>

              <Badge className="bg-white/20 text-white border-white/30 text-xs px-3 py-1 mb-2 backdrop-blur-sm">
                ¡PAGO VERIFICADO Y APROBADO!
              </Badge>

              <DialogTitle className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                ¡Bienvenido a FinDash {planName}!
              </DialogTitle>
              <DialogDescription className="text-white/90 text-xs sm:text-sm mt-1 max-w-sm mx-auto">
                Tu transferencia ha sido confirmada con éxito. Ya tienes todas las herramientas exclusivas desbloqueadas.
              </DialogDescription>
            </div>

            {/* Contenido con beneficios */}
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Nuevas funciones habilitadas en tu cuenta:
                </p>
                <div className="space-y-2 bg-muted/40 p-3.5 rounded-xl border">
                  {perks.map((perk, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-xs sm:text-sm">
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                      <span className="text-foreground">{perk}</span>
                    </div>
                  ))}
                </div>
              </div>

              {request.admin_notes && (
                <div className="text-xs bg-primary/5 p-3 rounded-lg border border-primary/20 text-muted-foreground">
                  <strong className="text-foreground block mb-0.5">Nota de bienvenida:</strong>
                  {request.admin_notes}
                </div>
              )}

              <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
                <Button
                  onClick={() => void handleAction()}
                  className={`w-full text-white shadow-lg text-sm font-semibold h-11 bg-gradient-to-r ${
                    request.plan === 'plus'
                      ? 'from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700'
                      : 'from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700'
                  }`}
                >
                  ¡Comenzar a Disfrutar!
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </DialogFooter>
            </div>
          </div>
        ) : (
          <div>
            {/* Header de Rechazo */}
            <div className="p-6 text-center bg-destructive/10 border-b border-destructive/20">
              <div className="w-14 h-14 rounded-full bg-destructive/20 text-destructive flex items-center justify-center mx-auto mb-3">
                <XCircle className="w-8 h-8" />
              </div>

              <DialogTitle className="text-xl sm:text-2xl font-bold text-foreground">
                Actualización sobre tu solicitud de Plan {planName}
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-1">
                Lamentablemente tu solicitud no pudo ser aprobada en esta ocasión.
              </DialogDescription>
            </div>

            <div className="p-6 space-y-4">
              {request.admin_notes ? (
                <div className="space-y-1 bg-muted/60 p-4 rounded-xl border">
                  <span className="text-xs font-semibold text-muted-foreground block">
                    Motivo indicado por el administrador:
                  </span>
                  <p className="text-sm text-foreground font-medium">
                    {request.admin_notes}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No pudimos validar la acreditación de la transferencia con los datos proporcionados.
                </p>
              )}

              <div className="flex items-start gap-2.5 text-xs text-muted-foreground bg-blue-500/5 p-3 rounded-lg border border-blue-500/20">
                <HelpCircle className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <span>
                  Si consideras que fue un error o deseas volver a enviar el comprobante correcto, puedes hacerlo desde la sección de planes o contactándonos.
                </span>
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => void handleClose()}
                  className="w-full sm:w-auto text-xs"
                >
                  Entendido
                </Button>
                <Button
                  onClick={() => void handleAction()}
                  className="w-full sm:w-auto text-xs"
                >
                  Ver Planes / Reintentar
                </Button>
              </DialogFooter>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
