// src/features/dividends/types/dividends.types.ts

import { DateRange } from "react-day-picker";
import { Table as TanstackTable } from "@tanstack/react-table";

/**
 * Representa un dividendo individual del calendario
 */
export interface Dividend {
  symbol: string;
  date: string;
  recordDate: string;
  paymentDate: string;
  declarationDate: string;
  adjDividend: number | null;
  dividend: number | null;
  yield: number | null;
  frequency: string;
}

/**
 * Props para el componente DataTable
 */
export interface DataTableProps<TData> {
  table: TanstackTable<TData>;
  totalPages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
}

/**
 * Props para el componente de filtros
 */
export interface DividendsFiltersProps {
  symbolFilter: string;
  onSymbolFilterChange: (value: string) => void;
  paymentDateRange: DateRange | undefined;
  onPaymentDateRangeChange: (range: DateRange | undefined) => void;
  frequencyFilter: string;
  onFrequencyFilterChange: (value: string) => void;
  frequencyOptions: string[];
  activeFiltersCount: number;
  onClearAllFilters: () => void;
}

/**
 * Estructura de datos en asset_data_cache
 */
export interface AssetDataCacheRow {
  data?: unknown;
  last_updated_at: string;
}
