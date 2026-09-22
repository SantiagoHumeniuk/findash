// src/features/portfolio/pages/portfolio-page.tsx

import { useState, useMemo, useCallback } from 'react';
import { usePortfolio } from '../../../hooks/use-portfolio';
import { usePortfolioHistory } from '../hooks/use-portfolio-history';
import { motion } from 'framer-motion';
import { LayoutDashboard, FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '../../../components/ui/theme-provider';
import { exportPortfolioToPdf } from '../../../utils/export-pdf';
import { Button } from '../../../components/ui/button';
import { usePlanFeature } from '../../../hooks/use-plan-feature';
import { UpgradeModal } from '../../../components/shared/upgrade-modal';
import { HoldingWithMetrics, AddModalInfo } from '../../../types/portfolio';
import {
  PortfolioStats,
  PortfolioCharts,
  PortfolioView,
  TransactionHistory,
  AddTransactionModal,
  SellTransactionModal,
  PortfolioSkeleton,
  PortfolioSelector,
} from '../components';
import { ErrorBoundary } from '../../../components/error-boundary';

import { PerformanceBenchmarks } from '../components/analysis/performance-benchmarks';

function PortfolioPageContent() {
  const { holdings, transactions, totalPerformance, loading, deleteAsset, portfolioData, portfolios, currentPortfolio } = usePortfolio();
  const { metrics: historicalMetrics, portfolioHistory } = usePortfolioHistory(holdings);

  const { theme } = useTheme();
  const { hasAccess: canExportPdf, requiredPlan } = usePlanFeature('exportPdf');

  const [addModalInfo, setAddModalInfo] = useState<AddModalInfo>({ isOpen: false, ticker: null, price: null });
  const [sellModalHolding, setSellModalHolding] = useState<HoldingWithMetrics | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const handleOpenAddModal = useCallback((ticker: string, price: number) => {
    setAddModalInfo({ isOpen: true, ticker, price });
  }, []);

  const handleOpenSellModal = useCallback((holding: HoldingWithMetrics) => {
    setSellModalHolding(holding);
  }, []);

  const handleDeleteAsset = useCallback(async (symbol: string) => {
    try {
      await deleteAsset(symbol);
      toast.success(`Activo ${symbol} eliminado correctamente.`);
    } catch {
      toast.error('Error al eliminar el activo.');
    }
  }, [deleteAsset]);

  const holdingsWithMetrics = useMemo(() => {
    if (loading || !holdings) return [];
    return holdings.map((h) => {
      const currentPrice = portfolioData[h.symbol]?.quote?.price ?? 0;
      const marketValue = h.quantity * currentPrice;
      const pl = marketValue - h.totalCost;
      const plPercent = h.totalCost > 0 ? (pl / h.totalCost) * 100 : 0;

      // Calcular días de tenencia
      const firstPurchase = transactions
        .filter(t => t.symbol === h.symbol && t.transaction_type === 'buy')
        .sort((a, b) => new Date(a.purchase_date).getTime() - new Date(b.purchase_date).getTime())[0];

      const firstDate = firstPurchase ? new Date(firstPurchase.purchase_date) : new Date();
      const holdingDays = Math.floor((Date.now() - firstDate.getTime()) / (1000 * 60 * 60 * 24));

      return { ...h, currentPrice, marketValue, pl, plPercent, holdingDays };
    });
  }, [holdings, portfolioData, loading, transactions]);

  const avgHoldingDays = useMemo(() => {
    if (holdingsWithMetrics.length === 0) return 0;
    return holdingsWithMetrics.reduce((sum, h) => sum + h.holdingDays, 0) / holdingsWithMetrics.length;
  }, [holdingsWithMetrics]);

  const handleExportPdf = async () => {
    if (!canExportPdf) return setShowUpgradeModal(true);
    if (holdingsWithMetrics.length === 0) return toast.error('No hay posiciones para exportar.');

    setExportingPdf(true);
    try {
      const totalInvestment = holdings.reduce((sum, h) => sum + h.totalCost, 0);
      const currentValue = holdingsWithMetrics.reduce((sum, h) => sum + h.marketValue, 0);
      const totalQuantity = holdings.reduce((sum, h) => sum + h.quantity, 0);

      await exportPortfolioToPdf({
        holdings: holdingsWithMetrics.map(h => ({
          symbol: h.symbol,
          name: portfolioData[h.symbol]?.profile?.companyName ?? h.symbol,
          quantity: h.quantity,
          averagePrice: h.avgPurchasePrice,
          currentPrice: h.currentPrice,
          totalCost: h.totalCost,
          currentValue: h.marketValue,
          gainLoss: h.pl,
          gainLossPercentage: h.plPercent,
        })),
        stats: {
          totalInvestment,
          currentValue,
          totalGainLoss: totalPerformance.pl,
          totalGainLossPercentage: totalPerformance.percent,
          averageBuyPrice: totalQuantity > 0 ? totalInvestment / totalQuantity : 0,
        },
        theme,
        portfolioName: 'Mi Portafolio',
      });
      toast.success('Portafolio exportado correctamente.');
    } catch (error) {
      console.error('Error durante la exportación a PDF:', error);
      toast.error(`Error al exportar el PDF: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setExportingPdf(false);
    }
  };

  if (loading) return <PortfolioSkeleton />;

  return (
    <>
      <motion.div
        id="portfolio-export-area"
        className="container-wide stack-8 relative bg-background" // Added bg-background just in case html2canvas needs a solid base
        initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ type: "spring", stiffness: 300, damping: 24, mass: 0.8 }}
      >
        <div className="flex items-center justify-between gap-4 pb-6 border-b flex-wrap">
          <div className="flex items-center gap-4">
            <div className="p-2 sm:p-3 bg-gradient-to-br from-primary/15 to-cyan-500/10 rounded-xl shadow-md border border-primary/10">
              <LayoutDashboard className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-gradient-animated pb-1">Mi Portafolio</h1>
              <p className="text-muted-foreground text-sm font-medium mt-1">Análisis avanzado de inversiones y gestión de activos.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <PortfolioSelector />
            <Button 
                onClick={() => void handleExportPdf()} 
                disabled={exportingPdf || holdingsWithMetrics.length === 0} 
                variant="outline" 
                className="gap-2 shadow-premium hover:shadow-none transition-all"
            >
              <FileDown className="h-4 w-4" />
              {exportingPdf ? 'Exportando...' : 'Exportar Informe'}
            </Button>
          </div>
        </div>

        <PortfolioStats
          holdings={holdings}
          totalPerformance={totalPerformance}
          portfolioData={portfolioData}
          avgHoldingDays={avgHoldingDays}
          historicalMetrics={historicalMetrics}
        />

        <div className="grid grid-cols-1 gap-6">
            <PortfolioCharts 
              holdings={holdings} 
              portfolioHistory={portfolioHistory} 
              portfolioData={portfolioData} 
              portfolioReturn={totalPerformance.percent}
              portfolios={portfolios}
              currentPortfolio={currentPortfolio}
            />
        </div>

        <PortfolioView
          holdings={holdingsWithMetrics}
          portfolioData={portfolioData}
          onDeleteAsset={(symbol: string) => void handleDeleteAsset(symbol)}
          onAddMore={handleOpenAddModal}
          onSell={handleOpenSellModal}
        />
        
        <TransactionHistory transactions={transactions} />
      </motion.div>

      <AddTransactionModal
        isOpen={addModalInfo.isOpen}
        onClose={() => setAddModalInfo({ isOpen: false, ticker: null, price: null })}
        ticker={addModalInfo.ticker}
        currentPrice={addModalInfo.price}
      />
      <SellTransactionModal
        isOpen={!!sellModalHolding}
        onClose={() => setSellModalHolding(null)}
        holding={sellModalHolding}
      />
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        featureName="Exportar Portfolio a PDF"
        requiredPlan={requiredPlan}
      />
    </>
  );
}

export default function PortfolioPage() {
  return (
    <ErrorBoundary level="feature" featureName="Portfolio">
      <PortfolioPageContent />
    </ErrorBoundary>
  );
}