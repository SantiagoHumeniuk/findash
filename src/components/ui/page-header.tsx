// src/components/ui/page-header.tsx

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

interface PageHeaderProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  className?: string;
}

/**
 * Componente reutilizable para las cabeceras de las páginas principales.
 * Incluye un ícono, título y descripción con una animación de entrada.
 * 
 * @remarks
 * - Usa `heading-2` para el título (responsive: text-3xl lg:text-4xl)
 * - Usa `body` para la descripción con color muted
 * - Usa `section-divider` para separación consistente
 * - Animación optimizada (0.3s)
 */
export function PageHeader({ icon, title, description, className }: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className={cn(
        "flex items-center gap-3 pb-4 sm:gap-4 sm:pb-6 border-b",
        className
      )}>
        <div className="shrink-0 rounded-xl border border-primary/10 bg-gradient-to-br from-primary/15 to-cyan-500/10 p-2 shadow-md sm:p-3">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="break-words pb-1 text-2xl font-extrabold tracking-tight text-gradient-animated sm:text-3xl lg:text-4xl">{title}</h1>
          <p className="mt-0.5 text-sm font-medium leading-relaxed text-muted-foreground sm:mt-1 sm:text-base">{description}</p>
        </div>
      </div>
    </motion.div>
  );
}