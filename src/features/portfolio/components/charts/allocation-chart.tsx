
import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "../../../../components/charts/lazy-recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../../components/ui/card";
import { PieChart as PieChartIcon, Globe } from "lucide-react";
import { Skeleton } from "../../../../components/ui/skeleton";
import type { AllocationChartProps } from "../../types/portfolio.types";

const COLORS = [
    'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)',
    'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)',
    'var(--chart-7)', 'var(--chart-8)', 'var(--chart-9)',
    'var(--chart-10)'
];

import { motion } from "framer-motion";

export function AllocationChart({ data, title, description, type, isLoading }: AllocationChartProps) {
    const Icon = type === 'sector' ? PieChartIcon : Globe;

    const chartData = useMemo(() => {
        // Filter out very small segments (< 1%) into "Otros" if too many segments
        if (data.length <= 10) return data;

        const main = data.slice(0, 9);
        const others = data.slice(9);
        const otherValue = others.reduce((sum, item) => sum + item.value, 0);
        const otherPercentage = others.reduce((sum, item) => sum + item.percentage, 0);

        return [
            ...main,
            { name: 'Otros', value: otherValue, percentage: otherPercentage }
        ];
    }, [data]);

    if (isLoading) {
        return (
            <Card className="bg-card/50 backdrop-blur-sm border-primary/10 shadow-premium">
                <CardHeader>
                    <Skeleton className="h-6 w-32 mb-2" />
                    <Skeleton className="h-4 w-48" />
                </CardHeader>
                <CardContent className="h-[300px] flex items-center justify-center">
                    <Skeleton className="h-[250px] w-[250px] rounded-full" />
                </CardContent>
            </Card>
        );
    }

    if (chartData.length === 0) {
        return (
            <Card className="bg-card/50 backdrop-blur-sm border-primary/10 shadow-premium">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Icon className="w-5 h-5 text-primary" />
                        <CardTitle className="text-lg heading-premium">{title}</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                    No hay datos suficientes para mostrar el gráfico.
                </CardContent>
            </Card>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
        >
            <Card className="bg-card/50 backdrop-blur-sm border-primary/10 shadow-premium overflow-hidden">
                <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-primary/5 rounded-lg">
                            <Icon className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <CardTitle className="text-lg heading-premium">{title}</CardTitle>
                            {description && <CardDescription className="text-xs font-medium">{description}</CardDescription>}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={chartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={90}
                                    paddingAngle={3}
                                    dataKey="value"
                                    stroke="none"
                                    className="drop-shadow-xl"
                                    cornerRadius={4}
                                >
                                    <defs>
                                        {COLORS.map((color, index) => (
                                            <linearGradient key={`grad-${index}`} id={`grad-${index}`} x1="0" y1="0" x2="1" y2="1">
                                                <stop offset="5%" stopColor={color} stopOpacity={0.9} />
                                                <stop offset="95%" stopColor={color} stopOpacity={0.4} />
                                            </linearGradient>
                                        ))}
                                    </defs>
                                    {chartData.map((_entry, index) => (
                                        <Cell 
                                            key={`cell-${index}`} 
                                            fill={`url(#grad-${index % COLORS.length})`}
                                            className="hover:opacity-80 transition-opacity cursor-pointer outline-none"
                                            stroke="currentColor" 
                                            strokeWidth={1} 
                                            strokeOpacity={0.2}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(value: number) => [`$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`]}
                                    contentStyle={{ 
                                        borderRadius: '12px', 
                                        border: 'none', 
                                        boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.3)',
                                        backgroundColor: 'hsl(var(--card))',
                                        padding: '12px'
                                    }}
                                    itemStyle={{ fontWeight: 'bold' }}
                                />
                                <Legend
                                    layout="vertical"
                                    verticalAlign="middle"
                                    align="right"
                                    wrapperStyle={{ fontSize: '12px' }}
                                    formatter={(value: string, _entry: unknown, index: number) => {
                                        const percent = chartData[index]?.percentage.toFixed(1) + '%';
                                        return <span className="text-foreground/80 font-semibold ml-1">{value} ({percent})</span>;
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}

