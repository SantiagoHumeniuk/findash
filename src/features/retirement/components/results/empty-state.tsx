// src/features/retirement/components/results/empty-state.tsx

import { TrendingUp, Lightbulb } from "lucide-react";
import { Card } from "../../../../components/ui/card";

/**
 * Estado vacío que se muestra cuando no hay valores calculados
 * Guía al usuario para comenzar a usar la calculadora
 * 
 * @example
 * ```tsx
 * {finalInversion === 0 && <EmptyState />}
 * ```
 */
export function EmptyState() {
  return (
    <Card className="p-6 sm:p-8 border-dashed border-2 bg-muted/30">
      <div className="flex flex-col items-center text-center gap-4">
        <div className="p-4 bg-primary/10 rounded-full">
          <TrendingUp className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
        </div>
        
        <div className="space-y-2">
          <h3 className="text-lg sm:text-xl font-semibold text-foreground">
            Comienza tu proyección
          </h3>
          <p className="text-sm sm:text-base text-muted-foreground max-w-md">
            Ajusta los parámetros de la izquierda para ver cómo tu dinero puede crecer 
            con el poder del interés compuesto
          </p>
        </div>

        <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg border border-blue-200 dark:border-blue-900 max-w-md mt-2">
          <Lightbulb className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-left">
            <p className="text-xs sm:text-sm text-blue-900 dark:text-blue-100 font-medium mb-1">
              💡 Tip: Probá con estos valores
            </p>
            <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-0.5">
              <li>• Inversión inicial: $100,000</li>
              <li>• Aporte mensual: $10,000</li>
              <li>• Años de inversión: 10-30 años</li>
              <li>• Rendimiento anual: 8-12%</li>
            </ul>
          </div>
        </div>
      </div>
    </Card>
  );
}
