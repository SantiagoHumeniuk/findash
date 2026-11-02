// src/features/portfolio/components/analysis/real-returns-card.tsx

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/card';
import { formatPercent } from '../../../../lib/utils';
import { fetchMepHistory, fetchMonthlyInflation } from '../../../../services/macro-api';
import type { AssetData } from '../../../../types/dashboard';
import type { Holding, Transaction } from '../../../../types/portfolio';
import { calculateRealReturns } from '../../lib/real-returns';
import { getColorClass } from '../../lib/portfolio.utils';

interface RealReturnsCardProps {
  transactions: Transaction[];
  holdings: Holding[];
  portfolioData: Record<string, AssetData>;
}

function Result({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${getColorClass(value)}`}>{formatPercent(value)}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

/** Shows whether the portfolio beat the MEP dollar and Argentine inflation. */
export function RealReturnsCard({ transactions, holdings, portfolioData }: RealReturnsCardProps) {
  const { data: macro } = useQuery({
    queryKey: ['real-returns-macro'],
    staleTime: 6 * 60 * 60 * 1000,
    enabled: transactions.length > 0,
    queryFn: async () => {
      const [mep, inflation] = await Promise.all([fetchMepHistory(), fetchMonthlyInflation()]);
      return { mep, inflation };
    },
  });

  const view = useMemo(() => {
    if (!macro) return null;
    const isDollarAsset = (symbol: string) => portfolioData[symbol]?.profile?.currency === 'USD';
    const held = holdings.filter((holding) => holding.quantity > 0);
    const dollarHoldings = held.filter((holding) => isDollarAsset(holding.symbol));
    // Prices may still be loading; a partial total would report a false loss.
    if (dollarHoldings.some((holding) => !(portfolioData[holding.symbol]?.quote?.price > 0))) return null;
    const value = dollarHoldings.reduce(
      (total, holding) => total + holding.quantity * portfolioData[holding.symbol].quote.price,
      0,
    );
    const heldSymbols = new Set(held.map((holding) => holding.symbol));
    const closedAndUnknown = transactions.filter((t) => !heldSymbols.has(t.symbol) && !portfolioData[t.symbol]);
    const flows = transactions.filter((t) => isDollarAsset(t.symbol));
    const excluded = new Set([
      ...held.filter((holding) => !isDollarAsset(holding.symbol)).map((holding) => holding.symbol),
      ...closedAndUnknown.map((t) => t.symbol),
    ]);
    const result = calculateRealReturns(flows, value, macro.mep, macro.inflation);
    return result && { result, excluded: [...excluded] };
  }, [macro, holdings, transactions, portfolioData]);

  if (!view) return null;
  const { result, excluded } = view;
  const through = new Date(`${result.inflationThrough.slice(0, 10)}T00:00:00`)
    .toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Rendimiento real</CardTitle>
        <CardDescription>
          Tus compras y ventas, convertidas a pesos al dólar MEP de cada fecha. Inflación publicada hasta {through}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Result label="Contra el dólar" value={result.usdPct} hint="Tu resultado en dólares, sobre lo invertido." />
          <Result label="En pesos" value={result.arsPct} hint={`Quedarte en dólar MEP habría dado ${formatPercent(result.mepPct)}.`} />
          <Result label="Contra la inflación" value={result.realPct} hint={`La inflación desde tus compras fue ${formatPercent(result.inflationPct)}.`} />
        </div>
        {excluded.length > 0 && (
          <p className="text-xs text-muted-foreground">
            No incluye {excluded.join(', ')}: solo se comparan activos en dólares con datos disponibles.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
