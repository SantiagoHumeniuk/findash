// src/features/dashboard/components/skeleton/dashboard-skeleton.tsx

import { Card, CardContent, CardHeader } from "../../../../components/ui/card";
import { Skeleton } from "../../../../components/ui/skeleton";
import { motion } from "framer-motion";

const containerVariants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.08,
            delayChildren: 0.1,
        },
    },
};

const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    show: {
        opacity: 1,
        y: 0,
        transition: { type: "spring", stiffness: 400, damping: 30 },
    },
};

export const DashboardSkeleton = () => (
    <motion.div
        className="container-wide space-y-6"
        variants={containerVariants}
        initial="hidden"
        animate="show"
    >
        {/* Header Section */}
        <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-6"
        >
            <div className="space-y-2 w-full sm:w-auto">
                <Skeleton className="h-8 w-48 sm:w-64" />
                <Skeleton className="h-4 w-64 sm:w-80" />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
                <Skeleton className="h-10 w-full sm:w-[200px]" />
                <Skeleton className="h-10 w-full sm:w-[140px]" />
            </div>
        </motion.div>

        {/* Input & Selected Tickers Area */}
        <motion.div variants={itemVariants}>
            <Card className="shadow-premium border-none">
                <CardHeader className="p-4 sm:p-6 space-y-4">
                    <div className="flex gap-4">
                        <Skeleton className="h-10 w-full sm:w-[250px]" />
                    </div>
                    <div className="flex gap-2 pt-2">
                        <Skeleton className="h-8 w-20 rounded-full" />
                        <Skeleton className="h-8 w-24 rounded-full" />
                        <Skeleton className="h-8 w-16 rounded-full" />
                    </div>
                </CardHeader>
            </Card>
        </motion.div>

        {/* Tabs Skeleton */}
        <motion.div variants={itemVariants} className="space-y-4">
            <div className="flex gap-2 overflow-x-auto pb-2">
                {Array.from({ length: 5 }).map((_, i) => (
                    <motion.div
                        key={i}
                        variants={itemVariants}
                    >
                        <Skeleton className="h-9 w-24 rounded-md flex-shrink-0" />
                    </motion.div>
                ))}
            </div>

            {/* Main Content Area (Matches Summary Analysis Layout) */}
            <div className="space-y-4">
                {/* Winner Card Skeleton */}
                <motion.div variants={itemVariants}>
                    <Card className="bg-muted/10 shadow-premium border-none">
                        <CardContent className="p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-4">
                                    <Skeleton className="h-12 w-12 rounded-full" />
                                    <div className="space-y-2">
                                        <Skeleton className="h-6 w-32" />
                                        <Skeleton className="h-4 w-48" />
                                    </div>
                                </div>
                                <Skeleton className="h-8 w-24 rounded-full" />
                            </div>
                            <Skeleton className="h-16 w-full rounded-lg" />
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Split View Skeleton */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <motion.div variants={itemVariants}>
                        <Card className="shadow-premium border-none">
                            <CardHeader><Skeleton className="h-6 w-40" /></CardHeader>
                            <CardContent className="space-y-4">
                                {Array.from({ length: 3 }).map((_, i) => (
                                    <Skeleton key={i} className="h-20 w-full rounded-lg" />
                                ))}
                            </CardContent>
                        </Card>
                    </motion.div>
                    <motion.div variants={itemVariants}>
                        <Card className="shadow-premium border-none">
                            <CardHeader><Skeleton className="h-6 w-40" /></CardHeader>
                            <CardContent className="space-y-2">
                                {Array.from({ length: 5 }).map((_, i) => (
                                    <Skeleton key={i} className="h-12 w-full rounded-lg" />
                                ))}
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>
            </div>
        </motion.div>
    </motion.div>
);