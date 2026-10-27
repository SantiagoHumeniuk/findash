// src/features/risk-premium/pages/risk-premium-page.tsx

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Globe } from 'lucide-react';
import { extractContinents } from '../lib/risk-premium.utils';
import { RiskPremiumFilters, RiskPremiumTable, RiskPremiumSkeleton } from '../components';
import { useRiskPremiumQuery } from '../hooks/use-risk-premium-query';
import { ErrorScreen } from '../../../components/ui/error-screen';
import { RiskPremiumViewMode } from '../types/risk-premium.types';
import { DAMODARAN_SOURCE_URL, DAMODARAN_UPDATED_AT } from '../../../data/damodaran-country-risk';

export default function RiskPremiumPage() {
  const [countryFilter, setCountryFilter] = useState('');
  const [continentFilter, setContinentFilter] = useState('');
  const [viewMode, setViewMode] = useState<RiskPremiumViewMode>('percentage');

  // Use TanStack Query hook
  const { data = [], isLoading, isError, error, refetch } = useRiskPremiumQuery();

  const continents = useMemo(() => extractContinents(data), [data]);

  const handleClearFilters = () => {
    setCountryFilter('');
    setContinentFilter('');
    setViewMode('percentage');
  };

  if (isLoading) {
    return <RiskPremiumSkeleton />;
  }

  if (isError) {
    return (
      <ErrorScreen
        title="Error al Cargar Datos"
        message={error instanceof Error ? error.message : 'No se pudieron obtener los datos de riesgo país.'}
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <motion.div
      className="container-wide stack-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center gap-3 sm:gap-4 pb-4 sm:pb-6 mb-4 sm:mb-6 border-b">
          <div className="p-1.5 sm:p-2 bg-primary/10 rounded-lg">
            <Globe className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">
              Riesgo País
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm">
              Consulta la prima de riesgo país y la prima total de acciones por
              país.
            </p>
            <p className="text-muted-foreground text-[11px] sm:text-xs mt-1">
              Fuente:{' '}
              <a href={DAMODARAN_SOURCE_URL} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                Aswath Damodaran (NYU Stern)
              </a>
              {DAMODARAN_UPDATED_AT ? `, actualizado el ${new Date(`${DAMODARAN_UPDATED_AT}T00:00:00`).toLocaleDateString('es-AR')}` : ''}.
              Se publica dos veces por año.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Filters */}
      <RiskPremiumFilters
        countryFilter={countryFilter}
        continentFilter={continentFilter}
        viewMode={viewMode}
        continents={continents}
        onCountryFilterChange={setCountryFilter}
        onContinentFilterChange={setContinentFilter}
        onViewModeChange={setViewMode}
        onClearFilters={handleClearFilters}
      />

      {/* Table */}
      <RiskPremiumTable
        data={data}
        countryFilter={countryFilter}
        continentFilter={continentFilter}
        viewMode={viewMode}
      />
    </motion.div>
  );
}