// src/features/screener/pages/cedears-page.tsx

import { usePageMeta } from '../../../hooks/use-page-meta';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowLeftRight, Info, Loader2 } from 'lucide-react';
import { AssetLogo } from '../../../components/ui/asset-logo';
import { Badge } from '../../../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { PageHeader } from '../../../components/ui/page-header';
import { useAssetLogos } from '../../../hooks/use-asset-logos';
import { useCclRate } from '../../../hooks/use-ccl-rate';
import { useCedearRatios } from '../../../hooks/use-cedear-ratios';
import { supabase } from '../../../lib/supabase';
import { fetchYahooMarketQuotes } from '../../../services/api/yahoo-finance-api';
import { buildCedearRows, type CedearMarketQuote, withPremiums } from '../lib/cedears';

/** Quotes come in batches of 20, so only the most traded CEDEARs get a US comparison. */
const COMPARED_CEDEARS = 40;

async function fetchCedearQuotes(): Promise<CedearMarketQuote[]> {
  const { data, error } = await supabase.functions.invoke<{ cedears?: Record<string, unknown>[] }>(
    'data912-fixed-income-proxy',
    { body: { market: 'cedears' } },
  );
  if (error || !Array.isArray(data?.cedears)) throw new Error('No se pudieron cargar las cotizaciones de CEDEARs.');
  const toNumber = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
  return data.cedears.flatMap((item) => (typeof item.symbol === 'string'
    ? [{
      symbol: item.symbol,
      bid: toNumber(item.px_bid),
      ask: toNumber(item.px_ask),
      last: toNumber(item.c),
      volume: toNumber(item.v),
      changePercent: toNumber(item.pct_change),
    }]
    : []));
}

function formatNumber(value: number | null, digits = 2): string {
  if (value === null) return '—';
  return value.toLocaleString('es-AR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function PremiumBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  const label = `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
  if (Math.abs(value) < 1) return <Badge variant="outline">{label}</Badge>;
  return (
    <Badge variant="outline" className={value < 0 ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400' : 'border-rose-500/40 text-rose-700 dark:text-rose-400'}>
      {label}
    </Badge>
  );
}

/**
 * Compares each CEDEAR with its share in the US at the CCL dollar, and shows the
 * CCL implied by its peso and dollar lines.
 */
export default function CedearsPage() {
  usePageMeta('CEDEARs: ratios, CCL implícito y prima', 'Compará cada CEDEAR con su acción en EE. UU.: ratio, MEP y CCL implícito, y si está caro o barato.');
  const [search, setSearch] = useState('');
  const { ratios, loading: ratiosLoading } = useCedearRatios();
  const ccl = useCclRate();
  const market = useQuery({
    queryKey: ['cedear-quotes'],
    queryFn: fetchCedearQuotes,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const rows = useMemo(() => buildCedearRows(market.data ?? [], ratios), [market.data, ratios]);
  const comparedSymbols = useMemo(() => rows.slice(0, COMPARED_CEDEARS).map((row) => row.usSymbol), [rows]);
  const usQuotes = useQuery({
    queryKey: ['cedear-us-quotes', comparedSymbols],
    enabled: comparedSymbols.length > 0,
    staleTime: 60_000,
    refetchInterval: 2 * 60_000,
    queryFn: async () => {
      const prices = new Map<string, number>();
      for (let index = 0; index < comparedSymbols.length; index += 20) {
        const { quotes } = await fetchYahooMarketQuotes(comparedSymbols.slice(index, index + 20));
        for (const quote of quotes) {
          if (quote.price.value) prices.set(quote.symbol, quote.price.value);
        }
      }
      return prices;
    },
  });

  const compared = useMemo(
    () => withPremiums(rows, usQuotes.data ?? new Map<string, number>(), ccl.data?.rate ?? null),
    [rows, usQuotes.data, ccl.data?.rate],
  );
  const filtered = useMemo(() => {
    const term = search.trim().toUpperCase();
    return (term ? compared.filter((row) => row.symbol.includes(term)) : compared).slice(0, 60);
  }, [compared, search]);
  const logos = useAssetLogos(filtered.map((row) => row.usSymbol).slice(0, 50));
  const isLoading = market.isLoading || ratiosLoading;

  return (
    <div className="container-wide stack-6">
      <PageHeader
        icon={<ArrowLeftRight className="w-8 h-8 text-primary" />}
        title="CEDEARs"
        description="Mirá si un CEDEAR está caro o barato frente a su acción en EE. UU., al dólar CCL."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Dólar CCL de referencia</p>
          <p className="text-xl font-semibold tabular-nums">{ccl.data ? `$ ${formatNumber(ccl.data.rate)}` : '—'}</p>
        </Card>
        <Card className="p-4 sm:col-span-2">
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <b>Prima negativa:</b> el CEDEAR cotiza más barato que su acción; <b>positiva:</b> más caro. Fuera del horario
              de ambos mercados la comparación puede no ser representativa. Es información, no una recomendación.
            </span>
          </p>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 pb-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Más operados</CardTitle>
            <CardDescription>La prima se calcula para los {COMPARED_CEDEARS} de mayor volumen. Queda en blanco si la diferencia supera el 15%, porque suele indicar un dato o ratio incorrecto.</CardDescription>
          </div>
          <Input
            aria-label="Buscar CEDEAR"
            placeholder="Buscar ticker…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="sm:w-48"
          />
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div> : market.isError ? (
            <p className="p-4 text-sm text-destructive">{market.error.message}</p>
          ) : (
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b text-right text-xs text-muted-foreground">
                  <th className="py-2 pr-3 text-left font-medium">CEDEAR</th>
                  <th className="px-3 py-2 font-medium">Ratio</th>
                  <th className="px-3 py-2 font-medium">Precio ARS</th>
                  <th className="px-3 py-2 font-medium">Var. día</th>
                  <th className="px-3 py-2 font-medium">Precio USD</th>
                  <th className="px-3 py-2 font-medium">MEP implícito</th>
                  <th className="px-3 py-2 font-medium">Valor según EE. UU.</th>
                  <th className="px-3 py-2 font-medium">CCL implícito</th>
                  <th className="py-2 pl-3 font-medium">Prima</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.symbol} className="border-b text-right tabular-nums last:border-0">
                    <td className="py-2 pr-3 text-left">
                      <Link to={`/asset/${row.usSymbol}`} className="flex items-center gap-2 font-semibold hover:underline">
                        <AssetLogo symbol={row.usSymbol} src={logos[row.usSymbol.toUpperCase()]} lookup={false} className="size-6 text-[0.55rem]" />
                        {row.symbol}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{row.ratio}:1</td>
                    <td className="px-3 py-2">{formatNumber(row.priceArs)}</td>
                    <td className={`px-3 py-2 ${row.changePercent >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {row.changePercent > 0 ? '+' : ''}{row.changePercent.toFixed(2)}%
                    </td>
                    <td className="px-3 py-2">{formatNumber(row.priceUsd)}</td>
                    <td className="px-3 py-2">{formatNumber(row.impliedMep)}</td>
                    <td className="px-3 py-2">{formatNumber(row.fairPriceUsd)}</td>
                    <td className="px-3 py-2">{formatNumber(row.impliedCcl)}</td>
                    <td className="py-2 pl-3"><PremiumBadge value={row.premiumPercent} /></td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">No hay CEDEARs para mostrar.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
