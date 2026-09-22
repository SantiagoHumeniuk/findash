// src/features/info/components/testimonials-section.tsx

import React from 'react';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '../../../components/ui/carousel';
import { Avatar, AvatarFallback, AvatarImage } from '../../../components/ui/avatar';
import { Star, Quote } from 'lucide-react';
import { AnimatedSection } from './animated-section';
import type { TestimonialOpinion } from '../types/info-config.types';

/**
 * Props para el componente TestimonialsSection.
 * @property title - Título de la sección de testimonios
 * @property subtitle - Subtítulo descriptivo
 * @property testimonials - Array de testimonios de usuarios
 */
interface TestimonialsSectionProps {
  title: string;
  subtitle: string;
  testimonials: TestimonialOpinion[];
}

/**
 * Sección de testimonios de usuarios con tarjetas glassmorphism en carrusel.
 * Cada testimonio incluye avatar, nombre, rol, calificación de 5 estrellas
 * y comentario del usuario. Fondo con degradado coherente.
 */
export const TestimonialsSection: React.FC<TestimonialsSectionProps> = ({ 
  title, 
  subtitle, 
  testimonials 
}) => {
  return (
    <AnimatedSection className="relative py-12 px-4 sm:py-16 md:py-20">
      {/* Fondo con degradado complementario */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-indigo-500/[0.03] to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_40%_50%,rgba(139,92,246,0.05),transparent)]" />
      </div>

      <div className="max-w-4xl mx-auto text-center">
        {/* Separador gradiente superior */}
        <div className="section-fade-divider mb-10 sm:mb-12 max-w-xs mx-auto" />

        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 px-2">{title}</h2>
        <p className="text-sm sm:text-base text-muted-foreground mb-8 sm:mb-10 max-w-full sm:max-w-lg mx-auto px-2 leading-relaxed">{subtitle}</p>

        <Carousel className="w-full" opts={{ align: "start", loop: true }}>
          <CarouselContent className="-ml-2 sm:-ml-4">
            {testimonials.map((opinion, index) => (
              <CarouselItem key={index} className="pl-2 sm:pl-4 basis-full sm:basis-1/2 md:basis-1/2 lg:basis-1/3">
                <div className="p-1 sm:p-2 h-full">
                  {/* Tarjeta con glassmorphism */}
                  <div className="glass-card rounded-xl flex flex-col h-full p-4 sm:p-5 md:p-6 text-left">
                    {/* Contenido del testimonio */}
                    <div className="flex-grow">
                      <Quote className="w-5 h-5 sm:w-6 sm:h-6 text-primary/40 mb-2 sm:mb-3" />
                      
                      {/* Calificación de 5 estrellas */}
                      <div className="flex mb-2 sm:mb-3 gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star 
                            key={i} 
                            className="text-yellow-400 fill-yellow-400 w-3.5 h-3.5 sm:w-4 sm:h-4" 
                          />
                        ))}
                      </div>

                      <p className="text-sm sm:text-base text-foreground mb-3 sm:mb-4 italic leading-relaxed">
                        "{opinion.comment}"
                      </p>
                    </div>

                    {/* Información del usuario */}
                    <div className="flex items-center gap-2 sm:gap-3 pt-3 sm:pt-4 border-t border-white/10 dark:border-white/5 mt-auto">
                      <Avatar className="w-9 h-9 sm:w-10 sm:h-10 ring-2 ring-primary/10">
                        <AvatarImage src={opinion.avatar} alt={opinion.name} />
                        <AvatarFallback className="bg-gradient-to-br from-primary/20 to-blue-500/20 text-foreground text-xs font-semibold">
                          {opinion.name.split(' ').map((n) => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm sm:text-base font-semibold text-foreground">{opinion.name}</p>
                        <p className="text-xs sm:text-sm text-muted-foreground">{opinion.role}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="hidden sm:flex" />
          <CarouselNext className="hidden sm:flex" />
        </Carousel>
      </div>
    </AnimatedSection>
  );
};
