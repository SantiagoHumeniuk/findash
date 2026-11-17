// src/features/dashboard/components/onboarding/dashboard-guide.tsx

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, TrendingUp, BarChart3 } from 'lucide-react';
import { Button } from '../../../../components/ui/button';
import { Card, CardContent } from '../../../../components/ui/card';

interface DashboardGuideProps {
  isVisible: boolean;
  onDismiss: () => void;
}

/**
 * Guía paso a paso para enseñar a los usuarios cómo usar el dashboard.
 * Se muestra como overlay con pasos para agregar activos y navegar tabs.
 */
export function DashboardGuide({ isVisible, onDismiss }: DashboardGuideProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      icon: Search,
      title: "1. Buscá un activo",
      description: "Escribí un símbolo o nombre en el buscador y elegí el resultado correcto.",
      examples: ["AAPL", "YPF", "SPY"],
    },
    {
      icon: TrendingUp,
      title: "2. Entendé su evolución",
      description: "Empezá por el precio y el gráfico histórico; agregá otros activos para compararlos.",
      examples: ["Precio", "Rendimiento", "Historial"],
    },
    {
      icon: BarChart3,
      title: "3. Profundizá cuando quieras",
      description: "Consultá ratios, correlaciones y noticias desde las secciones del análisis.",
      examples: ["Ratios", "Correlación", "Noticias"],
    },
  ];

  const dismiss = () => {
    setCurrentStep(0);
    onDismiss();
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      dismiss();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:items-center"
        onClick={dismiss}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto"
        >
          <Card>
            <CardContent className="p-4 sm:p-6">
              {/* Header */}
              <div className="mb-4 flex items-center justify-between gap-3 sm:mb-6">
                <div>
                  <h2 className="text-lg font-bold sm:text-xl">Guía rápida</h2>
                  <p className="text-sm text-muted-foreground">
                    Empezá simple y explorá más cuando lo necesites.
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={dismiss} aria-label="Cerrar guía">
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Step Content */}
              <div className="space-y-4 text-center sm:space-y-6">
                {/* Icon */}
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 sm:h-20 sm:w-20">
                  {steps[currentStep] && (() => {
                    const IconComponent = steps[currentStep].icon;
                    return <IconComponent className="h-7 w-7 text-primary sm:h-10 sm:w-10" />;
                  })()}
                </div>

                {/* Title and Description */}
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-foreground sm:text-xl">
                    {steps[currentStep]?.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                    {steps[currentStep]?.description}
                  </p>
                </div>

                {/* Visual Examples */}
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground sm:text-sm">Ejemplos</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {steps[currentStep]?.examples.map((example, index) => (
                      <span
                        key={index}
                        className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground sm:text-sm"
                      >
                        {example}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Visual Mockup */}
                <div className="rounded-lg border border-dashed bg-muted/30 p-3 sm:p-4">
                  <VisualMockup step={currentStep} />
                </div>

                {/* Progress */}
                <div className="flex justify-center gap-2 pt-1">
                  {steps.map((_, index) => (
                    <div
                      key={index}
                      className={`h-2.5 w-2.5 rounded-full transition-colors ${
                        index === currentStep 
                          ? 'bg-primary' 
                          : index < currentStep 
                            ? 'bg-primary/50' 
                            : 'bg-muted'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Controls */}
              <div className="mt-5 flex items-center justify-between gap-2 sm:mt-8">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={prevStep}
                  disabled={currentStep === 0}
                  className="h-10"
                >
                  Anterior
                </Button>
                <div className="shrink-0 text-xs text-muted-foreground sm:text-sm">
                  {currentStep + 1} de {steps.length}
                </div>
                <Button onClick={nextStep} size="sm" className="h-10">
                  {currentStep === steps.length - 1 ? 'Listo' : 'Siguiente'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Visual mockups for each step
function VisualMockup({ step }: { step: number }) {
  switch (step) {
    case 0:
      return (
        <div className="flex w-full items-center">
          <Button
            variant="outline"
            className="h-11 w-full justify-between text-muted-foreground"
            disabled
          >
            <span className="truncate text-sm">Buscar símbolo o nombre</span>
            <Search className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </div>
      );
    
    case 1:
      return (
        <div className="space-y-2 rounded-lg border bg-background p-3 text-left">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">Precio de ejemplo</span>
            <span className="text-sm font-semibold">USD 182,40</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-2/3 rounded-full bg-primary" />
          </div>
          <p className="text-xs text-muted-foreground">Usá el gráfico para revisar su evolución.</p>
        </div>
      );
    
    case 2:
      return (
        <div className="space-y-2 rounded-lg border bg-background p-3 text-left">
          <div className="flex items-center gap-2 text-sm font-medium">
            <BarChart3 className="h-4 w-4 text-primary" />
            Análisis disponibles
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">Fundamentales · Correlación · Noticias</p>
        </div>
      );
    
    default:
      return null;
  }
}