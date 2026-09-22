// src/features/info/pages/info-page.tsx

import React from 'react';
import { useAuth } from '../../../hooks/use-auth';
import { useConfig } from '../../../hooks/use-config';
import { isInfoPageConfig } from '../lib/type-guards';
import { HeroSection } from '../components/hero-section';
import { FeaturesSection } from '../components/features-section';
import { FinalCtaSection } from '../components/final-cta-section';

/**
 * Página de información/landing de la aplicación.
 * Orquesta cuatro secciones principales: Hero, Features, Testimonials y Final CTA.
 * 
 * El contenido de cada sección se carga dinámicamente desde `config.json`,
 * lo que permite actualizar textos, características y testimonios sin modificar código.
 * 
 * @remarks
 * - Utiliza type guards para validar la configuración antes de renderizar
 * - Muestra diferentes CTAs dependiendo del estado de autenticación del usuario
 * - Todas las secciones son modulares y reutilizables
 */
const InfoPage: React.FC = () => {
  const { user } = useAuth();
  const config = useConfig();

  // Validación defensiva de la configuración
  if (!config || typeof config !== 'object' || config === null || !('infoPage' in config)) {
    return <div className="p-4">Cargando...</div>;
  }

  const infoPageRaw = (config as unknown as Record<string, unknown>).infoPage;
  if (!isInfoPageConfig(infoPageRaw)) {
    return <div className="p-4">Cargando...</div>;
  }

  const infoPage = infoPageRaw;
  const isLoggedIn = !!user;

  return (
    <div className="flex flex-col gap-12 pt-6">
      {/* Sección Hero con título principal y CTA */}
      <HeroSection
        title={infoPage.hero.title}
        subtitle={infoPage.hero.subtitle}
        ctaText={isLoggedIn ? infoPage.hero.cta.loggedIn : infoPage.hero.cta.loggedOut}
        ctaLink={isLoggedIn ? "/dashboard" : "/register"}
      />

      {/* Sección de Características */}
      <FeaturesSection
        title={infoPage.features.title}
        subtitle={infoPage.features.subtitle}
        features={infoPage.features.items}
      />

      {/* CTA Final para conversión */}
      <FinalCtaSection
        title={infoPage.finalCta.title}
        subtitle={infoPage.finalCta.subtitle}
        ctaText={isLoggedIn ? infoPage.finalCta.cta.loggedIn : infoPage.finalCta.cta.loggedOut}
        ctaLink={isLoggedIn ? "/dashboard" : "/register"}
      />
    </div>
  );
};

export default InfoPage;