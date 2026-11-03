// src/features/retirement/components/chart/retirement-chart.tsx

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "../../../../components/charts/lazy-recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartConfig,
} from "../../../../components/ui/chart";
import { RetirementChartProps } from "../../types/retirement.types";
import { formatCurrency } from "../../lib/retirement.utils";

const chartConfig: ChartConfig = {
  "Solo Ahorro": {
    label: "Solo Ahorro",
    color: "#f59e0b", // amber-500 - más visible
  },
  Invirtiendo: {
    label: "Invirtiendo",
    color: "#10b981", // emerald-500 - más vibrante
  },
};

/**
 * Gráfico de área que muestra la proyección de crecimiento
 */
export function RetirementChart({ chartData }: RetirementChartProps) {
  return (
    <ChartContainer config={chartConfig} className="h-[280px] sm:h-[350px] w-full">
      <ResponsiveContainer>
        <AreaChart
          data={chartData}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <CartesianGrid
            vertical={false}
            strokeDasharray="3 3"
            stroke="var(--border)"
          />
          <XAxis
            dataKey="year"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tick={{ fontSize: 10, fill: "var(--foreground)" }}
          />
          <YAxis
            tickFormatter={(value) => formatCurrency(Number(value))}
            tickLine={false}
            axisLine={false}
            width={60}
            tick={{ fontSize: 10, fill: "var(--foreground)" }}
          />
          <ChartTooltip
            content={({ active, payload }) => {
              if (!active || !payload || payload.length === 0) return null;
              
               
              const year = payload[0].payload.year as number;
               
              const ahorro = payload[0].payload["Solo Ahorro"] as number;
               
              const inversion = payload[0].payload.Invirtiendo as number;
              const diferencia = inversion - ahorro;
              
              return (
                <div className="rounded-lg border bg-background p-3 shadow-lg">
                  <div className="grid gap-2">
                    <div className="flex flex-col">
                      <span className="text-[0.70rem] uppercase text-muted-foreground font-semibold">
                        Año {year}
                      </span>
                    </div>
                    <div className="grid gap-1.5">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: chartConfig["Solo Ahorro"].color }} />
                          <span className="text-xs text-muted-foreground">Solo Ahorro:</span>
                        </div>
                        <span className="text-xs font-bold text-amber-600 dark:text-amber-500">
                          {formatCurrency(ahorro)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: chartConfig.Invirtiendo.color }} />
                          <span className="text-xs text-muted-foreground">Invirtiendo:</span>
                        </div>
                        <span className="text-xs font-bold text-green-600 dark:text-green-500">
                          {formatCurrency(inversion)}
                        </span>
                      </div>
                      <div className="pt-1.5 mt-1.5 border-t">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-xs text-muted-foreground">Ganancia extra:</span>
                          <span className="text-xs font-bold text-blue-600 dark:text-blue-500">
                            +{formatCurrency(diferencia)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }}
          />
          <Legend 
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="circle"
          />
          <defs>
            <linearGradient id="fillAhorro" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={chartConfig["Solo Ahorro"].color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={chartConfig["Solo Ahorro"].color} stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="fillInvirtiendo" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={chartConfig.Invirtiendo.color} stopOpacity={0.4} />
              <stop offset="95%" stopColor={chartConfig.Invirtiendo.color} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="Solo Ahorro"
            stroke={chartConfig["Solo Ahorro"].color}
            fill="url(#fillAhorro)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="Invirtiendo"
            stroke={chartConfig.Invirtiendo.color}
            fill="url(#fillInvirtiendo)"
            strokeWidth={3}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
