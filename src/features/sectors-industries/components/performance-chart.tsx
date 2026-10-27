// src/features/sectors-industries/components/performance-chart.tsx

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { TrendingUp } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { formatPercentage, formatDate } from '../lib/format-utils';
import type { HistoricalIndustryPerformance, HistoricalSectorPerformance } from '../types';

/**
 * Props for the PerformanceChart component.
 */
interface PerformanceChartProps {
  /**
   * Historical performance data to display
   */
  data: HistoricalIndustryPerformance[] | HistoricalSectorPerformance[];
  
  /**
   * Title for the chart
   */
  title: string;
  
  /**
   * Description text
   */
  description?: string;
}

/**
 * Displays a line chart showing historical performance over time.
 * 
 * @remarks
 * Uses Recharts library with optimized performance through React.memo.
 * Data is displayed in reverse chronological order (oldest first).
 * 
 * @example
 * ```tsx
 * <PerformanceChart
 *   data={performanceData}
 *   title="Performance de Biotechnology"
 *   description="Cambio promedio diario"
 * />
 * ```
 */
export const PerformanceChart = React.memo<PerformanceChartProps>(
  function PerformanceChart({ data, title, description }) {
    // Sort chronologically so the chart does not depend on the provider's ordering.
    const chartData = React.useMemo(() => {
      return [...data]
        .filter((item) =>
          Number.isFinite(Date.parse(item.date)) &&
          typeof item.averageChange === 'number' &&
          Number.isFinite(item.averageChange)
        )
        .sort((left, right) => Date.parse(left.date) - Date.parse(right.date))
        .map((item) => ({
          date: item.date,
          value: item.averageChange,
          formattedDate: formatDate(item.date),
        }));
    }, [data]);

    if (chartData.length === 0) {
      return (
        <Card className="border-primary/20 bg-gradient-to-br from-card to-card/50">
          <CardHeader>
            <CardTitle className="text-xl">{title}</CardTitle>
            {description && <CardDescription className="text-base">{description}</CardDescription>}
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
              <TrendingUp className="w-12 h-12 mb-3 opacity-20" />
              <p className="font-medium">No hay datos disponibles</p>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="border-primary/20 bg-gradient-to-br from-card to-card/50">
        <CardHeader>
          <CardTitle className="text-xl">{title}</CardTitle>
          {description && <CardDescription className="text-base">{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="formattedDate" 
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                tickFormatter={(value: number) => `${value.toFixed(1)}%`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload?.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                        <p className="text-sm font-medium mb-1">{data.formattedDate}</p>
                        <p className={`text-sm font-bold ${
                          data.value >= 0 
                            ? 'text-green-600 dark:text-green-400' 
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {formatPercentage(data.value)}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  }
);
