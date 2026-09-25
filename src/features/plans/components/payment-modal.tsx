// src/features/plans/components/payment-modal.tsx

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Badge } from '../../../components/ui/badge';
import { Card, CardContent } from '../../../components/ui/card';
import { 
  Crown, 
  Rocket, 
  Copy, 
  Check, 
  UploadCloud, 
  X, 
  AlertCircle,
  Clock,
  ShieldCheck,
  QrCode
} from 'lucide-react';
import { useConfig } from '../../../hooks/use-config';
import { useAuth } from '../../../hooks/use-auth';
import { paymentService } from '../../../services/payment-service';
import { toast } from 'sonner';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: 'plus' | 'premium';
  onSuccess?: () => void;
}

export function PaymentModal({ isOpen, onClose, plan, onSuccess }: PaymentModalProps) {
  const config = useConfig();
  const { user, profile } = useAuth();

  const [copiedAlias, setCopiedAlias] = useState(false);
  const [copiedCvu, setCopiedCvu] = useState(false);

  // Form State
  const [senderName, setSenderName] = useState(
    profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : ''
  );
  const [receiptReference, setReceiptReference] = useState('');
  const [notes, setNotes] = useState('');
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Payment account defaults from config
  const paymentInfo = config.payment || {
    bankName: 'Mercado Pago',
    accountHolder: 'Santiago Humeniuk',
    alias: 'santiagohumeniuk',
    cvu: '00000031300056422142774',
    cuitCuil: 'Mercado Pago',
    instructions: 'Transfiere el monto exacto desde tu cuenta bancaria o Mercado Pago.',
    pricing: {
      plus: 15000,
      premium: 25000,
    },
  };

  const planName = plan === 'plus' ? 'Plus' : 'Premium';
  const planPrice = plan === 'plus' ? (paymentInfo.pricing?.plus ?? 15000) : (paymentInfo.pricing?.premium ?? 25000);
  const planIcon = plan === 'plus' ? Crown : Rocket;
  const PlanIconComponent = planIcon;
  const planGradient = plan === 'plus' 
    ? 'from-purple-500 to-pink-500' 
    : 'from-orange-500 to-red-500';

  const copyToClipboard = (text: string, type: 'alias' | 'cvu') => {
    void navigator.clipboard.writeText(text);
    if (type === 'alias') {
      setCopiedAlias(true);
      setTimeout(() => setCopiedAlias(false), 2000);
    } else {
      setCopiedCvu(true);
      setTimeout(() => setCopiedCvu(false), 2000);
    }
    toast.success(`${type === 'alias' ? 'Alias' : 'CVU'} copiado al portapapeles`);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen no debe superar los 5MB');
      return;
    }

    setImageFileName(file.name);
    const reader = new FileReader();
    reader.onloadend = () => {
      setReceiptImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setReceiptImage(null);
    setImageFileName(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error('Debes iniciar sesión para realizar la suscripción');
      return;
    }

    if (!senderName.trim()) {
      toast.error('Por favor ingresa el nombre del titular que realizó la transferencia');
      return;
    }

    if (!receiptReference.trim() && !receiptImage) {
      toast.error('Por favor ingresa el número de comprobante o sube una captura');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await paymentService.createSubscriptionRequest({
        plan,
        amount: planPrice,
        senderName: senderName.trim(),
        receiptReference: receiptReference.trim() || undefined,
        receiptImage: receiptImage || undefined,
        notes: notes.trim() || undefined,
      });

      if (!res.success) {
        toast.error('Error al enviar la solicitud', { description: res.error });
        return;
      }

      toast.success('¡Comprobante enviado con éxito!', {
        description: 'Revisaremos tu transferencia y activaremos tu plan a la brevedad.',
      });

      setSubmitted(true);
      if (onSuccess) {
        onSuccess();
      }
    } catch {
      toast.error('Error inesperado al procesar la solicitud.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitted) {
      setSubmitted(false);
      setReceiptReference('');
      setNotes('');
      setReceiptImage(null);
      setImageFileName(null);
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        {submitted ? (
          <div className="py-6 text-center space-y-4">
            <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto">
              <ShieldCheck className="w-9 h-9" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl sm:text-2xl font-bold">¡Transferencia Notificada!</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Hemos recibido los datos de tu transferencia para el plan{' '}
                <strong className="text-foreground">{planName}</strong> por{' '}
                <strong className="text-foreground">${planPrice.toLocaleString('es-AR')} ARS</strong>.
              </p>
            </div>

            <Card className="bg-primary/5 border-primary/20 text-left p-4 max-w-md mx-auto">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm space-y-1">
                  <p className="font-semibold text-foreground">Tiempo estimado de validación</p>
                  <p className="text-muted-foreground">
                    Tu plan se activará en un lapso de 15 minutos a 2 horas tras confirmar la acreditación.
                  </p>
                </div>
              </div>
            </Card>

            <Button onClick={handleClose} className="w-full sm:w-auto px-8">
              Entendido
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${planGradient} flex items-center justify-center text-white`}>
                    <PlanIconComponent className="w-4 h-4" />
                  </div>
                  <div>
                    <DialogTitle className="text-lg sm:text-xl font-bold">
                      Suscripción Plan {planName}
                    </DialogTitle>
                  </div>
                </div>
                <Badge variant="secondary" className="text-sm font-semibold px-3 py-1 bg-primary/10 text-primary">
                  ${planPrice.toLocaleString('es-AR')} ARS / mes
                </Badge>
              </div>
              <DialogDescription className="text-xs sm:text-sm">
                Transfiere mediante <strong>Mercado Pago</strong> o cualquier banco a los siguientes datos y confirma tu comprobante.
              </DialogDescription>
            </DialogHeader>

            {/* Account Details Box */}
            <Card className="border-primary/20 bg-muted/40 my-2">
              <CardContent className="p-3 sm:p-4 space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-xs text-muted-foreground font-medium">Billetera / Banco:</span>
                  <span className="text-xs sm:text-sm font-semibold flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-blue-500"></span>
                    {paymentInfo.bankName}
                  </span>
                </div>

                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-xs text-muted-foreground font-medium">Titular de la cuenta:</span>
                  <span className="text-xs sm:text-sm font-semibold">{paymentInfo.accountHolder}</span>
                </div>

                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-xs text-muted-foreground font-medium">CUIT / CUIL:</span>
                  <span className="text-xs sm:text-sm font-mono">{paymentInfo.cuitCuil}</span>
                </div>

                {/* Alias with Copy Button */}
                <div className="flex items-center justify-between bg-background/80 p-2 rounded-md border">
                  <div>
                    <span className="text-[11px] text-muted-foreground block">Alias:</span>
                    <span className="text-xs sm:text-sm font-bold font-mono text-primary">{paymentInfo.alias}</span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    onClick={() => copyToClipboard(paymentInfo.alias, 'alias')}
                  >
                    {copiedAlias ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedAlias ? 'Copiado' : 'Copiar'}
                  </Button>
                </div>

                {/* CVU with Copy Button */}
                <div className="flex items-center justify-between bg-background/80 p-2 rounded-md border">
                  <div>
                    <span className="text-[11px] text-muted-foreground block">CVU:</span>
                    <span className="text-xs font-mono break-all">{paymentInfo.cvu}</span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1 shrink-0 ml-2"
                    onClick={() => copyToClipboard(paymentInfo.cvu, 'cvu')}
                  >
                    {copiedCvu ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedCvu ? 'Copiado' : 'Copiar'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Notification / Instructions */}
            <div className="flex items-center gap-2 text-[11px] sm:text-xs text-muted-foreground bg-blue-500/5 text-blue-600 dark:text-blue-400 p-2.5 rounded-lg border border-blue-500/20">
              <QrCode className="w-4 h-4 shrink-0" />
              <span>Transfiere exactamente <strong>${planPrice.toLocaleString('es-AR')}</strong> para facilitar la validación inmediata.</span>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3.5 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="senderName" className="text-xs sm:text-sm">
                  Nombre del Titular de la cuenta que transfiere <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="senderName"
                  placeholder="Ej: Juan Pérez"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  className="text-xs sm:text-sm"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="receiptReference" className="text-xs sm:text-sm">
                  N° de Comprobante / Operación de Mercado Pago (Opcional si adjuntas captura)
                </Label>
                <Input
                  id="receiptReference"
                  placeholder="Ej: 9876543210"
                  value={receiptReference}
                  onChange={(e) => setReceiptReference(e.target.value)}
                  className="text-xs sm:text-sm font-mono"
                />
              </div>

              {/* Upload Receipt Image */}
              <div className="space-y-1.5">
                <Label className="text-xs sm:text-sm">Comprobante de Transferencia (Captura / Foto)</Label>
                {receiptImage ? (
                  <div className="relative rounded-lg border p-2 bg-muted/30 flex items-center justify-between">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <img
                        src={receiptImage}
                        alt="Comprobante"
                        className="w-10 h-10 object-cover rounded border"
                      />
                      <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {imageFileName || 'comprobante.jpg'}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={removeImage}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center p-3 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                    <UploadCloud className="w-6 h-6 text-muted-foreground mb-1" />
                    <span className="text-xs font-medium text-foreground">
                      Subir comprobante o captura de pantalla
                    </span>
                    <span className="text-[10px] text-muted-foreground">PNG, JPG hasta 5MB</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                  </label>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notes" className="text-xs sm:text-sm">Notas adicionales (Opcional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Comentarios o aclaraciones adicionales..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="text-xs sm:text-sm resize-none"
                  rows={2}
                />
              </div>

              {!user && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Debes iniciar sesión para que podamos asignar el plan a tu cuenta.</span>
                </div>
              )}

              <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  className="w-full sm:w-auto text-xs sm:text-sm"
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="w-full sm:w-auto text-xs sm:text-sm"
                  disabled={isSubmitting || !user}
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-2">
                      <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                      <span>Enviando comprobante...</span>
                    </div>
                  ) : (
                    'Notificar Transferencia y Activar'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
