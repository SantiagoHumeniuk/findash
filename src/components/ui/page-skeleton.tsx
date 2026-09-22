// src/components/ui/page-skeleton.tsx

import { Skeleton } from "./skeleton";
import { Card, CardContent, CardHeader } from "./card";
import { motion } from "framer-motion";

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 400, damping: 30 },
  },
};

/**
 * Skeleton genérico para páginas
 * Usado como fallback en Suspense cuando no hay un skeleton específico
 */
export function PageSkeleton() {
  return (
    <motion.div
      className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {/* Page Header */}
      <motion.div variants={staggerItem} className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </motion.div>

      {/* Main Content Card */}
      <motion.div variants={staggerItem}>
        <Card className="shadow-premium border-none">
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </motion.div>

      {/* Secondary Content */}
      <div className="grid gap-4 md:grid-cols-2">
        <motion.div variants={staggerItem}>
          <Card className="shadow-premium border-none">
            <CardContent className="pt-6">
              <Skeleton className="h-48 w-full" />
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={staggerItem}>
          <Card className="shadow-premium border-none">
            <CardContent className="pt-6">
              <Skeleton className="h-48 w-full" />
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}

/**
 * Skeleton mínimo para páginas de auth (login, register, etc)
 */
export function AuthPageSkeleton() {
  return (
    <motion.div
      className="flex min-h-screen items-center justify-center p-4"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className="w-full max-w-md shadow-premium border-none">
        <CardHeader className="space-y-2">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-4 w-64 mx-auto" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.08 }}
            >
              <Skeleton className="h-10 w-full" />
            </motion.div>
          ))}
        </CardContent>
      </Card>
    </motion.div>
  );
}
