// src/features/asset-detail/components/skeleton/asset-detail-skeleton.tsx

import { Skeleton } from '../../../../components/ui/skeleton';
import { Card, CardHeader } from '../../../../components/ui/card';
import { motion } from 'framer-motion';

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.05,
    },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 400, damping: 30 },
  },
};

/**
 * Componente de loading skeleton para la página de detalle del activo.
 * Muestra placeholders animados que coinciden con el layout real:
 * - Breadcrumb
 * - Header (logo + info)
 * - Métricas clave (grid)
 * - Tarjetas de valoración (2 columnas)
 * - Tabs
 * - Contenido principal
 * 
 * @example
 * ```tsx
 * {isLoading ? <AssetDetailSkeleton /> : <AssetDetailPage asset={data} />}
 * ```
 */
export function AssetDetailSkeleton() {
  return (
    <motion.div
      className="space-y-6 sm:space-y-8 container px-4 py-6 sm:py-10 mx-auto sm:px-6 lg:px-8"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={staggerItem}>
        <Skeleton className="h-6 sm:h-8 w-24 sm:w-32 rounded-md" />
      </motion.div>

      <motion.div variants={staggerItem} className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start">
        <Skeleton className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl" />
        <div className="space-y-2 sm:space-y-3 flex-1">
          <Skeleton className="h-7 sm:h-9 w-48 sm:w-56" />
          <Skeleton className="h-5 sm:h-6 w-32 sm:w-40" />
          <Skeleton className="h-6 sm:h-8 w-40 sm:w-48" />
        </div>
      </motion.div>

      <motion.div variants={staggerItem}>
        <Card className="shadow-premium border-none">
          <CardHeader>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 + i * 0.05 }}
                >
                  <Skeleton className="h-10 sm:h-12 w-full rounded-lg" />
                </motion.div>
              ))}
            </div>
          </CardHeader>
        </Card>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        <motion.div variants={staggerItem}>
          <Skeleton className="h-56 sm:h-64 w-full rounded-xl" />
        </motion.div>
        <motion.div variants={staggerItem}>
          <Skeleton className="h-56 sm:h-64 w-full rounded-xl" />
        </motion.div>
      </div>

      <motion.div variants={staggerItem}>
        <Skeleton className="h-10 sm:h-12 w-full max-w-md rounded-lg" />
      </motion.div>

      <motion.div variants={staggerItem}>
        <Skeleton className="h-64 sm:h-80 w-full rounded-xl" />
      </motion.div>
    </motion.div>
  );
}
