// src/features/sectors-industries/pages/sectors-industries-page.tsx

import React from 'react';
import { Factory, FactoryIcon, TrendingUp } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { Card, CardContent, CardHeader } from '../../../components/ui/card';
import { Skeleton } from '../../../components/ui/skeleton';
import {
  Selector,
  StatsCard,
  PerformanceChart,
  PerformanceTable,
  YahooFinanceTest
} from '../components';
import {
  useIndustries,
  useSectors,
  useIndustryPerformance,
  useSectorPerformance
} from '../hooks';
import { calculateStats } from '../lib/format-utils';
import { toast } from 'sonner';

/**
 * Loading skeleton for performance data section.
 */
const PerformanceLoadingSkeleton: React.FC = () => (
  <div className="space-y-6 animate-in fade-in duration-300">
    {/* Stats Grid Skeleton */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className="border-primary/20">
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-20 mb-2" />
            <Skeleton className="h-3 w-28" />
          </CardContent>
        </Card>
      ))}
    </div>

    {/* Chart Skeleton */}
    <Card className="border-primary/20">
      <CardHeader>
        <Skeleton className="h-6 w-48 mb-2" />
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent>
        <div className="relative h-[300px] flex items-end gap-2 px-4">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 bg-primary/10 rounded-t animate-pulse"
              style={{
                height: `${Math.random() * 80 + 20}%`,
                animationDelay: `${i * 50}ms`
              }}
            />
          ))}
        </div>
      </CardContent>
    </Card>

    {/* Table Skeleton */}
    <Card className="border-primary/20">
      <CardHeader>
        <Skeleton className="h-6 w-40 mb-2" />
        <Skeleton className="h-4 w-56" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-10 flex-1" />
              <Skeleton className="h-10 w-20" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  </div>
);

/**
 * Sectors and Industries page displays performance data for market sectors and industries.
 * 
 * @remarks
 * This is an orchestrator component following the feature-sliced design pattern.
 * It composes the page layout with minimal business logic and delegates to child components.
 * 
 * Features:
 * - Tab-based interface for switching between Industries and Sectors
 * - Selector dropdowns for choosing specific industry/sector
 * - Statistics cards showing key performance metrics
 * - Line chart visualization of historical performance
 * - Table view of recent performance data
 */
