// src/features/screener/pages/screener-page.tsx

import { usePageMeta } from '../../../hooks/use-page-meta';
import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Filter, Loader2, Map as MapIcon, RotateCcw, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AssetLogo } from '../../../components/ui/asset-logo';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { PageHeader } from '../../../components/ui/page-header';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { useAssetLogos } from '../../../hooks/use-asset-logos';
import { useAuth } from '../../../hooks/use-auth';
import { usePlanFeature } from '../../../hooks/use-plan-feature';
import { UpgradeHint } from '../../../components/shared/upgrade-hint';
import { fetchYahooScreener, type YahooScreenerFilter } from '../../../services/api/yahoo-finance-api';
import { MarketHeatmap } from '../components/market-heatmap';

const PAGE_SIZE = 25;
const FREE_RESULTS = 10;
const MILLION = 1_000_000;

const SECTORS: Record<string, string> = {
  Technology: 'Tecnología',
  'Financial Services': 'Financiero',
  Healthcare: 'Salud',
  'Consumer Cyclical': 'Consumo cíclico',
  'Communication Services': 'Comunicaciones',
  Industrials: 'Industrial',
  'Consumer Defensive': 'Consumo defensivo',
  Energy: 'Energía',
  'Basic Materials': 'Materiales',
  'Real Estate': 'Inmobiliario',
  Utilities: 'Servicios públicos',
};

/** Numeric filters. `scale` converts what the user types into Yahoo's unit. */
const FILTER_FIELDS = [
  { field: 'marketCap', label: 'Capitalización (USD millones)', scale: MILLION },
  { field: 'pe', label: 'P/E', scale: 1 },
  { field: 'peg', label: 'PEG', scale: 1 },
  { field: 'priceToBook', label: 'P/B', scale: 1 },
  { field: 'roe', label: 'ROE (%)', scale: 1 },
  { field: 'dividendYield', label: 'Dividendo (%)', scale: 1 },
  { field: 'revenueGrowth', label: 'Crec. ingresos (%)', scale: 1 },
  { field: 'epsGrowth', label: 'Crec. EPS (%)', scale: 1 },
  { field: 'debtToEquity', label: 'Deuda / patrimonio (%)', scale: 1 },
  { field: 'changePercent', label: 'Variación del día (%)', scale: 1 },
  { field: 'yearChange', label: 'Variación 52 semanas (%)', scale: 1 },
  { field: 'beta', label: 'Beta', scale: 1 },
];

const SORT_OPTIONS = [
  { field: 'marketCap', label: 'Capitalización' },
  { field: 'changePercent', label: 'Variación del día' },
  { field: 'yearChange', label: 'Variación 52 semanas' },
  { field: 'pe', label: 'P/E' },
  { field: 'dividendYield', label: 'Dividendo' },
  { field: 'roe', label: 'ROE' },
  { field: 'revenueGrowth', label: 'Crec. ingresos' },
];

type Limits = Record<string, { min: string; max: string }>;

interface ScreenState {
  region: 'us' | 'ar';
  sector: string;
  limits: Limits;
  sortField: string;
  sortDescending: boolean;
}

const EMPTY_STATE: ScreenState = { region: 'us', sector: 'all', limits: {}, sortField: 'marketCap', sortDescending: true };

const PRESETS: { name: string; state: Partial<ScreenState> }[] = [
  {
    name: 'Calidad a buen precio',
    state: { limits: { marketCap: { min: '2000', max: '' }, pe: { min: '1', max: '20' }, roe: { min: '15', max: '' } } },
  },
  {
    name: 'Dividendos altos',
    state: {
      limits: { marketCap: { min: '2000', max: '' }, dividendYield: { min: '4', max: '' } },
      sortField: 'dividendYield',
    },
  },
  {
    name: 'Crecimiento',
    state: {
      limits: { marketCap: { min: '2000', max: '' }, revenueGrowth: { min: '20', max: '' } },
      sortField: 'revenueGrowth',
    },
  },
  {
    name: 'Subas fuertes de hoy',
    state: {
      limits: { marketCap: { min: '2000', max: '' }, changePercent: { min: '5', max: '' } },
      sortField: 'changePercent',
      sortDescending: true,
    },
  },
  {
    name: 'Caídas fuertes de hoy',
    state: {
      limits: { marketCap: { min: '2000', max: '' }, changePercent: { min: '', max: '-5' } },
      sortField: 'changePercent',
      sortDescending: false,
    },
  },
  { name: 'Bolsa de Buenos Aires', state: { region: 'ar' } },
];

