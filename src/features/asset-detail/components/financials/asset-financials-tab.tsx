import { useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../components/ui/tabs';
import { FinancialAnalysisTable, MetricConfig } from './financial-analysis-table';
import type { AssetData } from '../../../../types/dashboard';
import {
  BarChart4,
  Calculator,
  TrendingUp,
  Scale,
  PieChart,
  ArrowUpRight,
  LineChart
} from 'lucide-react';

interface AssetFinancialsTabProps {
  asset: AssetData;
}

// --- 1. ESTIMACIONES (Analyst Estimates) ---
const ESTIMATES_METRICS: MetricConfig[] = [
  // Principales
  { key: 'revenueAvg', label: 'Ingresos (Estimado)', format: 'compact' },
  { key: 'ebitdaAvg', label: 'EBITDA (Estimado)', format: 'compact' },
  { key: 'ebitAvg', label: 'EBIT (Estimado)', format: 'compact' },
  { key: 'netIncomeAvg', label: 'Ingreso Neto (Estimado)', format: 'compact' },
  { key: 'epsAvg', label: 'EPS Promedio', format: 'currency' },

  // Rangos - Ingresos
  { key: 'revenueHigh', label: 'Ingresos (Max)', format: 'compact' },
  { key: 'revenueLow', label: 'Ingresos (Min)', format: 'compact' },

  // Rangos - EBITDA
  { key: 'ebitdaHigh', label: 'EBITDA (Max)', format: 'compact' },
  { key: 'ebitdaLow', label: 'EBITDA (Min)', format: 'compact' },

  // Rangos - EBIT
  { key: 'ebitHigh', label: 'EBIT (Max)', format: 'compact' },
  { key: 'ebitLow', label: 'EBIT (Min)', format: 'compact' },

  // Rangos - Net Income
  { key: 'netIncomeHigh', label: 'Ingreso Neto (Max)', format: 'compact' },
  { key: 'netIncomeLow', label: 'Ingreso Neto (Min)', format: 'compact' },

  // Rangos - EPS
  { key: 'epsHigh', label: 'EPS (Max)', format: 'currency' },
  { key: 'epsLow', label: 'EPS (Min)', format: 'currency' },

  // Detalles Operativos
  { key: 'sgaExpenseAvg', label: 'Gastos SG&A Est.', format: 'compact' },
  { key: 'sgaExpenseHigh', label: 'Gastos SG&A (Max)', format: 'compact' },
  { key: 'sgaExpenseLow', label: 'Gastos SG&A (Min)', format: 'compact' },

  // Cobertura
  { key: 'numAnalystsRevenue', label: 'N° Analistas (Ventas)', format: 'number' },
  { key: 'numAnalystsEps', label: 'N° Analistas (EPS)', format: 'number' },
];

// --- 2. VALORACIÓN (Key Metrics + Ratios) ---
const VALUATION_METRICS: MetricConfig[] = [
  // Múltiplos de Precio
  { key: 'marketCap', label: 'Market Cap', format: 'compact' },
  { key: 'enterpriseValue', label: 'Enterprise Value (EV)', format: 'compact' },
  { key: 'priceToEarningsRatio', label: 'P/E Ratio', format: 'number' },
  { key: 'priceToSalesRatio', label: 'P/S Ratio', format: 'number' },
  { key: 'priceToBookRatio', label: 'P/B Ratio', format: 'number' },
  { key: 'priceToFreeCashFlowRatio', label: 'P/FCF Ratio', format: 'number' },
  { key: 'priceToOperatingCashFlowRatio', label: 'P/OCF Ratio', format: 'number' },
  { key: 'priceToFairValue', label: 'Price to Fair Value', format: 'number' },

  // Múltiplos EV
  { key: 'evToEBITDA', label: 'EV / EBITDA', format: 'number' },
  { key: 'evToSales', label: 'EV / Ventas', format: 'number' },
  { key: 'evToOperatingCashFlow', label: 'EV / OCF', format: 'number' },
  { key: 'evToFreeCashFlow', label: 'EV / FCF', format: 'number' },
  { key: 'enterpriseValueMultiple', label: 'EV Multiple', format: 'number' },

  // Yields
  { key: 'earningsYield', label: 'Earnings Yield', format: 'percent' },
  { key: 'freeCashFlowYield', label: 'FCF Yield', format: 'percent' },

  // Graham & Valoración Teórica
  { key: 'grahamNumber', label: 'Graham Number', format: 'currency' },
  { key: 'grahamNetNet', label: 'Graham Net-Net', format: 'currency' },

  // Activos
  { key: 'tangibleAssetValue', label: 'Valor Activos Tangibles', format: 'compact' },
  { key: 'netCurrentAssetValue', label: 'Valor Activos Corrientes Netos', format: 'compact' },
  { key: 'investedCapital', label: 'Capital Invertido', format: 'compact' },
];

// --- 3. RENTABILIDAD & OPERACIÓN (Ratios) ---
const PROFITABILITY_METRICS: MetricConfig[] = [
  // Márgenes
  { key: 'grossProfitMargin', label: 'Margen Bruto', format: 'percent' },
  { key: 'operatingProfitMargin', label: 'Margen Operativo', format: 'percent' },
  { key: 'netProfitMargin', label: 'Margen Neto', format: 'percent' },
  { key: 'ebitdaMargin', label: 'Margen EBITDA', format: 'percent' },
  { key: 'ebitMargin', label: 'Margen EBIT', format: 'percent' },
  { key: 'pretaxProfitMargin', label: 'Margen Antes de Impuestos', format: 'percent' },
  { key: 'continuousOperationsProfitMargin', label: 'Margen Ops. Continuas', format: 'percent' },
  { key: 'effectiveTaxRate', label: 'Tasa Impositiva Efectiva', format: 'percent' },

  // Retornos
  { key: 'returnOnEquity', label: 'ROE', format: 'percent' },
  { key: 'returnOnAssets', label: 'ROA', format: 'percent' },
  { key: 'returnOnInvestedCapital', label: 'ROIC', format: 'percent' },
  { key: 'returnOnCapitalEmployed', label: 'ROCE', format: 'percent' },
  { key: 'returnOnTangibleAssets', label: 'Retorno s/ Activos Tangibles', format: 'percent' },

  // Eficiencia / Rotación
  { key: 'assetTurnover', label: 'Rotación de Activos', format: 'number' },
  { key: 'fixedAssetTurnover', label: 'Rotación Activos Fijos', format: 'number' },
  { key: 'inventoryTurnover', label: 'Rotación Inventario', format: 'number' },
  { key: 'receivablesTurnover', label: 'Rotación Cuentas por Cobrar', format: 'number' },
  { key: 'payablesTurnover', label: 'Rotación Cuentas por Pagar', format: 'number' },
  { key: 'operatingCycle', label: 'Ciclo Operativo (Días)', format: 'number' },
  { key: 'cashConversionCycle', label: 'Ciclo Conversión Efectivo', format: 'number' },
];

// --- 4. SALUD FINANCIERA (Balance Sheet Ratios) ---
const HEALTH_METRICS: MetricConfig[] = [
  // Liquidez
  { key: 'currentRatio', label: 'Ratio Corriente', format: 'number' },
  { key: 'quickRatio', label: 'Ratio Ácido', format: 'number' },
  { key: 'cashRatio', label: 'Ratio de Caja', format: 'number' },
  { key: 'workingCapitalTurnoverRatio', label: 'Rotación Capital Trabajo', format: 'number' },

  // Solvencia y Deuda
  { key: 'debtToEquityRatio', label: 'Deuda / Equity', format: 'number' },
  { key: 'debtToAssetsRatio', label: 'Deuda / Activos', format: 'number' },
  { key: 'debtToCapitalRatio', label: 'Deuda / Capital', format: 'number' },
  { key: 'longTermDebtToCapitalRatio', label: 'Deuda LP / Capital', format: 'number' },
  { key: 'debtToMarketCap', label: 'Deuda / Market Cap', format: 'number' },
  { key: 'netDebtToEBITDA', label: 'Deuda Neta / EBITDA', format: 'number' },
  { key: 'financialLeverageRatio', label: 'Apalancamiento Fin.', format: 'number' },
  { key: 'solvencyRatio', label: 'Ratio Solvencia', format: 'number' },

  // Cobertura
  { key: 'interestCoverageRatio', label: 'Cobertura Intereses', format: 'number' },
  { key: 'debtServiceCoverageRatio', label: 'Cobertura Servicio Deuda', format: 'number' },
  { key: 'operatingCashFlowCoverageRatio', label: 'Cobertura OCF', format: 'number' },
  { key: 'capitalExpenditureCoverageRatio', label: 'Cobertura Capex', format: 'number' },
  { key: 'dividendPaidAndCapexCoverageRatio', label: 'Cobertura Div + Capex', format: 'number' }
];

// --- 5. FLUJO DE CAJA & DIVIDENDOS ---
const CASHFLOW_METRICS: MetricConfig[] = [
  // Por Acción
  { key: 'operatingCashFlowPerShare', label: 'Op. Cash Flow / Acción', format: 'currency' },
  { key: 'freeCashFlowPerShare', label: 'Free Cash Flow / Acción', format: 'currency' },
  { key: 'cashPerShare', label: 'Caja por Acción', format: 'currency' },
  { key: 'capexPerShare', label: 'Capex por Acción', format: 'currency' },
  { key: 'revenuePerShare', label: 'Ventas por Acción', format: 'currency' },
  { key: 'netIncomePerShare', label: 'Beneficio por Acción', format: 'currency' },
  { key: 'bookValuePerShare', label: 'Valor Libro por Acción', format: 'currency' },
  { key: 'tangibleBookValuePerShare', label: 'Valor Libro Tang. / Acción', format: 'currency' },
  { key: 'shareholdersEquityPerShare', label: 'Patrimonio / Acción', format: 'currency' },
  { key: 'interestDebtPerShare', label: 'Interés Deuda / Acción', format: 'currency' },

  // Dividendos
  { key: 'dividendYieldPercentage', label: 'Dividend Yield', format: 'percent' },
  { key: 'dividendPerShare', label: 'Dividendo por Acción', format: 'currency' },
  { key: 'dividendPayoutRatio', label: 'Dividend Payout Ratio', format: 'percent' },

  // Ratios de Flujo
  { key: 'operatingCashFlowSalesRatio', label: 'OCF / Ventas', format: 'percent' },
  { key: 'freeCashFlowOperatingCashFlowRatio', label: 'FCF / OCF', format: 'percent' },
];

// --- 6. DCF PROJECTION ---
const DCF_METRICS: MetricConfig[] = [
  // Proyecciones Principales
  { key: 'revenue', label: 'Ingresos Proyectados', format: 'compact' },
  { key: 'ebitda', label: 'EBITDA Proyectado', format: 'compact' },
  { key: 'ebit', label: 'EBIT Proyectado', format: 'compact' },
  // { key: 'netIncome', label: 'Net Income Proyectado', format: 'compact' }, // No disponible en la fuente

  // Flujo de Caja
  { key: 'depreciation', label: 'Depreciación', format: 'compact' },
  { key: 'capitalExpenditure', label: 'Capex Proyectado', format: 'compact' },
  { key: 'ufcf', label: 'Unlevered FCF', format: 'compact' },
  { key: 'freeCashFlowT1', label: 'FCF T+1', format: 'compact' },

  // Balance Proyectado
  { key: 'totalCash', label: 'Caja Total', format: 'compact' },
  { key: 'receivables', label: 'Cuentas por Cobrar', format: 'compact' },
  { key: 'inventories', label: 'Inventarios', format: 'compact' },
  { key: 'payable', label: 'Cuentas por Pagar', format: 'compact' },

  // Deuda y Capital
  { key: 'totalDebt', label: 'Deuda Total', format: 'compact' },
  { key: 'netDebt', label: 'Deuda Neta', format: 'compact' },
  { key: 'totalEquity', label: 'Patrimonio Total', format: 'compact' },
  { key: 'totalCapital', label: 'Capital Total', format: 'compact' },

  // Valoración DCF
  { key: 'enterpriseValue', label: 'Enterprise Value DCF', format: 'compact' },
  { key: 'equityValue', label: 'Equity Value DCF', format: 'compact' },
  { key: 'equityValuePerShare', label: 'Valor Teórico DCF (Crudo)', format: 'currency' },
  { key: 'price', label: 'Precio en Modelo', format: 'currency' },

  // Parámetros del Modelo
  { key: 'wacc', label: 'WACC (%)', format: 'number' },
  { key: 'costOfEquity', label: 'Costo del Equity (%)', format: 'number' },
  { key: 'costofDebt', label: 'Costo de la Deuda (%)', format: 'number' },
  { key: 'afterTaxCostOfDebt', label: 'Costo Deuda (After-Tax)', format: 'number' },
  { key: 'riskFreeRate', label: 'Tasa Libre de Riesgo', format: 'number' },
  { key: 'marketRiskPremium', label: 'Prima de Riesgo', format: 'number' },
  { key: 'beta', label: 'Beta', format: 'number' },
  { key: 'taxRate', label: 'Tasa Impositiva (%)', format: 'number' },
  { key: 'longTermGrowthRate', label: 'Tasa Crecimiento LP', format: 'number' },
  { key: 'dilutedSharesOutstanding', label: 'Acciones Diluidas', format: 'compact' },
];

export function AssetFinancialsTab({ asset }: AssetFinancialsTabProps) {

  // Disponibilidad de datos
  const hasEstimates = asset.analystEstimates && asset.analystEstimates.length > 0;
  const hasKeyMetrics = asset.keyMetricsYearly && asset.keyMetricsYearly.length > 0;
  const hasRatios = asset.ratios && asset.ratios.length > 0;
  const hasDCF = asset.dcf && asset.dcf.length > 0;

  // MERGE DE DATOS: Combinar keyMetricsYearly y ratios para tener todos los campos disponibles
  // Esto resuelve el problema de métricas faltantes cuando están en el dataset "equivocado"
  const mergedFinancials = useMemo(() => {
    if (!hasKeyMetrics && !hasRatios) return [];

    // Si falta alguno, devolver el que existe
    if (!hasKeyMetrics) return asset.ratios || [];
    if (!hasRatios) return asset.keyMetricsYearly || [];

    // Estrategia: Iterar sobre keyMetrics (base anual) y buscar el ratio correspondiente al mismo año
    return asset.keyMetricsYearly.map(metric => {
      // Extraer el año del date string "YYYY-MM-DD" o usar fiscalYear "YYYY"
      const metricDate = new Date(metric.date);
      const metricYear = metricDate.getFullYear();

      // Intentar encontrar el ratio del mismo año
      const match = asset.ratios.find(r => {
        const rDate = new Date(r.date);
        return rDate.getFullYear() === metricYear;
      });

      // Retornar un objeto unificado con prioridad a Ratios (suelen ser más específicos) o KeyMetrics
      // Spread operator: primero metric, luego match sobrescribe si hay colisión (aunque suelen ser disjuntos)
      return {
        ...metric,
        ...(match ?? {})
      };
    });
  }, [asset.keyMetricsYearly, asset.ratios, hasKeyMetrics, hasRatios]);


  return (
    <Tabs defaultValue={hasEstimates ? "estimates" : "valuation"} className="w-full space-y-6">

      {/* Scroll horizontal para tabs en móvil */}
      <div className="overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
        <TabsList className="w-full sm:w-auto inline-flex justify-start h-10 p-1">
          {hasEstimates && (
            <TabsTrigger value="estimates" className="gap-2 px-3">
              <LineChart className="w-4 h-4" />
              Estimaciones
            </TabsTrigger>
          )}
          <TabsTrigger value="valuation" className="gap-2 px-3">
            <Scale className="w-4 h-4" />
            Valoración
          </TabsTrigger>
          <TabsTrigger value="profitability" className="gap-2 px-3">
            <TrendingUp className="w-4 h-4" />
            Rentabilidad
          </TabsTrigger>
          <TabsTrigger value="health" className="gap-2 px-3">
            <BarChart4 className="w-4 h-4" />
            Salud Fin.
          </TabsTrigger>
          <TabsTrigger value="cashflow" className="gap-2 px-3">
            <PieChart className="w-4 h-4" />
            Dividendos/Caja
          </TabsTrigger>
          {hasDCF && (
            <TabsTrigger value="dcf" className="gap-2 px-3">
              <Calculator className="w-4 h-4" />
              Modelo DCF
            </TabsTrigger>
          )}
        </TabsList>
      </div>

      {/* --- CONTENIDO DE TABS --- */}

      {hasEstimates && (
        <TabsContent value="estimates" className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
          <div className="bg-primary/5 p-4 rounded-lg border border-primary/10 mb-4">
            <h3 className="font-semibold flex items-center gap-2 mb-1">
              <ArrowUpRight className="w-4 h-4 text-primary" />
              Proyecciones de Analistas
            </h3>
            <p className="text-sm text-muted-foreground">
              Consenso de mercado sobre el desempeño futuro de la compañía para los próximos años.
            </p>
          </div>
          <FinancialAnalysisTable
            data={asset.analystEstimates}
            availableMetrics={ESTIMATES_METRICS}
            defaultMetrics={['revenueAvg', 'ebitdaAvg', 'epsAvg', 'netIncomeAvg']}
            dateKey="date"
          />
        </TabsContent>
      )}

      <TabsContent value="valuation" className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
        <div className="text-sm text-muted-foreground mb-2">
          Análisis de múltiplos históricos para determinar si la acción está cara o barata.
        </div>
        {/* Usamos mergedFinancials para tener acceso a TODOS los datos */}
        <FinancialAnalysisTable
          data={mergedFinancials}
          availableMetrics={VALUATION_METRICS}
          defaultMetrics={['marketCap', 'enterpriseValue', 'evToEBITDA', 'earningsYield']}
          dateKey="date"
        />
      </TabsContent>

      <TabsContent value="profitability" className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
        <div className="text-sm text-muted-foreground mb-2">
          Márgenes y retornos sobre capital para evaluar la eficiencia del negocio.
        </div>
        <FinancialAnalysisTable
          data={mergedFinancials}
          availableMetrics={PROFITABILITY_METRICS}
          defaultMetrics={['grossProfitMargin', 'operatingProfitMargin', 'returnOnEquity', 'returnOnInvestedCapital']}
          dateKey="date"
        />
      </TabsContent>

      <TabsContent value="health" className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
        <div className="text-sm text-muted-foreground mb-2">
          Balance general, apalancamiento y capacidad de pago de deuda.
        </div>
        <FinancialAnalysisTable
          data={mergedFinancials}
          availableMetrics={HEALTH_METRICS}
          defaultMetrics={['currentRatio', 'debtToEquityRatio', 'netDebtToEBITDA', 'interestCoverageRatio']}
          dateKey="date"
        />
      </TabsContent>

      <TabsContent value="cashflow" className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
        <div className="text-sm text-muted-foreground mb-2">
          Generación de caja por acción y política de retribución al accionista.
        </div>
        <FinancialAnalysisTable
          data={mergedFinancials}
          availableMetrics={CASHFLOW_METRICS}
          defaultMetrics={['freeCashFlowPerShare', 'dividendPerShare', 'dividendYieldPercentage', 'payoutRatio']}
          dateKey="date"
        />
      </TabsContent>

      {hasDCF && (
        <TabsContent value="dcf" className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
          <div className="bg-primary/5 p-4 rounded-lg border border-primary/10 mb-4">
            <h3 className="font-semibold flex items-center gap-2 mb-1">
              <Calculator className="w-4 h-4 text-primary" />
              Modelo de Flujo de Caja Descontado (DCF)
            </h3>
            <p className="text-sm text-muted-foreground">
              Proyecciones detalladas utilizadas para calcular el valor intrínseco.
            </p>
          </div>
          <FinancialAnalysisTable
            data={asset.dcf}
            availableMetrics={DCF_METRICS}
            defaultMetrics={['revenue', 'ebitda', 'ufcf', 'equityValuePerShare']}
            dateKey="year" // DCF suele usar 'year' string
          />
        </TabsContent>
      )}
    </Tabs>
  );
}