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
        "flex items-center gap-3 sm:gap-4 pb-4 sm:pb-6 border-b",
        className
      )}>
        <div className="p-2 sm:p-3 bg-gradient-to-br from-primary/15 to-cyan-500/10 rounded-xl shadow-md border border-primary/10">
          {icon}
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-gradient-animated pb-1">{title}</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-0.5 sm:mt-1 font-medium">{description}</p>
        </div>
      </div>
    </motion.div>
  );
}