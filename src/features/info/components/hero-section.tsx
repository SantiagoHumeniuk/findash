// src/features/info/components/hero-section.tsx

import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '../../../components/ui/button';

/**
 * Props para el componente HeroSection.
 * @property title - Título principal del hero
 * @property subtitle - Subtítulo o descripción
 * @property ctaText - Texto del botón de llamada a la acción
 * @property ctaLink - Ruta a la que redirige el botón CTA
 */
interface HeroSectionProps {
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
}

/**
 * Sección hero de la landing page con título animado con gradiente,
 * subtítulo, y CTA con glow pulsante. Incluye partículas decorativas
 * y un fondo con gradientes radiales vibrantes.
 */
export const HeroSection: React.FC<HeroSectionProps> = ({ 
  title, 
  subtitle, 
  ctaText, 
  ctaLink 
}) => {
  return (
    <section className="relative text-center py-16 px-4 sm:py-20 md:py-28 lg:py-36 overflow-visible z-10">
      {/* Fondo decorativo sutil */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_30%,rgba(120,119,198,0.12),transparent)]" />
      </div>

      {/* Título principal con gradiente animado */}
      <motion.h1
        className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl heading-premium text-gradient-animated mb-6 px-2"
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        {title}
      </motion.h1>

      {/* Subtítulo con animación retrasada */}
      <motion.p
        className="text-base sm:text-lg md:text-xl text-muted-foreground font-medium max-w-full sm:max-w-xl md:max-w-3xl mx-auto mb-10 px-4 leading-relaxed"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
      >
        {subtitle}
      </motion.p>

      {/* CTA Button con glow animado */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.5 }}
      >
        <Link to={ctaLink}>
          <Button 
            size="lg" 
            className="glow-button btn-press text-sm sm:text-base py-3 px-7 sm:py-3.5 sm:px-8 shadow-lg hover:shadow-xl transition-all w-full sm:w-auto max-w-xs sm:max-w-none"
          >
            {ctaText}
          </Button>
        </Link>
      </motion.div>

      {/* Línea decorativa degradada debajo del hero */}
      <motion.div
        className="section-fade-divider mt-16 sm:mt-20 max-w-2xl mx-auto"
        initial={{ opacity: 0, scaleX: 0 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ duration: 1, delay: 0.8 }}
      />
    </section>
  );
};
