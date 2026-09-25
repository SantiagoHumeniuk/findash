// src/components/shared/upgrade-modal.tsx

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Crown, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface UpgradeModalProps {
  /** Si el modal está abierto */
  isOpen: boolean;
  /** Función para cerrar el modal */
  onClose: () => void;
  /** Nombre de la funcionalidad bloqueada */
  featureName: string;
  /** Plan mínimo requerido */
  requiredPlan: 'plus' | 'premium';
  /** Descripción adicional opcional */
  description?: string;
}

/**
 * Modal para solicitar actualización de plan cuando el usuario intenta
 * acceder a una funcionalidad restringida.
 * 
 * @example
 * ```tsx
 * <UpgradeModal
 *   isOpen={showModal}
 *   onClose={() => setShowModal(false)}
 *   featureName="Exportar Portfolio a PDF"
 *   requiredPlan="plus"
 * />
 * ```
 */
export function UpgradeModal({
  isOpen,
  onClose,
  featureName,
  requiredPlan,
  description,
}: UpgradeModalProps) {
  const navigate = useNavigate();

  const planDetails = {
    plus: {
      name: 'Plus',
      price: '$15.000 / mes',
      features: [
        '+8000 activos en seguimiento',
        '5 portfolios',
        'Exportar a PDF',
        'Calificaciones de Analistas',
        'Segmentación de Ingresos',
        'Calculadora Avanzada de Retiro',
      ],
    },
    premium: {
      name: 'Premium',
      price: '$25.000 / mes',
      features: [
        '50 activos en seguimiento',
        '10 portfolios',
        'Todo lo de Plus +',
        'Acceso a API REST',
        'Alertas en Tiempo Real',
        'Análisis Predictivo con IA',
      ],
    },
  };

  const plan = planDetails[requiredPlan];

  const handleUpgrade = () => {
    void navigate('/plans');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Crown className="h-6 w-6 text-yellow-500" />
            <DialogTitle className="text-2xl">Actualiza a {plan.name}</DialogTitle>
          </div>
          <DialogDescription className="text-base">
            {description ?? `${featureName} está disponible en el plan ${plan.name}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="mb-4">
            <div className="text-3xl font-bold text-primary mb-1">{plan.price}</div>
            <div className="text-sm text-muted-foreground">Cancela cuando quieras</div>
          </div>

          <div className="space-y-2">
            {plan.features.map((feature, index) => (
              <div key={index} className="flex items-start gap-2">
                <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
            Tal vez después
          </Button>
          <Button onClick={handleUpgrade} className="w-full sm:w-auto">
            <Crown className="mr-2 h-4 w-4" />
            Ver Planes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
