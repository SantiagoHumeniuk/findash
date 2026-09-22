// src/features/info/components/animated-section.tsx

import React from 'react';
import { motion } from 'framer-motion';

/**
 * Props para el componente AnimatedSection.
 * @property children - Contenido a animar
 * @property className - Clases CSS adicionales
 */
interface AnimatedSectionProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Componente wrapper que aplica animaciones de entrada suaves a sus hijos.
 * Utiliza Framer Motion con detección de viewport para activar la animación
 * cuando el elemento entra en la vista.
 * 
 * @example
 * ```tsx
 * <AnimatedSection className="py-12">
 *   <h2>Título Animado</h2>
 * </AnimatedSection>
 * ```
 */
export const AnimatedSection: React.FC<AnimatedSectionProps> = ({ children, className }) => (
  <motion.section
    className={className}
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, ease: "easeOut" }}
    viewport={{ once: true, margin: "-50px" }}
    style={{ willChange: "opacity, transform" }}
  >
    {children}
  </motion.section>
);
