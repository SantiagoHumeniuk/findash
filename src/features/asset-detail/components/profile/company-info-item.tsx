// src/features/asset-detail/components/profile/company-info-item.tsx

import React from 'react';

/**
 * Props para el componente CompanyInfoItem.
 * @property icon - Icono de lucide-react a mostrar
 * @property label - Etiqueta descriptiva del campo
 * @property value - Valor a mostrar (puede ser string o JSX para links)
 */
interface CompanyInfoItemProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}

/**
 * Componente reutilizable para mostrar un campo de información de la compañía.
 * Incluye un icono, etiqueta y valor con diseño consistente.
 */
export function CompanyInfoItem({ icon, label, value }: CompanyInfoItemProps) {
  if (value === null || value === undefined || value === '' || value === 'N/A' || value === 'Unknown') return null;

  return (
    <div className="flex items-start gap-2 sm:gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
      <div className="shrink-0 text-muted-foreground mt-0.5">{icon}</div>
      <div className="space-y-0.5 min-w-0">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </p>
        <div className="text-sm font-medium text-foreground break-words leading-snug">
          {value}
        </div>
      </div>
    </div>
  );
}