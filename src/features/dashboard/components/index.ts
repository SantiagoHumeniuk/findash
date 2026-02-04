// src/features/dashboard/components/index.ts

// Empty state
export { EmptyDashboard } from './empty-state/empty-dashboard';

// Skeleton
export { DashboardSkeleton } from './skeleton/dashboard-skeleton';

// Ticker input
export { TickerAddForm } from './ticker-input/ticker-add-form';
export { SelectedTickersList } from './ticker-input/selected-tickers-list';
export { TickerBadge } from './ticker-input/ticker-badge';

// Tabs
export { DashboardTabs } from './tabs/dashboard-tabs';

// Analysis components
export { PriceAnalysisTable } from './analysis/price-analysis-table';
export { FundamentalsTable } from './analysis/fundamentals-table';
export { CorrelationMatrix } from './analysis/correlation-matrix';
export { RadarComparison } from './analysis/radar-comparison';
export { default as SummaryAnalysis } from './analysis/summary-analysis';

// Charts
export { HistoricalPerformanceChart } from './charts/historical-performance-chart';

// Onboarding
export { DashboardGuide } from './onboarding/dashboard-guide';
