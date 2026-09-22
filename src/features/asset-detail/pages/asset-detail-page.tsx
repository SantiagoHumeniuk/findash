// src/features/asset-detail/pages/asset-detail-page.tsx

import { Link, useParams } from 'react-router-dom';
import { useAssetData } from '../../dashboard/hooks/use-asset-data';
import { motion } from 'framer-motion';
import { Button } from '../../../components/ui/button';
import { ArrowLeft } from 'lucide-react';
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
  const { data: asset, isLoading, isError, error } = useAssetData(symbol!);

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

      {/* Valuation & Rating Cards */}
      <div className="grid-cards-2">
        <motion.div variants={itemVariants}>
          <DCFValuationCard asset={asset} />
        </motion.div>
        <motion.div variants={itemVariants}>
          <RatingScorecard asset={asset} />
        </motion.div>
      </div>

      {/* Tabs */}
      <motion.div variants={itemVariants}>
        <AssetDetailTabs asset={asset} />
      </motion.div>
    </motion.div>
  );
}