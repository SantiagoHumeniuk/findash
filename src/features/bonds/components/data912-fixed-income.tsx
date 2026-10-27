import React from 'react';
import { AlertCircle, ChevronDown, ChevronUp, RefreshCw, Search, TrendingUp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from '@/components/charts/lazy-recharts';
import { fetchData912FixedIncome } from '@/services/api/data912-fixed-income-api';
import type { Data912BondQuote } from '@/services/api/data912-fixed-income-api';
import { fetchFixedIncomeSheet } from '@/services/api/fixed-income-sheet-api';
import type { FixedIncomeCategory, FixedIncomeContract } from '@/services/api/fixed-income-sheet-api';
import type { PlazoFijoDato } from '@/services/macro-api';
import { calculateCashFlowYield, getMarketPrice } from '../lib/fixed-income-yield';
import { calculateData912ZeroCouponYield, getData912MaturityDate } from '../lib/data912-yield';
import { normalizeFixedIncomeTicker } from '../lib/fixed-income-ticker';

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

type FixedIncomeColumn = 'instrument' | 'last' | 'change' | 'maturity' | 'yield' | 'rating' | 'payment';
type SortDirection = 'asc' | 'desc';

const FIXED_INCOME_COLUMNS: { key: FixedIncomeColumn; label: string; align?: 'right' }[] = [
  { key: 'instrument', label: 'Instrumento' },
  { key: 'last', label: 'Último', align: 'right' },
  { key: 'change', label: 'Var. %', align: 'right' },
  { key: 'maturity', label: 'Vencimiento', align: 'right' },
  { key: 'yield', label: 'TIR anual', align: 'right' },
  { key: 'rating', label: 'Calificación crediticia' },
  { key: 'payment', label: 'Próximo pago' },
];

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
  const [sort, setSort] = React.useState<{ column: FixedIncomeColumn; direction: SortDirection }>({
    column: 'instrument',
    direction: 'asc',
  });
  const rows = React.useMemo(() => {
    const rowsByTicker = new Map<string, FixedIncomeTableRow>();
    const linkedSymbols = new Set<string>();
    for (const contract of contracts) {
      const symbol = normalizeFixedIncomeTicker(contract.priceTicker, contract.currency);
      const groupKey = contract.currency === 'USD' ? symbol.slice(0, -1) : symbol;
      const quote = quotes.find((item) => item.symbol.toUpperCase() === symbol) ?? null;
      if (quote) linkedSymbols.add(quote.symbol.toUpperCase());
      rowsByTicker.set(groupKey, {
        groupKey,
        symbol,
        name: contract.name,
        quote,
        variants: quote ? [quote] : [],
        contract,
      });
    }
    if (includeUnmatchedQuotes) {
      const availableDollarD = new Set(
        quotes
          .filter((quote) => quote.symbol.toUpperCase().endsWith('D'))
          .map((quote) => quote.symbol.toUpperCase().slice(0, -1)),
      );
      for (const quote of quotes) {
        if (linkedSymbols.has(quote.symbol.toUpperCase())) continue;
        const normalizedSymbol = quote.symbol.toUpperCase();
        if (/[CO]$/.test(normalizedSymbol)) continue;
        const isDollarTicker = normalizedSymbol.endsWith('D');
        const groupKey = isDollarTicker ? normalizedSymbol.slice(0, -1) : normalizedSymbol;
        if (!isDollarTicker && availableDollarD.has(groupKey)) continue;
        if (rowsByTicker.has(groupKey)) continue;
        rowsByTicker.set(groupKey, {
          groupKey,
          symbol: normalizedSymbol,
          name: normalizedSymbol,
          quote,
          variants: [quote],
          contract: null,
        });
      }
    }
    return [...rowsByTicker.values()]
      .sort((left, right) => left.groupKey.localeCompare(right.groupKey));
  }, [quotes, contracts, includeUnmatchedQuotes]);
  const displayRows = React.useMemo(() => rows.flatMap((row) => {
    const { symbol, quote, contract } = row;
    const quotePrice = quote ? getMarketPrice(quote) : null;
    const usableQuote = quotePrice !== null ? quote : null;
    const currentPrice = quotePrice ?? contract?.workbookPrice ?? null;
    const calculatedYtm = contract
      ? calculateCashFlowYield(
        usableQuote,
        contract.cashFlows,
        undefined,
        usableQuote ? undefined : contract.workbookPrice ?? undefined,
      )
      : usableQuote ? calculateData912ZeroCouponYield(usableQuote) : null;
    const ytm = calculatedYtm ?? contract?.workbookYieldPercent ?? null;
    const dailyChange = usableQuote?.pct_change ?? contract?.workbookChangePercent ?? null;
    const maturity = contract?.maturityDate
      ? new Date(`${contract.maturityDate}T12:00:00`)
      : getData912MaturityDate(quote?.symbol ?? symbol);
    const maturityLabel = maturity ? maturity.toLocaleDateString('es-AR') : '';
    const paymentLabel = contract?.nextPaymentDate
      ? new Date(`${contract.nextPaymentDate}T12:00:00`).toLocaleDateString('es-AR')
      : '';
    const rating = contract?.rating ?? '';
    const matchesQuery = [symbol, row.name, contract?.symbol ?? '']
      .some((value) => value.toLocaleLowerCase('es-AR').includes(query.trim().toLocaleLowerCase('es-AR')));
    if (!matchesQuery) return [];
    return [{
      ...row,
      currentPrice,
      dailyChange,
      maturityLabel,
      maturitySort: maturity?.getTime() ?? null,
      ytm,
      yieldLabel: contract?.category === 'cer' ? 'TIR real' : 'TIR',
      rating,
      paymentLabel,
      paymentSort: contract?.nextPaymentDate ? Date.parse(`${contract.nextPaymentDate}T12:00:00`) : null,
    }];
  }).sort((left, right) => {
    const leftValue = {
      instrument: left.symbol,
      last: left.currentPrice,
      change: left.dailyChange,
      maturity: left.maturitySort,
      yield: left.ytm,
      rating: left.rating,
      payment: left.paymentSort,
    }[sort.column];
    const rightValue = {
      instrument: right.symbol,
      last: right.currentPrice,
      change: right.dailyChange,
      maturity: right.maturitySort,
      yield: right.ytm,
      rating: right.rating,
      payment: right.paymentSort,
    }[sort.column];
    if (leftValue === null || leftValue === '') return rightValue === null || rightValue === '' ? 0 : 1;
    if (rightValue === null || rightValue === '') return -1;
    const comparison = typeof leftValue === 'number' && typeof rightValue === 'number'
      ? leftValue - rightValue
      : String(leftValue).localeCompare(String(rightValue), 'es-AR', { numeric: true, sensitivity: 'base' });
    return sort.direction === 'asc' ? comparison : -comparison;
  }), [rows, query, sort]);

  const handleSort = (column: FixedIncomeColumn) => {
    setSort((current) => ({
      column,
      direction: current.column === column && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  return (
    <div className="max-h-[70vh] overflow-auto rounded-md border">
      <table className="w-full min-w-[1080px] text-sm">
        <thead className="sticky top-0 z-10 bg-muted">
          <tr className="text-left">
            {FIXED_INCOME_COLUMNS.map(({ key, label, align }) => (
              <th
                key={key}
                className={`p-3 ${align === 'right' ? 'text-right' : ''}`}
                aria-sort={sort.column === key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                <button
                  type="button"
                  onClick={() => handleSort(key)}
                  className={`inline-flex items-center gap-1 hover:text-foreground ${align === 'right' ? 'ml-auto' : ''}`}
                  aria-label={`Ordenar por ${label}, ${sort.column === key && sort.direction === 'asc' ? 'descendente' : 'ascendente'}`}
                >
                  {label}
                  {sort.column === key
                    ? sort.direction === 'asc'
                      ? <ChevronUp className="size-4" aria-hidden="true" />
                      : <ChevronDown className="size-4" aria-hidden="true" />
                    : null}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {displayRows.map(({ groupKey, symbol, currentPrice, dailyChange, maturityLabel, ytm, yieldLabel, rating, paymentLabel }) => (
            <tr key={groupKey} className="hover:bg-muted/40">
              <td className="p-3 font-semibold">{symbol}</td>
              <td className="p-3 text-right tabular-nums">{currentPrice !== null ? formatNumber(currentPrice) : ''}</td>
              <td className={`p-3 text-right tabular-nums ${dailyChange === null ? 'text-muted-foreground' : dailyChange >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {dailyChange !== null ? `${dailyChange > 0 ? '+' : ''}${formatNumber(dailyChange)}%` : ''}
              </td>
              <td className="p-3 text-right tabular-nums">{maturityLabel}</td>
              <td className="p-3 text-right tabular-nums">
                {ytm !== null && <span>{formatNumber(ytm)}% <span className="text-muted-foreground">{yieldLabel}</span></span>}
              </td>
              <td className="p-3">
                {rating ? <Badge variant="outline">{rating}</Badge> : <span className="text-muted-foreground">—</span>}
              </td>
              <td className="p-3 text-xs text-muted-foreground">{paymentLabel}</td>
            </tr>
          ))}
          {displayRows.length === 0 && (
            <tr>
              <td colSpan={FIXED_INCOME_COLUMNS.length} className="py-10 text-center text-sm text-muted-foreground">
                No hay instrumentos que coincidan con los filtros.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function LecapCurveAndCalculator({
  contracts,
  quotes,
  plazosFijos,
}: {
  contracts: FixedIncomeContract[];
  quotes: Data912BondQuote[];
  plazosFijos: PlazoFijoDato[];
}) {
  const [selectedSymbol, setSelectedSymbol] = React.useState('');
  const [investment, setInvestment] = React.useState('1000000');
  const [purchasePrice, setPurchasePrice] = React.useState<string | null>(null);
  const [selectedBank, setSelectedBank] = React.useState('');
  const [today] = React.useState(() => new Date());
  const options = React.useMemo(() => contracts.flatMap((contract) => {
    const ticker = normalizeFixedIncomeTicker(contract.priceTicker, contract.currency);
    const quote = quotes.find((item) => item.symbol.toUpperCase() === ticker);
    const quotePrice = quote ? getMarketPrice(quote) : null;
    const usableQuote = quotePrice !== null ? quote : null;
    const marketPrice = quotePrice ?? contract.workbookPrice;
    if (marketPrice === null || contract.cashFlows.length === 0) return [];
    const marketYield = calculateCashFlowYield(usableQuote, contract.cashFlows, today, marketPrice) ??
      contract.workbookYieldPercent;
    const lastFlow = contract.cashFlows
      .filter((flow) => Date.parse(`${flow.date.slice(0, 10)}T00:00:00Z`) > Date.now())
      .sort((left, right) => right.date.localeCompare(left.date))[0];
    const contractMaturity = contract.maturityDate
      ? Date.parse(`${contract.maturityDate.slice(0, 10)}T00:00:00Z`)
      : Number.NaN;
    const maturity = contractMaturity > Date.now() ? contract.maturityDate : lastFlow?.date;
    const maturityTime = maturity ? Date.parse(`${maturity.slice(0, 10)}T00:00:00Z`) : Number.NaN;
    if (marketYield === null || !Number.isFinite(maturityTime)) return [];
    const maturityDays = Math.ceil((maturityTime - Date.now()) / 86_400_000);
    if (maturityDays <= 0) return [];
    return [{ contract, quote: usableQuote, marketPrice, maturityDays, marketYield }];
  }).sort((left, right) => left.maturityDays - right.maturityDays), [contracts, quotes, today]);
  const selected = options.find((option) => option.contract.symbol === selectedSymbol) ?? options[0];

  const bank = plazosFijos.find((item) => item.entidad === selectedBank) ?? plazosFijos[0];
  const principal = Number(investment);
  const price = Number(purchasePrice ?? (selected ? String(selected.marketPrice) : ''));
  const flows = selected?.contract.cashFlows.filter((flow) => {
    const flowTime = Date.parse(`${flow.date.slice(0, 10)}T00:00:00Z`);
    return flowTime > Date.now() && Number.isFinite(flow.amount) && flow.amount > 0;
  }) ?? [];
  const remainingDays = selected?.maturityDays ?? 0;
  const projectedValue = selected && price > 0 && principal > 0
    ? flows.reduce((total, flow) => total + flow.amount, 0) * principal / price
    : null;
  const depositTna = bank?.tnaClientes ?? null;
  const depositGain = depositTna !== null && principal > 0
    ? principal * depositTna * remainingDays / 365
    : null;
  const purchaseYield = selected
    ? calculateCashFlowYield(selected.quote, selected.contract.cashFlows, today, price) ??
      (price === selected.marketPrice ? selected.contract.workbookYieldPercent : null)
    : null;
  const curveData = options.map(({ contract, maturityDays, marketYield }) => ({
    ticker: contract.priceTicker,
    vencimiento: maturityDays,
    tir: marketYield,
  }));

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="size-5 text-primary" />
          Curva y calculadora de LECAPs
        </CardTitle>
        <CardDescription>
          Curva calculada con precios DATA912 cuando están disponibles y, como respaldo, precios y flujos de la planilla.
          Solo se incluyen instrumentos con precio, vencimiento y TIR disponibles.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {curveData.length > 0 ? (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={curveData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="vencimiento" type="number" domain={['dataMin', 'dataMax']} tickFormatter={(days: number) => `${days}d`} />
                <YAxis unit="%" width={58} />
                <Tooltip
                  formatter={(value: number, name: string) => [`${formatNumber(value)}%`, name === 'tir' ? 'TIR efectiva anual' : name]}
                  labelFormatter={(days: number) => {
                    const point = curveData.find((item) => item.vencimiento === Number(days));
                    return `${point?.ticker ?? 'LECAP'} · vencimiento en ${days} días`;
                  }}
                />
                <Line type="monotone" dataKey="tir" name="TIR efectiva anual" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            No hay LECAPs con precio y flujos futuros suficientes para construir una curva confiable.
          </p>
        )}

        {selected && (
          <div className="grid gap-5 border-t pt-5 lg:grid-cols-2">
            <div className="grid content-start gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium">LECAP</span>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3"
                  value={selected.contract.symbol}
                  onChange={(event) => {
                    setSelectedSymbol(event.target.value);
                    setPurchasePrice(null);
                  }}
                >
                  {options.map(({ contract }) => (
                    <option key={contract.symbol} value={contract.symbol}>
                      {contract.name} ({contract.priceTicker})
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Inversión (ARS)</span>
                <Input type="number" min="0" value={investment} onChange={(event) => setInvestment(event.target.value)} />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Precio de compra por VN 100</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={purchasePrice ?? (selected ? String(selected.marketPrice) : '')}
                  onChange={(event) => setPurchasePrice(event.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Banco para plazo fijo</span>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3"
                  value={bank?.entidad ?? ''}
                  onChange={(event) => setSelectedBank(event.target.value)}
                  disabled={plazosFijos.length === 0}
                >
                  {plazosFijos.map((item) => (
                    <option key={item.entidad} value={item.entidad}>{item.entidad}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid content-start gap-3 sm:grid-cols-2">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">TIR efectiva anual al precio de compra</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{purchaseYield !== null ? `${formatNumber(purchaseYield)}%` : 'No disponible'}</p>
                <p className="mt-1 text-xs text-muted-foreground">TIR de mercado: {formatNumber(selected.marketYield)}%</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Flujos estimados hasta vencimiento</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{projectedValue !== null ? `$${formatNumber(projectedValue)}` : 'Ingresá monto y precio válidos'}</p>
                <p className="mt-1 text-xs text-muted-foreground">{remainingDays} días · {selected.contract.flowsProjected ? 'incluye flujos proyectados' : 'flujos de planilla'}</p>
              </div>
              <div className="rounded-lg border p-3 sm:col-span-2">
                <p className="text-sm font-medium">Comparación con {bank?.entidad ?? 'plazo fijo'}</p>
                {depositGain !== null ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Plazo fijo a {formatNumber(depositTna * 100)}% TNA: ganancia simple estimada de ${formatNumber(depositGain)} en {remainingDays} días.
                    {projectedValue !== null && ` Diferencia estimada de la LECAP: $${formatNumber(projectedValue - principal - depositGain)}.`}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">No hay tasas de plazo fijo disponibles para comparar.</p>
                )}
              </div>
            </div>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Simulación antes de impuestos, comisiones y reinversión de cupones. Los flujos proyectados son estimaciones; el resultado no está garantizado. La comparación de plazo fijo usa TNA y cálculo simple por días.
        </p>
      </CardContent>
    </Card>
  );
}

const DEFAULT_CATEGORIES: FixedIncomeCategory[] = [
  'corporate',
  'sovereign',
  'provincial',
  'fixed-peso',
  'cer',
];

const CATEGORY_LABELS: Record<FixedIncomeCategory, string> = {
  corporate: 'ONs USD',
  sovereign: 'Soberanos USD',
  provincial: 'Provinciales',
  'fixed-peso': 'Pesos / tasa fija',
  cer: 'CER',
};

interface Data912FixedIncomeProps {
  categories?: FixedIncomeCategory[];
  title?: string;
  description?: string;
  plazosFijos?: PlazoFijoDato[];
}

/**
 * Displays DATA912 market prices joined with workbook terms and payment flows.
 *
 * @param props - Optional category selection and heading overrides
 */
export function Data912FixedIncome({
  categories = DEFAULT_CATEGORIES,
  title = 'Renta fija argentina en vivo',
  description = 'Cotizaciones de mercado con vencimientos y flujos contractuales.',
  plazosFijos = [],
}: Data912FixedIncomeProps) {
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
  const quoteUniverse = React.useMemo(
    () => [...(query.data?.sovereign ?? []), ...(query.data?.corporate ?? [])],
    [query.data],
  );

  const renderCategory = (category: FixedIncomeCategory) => (
    <>
      <QuotesTable
        quotes={quotesFor(category === 'corporate' ? 'corporate' : 'sovereign')}
        contracts={contractsFor(category)}
        query={search}
        includeUnmatchedQuotes={category === 'corporate' || category === 'sovereign'}
      />
      {category === 'fixed-peso' && (
        <LecapCurveAndCalculator
          contracts={contractsFor('fixed-peso')}
          quotes={quoteUniverse}
          plazosFijos={plazosFijos}
        />
      )}
    </>
  );

  return (
    <section className="space-y-4">
      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
            {query.data && (
              <p className="mt-2 text-xs text-muted-foreground">
                Actualizado: {new Date(Math.max(
                  Date.parse(query.data.fetchedAt),
                  Date.parse(contractsQuery.data?.fetchedAt ?? query.data.fetchedAt),
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
            categories.length === 1 ? (
              renderCategory(categories[0])
            ) : (
              <Tabs defaultValue={categories[0]}>
                <div className="overflow-x-auto">
                  <TabsList className="grid w-full min-w-[720px] grid-cols-5">
                    {categories.map((category) => (
                      <TabsTrigger key={category} value={category}>
                        {CATEGORY_LABELS[category]}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>
                {categories.map((category) => (
                  <TabsContent key={category} value={category}>
                    {renderCategory(category)}
                  </TabsContent>
                ))}
              </Tabs>
            )
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
