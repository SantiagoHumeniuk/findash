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
import { fetchFixedIncomeSheet } from '@/services/api/fixed-income-sheet-api';
import type { FixedIncomeCategory, FixedIncomeContract } from '@/services/api/fixed-income-sheet-api';
import { calculateCashFlowYield } from '../lib/fixed-income-yield';
import { calculateData912ZeroCouponYield, getData912MaturityDate } from '../lib/data912-yield';

function formatNumber(value: number, digits = 2): string {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: digits }).format(value);
}

interface FixedIncomeTableRow {
  groupKey: string;
  symbol: string;
  name: string;
  quote: Data912BondQuote | null;
  variants: Data912BondQuote[];
  contract: FixedIncomeContract | null;
}

function getVariantBaseTicker(symbol: string): string {
  return symbol.toUpperCase().replace(/[DCO]$/, '');
}

function QuotesTable({
  quotes,
  contracts,
  query,
  includeUnmatchedQuotes = true,
}: {
  quotes: Data912BondQuote[];
  contracts: FixedIncomeContract[];
  query: string;
  includeUnmatchedQuotes?: boolean;
}) {
  const [selectedTickers, setSelectedTickers] = React.useState<Record<string, string>>({});
  const rows = React.useMemo(() => {
    const quoteGroups = new Map<string, Set<string>>();
    for (const quote of quotes) {
      const baseTicker = getVariantBaseTicker(quote.symbol);
      const symbols = quoteGroups.get(baseTicker) ?? new Set<string>();
      symbols.add(quote.symbol.toUpperCase());
      quoteGroups.set(baseTicker, symbols);
    }
    const variantBases = new Set(
      [...quoteGroups.entries()]
        .filter(([, symbols]) => symbols.size > 1)
        .map(([baseTicker]) => baseTicker),
    );
    const getGroupKey = (symbol: string) => {
      const normalizedSymbol = symbol.toUpperCase();
      const baseTicker = getVariantBaseTicker(normalizedSymbol);
      return variantBases.has(baseTicker) ? baseTicker : normalizedSymbol;
    };

    const rowsByTicker = new Map<string, FixedIncomeTableRow>();
    const linkedSymbols = new Set<string>();
    for (const contract of contracts) {
      const groupKey = getGroupKey(contract.priceTicker);
      const variants = quotes.filter((quote) =>
        getGroupKey(quote.symbol) === groupKey
      );
      variants.forEach((quote) => linkedSymbols.add(quote.symbol.toUpperCase()));
      const current = rowsByTicker.get(groupKey);
      if (current) {
        current.variants = [...new Map(
          [...current.variants, ...variants].map((quote) => [quote.symbol.toUpperCase(), quote]),
        ).values()];
      } else {
        rowsByTicker.set(groupKey, {
          groupKey,
          symbol: contract.priceTicker,
          name: contract.name,
          quote: variants.find((quote) => quote.symbol.toUpperCase() === contract.priceTicker.toUpperCase()) ?? variants[0] ?? null,
          variants,
          contract,
        });
      }
    }
    if (includeUnmatchedQuotes) {
      for (const quote of quotes) {
        if (linkedSymbols.has(quote.symbol.toUpperCase())) continue;
        const groupKey = getGroupKey(quote.symbol);
        const current = rowsByTicker.get(groupKey);
        if (current) {
          if (!current.variants.some((variant) => variant.symbol.toUpperCase() === quote.symbol.toUpperCase())) {
            current.variants.push(quote);
          }
        } else {
          rowsByTicker.set(groupKey, {
            groupKey,
            symbol: quote.symbol,
            name: quote.symbol,
            quote,
            variants: [quote],
            contract: null,
          });
        }
      }
    }
    const normalizedQuery = query.trim().toLowerCase();
    return [...rowsByTicker.values()]
      .filter((row) =>
        row.symbol.toLowerCase().includes(normalizedQuery) ||
        row.name.toLowerCase().includes(normalizedQuery) ||
        Boolean(row.contract?.symbol.toLowerCase().includes(normalizedQuery)) ||
        row.variants.some((quote) => quote.symbol.toLowerCase().includes(normalizedQuery))
      )
      .sort((left, right) => left.groupKey.localeCompare(right.groupKey));
  }, [quotes, contracts, query, includeUnmatchedQuotes]);

  if (rows.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No hay instrumentos que coincidan con la búsqueda.
      </p>
    );
  }

  return (
    <div className="max-h-[70vh] overflow-auto rounded-md border">
      <table className="w-full min-w-[980px] text-sm">
        <thead className="sticky top-0 z-10 bg-muted">
          <tr className="text-left">
            <th className="p-3">Instrumento</th>
            <th className="p-3">Ticker</th>
            <th className="p-3 text-right">Último</th>
            <th className="p-3 text-right">Var. %</th>
            <th className="p-3 text-right">Vencimiento</th>
            <th className="p-3 text-right">TIR anual</th>
            <th className="p-3">Próximo pago</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map(({ groupKey, symbol, name, quote: defaultQuote, variants, contract }) => {
            const quote = variants.find((variant) =>
              variant.symbol.toUpperCase() === selectedTickers[groupKey]?.toUpperCase()
            ) ?? variants.find((variant) =>
              variant.symbol.toUpperCase() === contract?.priceTicker.toUpperCase()
            ) ?? defaultQuote;
            const ytm = contract
              ? calculateCashFlowYield(
                contract.currency === 'USD' && quote?.symbol.endsWith('O') ? null : quote,
                contract.cashFlows,
              )
              : quote ? calculateData912ZeroCouponYield(quote) : null;
            const maturity = contract?.maturityDate
              ? new Date(`${contract.maturityDate}T12:00:00`)
              : getData912MaturityDate(quote?.symbol ?? symbol);
            const yieldLabel = contract?.category === 'cer'
              ? 'TIR real'
              : contract?.flowsProjected
                ? 'TEA estimada'
                : 'TEA';
            return (
              <tr key={groupKey} className="hover:bg-muted/40">
                <td className="p-3 font-semibold">
                  <span>{name}</span>
                  {contract?.rating && <Badge variant="outline" className="ml-2">{contract.rating}</Badge>}
                </td>
                <td className="p-3">
                  {variants.length > 1 ? (
                    <select
                      aria-label={`Ticker de ${name}`}
                      className="max-w-32 rounded-md border bg-background px-2 py-1 text-sm"
                      value={quote?.symbol ?? symbol}
                      onChange={(event) => setSelectedTickers((current) => ({
                        ...current,
                        [groupKey]: event.currentTarget.value,
                      }))}
                    >
                      {variants.map((variant) => (
                        <option key={variant.symbol} value={variant.symbol}>{variant.symbol}</option>
                      ))}
                    </select>
                  ) : quote?.symbol ?? symbol}
                </td>
                <td className="p-3 text-right tabular-nums">{quote ? formatNumber(quote.c) : ''}</td>
                <td className={`p-3 text-right tabular-nums ${quote && quote.pct_change >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {quote ? `${quote.pct_change > 0 ? '+' : ''}${formatNumber(quote.pct_change)}%` : ''}
                </td>
                <td className="p-3 text-right tabular-nums">
                  {maturity ? (
                    <time>
                      {maturity.toLocaleDateString('es-AR')}
                    </time>
                  ) : ''}
                </td>
                <td className="p-3 text-right tabular-nums">
                  {ytm !== null && (
                    <span>
                      {formatNumber(ytm)}% <span className="text-muted-foreground">{yieldLabel}</span>
                    </span>
                  )}
                </td>
                <td className="max-w-[320px] p-3 text-xs text-muted-foreground">
                  {contract?.nextPaymentDate && contract.nextPaymentAmount !== null && (
                    <span className="block">
                      Próx. pago: {new Date(`${contract.nextPaymentDate}T12:00:00`).toLocaleDateString('es-AR')}
                      {' · '}{formatNumber(contract.nextPaymentAmount)} {contract.currency} / 100 VN
                    </span>
                  )}
                  {contract?.sector && <span className="block">Sector: {contract.sector}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Live DATA912 market prices joined with the published terms and future cash flows.
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
  const contractsQuery = useQuery({
    queryKey: ['fixed-income-sheet'],
    queryFn: fetchFixedIncomeSheet,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
  });
  const quotesFor = React.useCallback((market: 'sovereign' | 'corporate') =>
    market === 'sovereign' ? query.data?.sovereign ?? [] : query.data?.corporate ?? [],
  [query.data]);
  const contractsFor = React.useCallback((category: FixedIncomeCategory) =>
    contractsQuery.data?.contracts.filter((contract) => contract.category === category) ?? [],
  [contractsQuery.data]);

  return (
    <section className="space-y-4">
      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Renta fija argentina en vivo</CardTitle>
            <CardDescription>
              Cotizaciones de mercado con vencimientos y flujos contractuales.
            </CardDescription>
            {query.data && (
              <p className="mt-2 text-xs text-muted-foreground">
                Actualizado: {new Date(Math.max(
                  query.data.fetchedAt,
                  contractsQuery.data?.fetchedAt ?? query.data.fetchedAt,
                )).toLocaleString('es-AR')}
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void Promise.all([query.refetch(), contractsQuery.refetch()])}
            disabled={query.isFetching || contractsQuery.isFetching}
          >
            <RefreshCw className={`mr-2 size-4 ${query.isFetching || contractsQuery.isFetching ? 'animate-spin' : ''}`} />
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
                {contractsQuery.data && (
                  <Badge variant="secondary">{contractsQuery.data.contracts.length} fichas</Badge>
                )}
              </div>
            )}
          </div>

          {query.isError && (
            <div role="alert" className="flex items-center gap-2 rounded-md border border-destructive/40 p-3 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              No se pudieron cargar las cotizaciones. Intenta actualizar.
            </div>
          )}
          {contractsQuery.isError && (
            <div role="alert" className="flex items-center gap-2 rounded-md border border-destructive/40 p-3 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              No se pudieron cargar los datos contractuales. Intenta actualizar.
            </div>
          )}
          {query.data && (query.data.errors.sovereign !== null || query.data.errors.corporate !== null) && (
            <div role="alert" className="flex items-center gap-2 rounded-md border border-destructive/40 p-3 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              {[query.data.errors.sovereign && 'No se pudieron cargar los títulos soberanos.',
                query.data.errors.corporate && 'No se pudieron cargar las obligaciones negociables.']
                .filter(Boolean)
                .join(' · ')}
            </div>
          )}
          {(query.isLoading || contractsQuery.isLoading) && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Cargando cotizaciones y fichas de renta fija...
            </p>
          )}
          {(query.data ?? contractsQuery.data) && (
            <Tabs defaultValue="sovereign">
              <div className="overflow-x-auto">
                <TabsList className="grid w-full min-w-[720px] grid-cols-5">
                  <TabsTrigger value="sovereign">Soberanos USD</TabsTrigger>
                  <TabsTrigger value="corporate">ONs USD</TabsTrigger>
                  <TabsTrigger value="provincial">Provinciales</TabsTrigger>
                  <TabsTrigger value="fixed-peso">Pesos / tasa fija</TabsTrigger>
                  <TabsTrigger value="cer">CER</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="sovereign">
                <QuotesTable
                  quotes={quotesFor('sovereign')}
                  contracts={contractsFor('sovereign')}
                  query={search}
                />
              </TabsContent>
              <TabsContent value="corporate">
                <QuotesTable
                  quotes={quotesFor('corporate')}
                  contracts={contractsFor('corporate')}
                  query={search}
                />
              </TabsContent>
              <TabsContent value="provincial">
                <QuotesTable
                  quotes={quotesFor('sovereign')}
                  contracts={contractsFor('provincial')}
                  query={search}
                  includeUnmatchedQuotes={false}
                />
              </TabsContent>
              <TabsContent value="fixed-peso">
                <QuotesTable
                  quotes={quotesFor('sovereign')}
                  contracts={contractsFor('fixed-peso')}
                  query={search}
                  includeUnmatchedQuotes={false}
                />
              </TabsContent>
              <TabsContent value="cer">
                <QuotesTable
                  quotes={quotesFor('sovereign')}
                  contracts={contractsFor('cer')}
                  query={search}
                  includeUnmatchedQuotes={false}
                />
              </TabsContent>
            </Tabs>
          )}
          <p className="text-xs text-muted-foreground">
            La TIR se calcula con el precio de mercado y los flujos futuros; queda vacía si
            precio, moneda o flujos no pueden compararse. Las tasas TAMAR se identifican como estimadas y los bonos CER como TIR real.
            Los títulos sin ficha contractual conservan el cálculo aproximado solo para letras cero cupón.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
