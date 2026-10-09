// src/features/asset-detail/pages/asset-detail-page.tsx

import { Link, useParams } from 'react-router-dom';
import { useAssetData } from '../../dashboard/hooks/use-asset-data';
import { motion } from 'framer-motion';
import { Button } from '../../../components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Card, CardContent } from '../../../components/ui/card';
import { CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import {
  AssetDetailSkeleton,
  AssetHeader,
  AssetKeyMetrics,
  LoadingError,
  NotFoundError,
  DCFValuationCard,
  RatingScorecard,
  AssetDetailTabs,
} from '../components';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.15,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.98, filter: "blur(6px)" },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 24,
    },
  },
};

const heroVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 250,
      damping: 20,
      delay: 0.1,
    },
  },
};

/**
 * Página de detalle de un activo financiero.
 * Muestra información completa del activo en tabs:
 * - Perfil: información general, ingresos por segmento
 * - Gráfico: rendimiento histórico
 * - Finanzas: métricas financieras detalladas
 * - Noticias: próximamente
 */
export default function AssetDetailPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const {
    data: asset,
    isLoading,
    isError,
    error,
    isFetching,
    refreshAssetData,
  } = useAssetData(symbol!);

  // Loading state
  if (isLoading) {
    return <AssetDetailSkeleton />;
  }

  // Error state
  if (isError) {
    return <LoadingError errorMessage={error.message} />;
  }

  // Not found state
  if (!asset) {
    return <NotFoundError symbol={symbol ?? 'UNKNOWN'} />;
  }

  const yahooMetrics = Object.entries(asset.yahooMetrics ?? {})
    .filter(([, value]) => value !== null && Number.isFinite(value))
    .sort(([left], [right]) => left.localeCompare(right));

  // Main content
  return (
    <motion.div
      className="container-wide stack-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Back button */}
      <motion.div variants={itemVariants}>
        <Button variant="outline" asChild className="group">
          <Link to="/dashboard">
            <motion.span
              className="inline-flex items-center"
              whileHover={{ x: -3 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
            >
              <ArrowLeft className="w-4 h-4 mr-2 transition-transform group-hover:-translate-x-0.5" />
              Volver al Dashboard
            </motion.span>
          </Link>
        </Button>
      </motion.div>

      {/* Header — hero entrance */}
      <motion.div variants={heroVariants}>
        <AssetHeader asset={asset} />
      </motion.div>

      {/* Key Metrics */}
      <motion.div variants={itemVariants}>
        <AssetKeyMetrics asset={asset} />
      </motion.div>

      {yahooMetrics.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card className="border-blue-500/20">
            <CardHeader>
              <CardTitle className="text-lg">Métricas complementarias de Yahoo Finance</CardTitle>
              <CardDescription>
                {yahooMetrics.length} campos disponibles de Yahoo. Cotización reportada:
                {' '}{asset.quote.timestamp
                  ? new Date(asset.quote.timestamp * 1000).toLocaleString('es-AR')
                  : 'fecha no informada'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {yahooMetrics.map(([key, value]) => (
                  <div key={key} className="min-w-0 rounded-md border p-3">
                    <p className="truncate text-xs text-muted-foreground" title={key}>
                      {key.replaceAll('.', ' · ').replace(/([a-z])([A-Z])/g, '$1 $2')}
                    </p>
                    <p className="break-all font-medium tabular-nums">
                      {new Intl.NumberFormat('es-AR', { maximumFractionDigits: 4 }).format(value ?? 0)}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Valuation & Rating Cards */}
      {asset.dataSource === 'Yahoo Finance' ? (
        <motion.div variants={itemVariants}>
          <Card className="border-amber-500/30">
            <CardContent className="p-4 text-sm text-muted-foreground">
              FMP no respondió para este símbolo. Se muestra la cotización y las métricas de
              valoración disponibles en Yahoo Finance; los modelos DCF, calificaciones,
              estimaciones y datos históricos de FMP no están disponibles.
              {asset.dataFetchedAt && (
                <span className="mt-1 block">
                  Consulta Yahoo: {new Date(asset.dataFetchedAt).toLocaleString('es-AR')}
                </span>
              )}
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <div className="grid-cards-2">
          <motion.div variants={itemVariants}>
            <DCFValuationCard asset={asset} />
          </motion.div>
          <motion.div variants={itemVariants}>
            <RatingScorecard asset={asset} />
          </motion.div>
        </div>
      )}

      {/* Tabs */}
      <motion.div variants={itemVariants}>
        <AssetDetailTabs asset={asset} onRefreshAssetData={refreshAssetData} isRefreshing={isFetching} />
      </motion.div>
    </motion.div>
  );
}