export default function SectorsIndustriesPage() {
  const [activeTab, setActiveTab] = React.useState<'industries' | 'sectors' | 'yahoo'>('yahoo');
  const [selectedIndustry, setSelectedIndustry] = React.useState<string | null>(null);
  const [selectedSector, setSelectedSector] = React.useState<string | null>(null);

  // Fetch data
  const { data: industries, isLoading: industriesLoading, error: industriesError } = useIndustries();
  const { data: sectors, isLoading: sectorsLoading, error: sectorsError } = useSectors();

  const {
    data: industryPerformance,
    isLoading: industryPerfLoading
  } = useIndustryPerformance(selectedIndustry);

  const {
    data: sectorPerformance,
    isLoading: sectorPerfLoading
  } = useSectorPerformance(selectedSector);

  // Set default selections when data loads
  React.useEffect(() => {
    if (industries && industries.length > 0 && !selectedIndustry) {
      // Select "Technology" or first available
      const defaultIndustry = industries.find(i => i.industry === 'Software - Application')
        ?? industries.find(i => i.industry === 'Semiconductors')
        ?? industries[0];
      setSelectedIndustry(defaultIndustry.industry);
    }
  }, [industries, selectedIndustry]);

  React.useEffect(() => {
    if (sectors && sectors.length > 0 && !selectedSector) {
      // Select "Technology" or first available
      const defaultSector = sectors.find(s => s.sector === 'Technology') ?? sectors[0];
      setSelectedSector(defaultSector.sector);
    }
  }, [sectors, selectedSector]);

  // Show errors
  React.useEffect(() => {
    if (industriesError) {
      toast.error('Error al cargar las industrias');
    }
    if (sectorsError) {
      toast.error('Error al cargar los sectores');
    }
  }, [industriesError, sectorsError]);

  // Calculate statistics
  const industryStats = React.useMemo(() => {
    if (!industryPerformance) return null;
    return calculateStats(industryPerformance);
  }, [industryPerformance]);

  const sectorStats = React.useMemo(() => {
    if (!sectorPerformance) return null;
    return calculateStats(sectorPerformance);
  }, [sectorPerformance]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container-wide stack-8">
        {/* Header with gradient background */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-4 sm:pb-6 mb-4 sm:mb-6 border-b">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="p-1.5 sm:p-2 bg-primary/10 rounded-lg">
              <FactoryIcon className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Sectores e Industrias</h1>
              <p className="text-muted-foreground text-xs sm:text-sm">
                Analiza el performance histórico de sectores e industrias del mercado
              </p>
            </div>
          </div>
        </div>
        {/* Tabs with improved styling */}
        <Tabs value={activeTab} onValueChange={(v: string) => setActiveTab(v as 'industries' | 'sectors' | 'yahoo')} className="space-y-6">
          <TabsList className="grid w-full max-w-xl grid-cols-3 h-12 p-1 bg-muted/50">
            <TabsTrigger value="industries" className="text-base data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Industrias
            </TabsTrigger>
            <TabsTrigger value="sectors" className="text-base data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Sectores
            </TabsTrigger>
            <TabsTrigger value="yahoo" className="text-sm sm:text-base data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Yahoo Finance
            </TabsTrigger>
          </TabsList>

          {/* Industries Tab */}
          <TabsContent value="industries" className="space-y-6">
            {/* Industry Selector */}
            <Selector
              label="Seleccionar Industria"
              placeholder="Elige una industria..."
              options={industries?.map(i => i.industry) ?? []}
              value={selectedIndustry}
              onChange={setSelectedIndustry}
              isLoading={industriesLoading}
            />

            {/* Show content only if an industry is selected */}
            {selectedIndustry && (
              <>
                {industryPerfLoading ? (
                  <PerformanceLoadingSkeleton />
                ) : industryPerformance && industryStats ? (
                  <>
                    {/* Statistics Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <StatsCard
                        title="Último Cambio"
                        value={industryStats.latest}
                        subtitle={industryStats.latestDate}
                      />
                      <StatsCard
                        title="Promedio"
                        value={industryStats.average}
                        subtitle="Período completo"
                      />
                      <StatsCard
                        title="Máximo"
                        value={industryStats.max}
                        subtitle="Mejor día"
                      />
                      <StatsCard
                        title="Mínimo"
                        value={industryStats.min}
                        subtitle="Peor día"
                      />
                    </div>

                    {/* Performance Chart */}
                    <PerformanceChart
                      data={industryPerformance}
                      title={`Performance de ${selectedIndustry}`}
                      description="Cambio promedio diario en el tiempo"
                    />

                    {/* Performance Table */}
                    <PerformanceTable
                      data={industryPerformance}
                      title="Historial Reciente"
                      description="Últimos movimientos registrados"
                      maxRows={15}
                    />
                  </>
                ) : (
                  <div className="flex items-center justify-center py-12 text-muted-foreground">
                    No hay datos disponibles para esta industria
                  </div>
                )}
              </>
            )}

            {!selectedIndustry && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="p-6 bg-primary/5 rounded-full mb-6">
                  <Factory className="w-16 h-16 text-primary/50" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Selecciona una industria</h3>
                <p className="text-muted-foreground max-w-sm">
                  Elige una industria del menú superior para visualizar su performance histórico y estadísticas
                </p>
              </div>
            )}
          </TabsContent>

          {/* Sectors Tab */}
          <TabsContent value="sectors" className="space-y-6">
            {/* Sector Selector */}
            <Selector
              label="Seleccionar Sector"
              placeholder="Elige un sector..."
              options={sectors?.map(s => s.sector) ?? []}
              value={selectedSector}
              onChange={setSelectedSector}
              isLoading={sectorsLoading}
            />

            {/* Show content only if a sector is selected */}
            {selectedSector && (
              <>
                {sectorPerfLoading ? (
                  <PerformanceLoadingSkeleton />
                ) : sectorPerformance && sectorStats ? (
                  <>
                    {/* Statistics Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <StatsCard
                        title="Último Cambio"
                        value={sectorStats.latest}
                        subtitle={sectorStats.latestDate}
                      />
                      <StatsCard
                        title="Promedio"
                        value={sectorStats.average}
                        subtitle="Período completo"
                      />
                      <StatsCard
                        title="Máximo"
                        value={sectorStats.max}
                        subtitle="Mejor día"
                      />
                      <StatsCard
                        title="Mínimo"
                        value={sectorStats.min}
                        subtitle="Peor día"
                      />
                    </div>

                    {/* Performance Chart */}
                    <PerformanceChart
                      data={sectorPerformance}
                      title={`Performance de ${selectedSector}`}
                      description="Cambio promedio diario en el tiempo"
                    />

                    {/* Performance Table */}
                    <PerformanceTable
                      data={sectorPerformance}
                      title="Historial Reciente"
                      description="Últimos movimientos registrados"
                      maxRows={15}
                    />
                  </>
                ) : (
                  <div className="flex items-center justify-center py-12 text-muted-foreground">
                    No hay datos disponibles para este sector
                  </div>
                )}
              </>
            )}

            {!selectedSector && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="p-6 bg-primary/5 rounded-full mb-6">
                  <TrendingUp className="w-16 h-16 text-primary/50" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Selecciona un sector</h3>
                <p className="text-muted-foreground max-w-sm">
                  Elige un sector del menú superior para visualizar su performance histórico y estadísticas
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="yahoo" className="space-y-6">
            <YahooFinanceTest />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
