// src/features/asset-detail/components/asset-detail-tabs.tsx

import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { AssetProfileTab } from './profile/asset-profile-tab';
import { AssetFinancialsTab } from './financials/asset-financials-tab';
import { motion } from 'framer-motion';
import type { AssetData } from '../../../types/dashboard';
import { BarChart3, Building2, DollarSign, Info, Newspaper } from 'lucide-react';
import { Card } from '../../../components/ui/card';
import { HistoricalPerformanceChart } from '../../dashboard/components';
import { AssetGradesTab } from './ratings/asset-grades-tab';
import { AssetNewsTab } from './news/asset-news-tab';
import { AssetFundamentalsTrends } from './fundamentals/asset-fundamentals-trends';

/**
 * Props para el componente AssetDetailTabs.
 * @property asset - Datos completos del activo
 */
interface AssetDetailTabsProps {
  asset: AssetData;
}

/**
 * Componente de navegación por tabs para los detalles del activo.
 * Incluye tres tabs: Perfil, Métricas Financieras y Calificaciones.
 * 
 * @example
 * ```tsx
 * <AssetDetailTabs asset={assetData} />
 * ```
 */
export function AssetDetailTabs({ asset }: AssetDetailTabsProps) {
  return (
    <Tabs defaultValue="profile" className="w-full">
      <TabsList className="grid w-full grid-cols-2 md:grid-cols-6 h-auto">
        <TabsTrigger value="profile" className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-2 py-2 sm:px-3 sm:py-2.5">
          <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">Perfil</span>
          <span className="sm:hidden">Info</span>
        </TabsTrigger>
        <TabsTrigger value="chart" className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-2 py-2 sm:px-3 sm:py-2.5">
          <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">Gráfico</span>
          <span className="sm:hidden">📊</span>
        </TabsTrigger>
        <TabsTrigger value="financials" className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-2 py-2 sm:px-3 sm:py-2.5">
          <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">Finanzas</span>
          <span className="sm:hidden">$</span>
        </TabsTrigger>
        <TabsTrigger value="news" className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-2 py-2 sm:px-3 sm:py-2.5">
          <Newspaper className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">Noticias</span>
          <span className="sm:hidden">📰</span>
        </TabsTrigger>
        <TabsTrigger value="ratings" className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-2 py-2 sm:px-3 sm:py-2.5">
          <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">Calificaciones de analistas</span>
          <span className="sm:hidden">Ratings</span>
        </TabsTrigger>
        <TabsTrigger value="evolution" className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-2 py-2 sm:px-3 sm:py-2.5">
          <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">Evolución</span>
          <span className="sm:hidden">Evol</span>
        </TabsTrigger>
      </TabsList>

      <motion.div
        key="tabs-content"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <TabsContent value="profile" className="mt-4 sm:mt-6">
          <AssetProfileTab asset={asset} />
        </TabsContent>

        <TabsContent value="chart" className="mt-4 sm:mt-6">
          <Card className="p-3 sm:p-4">
            <HistoricalPerformanceChart assets={[asset]} />
          </Card>
        </TabsContent>

        <TabsContent value="financials" className="mt-4 sm:mt-6">
          <AssetFinancialsTab asset={asset} />
        </TabsContent>

        <TabsContent value="news" className="mt-4 sm:mt-6">
          <AssetNewsTab symbol={asset.profile.symbol} />
        </TabsContent>

        <TabsContent value="ratings" className="mt-4 sm:mt-6">
          <AssetGradesTab asset={asset} />
        </TabsContent>

        <TabsContent value="evolution" className="mt-4 sm:mt-6">
          <AssetFundamentalsTrends asset={asset} />
        </TabsContent>
      </motion.div>
    </Tabs>
  );
}
