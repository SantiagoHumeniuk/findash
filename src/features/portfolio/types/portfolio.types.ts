// src/features/portfolio/types/portfolio.types.ts

import { HoldingWithMetrics } from '../../../types/portfolio';

/**
 * Props para el componente PortfolioView
 */
export interface PortfolioViewProps {
  holdings: HoldingWithMetrics[];
  portfolioData: Record<string, any>;
  onDeleteAsset: (symbol: string) => void;
  onAddMore: (ticker: string, price: number) => void;
  onSell: (holding: HoldingWithMetrics) => void;
}

/**
 * Props para el componente AllocationChart
 */
export interface AllocationChartProps {
  data: AllocationData[];
  title: string;
  description?: string;
  type: 'sector' | 'country';
  isLoading?: boolean;
}

/**
 * Estructura de datos para gráficos de alocación
 */
export interface AllocationData {
  name: string;
  value: number;
  percentage: number;
  [key: string]: string | number;
}

/**
 * Props para los chart tooltips tipados
 */
export interface TooltipPayload<TValue = number, TName = string> {
  name?: TName;
  value?: TValue;
  payload?: Record<string, unknown>;
}
