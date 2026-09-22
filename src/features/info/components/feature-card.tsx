// src/features/info/components/feature-card.tsx

import React from 'react';

/**
 * Props para el componente FeatureCard.
 * @property icon - Elemento React que representa el icono (de lucide-react)
 * @property title - Título de la característica
 * @property description - Descripción detallada de la característica
 */
interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

/**
 * Tarjeta individual con efecto glassmorphism que muestra una característica del producto.
 * Incluye un icono con fondo gradiente, título y descripción con efectos hover premium.
 * 
 * Se usa principalmente en el carrusel de características de la landing page.
 * 
 * @example
 * ```tsx
 * <FeatureCard
 *   icon={<Brain className="w-6 h-6" />}
 *   title="Análisis con IA"
 *   description="Obtén insights generados por inteligencia artificial"
 * />
 * ```
 */
export const FeatureCard: React.FC<FeatureCardProps> = ({ icon, title, description }) => (
  <div className="relative p-[1.5px] rounded-2xl bg-gradient-to-br from-primary/30 via-blue-500/10 to-cyan-400/30 hover:from-primary/70 hover:via-blue-500/50 hover:to-cyan-400/70 transition-all duration-500 h-full group">
    <div className="bg-background/95 backdrop-blur-xl rounded-2xl h-full p-5 sm:p-6 md:p-7 text-left shadow-inner relative z-10 overflow-hidden">
      {/* Destellos decorativos internos parecidos al CTA */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-primary/10 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" aria-hidden="true" />
      
      {/* Icono con fondo gradiente */}
      <div className="mb-4 sm:mb-5 inline-flex items-center justify-center p-3 sm:p-3.5 rounded-xl bg-gradient-to-br from-primary/15 to-blue-500/10 dark:from-primary/20 dark:to-blue-500/15 border border-primary/10 group-hover:border-primary/30 group-hover:scale-110 transition-all duration-300 relative z-10">
        {icon}
      </div>
      
      <h3 className="text-lg sm:text-xl font-semibold mb-2 text-foreground group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-primary group-hover:to-cyan-400 transition-all duration-300 relative z-10">
        {title}
      </h3>
      
      <p className="text-sm sm:text-base text-muted-foreground leading-relaxed relative z-10">
        {description}
      </p>
    </div>
  </div>
);
