// src/features/sectors-industries/components/performance-table.tsx

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { TrendingUp } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui/table';
import { formatPercentage, formatDate, getPercentageColor } from '../lib/format-utils';
import type { HistoricalIndustryPerformance, HistoricalSectorPerformance } from '../types';

/**
 * Props for the PerformanceTable component.
 */
interface PerformanceTableProps {
  /**
   * Historical performance data to display
   */
  data: HistoricalIndustryPerformance[] | HistoricalSectorPerformance[];
  
  /**
   * Title for the table
   */
  title: string;
  
  /**
   * Description text
   */
  description?: string;
  
  /**
   * Maximum number of rows to display
   */
  maxRows?: number;
}

/**
 * Displays performance data in a tabular format.
 * 
 * ../../..remarks
 * Shows the most recent data first with formatted dates and percentages.
 * Limits rows to maxRows (default: 10).
 * 
 * ../../..example
 * ```tsx
 * <PerformanceTable
 *   data={performanceData}
 *   title="Historial Reciente"
 *   description="Últimos 10 días"
 *   maxRows={10}
 * />
 * ```
 */
export const PerformanceTable: React.FC<PerformanceTableProps> = ({
  data,
  title,
  description,
  maxRows = 10
}) => {
  const displayData = React.useMemo(() => {
    return data.slice(0, maxRows);
  }, [data, maxRows]);

  if (data.length === 0) {
    return (
      <Card className="border-primary/20 bg-gradient-to-br from-card to-card/50">
        <CardHeader>
          <CardTitle className="text-xl">{title}</CardTitle>
          {description && <CardDescription className="text-base">{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
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
        <div className="rounded-lg border border-primary/20 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Índice</TableHead>
                <TableHead className="text-right">Variación semanal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayData.map((item, index) => (
                <TableRow key={`${item.date}-${index}`}>
                  <TableCell className="font-medium">
                    {formatDate(item.date)}
                  </TableCell>
                  <TableCell>{item.exchange}</TableCell>
                  <TableCell className={`text-right font-semibold ${getPercentageColor(item.averageChange)}`}>
                    {formatPercentage(item.averageChange)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {data.length > maxRows && (
          <p className="text-sm text-muted-foreground mt-2 text-center">
            Mostrando {maxRows} de {data.length} registros
          </p>
        )}
      </CardContent>
    </Card>
  );
};
