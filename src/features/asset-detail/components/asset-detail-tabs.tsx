// src/features/asset-detail/components/asset-detail-tabs.tsx

import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { AssetProfileTab } from './profile/asset-profile-tab';
import { AssetFinancialsTab } from './financials/asset-financials-tab';
import { motion } from 'framer-motion';
import type { AssetData } from '../../../types/dashboard';
import { BarChart3, Building2, DollarSign, Info, Newspaper, Users } from 'lucide-react';
import { Card } from '../../../components/ui/card';
import { HistoricalPerformanceChart } from '../../dashboard/components';
import { AssetGradesTab } from './ratings/asset-grades-tab';
import { AssetNewsTab } from './news/asset-news-tab';
import { AssetFilingsCard } from './news/asset-filings-card';
import { AssetOwnershipTab } from './insights/asset-ownership-tab';
import { AssetFundamentalsTrends } from './fundamentals/asset-fundamentals-trends';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { useState } from 'react';

/**
 * Props para el componente AssetDetailTabs.
 * @property asset - Datos completos del activo
 */
interface AssetDetailTabsProps {
  asset: AssetData;
  onRefreshAssetData: () => Promise<AssetData>;
  isRefreshing: boolean;
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
export function AssetDetailTabs({ asset, onRefreshAssetData, isRefreshing }: AssetDetailTabsProps) {
  const [activeTab, setActiveTab] = useState('profile');
  // ETFs and indexes have no company statements, so the tab is hidden for them.
  const hasFinancials = asset.ratios.length > 0 || asset.keyMetricsYearly.length > 0 ||
    asset.analystEstimates.length > 0 || (asset.yahooInsights?.annualStatements.length ?? 0) > 0;
  const hasOwnership = Boolean(asset.yahooInsights?.ownership);
  const tabCount = 5 + Number(hasFinancials) + Number(hasOwnership);
  const desktopColumns: Record<number, string> = { 5: 'lg:grid-cols-5', 6: 'lg:grid-cols-6', 7: 'lg:grid-cols-7' };
  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <div className="sm:hidden">
        <Select value={activeTab} onValueChange={setActiveTab}>
          <SelectTrigger className="h-11 w-full">
            <SelectValue placeholder="Elegí una sección" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="profile">Perfil</SelectItem>
            <SelectItem value="chart">Gráfico</SelectItem>
            {hasFinancials && <SelectItem value="financials">Fundamentales</SelectItem>}
            {hasOwnership && <SelectItem value="ownership">Accionistas</SelectItem>}
            <SelectItem value="news">Noticias</SelectItem>
            <SelectItem value="ratings">Analistas</SelectItem>
            <SelectItem value="evolution">Evolución</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <TabsList className={`hidden sm:grid w-full grid-cols-2 sm:grid-cols-4 ${desktopColumns[tabCount]} h-auto`}>
        <TabsTrigger value="profile" className="flex min-h-11 min-w-0 items-center justify-center gap-1.5 whitespace-normal px-2 py-2 text-center text-[11px] leading-tight sm:gap-2 sm:px-3 sm:py-2.5 sm:text-sm">
          <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>Perfil</span>
        </TabsTrigger>
        <TabsTrigger value="chart" className="flex min-h-11 min-w-0 items-center justify-center gap-1.5 whitespace-normal px-2 py-2 text-center text-[11px] leading-tight sm:gap-2 sm:px-3 sm:py-2.5 sm:text-sm">
          <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>Gráfico</span>
        </TabsTrigger>
        {hasFinancials && (
          <TabsTrigger value="financials" className="flex min-h-11 min-w-0 items-center justify-center gap-1.5 whitespace-normal px-2 py-2 text-center text-[11px] leading-tight sm:gap-2 sm:px-3 sm:py-2.5 sm:text-sm">
            <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Fundamentales</span>
          </TabsTrigger>
        )}
        {hasOwnership && (
          <TabsTrigger value="ownership" className="flex min-h-11 min-w-0 items-center justify-center gap-1.5 whitespace-normal px-2 py-2 text-center text-[11px] leading-tight sm:gap-2 sm:px-3 sm:py-2.5 sm:text-sm">
            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Accionistas</span>
          </TabsTrigger>
        )}
        <TabsTrigger value="news" className="flex min-h-11 min-w-0 items-center justify-center gap-1.5 whitespace-normal px-2 py-2 text-center text-[11px] leading-tight sm:gap-2 sm:px-3 sm:py-2.5 sm:text-sm">
          <Newspaper className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>Noticias</span>
        </TabsTrigger>
        <TabsTrigger value="ratings" className="flex min-h-11 min-w-0 items-center justify-center gap-1.5 whitespace-normal px-2 py-2 text-center text-[11px] leading-tight sm:gap-2 sm:px-3 sm:py-2.5 sm:text-sm">
          <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>Analistas</span>
        </TabsTrigger>
        <TabsTrigger value="evolution" className="flex min-h-11 min-w-0 items-center justify-center gap-1.5 whitespace-normal px-2 py-2 text-center text-[11px] leading-tight sm:gap-2 sm:px-3 sm:py-2.5 sm:text-sm">
          <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>Evolución</span>
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

        {hasFinancials && (
          <TabsContent value="financials" className="mt-4 sm:mt-6">
            <AssetFinancialsTab asset={asset} />
          </TabsContent>
        )}

        {hasOwnership && (
          <TabsContent value="ownership" className="mt-4 sm:mt-6">
            <AssetOwnershipTab asset={asset} />
          </TabsContent>
        )}

        <TabsContent value="news" className="mt-4 sm:mt-6">
          <AssetNewsTab symbol={asset.profile.symbol} />
          {!asset.profile.isEtf && <AssetFilingsCard symbol={asset.profile.symbol} />}
        </TabsContent>

        <TabsContent value="ratings" className="mt-4 sm:mt-6">
          <AssetGradesTab asset={asset} onRefreshAssetData={onRefreshAssetData} isRefreshing={isRefreshing} />
        </TabsContent>

        <TabsContent value="evolution" className="mt-4 sm:mt-6">
          <AssetFundamentalsTrends asset={asset} />
        </TabsContent>
      </motion.div>
    </Tabs>
  );
}
