// src/features/asset-detail/components/fundamentals/asset-fundamentals-trends.tsx

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/card';
import { AssetData } from '../../../../types/dashboard';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  LabelList
} from 'recharts';
import { formatCurrency } from '../../../../utils/formatters';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../components/ui/select';

interface AssetFundamentalsTrendsProps {
  asset: AssetData;
}

type MetricType = 'revenuePerShare' | 'netIncomePerShare' | 'freeCashFlowPerShare';

const METRIC_CONFIG = {
  revenuePerShare: {
    label: 'Ingresos por Acción (Revenue p/s)',
    color: 'hsl(var(--primary))',
    gradient: ['#3b82f6', '#1d4ed8']
  },
  netIncomePerShare: {
    label: 'Beneficio por Acción (EPS)',
    color: 'hsl(var(--accent))',
    gradient: ['#10b981', '#047857']
  },
  freeCashFlowPerShare: {
    label: 'FCF por Acción',
    color: 'hsl(var(--chart-3))',
    gradient: ['#8b5cf6', '#6d28d9']
  }
};

export function AssetFundamentalsTrends({ asset }: AssetFundamentalsTrendsProps) {
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('revenuePerShare');

  const chartData = useMemo(() => {
    // Usamos ratios que contiene datos históricos REALES por acción
    if (!asset.ratios || asset.ratios.length === 0) return [];
    
    // Tomamos los datos y los ordenamos cronológicamente (de más antiguo a más reciente)
    return [...asset.ratios]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(item => ({
        year: new Date(item.date).getFullYear().toString(),
        revenuePerShare: item.revenuePerShare,
        netIncomePerShare: item.netIncomePerShare,
        freeCashFlowPerShare: item.freeCashFlowPerShare
      }));
  }, [asset]);

  if (chartData.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          No hay datos históricos disponibles para este activo.
        </CardContent>
      </Card>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const value = payload[0].value;
      const isNegative = value < 0;
      return (
        <div className="bg-popover/95 backdrop-blur-md border border-border p-3 rounded-xl shadow-xl text-popover-foreground">
          <p className="font-semibold mb-1">{label}</p>
          <p className="text-sm">
            <span className="text-muted-foreground mr-2">{METRIC_CONFIG[selectedMetric].label}:</span>
            <span className={`font-bold ${isNegative ? 'text-red-500' : 'text-emerald-500'}`}>
              {formatCurrency(value)}
            </span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-2xl font-bold tracking-tight">Evolución Fundamental</h3>
          <p className="text-sm text-muted-foreground">
            Análisis histórico real del rendimiento de la empresa (Valores por Acción)
          </p>
        </div>
        <Select value={selectedMetric} onValueChange={(value) => setSelectedMetric(value as MetricType)}>
          <SelectTrigger className="w-[240px] bg-background/50 backdrop-blur-sm font-medium">
            <SelectValue placeholder="Seleccionar Métrica" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="revenuePerShare">Ingresos por Acción</SelectItem>
            <SelectItem value="netIncomePerShare">Beneficio por Acción (EPS)</SelectItem>
            <SelectItem value="freeCashFlowPerShare">Flujo de Caja Libre por Acción</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="bg-card/40 backdrop-blur-sm border-white/5 overflow-hidden shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full shadow-sm" 
              style={{ background: `linear-gradient(to bottom, ${METRIC_CONFIG[selectedMetric].gradient[0]}, ${METRIC_CONFIG[selectedMetric].gradient[1]})` }} 
            />
            {METRIC_CONFIG[selectedMetric].label}
          </CardTitle>
          <CardDescription>Evolución histórica real en {asset.profile.currency || 'USD'}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 30, right: 30, left: 20, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={METRIC_CONFIG[selectedMetric].gradient[0]} stopOpacity={0.95}/>
                    <stop offset="100%" stopColor={METRIC_CONFIG[selectedMetric].gradient[1]} stopOpacity={0.75}/>
                  </linearGradient>
                  <linearGradient id="colorMetricNegative" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.95}/>
                    <stop offset="100%" stopColor="#991b1b" stopOpacity={0.75}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis 
                  dataKey="year" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'hsl(var(--foreground))', fontSize: 13, fontWeight: 500 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  tickFormatter={(val) => {
                    if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(1)}k`;
                    return val.toFixed(1);
                  }}
                  dx={-10}
                />
                <Tooltip 
                  content={<CustomTooltip />} 
                  cursor={{ fill: 'hsl(var(--muted))', opacity: 0.15 }}
                />
                <Bar 
                  dataKey={selectedMetric} 
                  radius={[6, 6, 6, 6]}
                  animationDuration={1500}
                  maxBarSize={60}
                >
                  <LabelList 
                    dataKey={selectedMetric} 
                    position="top" 
                    formatter={(val: number) => val.toFixed(2)}
                    style={{ fill: 'hsl(var(--foreground))', fontSize: 12, fontWeight: 600, textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
                  />
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry[selectedMetric] < 0 ? 'url(#colorMetricNegative)' : 'url(#colorMetric)'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