function toNumber(text: string): number | null {
  if (text.trim() === '') return null;
  const value = Number(text.replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

function toScreenerFilters(limits: Limits): YahooScreenerFilter[] {
  return FILTER_FIELDS.flatMap(({ field, scale }) => {
    const min = toNumber(limits[field]?.min ?? '');
    const max = toNumber(limits[field]?.max ?? '');
    return min === null && max === null
      ? []
      : [{ field, min: min === null ? null : min * scale, max: max === null ? null : max * scale }];
  });
}

function savedKey(userId: string | undefined) {
  return `findash:saved-screens:${userId ?? 'anon'}`;
}

function readSaved(userId: string | undefined): { name: string; state: ScreenState }[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(savedKey(userId)) ?? '[]');
    return Array.isArray(parsed) ? parsed as { name: string; state: ScreenState }[] : [];
  } catch {
    return [];
  }
}

function formatCap(value: number | null, currency: string): string {
  if (value === null) return '—';
  const steps: [number, string][] = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M']];
  const step = steps.find(([size]) => value >= size);
  return `${currency} ${step ? `${(value / step[0]).toFixed(1)}${step[1]}` : value.toFixed(0)}`;
}

function formatNumber(value: number | null, suffix = ''): string {
  return value === null ? '—' : `${value.toFixed(2)}${suffix}`;
}

function changeClass(value: number | null): string {
  if (value === null || value === 0) return '';
  return value > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';
}

