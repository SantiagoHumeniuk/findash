// src/features/info/components/final-cta-section.tsx

import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '../../../components/ui/button';
import { AnimatedSection } from './animated-section';

/**
 * Props para el componente FinalCtaSection.
 * @property title - Título del CTA final
 * @property subtitle - Subtítulo o descripción
 * @property ctaText - Texto del botón de acción
 * @property ctaLink - Ruta a la que redirige el botón
 */
interface FinalCtaSectionProps {
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
}

/**
 * Sección de llamada a la acción (CTA) final de la landing page.
 * Presenta un diseño premium con glassmorphism, bordes gradiente vibrantes,
 * y un botón con efecto glow pulsante para máxima conversión.
 */
export const FinalCtaSection: React.FC<FinalCtaSectionProps> = ({ 
  title, 
  subtitle, 
  ctaText, 
  ctaLink 
}) => {
  return (
    <AnimatedSection className="relative py-12 px-4 sm:py-16 md:py-20">
      {/* Fondo con degradado intenso para peso visual */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-t from-primary/[0.05] via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_80%,rgba(99,102,241,0.08),transparent)]" />
      </div>

      {/* Separador gradiente superior */}
      <div className="section-fade-divider mb-10 sm:mb-12 max-w-xs mx-auto" />

      <div className="max-w-3xl mx-auto text-center">
        {/* Contenedor con borde gradiente vibrante */}
        <motion.div
          className="relative p-[1.5px] rounded-2xl bg-gradient-to-r from-primary/80 via-blue-500/70 to-cyan-400/80 overflow-hidden"
          whileHover={{ scale: 1.01 }}
          transition={{ duration: 0.3 }}
        >
          {/* Interior con contraste mejorado */}
          <div className="bg-background/95 backdrop-blur-xl rounded-2xl p-6 sm:p-8 md:p-10 !border-0 shadow-inner">
            {/* Destellos decorativos internos */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/15 to-transparent rounded-bl-full" aria-hidden="true" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-cyan-400/15 to-transparent rounded-tr-full" aria-hidden="true" />

            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight mb-3 sm:mb-4 px-2 relative z-10 text-gradient-animated">
              {title}
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground mb-6 sm:mb-8 px-2 leading-relaxed relative z-10">
              {subtitle}
            </p>
            <div className="relative z-10">
              <Link to={ctaLink}>
                <Button 
                  size="lg"
                  className="glow-button text-sm sm:text-base py-3 px-7 sm:py-3.5 sm:px-8 bg-foreground text-background hover:bg-foreground/80 transition-all w-full sm:w-auto max-w-xs sm:max-w-none"
                >
                  {ctaText}
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatedSection>
  );
};
