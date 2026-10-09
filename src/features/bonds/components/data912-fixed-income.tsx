import React from 'react';
import { AlertCircle, RefreshCw, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { fetchData912FixedIncome } from '@/services/api/data912-fixed-income-api';
import type { Data912BondQuote } from '@/services/api/data912-fixed-income-api';
import { calculateData912ZeroCouponYield, getData912MaturityDate } from '../lib/data912-yield';

function formatNumber(value: number, digits = 2): string {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: digits }).format(value);
}

function QuotesTable({ quotes, query }: { quotes: Data912BondQuote[]; query: string }) {
  const filtered = React.useMemo(
    () => quotes.filter((quote) => quote.symbol.toLowerCase().includes(query.trim().toLowerCase())),
    [quotes, query],
  );

  if (quotes.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">DATA912 no devolvió instrumentos.</p>;
  }

  return (
    <div className="max-h-[70vh] overflow-auto rounded-md border">
      <table className="w-full min-w-[1180px] text-sm">
        <thead className="sticky top-0 z-10 bg-muted">
          <tr className="text-left">
            <th className="p-3">Ticker</th>
            <th className="p-3 text-right">Último</th>
            <th className="p-3 text-right">Compra</th>
            <th className="p-3 text-right">Cant. compra</th>
            <th className="p-3 text-right">Venta</th>
            <th className="p-3 text-right">Cant. venta</th>
            <th className="p-3 text-right">Volumen</th>
            <th className="p-3 text-right">Operaciones</th>
            <th className="p-3 text-right">Var. %</th>
            <th className="p-3 text-right">Vencimiento</th>
            <th className="p-3 text-right">TIR anual cero cupón</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {filtered.map((quote) => {
            const ytm = calculateData912ZeroCouponYield(quote);
            const maturity = getData912MaturityDate(quote.symbol);
            return (
              <tr key={quote.symbol} className="hover:bg-muted/40">
                <td className="p-3 font-semibold">{quote.symbol}</td>
                <td className="p-3 text-right tabular-nums">{formatNumber(quote.c)}</td>
                <td className="p-3 text-right tabular-nums">{formatNumber(quote.px_bid)}</td>
                <td className="p-3 text-right tabular-nums">{formatNumber(quote.q_bid, 0)}</td>
                <td className="p-3 text-right tabular-nums">{formatNumber(quote.px_ask)}</td>
                <td className="p-3 text-right tabular-nums">{formatNumber(quote.q_ask, 0)}</td>
                <td className="p-3 text-right tabular-nums">{formatNumber(quote.v, 0)}</td>
                <td className="p-3 text-right tabular-nums">{formatNumber(quote.q_op, 0)}</td>
                <td className={`p-3 text-right tabular-nums ${quote.pct_change >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {quote.pct_change > 0 ? '+' : ''}{formatNumber(quote.pct_change)}%
                </td>
                <td className="p-3 text-right tabular-nums">
                  {maturity ? (
                    <time title="Fecha inferida por ticker o mapeo local; confirmar en la ficha oficial del instrumento">
                      {maturity.toLocaleDateString('es-AR')}
                    </time>
                  ) : (
                    <span className="text-muted-foreground" title="DATA912 no publica vencimientos; falta validar la ficha del instrumento">
                      No informado
                    </span>
                  )}
                </td>
                <td className="p-3 text-right tabular-nums">
                  {ytm === null ? (
                    <span className="text-muted-foreground" title="DATA912 no publica cupón ni flujo de fondos">
                      No disponible
                    </span>
                  ) : `${formatNumber(ytm)}%`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {filtered.length === 0 && (
        <p className="p-8 text-center text-sm text-muted-foreground">No hay tickers que coincidan.</p>
      )}
    </div>
  );
}

/**
 * Live DATA912 tables for every sovereign and corporate ticker.
 *
 * @remarks
 * A TIR is calculated only for short zero-coupon symbols whose maturity date is encoded
 * in the ticker. DATA912 does not provide coupon schedules or cash flows for regular bonds/ONs.
 */
export function Data912FixedIncome() {
  const [search, setSearch] = React.useState('');
  const query = useQuery({
    queryKey: ['data912-fixed-income'],
    queryFn: fetchData912FixedIncome,
    staleTime: 0,
    refetchInterval: 30_000,
    retry: 2,
  });

  return (
    <section className="space-y-4">
      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Renta fija argentina en vivo · DATA912</CardTitle>
            <CardDescription>
              Cotizaciones de todos los tickers soberanos y corporativos, actualizadas cada 30 segundos.
            </CardDescription>
            {query.data && (
              <p className="mt-2 text-xs text-muted-foreground">
                Última consulta: {new Date(query.data.fetchedAt).toLocaleString('es-AR')}
              </p>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => void query.refetch()} disabled={query.isFetching}>
            <RefreshCw className={`mr-2 size-4 ${query.isFetching ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-9"
                placeholder="Buscar ticker..."
                aria-label="Buscar ticker de renta fija"
              />
            </div>
            {query.data && (
              <div className="flex gap-2">
                <Badge variant="secondary">{query.data.sovereign.length} soberanos</Badge>
                <Badge variant="secondary">{query.data.corporate.length} corporativos</Badge>
              </div>
            )}
          </div>

          {query.isError && (
            <div role="alert" className="flex items-center gap-2 rounded-md border border-destructive/40 p-3 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              {query.error.message}
            </div>
          )}
          {query.data && (query.data.errors.sovereign !== null || query.data.errors.corporate !== null) && (
            <div role="alert" className="flex items-center gap-2 rounded-md border border-destructive/40 p-3 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              {[query.data.errors.sovereign && `Soberanos: ${query.data.errors.sovereign}`,
                query.data.errors.corporate && `Corporativos: ${query.data.errors.corporate}`]
                .filter(Boolean)
                .join(' · ')}
            </div>
          )}
          {query.isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Cargando cotizaciones DATA912...</p>}
          {query.data && (
            <Tabs defaultValue="sovereign">
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="sovereign">Bonos soberanos</TabsTrigger>
                <TabsTrigger value="corporate">Obligaciones negociables</TabsTrigger>
              </TabsList>
              <TabsContent value="sovereign">
                <QuotesTable quotes={query.data.sovereign} query={search} />
              </TabsContent>
              <TabsContent value="corporate">
                <QuotesTable quotes={query.data.corporate} query={search} />
              </TabsContent>
            </Tabs>
          )}
          <p className="text-xs text-muted-foreground">
            DATA912 solo publica cotizaciones. El vencimiento se muestra cuando está codificado
            en el ticker o corresponde a una serie soberana reconocida. La TIR solo se calcula
            para letras cero cupón; no se inventa una TIR para ON/bonos cuyo prospecto y flujos
            de fondos no están disponibles en el feed.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
