// src/features/insights/pages/insights-page.tsx
import React from 'react';
import { useInsightsData } from '../hooks/use-insights-data';
import { useConfig } from '../../../hooks/use-config';
import { useAuth } from '../../../hooks/use-auth';
import { InsightsSection } from '../components/insights-section';
import { SortSelect, LimitSelect } from '../components/filters';
import { SuspenseFallback } from '../../../components/suspense';
import { FeatureLocked } from '../../../components/shared/feature-locked';
import { usePlanFeature } from '../../../hooks/use-plan-feature';
import { PageHeader } from '../../../components/ui/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';

import { motion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight, Filter, TrendingDown, TrendingUp } from 'lucide-react';
import type { InsightItem } from '../types/insights.types';
import { ScreenerTab } from '../components/screener-tab';

const analystSortOptions = [
  { label: 'Más Recomendadas para Compra', value: 'buy' },
  { label: 'Más Recomendadas para Venta', value: 'sell' },
];


/**
 * Página de Insights de Mercado (ORQUESTADOR)
 * - Analiza oportunidades de inversión basadas en datos recientes
 * - Muestra valoraciones (infravaloradas/sobrevaloradas) y recomendaciones de analistas
 * - Respeta límites por plan y permisos de Stock Grades
 */

const InsightsPage: React.FC = () => {
  // Valuation tab state
  const [valuationLimit, setValuationLimit] = React.useState<number>(5);

  // Analysts tab state
  const [analystLimit, setAnalystLimit] = React.useState<number>(5);
  const [analystSortBy, setAnalystSortBy] = React.useState<'buy' | 'sell'>('buy');

  const config = useConfig();
  const { profile } = useAuth();
  const role = profile?.role ?? 'basico';
  const { hasAccess: hasStockGrades, upgradeMessage, requiredPlan } = usePlanFeature('stockGrades');
  const max = config.insights?.maxItems?.[role] ?? 5;

  // Limit options per role
  const limitOptions = React.useMemo(() => (role === 'basico' ? [max] : [5, 10, 20, 50]), [role, max]);

  // A single cache-backed query powers both valuation and analyst views.
  const { data: valuationData, isLoading: isValuationLoading, error: valuationError } = useInsightsData();
  const analystsData = valuationData;
  const isAnalystsLoading = isValuationLoading;
  const analystsError = valuationError;

  // Sync limits with role changes
  React.useEffect(() => {
    if (!limitOptions.includes(valuationLimit)) setValuationLimit(limitOptions[0]);
    if (!limitOptions.includes(analystLimit)) setAnalystLimit(limitOptions[0]);
  }, [limitOptions, valuationLimit, analystLimit]);


  // Valuation tab data
  const undervalued = valuationData?.undervalued.slice(0, valuationLimit) ?? [];
  const overvalued = valuationData?.overvalued.slice(0, valuationLimit) ?? [];
  const averageUpside = undervalued.length
    ? undervalued.reduce((sum, item) => sum + (item.mispricingPct ?? 0), 0) / undervalued.length
    : null;
  const averageOverpricing = overvalued.length
    ? overvalued.reduce((sum, item) => sum + Math.abs(item.mispricingPct ?? 0), 0) / overvalued.length
    : null;

  // Analysts tab data
  const analystItems = React.useMemo(() => {
    if (!analystsData) return [];
    const allItems: InsightItem[] = [...analystsData.analystBuys, ...analystsData.analystSells];
    // Eliminar duplicados por símbolo
    const uniqueMap = new Map<string, InsightItem>();
    allItems.forEach(item => {
      if (!uniqueMap.has(item.symbol)) {
        uniqueMap.set(item.symbol, item);
      }
    });
    const unique = Array.from(uniqueMap.values());
    // Ordenar según criterio
    return unique
      .sort((a, b) => {
        if (analystSortBy === 'buy') {
          return (b.buyCount ?? 0) - (a.buyCount ?? 0);
        } else {
          return (b.sellCount ?? 0) - (a.sellCount ?? 0);
        }
      })
      .slice(0, analystLimit);
  }, [analystsData, analystSortBy, analystLimit]);

  // Only show loading/error in the active tab

  // Opciones de límite solo si el plan no es básico (declaradas arriba)

  return (
    <div className="container-wide stack-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <PageHeader
          icon={<TrendingUp className="h-6 w-6 text-primary" />}
          title="Insights de Mercado"
          description="Descubre oportunidades de inversión analizando activos infravalorados, recomendaciones de analistas profesionales y tendencias del mercado. Información actualizada en tiempo real."
        />
      </motion.div>

      <Tabs defaultValue="analysts" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-card shadow-sm border rounded-xl p-1 h-auto">
          <TabsTrigger value="analysts" className="gap-2 py-3 rounded-lg data-[state=active]:shadow-premium transition-all">
            <TrendingDown className="h-4 w-4" />
            <span className="hidden sm:inline">Recomendaciones de Analistas</span>
            <span className="sm:hidden">Analistas</span>
          </TabsTrigger>
          <TabsTrigger value="valuation" className="gap-2 py-3 rounded-lg data-[state=active]:shadow-premium transition-all">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Valoración</span>
            <span className="sm:hidden">Valor</span>
          </TabsTrigger>
          <TabsTrigger value="screener" className="gap-2 py-3 rounded-lg data-[state=active]:shadow-premium transition-all">
            <Filter className="h-4 w-4" />
            <span>Screening</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="valuation" className="space-y-6 mt-6">
          {isValuationLoading ? (
            <SuspenseFallback type="page" message="Cargando insights de valoración..." />
          ) : valuationError ? (
            <div className="p-6 text-red-600">Error al cargar insights de valoración</div>
          ) : (
            <>
              <div className="flex flex-wrap items-end justify-between gap-4 border-b pb-4">
                <div>
                  <h2 className="text-lg font-semibold">Señales de valoración</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Ordenadas por diferencia frente al valor justo ponderado.</p>
                </div>
                <LimitSelect
                  value={valuationLimit}
                  options={limitOptions}
                  onChange={setValuationLimit}
                  className="w-[140px]"
                />
              </div>
              <div className="grid grid-cols-1 divide-y rounded-md border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Infravalorados mostrados</p>
                    <p className="mt-1 text-xs text-muted-foreground">Upside medio</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-semibold tabular-nums">{undervalued.length}</p>
                    <p className="flex items-center justify-end gap-1 text-sm font-semibold text-green-600 dark:text-green-400">
                      <ArrowUpRight className="h-4 w-4" />
                      {averageUpside === null ? 'N/D' : `+${averageUpside.toFixed(1)}%`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Sobrevalorados mostrados</p>
                    <p className="mt-1 text-xs text-muted-foreground">Sobreprecio medio</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-semibold tabular-nums">{overvalued.length}</p>
                    <p className="flex items-center justify-end gap-1 text-sm font-semibold text-red-600 dark:text-red-400">
                      <ArrowDownRight className="h-4 w-4" />
                      {averageOverpricing === null ? 'N/D' : `${averageOverpricing.toFixed(1)}%`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Activos en ranking</p>
                    <p className="mt-1 text-xs text-muted-foreground">Sin duplicados</p>
                  </div>
                  <p className="text-2xl font-semibold tabular-nums">{undervalued.length + overvalued.length}</p>
                </div>
              </div>
              <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5 }}
            >
              <InsightsSection
                title="Activos Infravalorados"
                subtitle="Ordenados por mayor descuento relativo entre su valor intrínseco y precio de mercado"
                items={undervalued}
                kind="undervalued"
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <InsightsSection
                title="Activos Sobrevalorados"
                subtitle="Ordenados por mayor sobreprecio relativo entre su valor intrínseco y precio de mercado"
                items={overvalued}
                kind="overvalued"
              />
            </motion.div>
            </>
          )}
        </TabsContent>

        <TabsContent value="analysts" className="space-y-4 mt-6">
          {isAnalystsLoading ? (
            <SuspenseFallback type="page" message="Cargando recomendaciones de analistas..." />
          ) : analystsError ? (
            <div className="p-6 text-red-600">Error al cargar recomendaciones de analistas</div>
          ) : hasStockGrades ? (
            <motion.div 
              className="space-y-4"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h3 className="text-lg font-semibold heading-premium">Recomendaciones de Analistas</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Basado en consenso de analistas profesionales
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap justify-end">
                  <SortSelect
                    value={analystSortBy}
                    onChange={v => setAnalystSortBy(v as 'buy' | 'sell')}
                    options={analystSortOptions}
                    className="w-[220px]"
                  />
                  <LimitSelect
                    value={analystLimit}
                    options={limitOptions}
                    onChange={setAnalystLimit}
                    className="w-[140px]"
                  />
                </div>
              </div>
              <InsightsSection
                title=""
                items={analystItems}
                kind={analystSortBy === 'buy' ? 'analystBuy' : 'analystSell'}
              />
            </motion.div>
          ) : (
            <FeatureLocked featureName="Stock Grades" description={upgradeMessage} requiredPlan={requiredPlan} />
          )}
        </TabsContent>

        <TabsContent value="screener" className="space-y-4 mt-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5 }}
          >
            <ScreenerTab />
          </motion.div>
        </TabsContent>

      </Tabs>
    </div>
  );
}; export default InsightsPage;
