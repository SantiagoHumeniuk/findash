// src/features/dashboard/components/onboarding/dashboard-guide.tsx

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, MousePointer2, TrendingUp, BarChart3, DollarSign, NewspaperIcon } from 'lucide-react';
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
      title: "1. Busca tu activo",
      description: "Usa el buscador para encontrar cualquier empresa o activo financiero",
      examples: ["YPF", "Apple", "Microsoft", "Bitcoin"],
      visual: "dashboard-search",
    },
    {
      icon: MousePointer2,
      title: "2. Selecciona del menú",
      description: "Aparecerán sugerencias, haz clic en el activo que te interesa",
      examples: ["YPF S.A.", "Apple Inc.", "Microsoft Corp"],
      visual: "search-results",
    },
    {
      icon: TrendingUp,
      title: "3. Explora los análisis",
      description: "El activo se agregará y verás todos los datos y gráficos disponibles",
      examples: ["Precios", "Fundamentales", "Comparación"],
      visual: "dashboard-tabs",
    },
    {
      icon: MousePointer2,
      title: "4. Navega entre pestañas",
      description: "Cada pestaña tiene análisis diferentes del activo",
      examples: ["Gráfico histórico", "Métricas financieras", "Correlaciones"],
      visual: "tabs-navigation",
    },
    {
      icon: NewspaperIcon,
      title: "5. Ve detalles específicos",
      description: "Haz clic en cualquier activo para ver su página completa con noticias",
      examples: ["Noticias", "Reportes", "Análisis detallado"],
      visual: "asset-detail",
    },
  ];

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onDismiss();
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
        className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
        onClick={onDismiss}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg"
        >
          <Card>
            <CardContent className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold">Guía del Dashboard</h2>
                  <p className="text-sm text-muted-foreground">
                    Aprende a usar el análisis de activos
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={onDismiss}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Step Content */}
              <div className="text-center space-y-6">
                {/* Icon */}
                <div className="p-6 bg-primary/10 rounded-full w-20 h-20 flex items-center justify-center mx-auto">
                  {steps[currentStep] && (() => {
                    const IconComponent = steps[currentStep].icon;
                    return <IconComponent className="w-10 h-10 text-primary" />;
                  })()}
                </div>

                {/* Title and Description */}
                <div className="space-y-3">
                  <h3 className="text-xl font-bold text-foreground">
                    {steps[currentStep]?.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {steps[currentStep]?.description}
                  </p>
                </div>

                {/* Visual Examples */}
                <div className="space-y-3">
                  <p className="text-sm font-medium text-muted-foreground">Ejemplos:</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {steps[currentStep]?.examples.map((example, index) => (
                      <span
                        key={index}
                        className="px-3 py-1.5 bg-muted text-muted-foreground text-sm rounded-full font-medium"
                      >
                        {example}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Visual Mockup */}
                <div className="bg-muted/30 rounded-lg p-4 border-2 border-dashed">
                  <VisualMockup step={currentStep} />
                </div>

                {/* Progress */}
                <div className="flex justify-center gap-2 pt-2">
                  {steps.map((_, index) => (
                    <div
                      key={index}
                      className={`w-3 h-3 rounded-full transition-colors ${
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
              <div className="flex justify-between mt-8">
                <Button
                  variant="outline"
                  onClick={prevStep}
                  disabled={currentStep === 0}
                  className="w-24"
                >
                  Anterior
                </Button>
                <div className="text-sm text-muted-foreground flex items-center">
                  {currentStep + 1} de {steps.length}
                </div>
                <Button onClick={nextStep} className="w-24">
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
    case 0: // Dashboard search - Replica del button real
      return (
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            className="w-[200px] justify-between text-muted-foreground border-2"
            disabled
          >
            <span className="truncate text-sm">Buscar activo (ej. AAPL)...</span>
            <Search className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </div>
      );
    
    case 1: // Search results - Replica del Command Menu
      return (
        <div className="space-y-0 border rounded-md bg-background">
          <div className="p-2 border-b bg-background">
            <div className="text-xs text-muted-foreground px-2 py-1">Escribe ticker o nombre...</div>
          </div>
          <div className="max-h-24 overflow-hidden">
            <div className="flex items-center gap-3 p-3 hover:bg-accent cursor-pointer border-l-2 border-l-primary bg-accent/50">
              <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-xs text-white font-bold">Y</span>
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm">YPF S.A.</div>
                <div className="text-xs text-muted-foreground">NYSE: YPF</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 hover:bg-accent cursor-pointer">
              <div className="w-6 h-6 bg-gray-800 rounded-full flex items-center justify-center">
                <span className="text-xs text-white font-bold">A</span>
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm">Apple Inc.</div>
                <div className="text-xs text-muted-foreground">NASDAQ: AAPL</div>
              </div>
            </div>
          </div>
        </div>
      );
    
    case 2: // Dashboard tabs - Replica de los selected tickers
      return (
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground font-medium">Activos agregados:</div>
          <div className="flex flex-wrap gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-full">
              <span className="text-sm font-medium">YPF</span>
              <X className="w-3 h-3 opacity-70" />
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-full">
              <span className="text-sm font-medium">AAPL</span>
              <X className="w-3 h-3 opacity-70" />
            </div>
          </div>
        </div>
      );
    
    case 3: // Tabs navigation - Replica de las pestañas reales
      return (
        <div className="bg-muted p-1 rounded-lg">
          <div className="grid grid-cols-3 gap-1">
            <div className="flex items-center justify-center gap-1 px-3 py-2 bg-background text-foreground rounded-md shadow-sm">
              <BarChart3 className="w-4 h-4" />
              <span className="text-xs font-medium">Precios</span>
            </div>
            <div className="flex items-center justify-center gap-1 px-3 py-2 text-muted-foreground hover:bg-background/50 rounded-md">
              <DollarSign className="w-4 h-4" />
              <span className="text-xs">Fund.</span>
            </div>
            <div className="flex items-center justify-center gap-1 px-3 py-2 text-muted-foreground hover:bg-background/50 rounded-md">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs">Gráf.</span>
            </div>
          </div>
        </div>
      );
    
    case 4: // Asset detail - Replica de como se vería un activo clickeable
      return (
        <div className="border rounded-lg p-3 hover:bg-accent/50 cursor-pointer">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-sm text-white font-bold">Y</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold">YPF</span>
                <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">+2.45%</span>
              </div>
              <div className="text-sm text-muted-foreground">YPF Sociedad Anónima</div>
            </div>
          </div>
          <div className="mt-2 text-xs text-muted-foreground bg-blue-50 p-2 rounded border-l-2 border-l-blue-500">
            💡 Haz clic para ver noticias, análisis detallado y más
          </div>
        </div>
      );
    
    default:
      return null;
  }
}