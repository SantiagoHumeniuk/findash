// src/features/portfolio/components/skeleton/portfolio-skeleton.tsx

import { Skeleton } from "../../../../components/ui/skeleton";
import { motion } from "framer-motion";

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.02,
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
 * Componente de carga para el portfolio
 * Diseño premium tipo glassmorphism con shimmer
 */
export function PortfolioSkeleton() {
  return (
    <motion.div
      className="container-wide space-y-4 sm:space-y-6"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={staggerItem} className="flex items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
            <Skeleton className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl" />
            <div>
            <Skeleton className="h-7 sm:h-9 w-48 sm:w-64 mb-2 rounded-md" />
            <Skeleton className="h-3 sm:h-4 w-60 sm:w-80 rounded-md" />
            </div>
        </div>
        <Skeleton className="hidden sm:block h-10 w-32 rounded-xl" />
      </motion.div>

      {/* Stats Cards (4) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <motion.div
            key={i}
            variants={staggerItem}
          >
            <div className="bg-card/40 backdrop-blur-md border border-primary/5 shadow-premium rounded-2xl p-4 sm:p-5 h-24 sm:h-28 flex flex-col justify-between">
                <Skeleton className="h-4 w-1/2 rounded-md" />
                <Skeleton className="h-8 w-3/4 rounded-md" />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <motion.div variants={staggerItem}>
          <div className="bg-card/40 backdrop-blur-md border border-primary/5 shadow-premium rounded-3xl p-5 sm:p-6 h-64 sm:h-80 flex flex-col gap-4">
            <Skeleton className="h-6 w-40 rounded-md" />
            <Skeleton className="flex-1 w-full rounded-2xl" />
          </div>
        </motion.div>
        <motion.div variants={staggerItem}>
          <div className="bg-card/40 backdrop-blur-md border border-primary/5 shadow-premium rounded-3xl p-5 sm:p-6 h-64 sm:h-80 flex flex-col gap-4">
            <Skeleton className="h-6 w-40 rounded-md" />
            <Skeleton className="flex-1 w-full rounded-2xl" />
          </div>
        </motion.div>
      </div>

      {/* Table */}
      <motion.div variants={staggerItem}>
        <div className="bg-card/40 backdrop-blur-md border border-primary/5 shadow-premium rounded-3xl p-5 sm:p-6 h-80 sm:h-96 flex flex-col gap-4">
           <Skeleton className="h-6 w-48 rounded-md mb-2" />
           <Skeleton className="h-10 w-full rounded-xl" />
           <Skeleton className="h-10 w-full rounded-xl" />
           <Skeleton className="h-10 w-full rounded-xl" />
           <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      </motion.div>
    </motion.div>
  );
}