function ScreenerTable() {
  const { user } = useAuth();
  const { hasAccess: fullAccess } = usePlanFeature('screenerFull');
  const [draft, setDraft] = useState<ScreenState>(EMPTY_STATE);
  const [applied, setApplied] = useState<ScreenState>(EMPTY_STATE);
  const [page, setPage] = useState(0);
  const [saved, setSaved] = useState<{ name: string; state: ScreenState }[]>([]);

  useEffect(() => setSaved(readSaved(user?.id)), [user?.id]);

  const run = (state: ScreenState) => {
    setDraft(state);
    setApplied(state);
    setPage(0);
  };
  const setLimit = (field: string, side: 'min' | 'max', value: string) => setDraft((current) => ({
    ...current,
    limits: {
      ...current.limits,
      [field]: { min: current.limits[field]?.min ?? '', max: current.limits[field]?.max ?? '', [side]: value },
    },
  }));

  const persist = (next: { name: string; state: ScreenState }[]) => {
    setSaved(next);
    try {
      localStorage.setItem(savedKey(user?.id), JSON.stringify(next));
    } catch {
      toast.error('No se pudo guardar el filtro en este navegador.');
    }
  };
  const saveCurrent = () => {
    const name = window.prompt('Nombre del filtro');
    if (name?.trim()) persist([...saved.filter((item) => item.name !== name.trim()), { name: name.trim(), state: draft }]);
  };

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ['screener', applied, page, fullAccess],
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchYahooScreener({
      region: applied.region,
      sector: applied.sector === 'all' ? null : applied.sector,
      filters: toScreenerFilters(applied.limits),
      sortField: applied.sortField,
      sortDescending: applied.sortDescending,
      offset: fullAccess ? page * PAGE_SIZE : 0,
      size: fullAccess ? PAGE_SIZE : FREE_RESULTS,
    }),
  });
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const logos = useAssetLogos(rows.map((row) => row.symbol));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <Button key={preset.name} variant="outline" size="sm" onClick={() => run({ ...EMPTY_STATE, ...preset.state })}>
            {preset.name}
          </Button>
        ))}
        {saved.map((item) => (
          <span key={item.name} className="inline-flex items-center">
            <Button variant="secondary" size="sm" className="rounded-r-none" onClick={() => run(item.state)}>{item.name}</Button>
            <Button
              variant="secondary"
              size="sm"
              className="rounded-l-none border-l px-2"
              aria-label={`Eliminar filtro ${item.name}`}
              onClick={() => persist(saved.filter((other) => other.name !== item.name))}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </span>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Filtros</CardTitle>
          <CardDescription>Completá solo los que te interesen. Podés poner mínimo, máximo o ambos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="screener-region">Mercado</Label>
              <Select value={draft.region} onValueChange={(value) => setDraft((current) => ({ ...current, region: value as 'us' | 'ar' }))}>
                <SelectTrigger id="screener-region"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="us">Estados Unidos</SelectItem>
                  <SelectItem value="ar">Buenos Aires (incluye CEDEARs)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="screener-sector">Sector</Label>
              <Select value={draft.sector} onValueChange={(value) => setDraft((current) => ({ ...current, sector: value }))}>
                <SelectTrigger id="screener-sector"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {Object.entries(SECTORS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="screener-sort">Ordenar por</Label>
              <Select value={draft.sortField} onValueChange={(value) => setDraft((current) => ({ ...current, sortField: value }))}>
                <SelectTrigger id="screener-sort"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((option) => <SelectItem key={option.field} value={option.field}>{option.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Dirección</Label>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => setDraft((current) => ({ ...current, sortDescending: !current.sortDescending }))}
              >
                {draft.sortDescending ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}
                {draft.sortDescending ? 'Mayor a menor' : 'Menor a mayor'}
              </Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FILTER_FIELDS.map(({ field, label }) => (
              <div key={field} className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                <div className="flex gap-2">
                  <Input
                    aria-label={`${label}, mínimo`}
                    inputMode="decimal"
                    placeholder="Mín."
                    value={draft.limits[field]?.min ?? ''}
                    onChange={(event) => setLimit(field, 'min', event.target.value)}
                  />
                  <Input
                    aria-label={`${label}, máximo`}
                    inputMode="decimal"
                    placeholder="Máx."
                    value={draft.limits[field]?.max ?? ''}
                    onChange={(event) => setLimit(field, 'max', event.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button className="gap-2" onClick={() => run(draft)}><Filter className="h-4 w-4" />Aplicar</Button>
            {fullAccess && <Button variant="outline" className="gap-2" onClick={saveCurrent}><Save className="h-4 w-4" />Guardar filtro</Button>}
            <Button variant="ghost" className="gap-2" onClick={() => run(EMPTY_STATE)}><RotateCcw className="h-4 w-4" />Limpiar</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            {total.toLocaleString('es-AR')} resultados
            {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </CardTitle>
          {fullAccess && <div className="flex items-center gap-2 text-sm">
            <Button variant="outline" size="icon" aria-label="Página anterior" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="tabular-nums">{page + 1}</span>
            <Button variant="outline" size="icon" aria-label="Página siguiente" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage((value) => value + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>}
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div> : isError ? (
            <p className="p-4 text-sm text-destructive">No se pudo consultar el screener. Probá de nuevo.</p>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Ninguna acción cumple esos filtros.</p>
          ) : (
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b text-right text-xs text-muted-foreground">
                  <th className="py-2 pr-3 text-left font-medium">Empresa</th>
                  <th className="px-3 py-2 font-medium">Precio</th>
                  <th className="px-3 py-2 font-medium">Día</th>
                  <th className="px-3 py-2 font-medium">52 sem.</th>
                  <th className="px-3 py-2 font-medium">Capitalización</th>
                  <th className="px-3 py-2 font-medium">P/E</th>
                  <th className="px-3 py-2 font-medium">P/B</th>
                  <th className="px-3 py-2 font-medium">Dividendo</th>
                  <th className="py-2 pl-3 font-medium">Analistas</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.symbol} className="border-b text-right tabular-nums last:border-0">
                    <td className="py-2 pr-3 text-left">
                      <Link to={`/asset/${row.symbol}`} className="flex items-center gap-2 hover:underline">
                        <AssetLogo symbol={row.symbol} name={row.name} src={logos[row.symbol]} lookup={false} className="size-7" />
                        <span className="min-w-0">
                          <span className="block font-semibold">{row.symbol}</span>
                          <span className="block max-w-[200px] truncate text-xs text-muted-foreground">{row.name}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-2">{formatNumber(row.price)}</td>
                    <td className={`px-3 py-2 ${changeClass(row.changePercent)}`}>{formatNumber(row.changePercent, '%')}</td>
                    <td className={`px-3 py-2 ${changeClass(row.yearChangePercent)}`}>{formatNumber(row.yearChangePercent, '%')}</td>
                    <td className="px-3 py-2">{formatCap(row.marketCap, row.currency)}</td>
                    <td className="px-3 py-2">{formatNumber(row.trailingPE)}</td>
                    <td className="px-3 py-2">{formatNumber(row.priceToBook)}</td>
                    <td className="px-3 py-2">{formatNumber(row.dividendYield, '%')}</td>
                    <td className="py-2 pl-3 text-xs text-muted-foreground">{row.analystRating ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!fullAccess && total > FREE_RESULTS && (
            <UpgradeHint className="mt-4" message={`Estás viendo los primeros ${FREE_RESULTS} resultados. Los ${total.toLocaleString('es-AR')} y guardar filtros están disponibles en el plan Plus.`} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Stock filters and a market map over Yahoo's whole equity universe. */
export default function ScreenerPage() {
  const [searchParams] = useSearchParams();
  usePageMeta('Screener de acciones y mapa del mercado', 'Filtrá acciones por valuación, dividendos y crecimiento, y mirá el mercado de un vistazo.');
  return (
    <div className="container-wide stack-6">
      <PageHeader
        icon={<Filter className="w-8 h-8 text-primary" />}
        title="Screener"
        description="Encontrá acciones con tus criterios y mirá el mercado de un vistazo."
      />
      <Tabs defaultValue={searchParams.get('tab') === 'map' ? 'map' : 'filters'}>
        <TabsList>
          <TabsTrigger value="filters" className="gap-2"><Filter className="h-4 w-4" />Filtros</TabsTrigger>
          <TabsTrigger value="map" className="gap-2"><MapIcon className="h-4 w-4" />Mapa del mercado</TabsTrigger>
        </TabsList>
        <TabsContent value="filters" className="mt-4"><ScreenerTable /></TabsContent>
        <TabsContent value="map" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Mapa del mercado de EE. UU.</CardTitle>
              <CardDescription>Las 12 mayores empresas de cada sector: el tamaño es la capitalización y el color, la variación del día.</CardDescription>
            </CardHeader>
            <CardContent><MarketHeatmap /></CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
