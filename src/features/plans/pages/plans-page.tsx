// src/features/plans/pages/plans-page.tsx

import { motion } from 'framer-motion';
import { Check, Crown, Zap, Rocket, Shield } from 'lucide-react';
import { useConfig } from '../../../hooks/use-config';
import { useAuth } from '../../../hooks/use-auth';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { cn } from '../../../lib/utils';

/**
 * Página de planes y precios.
 * Muestra una comparación detallada de los diferentes planes disponibles
 * y sus características.
 * 
 * @example
 * ```tsx
 * <Route path="/plans" element={<PlansPage />} />
 * ```
 */
export default function PlansPage() {
  const config = useConfig();
  const { user, profile } = useAuth();

  const plans = [
    {
      name: 'Básico',
      role: 'basico',
      icon: Zap,
      description: 'Perfecto para comenzar tu análisis financiero',
      price: 'Gratis',
      priceDetail: 'Para siempre',
      features: [
        `Acceso a ~${config.plans.freeTierSymbols.length} símbolos populares`,
        `${config.plans.roleLimits.basico} llamadas API diarias`,
        `Dashboard comparativo (hasta ${config.dashboard.maxTickersToCompare.basico} activos)`,
        `${config.plans.portfolioLimits.basico} portfolio de inversiones`,
        'Análisis fundamental completo',
        'Matriz de correlación',
        'Gráfico radar comparativo',
        'Calendario de dividendos',
        'Noticias financieras',
        'Acceso al blog comunitario',
      ],
      highlighted: false,
      ctaText: 'Plan Actual',
      color: 'from-blue-500 to-cyan-500',
    },
    {
      name: 'Plus',
      role: 'plus',
      icon: Crown,
      description: 'Para inversores serios que necesitan más análisis',
      price: '$15.000',
      priceDetail: 'por mes',
      features: [
        `Acceso a todos los símbolos (+8,000)`,
        `${config.plans.roleLimits.plus} llamadas API diarias`,
        `Dashboard comparativo (hasta ${config.dashboard.maxTickersToCompare.plus} activos)`,
        `${config.plans.portfolioLimits.plus} portfolios de inversión`,
        'Todas las funciones del plan Básico',
        'Análisis de segmentación geográfica',
        'Análisis de segmentación de productos',
        'Stock grades (calificaciones)',
        'Exportar portafolio a PDF',
        'Calculadora de retiro avanzada',
        'Soporte prioritario',
      ],
      highlighted: true,
      ctaText: 'Actualizar a Plus',
      color: 'from-purple-500 to-pink-500',
    },
    {
      name: 'Premium',
      role: 'premium',
      icon: Rocket,
      description: 'Para profesionales que demandan lo mejor',
      price: '$25.000',
      priceDetail: 'por mes',
      features: [
        `Acceso a todos los símbolos (+8,000)`,
        `${config.plans.roleLimits.premium} llamadas API diarias`,
        `Dashboard comparativo (hasta ${config.dashboard.maxTickersToCompare.premium} activos)`,
        `${config.plans.portfolioLimits.premium} portfolios de inversión`,
        'Todas las funciones del plan Plus',
        'Publicar artículos en el blog',
        'Participación activa en la comunidad',
        'Acceso API para automatización',
        'Alertas personalizadas en tiempo real',
        'Análisis predictivo con IA',
        'Reportes personalizados',
        'Soporte 24/7',
        'Acceso anticipado a nuevas funciones',
      ],
      highlighted: false,
      ctaText: 'Actualizar a Premium',
      color: 'from-orange-500 to-red-500',
    },
  ];

  const currentRole = profile?.role ?? 'basico';

  return (
    <div className="container-wide space-y-4 sm:space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-6 sm:space-y-8"
      >
        {/* Header */}
        <div className="text-center space-y-2 sm:space-y-4 px-4">
          <Badge variant="outline" className="mb-2 sm:mb-4 text-xs sm:text-sm">
            Planes y Precios
          </Badge>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">
            Elige el plan perfecto para ti
          </h1>
          <p className="text-sm sm:text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
            Comienza gratis y actualiza cuando necesites más poder de análisis.
            Todos los planes incluyen acceso a funciones esenciales. Para actualizar tu plan, <a href="/contact" className="text-primary hover:underline font-semibold">contáctanos</a>.
          </p>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 mt-8 pt-4 sm:mt-12">
          {plans.map((plan, index) => {
            const Icon = plan.icon;
            const isCurrentPlan = currentRole === plan.role;

            return (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card
                  className={cn(
                    'relative h-full flex flex-col',
                    plan.highlighted &&
                    'border-primary shadow-lg scale-105 md:scale-110'
                  )}
                >
                  {plan.highlighted && (
                    <div className="absolute -top-3 sm:-top-4 left-1/2 -translate-x-1/2">
                      <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-none text-xs sm:text-sm">
                        Más Popular
                      </Badge>
                    </div>
                  )}

                  <CardHeader className="text-center pb-6 sm:pb-8">
                    <div
                      className={cn(
                        'w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 rounded-full bg-gradient-to-br flex items-center justify-center',
                        plan.color
                      )}
                    >
                      <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                    </div>
                    <CardTitle className="text-xl sm:text-2xl">{plan.name}</CardTitle>
                    <CardDescription className="mt-1.5 sm:mt-2 text-xs sm:text-sm">
                      {plan.description}
                    </CardDescription>
                    <div className="mt-3 sm:mt-4">
                      <div className="text-3xl sm:text-4xl font-bold">{plan.price}</div>
                      <div className="text-xs sm:text-sm text-muted-foreground">
                        {plan.priceDetail}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="flex-1">
                    <ul className="space-y-2 sm:space-y-3">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Check className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0 mt-0.5" />
                          <span className="text-xs sm:text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>

                  <CardFooter>
                    <Button
                      className="w-full text-xs sm:text-sm"
                      size="sm"
                      variant={plan.highlighted ? 'default' : 'outline'}
                      disabled={isCurrentPlan}
                      asChild={!isCurrentPlan}
                    >
                      {isCurrentPlan ? (
                        'Plan Actual'
                      ) : (
                        <a href="/contact">Contactar para {plan.name}</a>
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Comparison Table */}
        <div className="mt-12 sm:mt-16">
          <h2 className="text-xl sm:text-2xl font-bold text-center mb-6 sm:mb-8 px-4">
            Comparación Detallada
          </h2>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 sm:p-4 font-semibold whitespace-nowrap">
                        Característica
                      </th>
                      <th className="text-center p-2 sm:p-4 font-semibold whitespace-nowrap">Básico</th>
                      <th className="text-center p-2 sm:p-4 font-semibold bg-primary/5 whitespace-nowrap">
                        Plus
                      </th>
                      <th className="text-center p-2 sm:p-4 font-semibold whitespace-nowrap">Premium</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="p-2 sm:p-4">Símbolos disponibles</td>
                      <td className="text-center p-2 sm:p-4 whitespace-nowrap">
                        ~{config.plans.freeTierSymbols.length} pop.
                      </td>
                      <td className="text-center p-2 sm:p-4 bg-primary/5 whitespace-nowrap">
                        Todos (+8K)
                      </td>
                      <td className="text-center p-2 sm:p-4 whitespace-nowrap">
                        Todos (+8K)
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2 sm:p-4">Dashboard comparativo</td>
                      <td className="text-center p-2 sm:p-4 whitespace-nowrap">
                        {config.dashboard.maxTickersToCompare.basico} activos
                      </td>
                      <td className="text-center p-2 sm:p-4 bg-primary/5 whitespace-nowrap">
                        {config.dashboard.maxTickersToCompare.plus} activos
                      </td>
                      <td className="text-center p-2 sm:p-4 whitespace-nowrap">
                        {config.dashboard.maxTickersToCompare.premium} activos
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2 sm:p-4">Llamadas API diarias</td>
                      <td className="text-center p-2 sm:p-4 whitespace-nowrap">
                        {config.plans.roleLimits.basico}
                      </td>
                      <td className="text-center p-2 sm:p-4 bg-primary/5 whitespace-nowrap">
                        {config.plans.roleLimits.plus}
                      </td>
                      <td className="text-center p-2 sm:p-4 whitespace-nowrap">
                        {config.plans.roleLimits.premium}
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2 sm:p-4">Portfolio de inversiones</td>
                      <td className="text-center p-2 sm:p-4 whitespace-nowrap">
                        <Check className="h-5 w-5 text-primary mx-auto" />
                      </td>
                      <td className="text-center p-2 sm:p-4 bg-primary/5">
                        <Check className="h-4 w-4 sm:h-5 sm:w-5 text-primary mx-auto" />
                      </td>
                      <td className="text-center p-2 sm:p-4">
                        <Check className="h-4 w-4 sm:h-5 sm:w-5 text-primary mx-auto" />
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2 sm:p-4">Análisis fundamental</td>
                      <td className="text-center p-2 sm:p-4">
                        <Check className="h-4 w-4 sm:h-5 sm:w-5 text-primary mx-auto" />
                      </td>
                      <td className="text-center p-2 sm:p-4 bg-primary/5">
                        <Check className="h-4 w-4 sm:h-5 sm:w-5 text-primary mx-auto" />
                      </td>
                      <td className="text-center p-2 sm:p-4">
                        <Check className="h-4 w-4 sm:h-5 sm:w-5 text-primary mx-auto" />
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2 sm:p-4">Stock grades</td>
                      <td className="text-center p-2 sm:p-4">-</td>
                      <td className="text-center p-2 sm:p-4 bg-primary/5">
                        <Check className="h-4 w-4 sm:h-5 sm:w-5 text-primary mx-auto" />
                      </td>
                      <td className="text-center p-2 sm:p-4">
                        <Check className="h-4 w-4 sm:h-5 sm:w-5 text-primary mx-auto" />
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2 sm:p-4">Exportar a PDF</td>
                      <td className="text-center p-2 sm:p-4">-</td>
                      <td className="text-center p-2 sm:p-4 bg-primary/5">
                        <Check className="h-4 w-4 sm:h-5 sm:w-5 text-primary mx-auto" />
                      </td>
                      <td className="text-center p-2 sm:p-4">
                        <Check className="h-4 w-4 sm:h-5 sm:w-5 text-primary mx-auto" />
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2 sm:p-4">API automatización</td>
                      <td className="text-center p-2 sm:p-4">-</td>
                      <td className="text-center p-2 sm:p-4 bg-primary/5">-</td>
                      <td className="text-center p-2 sm:p-4">
                        <Check className="h-4 w-4 sm:h-5 sm:w-5 text-primary mx-auto" />
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2 sm:p-4">Publicar en el blog</td>
                      <td className="text-center p-2 sm:p-4">-</td>
                      <td className="text-center p-2 sm:p-4 bg-primary/5">-</td>
                      <td className="text-center p-2 sm:p-4">
                        <Check className="h-4 w-4 sm:h-5 sm:w-5 text-primary mx-auto" />
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2 sm:p-4">Soporte</td>
                      <td className="text-center p-2 sm:p-4 whitespace-nowrap">Email</td>
                      <td className="text-center p-2 sm:p-4 bg-primary/5 whitespace-nowrap">
                        Prioritario
                      </td>
                      <td className="text-center p-2 sm:p-4 whitespace-nowrap">24/7</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Popular Symbols Section */}
        <div className="mt-12 sm:mt-16">
          <h2 className="text-xl sm:text-2xl font-bold text-center mb-3 sm:mb-4 px-4">
            Símbolos Populares Incluidos en el Plan Básico
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground text-center mb-6 sm:mb-8 px-4 max-w-3xl mx-auto">
            Accede a {config.plans.freeTierSymbols.length} de los símbolos más negociados y populares del mercado, incluyendo acciones de tecnología, finanzas, consumo y más.
          </p>
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-wrap gap-2 justify-center">
                {config.plans.freeTierSymbols.map((symbol) => (
                  <Badge
                    key={symbol}
                    variant="secondary"
                    className="text-xs sm:text-sm px-2 sm:px-3 py-1 font-mono"
                  >
                    {symbol}
                  </Badge>
                ))}
              </div>
              <div className="mt-6 text-center">
                <p className="text-xs sm:text-sm text-muted-foreground">
                  ¿Necesitas acceso a más de 8,000 símbolos?{' '}
                  <a href="/contact" className="text-primary hover:underline font-semibold">
                    Actualiza a Plus o Premium
                  </a>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* FAQ Section */}
        <div className="mt-12 sm:mt-16">
          <h2 className="text-xl sm:text-2xl font-bold text-center mb-6 sm:mb-8 px-4">
            Preguntas Frecuentes
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 max-w-4xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  ¿Cómo puedo actualizar mi plan?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Para actualizar o cambiar tu plan, <a href="/contact" className="text-primary hover:underline">contáctanos</a> y te ayudaremos con el proceso. Los cambios se aplicarán rápidamente.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  ¿Qué métodos de pago aceptan?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Aceptamos tarjetas de crédito, débito y transferencias
                  bancarias. Contáctanos para coordinar el método de pago que prefieras.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  ¿Hay período de prueba gratuito?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  El plan Básico es completamente gratuito para siempre. Puedes
                  probar todas las funciones esenciales sin límite de tiempo.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  ¿Necesito ayuda para elegir?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Nuestro equipo está aquí para ayudarte.{' '}
                  <a href="/contact" className="text-primary hover:underline">
                    Contáctanos
                  </a>{' '}
                  y te asesoraremos.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* CTA Section */}
        {!user && (
          <Card className="mt-16 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="p-8 text-center">
              <Shield className="h-12 w-12 mx-auto mb-4 text-primary" />
              <h3 className="text-2xl font-bold mb-2">
                ¿Listo para comenzar?
              </h3>
              <p className="text-muted-foreground mb-6">
                Crea tu cuenta gratis y accede al plan Básico de inmediato.
              </p>
              <Button size="lg" asChild>
                <a href="/register">Crear Cuenta Gratis</a>
              </Button>
            </CardContent>
          </Card>
        )}
      </motion.div>
    </div>
  );
}
