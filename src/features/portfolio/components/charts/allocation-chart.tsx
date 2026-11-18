import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../../components/ui/card";
import { BarChart3, Globe } from "lucide-react";
import { Skeleton } from "../../../../components/ui/skeleton";
import { formatCurrency } from "../../../../lib/utils";
import type { AllocationChartProps } from "../../types/portfolio.types";
import { motion } from "framer-motion";

const COLORS = [
    'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)',
    'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)',
    'var(--chart-7)', 'var(--chart-8)', 'var(--chart-9)',
    'var(--chart-10)'
];

export function AllocationChart({ data, title, description, type, isLoading }: AllocationChartProps) {
    const Icon = type === 'sector' ? BarChart3 : Globe;

    const chartData = useMemo(() => {
        const sorted = [...data].sort((a, b) => b.value - a.value);
        if (sorted.length <= 10) return sorted;

        const main = sorted.slice(0, 9);
        const others = sorted.slice(9);
        const otherValue = others.reduce((sum, item) => sum + item.value, 0);
        const otherPercentage = others.reduce((sum, item) => sum + item.percentage, 0);

        return [
            ...main,
            { name: 'Otros', value: otherValue, percentage: otherPercentage }
        ];
    }, [data]);
    const maxPercentage = Math.max(1, ...chartData.map((item) => item.percentage));

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <Skeleton className="mb-2 h-6 w-40" />
                    <Skeleton className="h-4 w-48" />
                </CardHeader>
                <CardContent className="space-y-4">
                    {Array.from({ length: 5 }).map((_, index) => (
                        <div key={index} className="grid grid-cols-[7rem_minmax(0,1fr)_3rem] items-center gap-3">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-2 w-full" />
                            <Skeleton className="h-4 w-full" />
                        </div>
                    ))}
                </CardContent>
            </Card>
        );
    }

    if (chartData.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Icon className="size-5 text-primary" />
                        <CardTitle className="text-lg">{title}</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
                    No hay datos suficientes para mostrar el gráfico.
                </CardContent>
            </Card>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
        >
            <Card className="overflow-hidden">
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-primary/5 p-2">
                            <Icon className="size-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                            <CardTitle className="text-base sm:text-lg">{title}</CardTitle>
                            {description && <CardDescription className="text-xs">{description}</CardDescription>}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    {chartData.map((item, index) => (
                        <div
                            key={item.name}
                            className="grid grid-cols-[minmax(5rem,8rem)_minmax(0,1fr)_3.25rem_5.5rem] items-center gap-2 text-xs sm:grid-cols-[minmax(7rem,10rem)_minmax(0,1fr)_3.5rem_6rem] sm:gap-3 sm:text-sm"
                        >
                            <span className="truncate font-medium" title={item.name}>{item.name}</span>
                            <span
                                role="meter"
                                aria-label={item.name}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={item.percentage}
                                className="h-2 overflow-hidden rounded-full bg-muted"
                            >
                                <span
                                    className="block h-full rounded-full transition-[width]"
                                    style={{
                                        width: `${(item.percentage / maxPercentage) * 100}%`,
                                        backgroundColor: COLORS[index % COLORS.length],
                                    }}
                                />
                            </span>
                            <span className="text-right tabular-nums text-muted-foreground">
                                {item.percentage.toFixed(1)}%
                            </span>
                            <span className="text-right tabular-nums">
                                {formatCurrency(item.value)}
                            </span>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </motion.div>
    );
}
