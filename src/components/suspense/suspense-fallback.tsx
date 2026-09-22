import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { TechLoader } from '../ui/tech-loader';
import { motion } from 'framer-motion';

type FallbackType = 'spinner' | 'skeleton' | 'page' | 'minimal';

interface SuspenseFallbackProps {
  type?: FallbackType;
  message?: string;
}

const fadeInVariants = {
  hidden: { opacity: 0, scale: 0.97 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.1,
    },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 400, damping: 30 },
  },
};

export function SuspenseFallback({ 
  type = 'spinner', 
  message = 'Cargando...' 
}: SuspenseFallbackProps) {
  switch (type) {
    case 'minimal':
      return (
        <motion.div
          className="flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </motion.div>
      );

    case 'spinner':
      return (
        <motion.div
          className="flex flex-col items-center justify-center min-h-[400px] gap-4"
          variants={fadeInVariants}
          initial="hidden"
          animate="visible"
        >
          <TechLoader />
        </motion.div>
      );

    case 'skeleton':
      return (
        <motion.div
          className="container mx-auto p-6 space-y-6"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={staggerItem} className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
          </motion.div>
          <motion.div variants={staggerItem}>
            <Card className="shadow-premium border-none">
              <CardContent className="pt-6 space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      );

    case 'page':
      return (
        <motion.div
          className="flex items-center justify-center min-h-[80vh]"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <TechLoader />
        </motion.div>
      );

    default:
      return null;
  }
}

/**
 * Fallback específico para tablas
 */
export function TableSuspenseFallback({ rows = 5 }: { rows?: number }) {
  return (
    <motion.div
      className="space-y-4"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={staggerItem} className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
      </motion.div>
      <motion.div variants={staggerItem}>
        <Card>
          <CardContent className="pt-6 space-y-3">
            {Array.from({ length: rows }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.05 }}
              >
                <Skeleton className="h-12 w-full" />
              </motion.div>
            ))}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

/**
 * Fallback específico para gráficos
 */
export function ChartSuspenseFallback() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center min-h-[300px] gap-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            >
              <Loader2 className="h-8 w-8 text-primary" />
            </motion.div>
            <motion.p
              className="text-sm text-muted-foreground"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              Cargando gráfico...
            </motion.p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/**
 * Fallback específico para formularios
 */
export function FormSuspenseFallback() {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      <Card>
        <CardContent className="pt-6 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <motion.div key={i} variants={staggerItem} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className={`${i === 2 ? 'h-20' : 'h-10'} w-full`} />
            </motion.div>
          ))}
          <motion.div variants={staggerItem}>
            <Skeleton className="h-10 w-32 ml-auto" />
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
