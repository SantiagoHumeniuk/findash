// src/features/screener/components/market-heatmap.tsx

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Search } from 'lucide-react';
import { ResponsiveContainer, Tooltip, Treemap } from 'recharts';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { fetchYahooHeatmap } from '../../../services/api/yahoo-finance-api';
import { SECTORS } from '../lib/sectors';

const COMPACT_SECTOR_LABELS: Record<string, string> = {
  'Financial Services': 'Finanzas',
  'Consumer Cyclical': 'Cons. cíclico',
  'Communication Services': 'Comunic.',
  Industrials: 'Industria',
  'Consumer Defensive': 'Cons. def.',
  'Basic Materials': 'Materiales',
  'Real Estate': 'Inmobiliario',
  Utilities: 'Servicios',
};

/** Green or red by the size of the day's move, saturating at ±3%. */
function heatColor(change: number | null): string {
  if (change === null) return '#475569';
  const strength = Math.min(Math.abs(change) / 3, 1);
  const hue = change >= 0 ? 152 : 350;
  return `hsl(${hue} ${35 + strength * 45}% ${30 + strength * 8}%)`;
}

function formatMarketCap(value: number): string {
  const units: [number, string][] = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M']];
  const unit = units.find(([size]) => value >= size);
  const amount = unit
    ? new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(value / unit[0])
    : new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(value);
  return `US$ ${amount}${unit?.[1] ?? ''}`;
}

interface MarketCellProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  company?: string;
  kind?: 'sector' | 'company';
  companyCount?: number;
  change?: number | null;
  onSelectSector: (sector: string) => void;
  onOpenAsset: (symbol: string) => void;
}

function MarketCell({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  name = '',
  company = '',
  kind,
  companyCount = 0,
  change = null,
  onSelectSector,
  onOpenAsset,
}: MarketCellProps) {
  if (!kind || !name) return <g />;

  const isSector = kind === 'sector';
  const fullLabel = isSector ? SECTORS[name] ?? name : name;
  const minimumFullLabelWidth = fullLabel.length * 8 * 0.62 + 12;
  const label = isSector && width < minimumFullLabelWidth
    ? COMPACT_SECTOR_LABELS[name] ?? fullLabel
    : fullLabel;
  const fontSize = isSector
    ? Math.min(15, Math.max(8, (width - 12) / (label.length * 0.62)))
    : Math.min(Math.max(width / 5, 9), 16);
  const showLabel = height > 22 && width >= label.length * fontSize * 0.62 + 4;
  const showChange = width > (isSector ? 58 : 42) && height > 38;
  const ariaLabel = isSector
    ? `Ver sector ${label}, ${companyCount} empresas principales`
    : `Abrir ${name}, ${company}`;

  return (
    <g
      role={isSector ? 'button' : 'link'}
      aria-label={ariaLabel}
      tabIndex={0}
      style={{ cursor: 'pointer' }}
      onClick={() => {
        if (isSector) onSelectSector(name);
        else onOpenAsset(name);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          if (isSector) onSelectSector(name);
          else onOpenAsset(name);
        }
      }}
    >
      <rect x={x} y={y} width={width} height={height} fill={heatColor(change)} stroke="var(--background)" strokeWidth={2} />
      {showLabel && (
        <text
          x={x + width / 2}
          y={y + height / 2 - (showChange ? 5 : -4)}
          textAnchor="middle"
          fill="#fff"
          stroke="none"
          fontSize={fontSize}
          fontWeight={700}
        >
          {label}
        </text>
      )}
      {showChange && (
        <text
          x={x + width / 2}
          y={y + height / 2 + fontSize}
          textAnchor="middle"
          fill="#fff"
          stroke="none"
          fontSize={Math.max(fontSize - 3, 9)}
        >
          {change === null ? 's/d' : `${change > 0 ? '+' : ''}${change.toFixed(2)}%`}
        </text>
      )}
    </g>
  );
}

/** Sector-grouped market heatmap with drill-down to leading companies. */
export function MarketHeatmap() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const { data, isLoading, isError } = useQuery({
    queryKey: ['market-heatmap'],
    queryFn: fetchYahooHeatmap,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
  const companies = useMemo(() => (data ?? []).flatMap(({ sector, companies }) =>
    companies.flatMap((company) => company.marketCap
      ? [{ ...company, marketCap: company.marketCap, sector }]
      : []),
  ), [data]);
  const filteredCompanies = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es-AR');
    return companies.filter((company) => {
      return !term
        || company.symbol.toLocaleLowerCase('es-AR').includes(term)
        || company.name.toLocaleLowerCase('es-AR').includes(term)
        || (SECTORS[company.sector] ?? company.sector).toLocaleLowerCase('es-AR').includes(term);
    });
  }, [companies, search]);
  const sectorOptions = useMemo(() => Array.from(new Set(companies.map(({ sector }) => sector))), [companies]);
  const sectorSummaries = useMemo(() => {
    const bySector = new Map<string, { marketCap: number; weightedChange: number; changeMarketCap: number; companies: number }>();
    filteredCompanies.forEach((company) => {
      const summary = bySector.get(company.sector) ?? { marketCap: 0, weightedChange: 0, changeMarketCap: 0, companies: 0 };
      summary.marketCap += company.marketCap;
      summary.companies += 1;
      if (company.changePercent !== null) {
        summary.weightedChange += company.changePercent * company.marketCap;
        summary.changeMarketCap += company.marketCap;
      }
      bySector.set(company.sector, summary);
    });
    return Array.from(bySector, ([sector, summary]) => ({
      name: sector,
      size: Math.log1p(summary.marketCap),
      marketCap: summary.marketCap,
      companyCount: summary.companies,
      change: summary.changeMarketCap > 0 ? summary.weightedChange / summary.changeMarketCap : null,
    }));
  }, [filteredCompanies]);
  const sectorCompanies = selectedSector
    ? filteredCompanies.filter((company) => company.sector === selectedSector)
    : [];
  const visibleCompanies = selectedSector ? sectorCompanies : filteredCompanies;
  const movers = useMemo(() => filteredCompanies.reduce(
    (counts, company) => {
      if (company.changePercent === null) counts.unknown += 1;
      else if (company.changePercent === 0) counts.unchanged += 1;
      else if (company.changePercent > 0) counts.up += 1;
      else counts.down += 1;
      return counts;
    },
    { up: 0, down: 0, unchanged: 0, unknown: 0 },
  ), [filteredCompanies]);
  const activeMovers = selectedSector
    ? sectorCompanies.reduce(
      (counts, company) => {
        if (company.changePercent === null) counts.unknown += 1;
        else if (company.changePercent === 0) counts.unchanged += 1;
        else if (company.changePercent > 0) counts.up += 1;
        else counts.down += 1;
        return counts;
      },
      { up: 0, down: 0, unchanged: 0, unknown: 0 },
    )
    : movers;
  const mapData = selectedSector
    ? sectorCompanies.map((company) => ({
      kind: 'company' as const,
      name: company.symbol,
      company: company.name,
      sector: company.sector,
      size: company.marketCap,
      change: company.changePercent,
    }))
    : sectorSummaries.map((sector) => ({ ...sector, kind: 'sector' as const }));
  const mapIsEmpty = selectedSector ? sectorCompanies.length === 0 : sectorSummaries.length === 0;

  if (isLoading) return <div className="flex h-96 items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (isError || companies.length === 0) return <p className="p-4 text-sm text-destructive">No se pudo cargar el mapa del mercado.</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {selectedSector ? (
          <>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setSelectedSector(null)}>
              <ArrowLeft className="h-4 w-4" />Sectores
            </Button>
            <div>
              <h3 className="font-semibold">{SECTORS[selectedSector] ?? selectedSector}</h3>
              <p className="text-xs text-muted-foreground">Cada bloque es una empresa; el tamaño indica su capitalización.</p>
            </div>
          </>
        ) : (
          <div>
            <h3 className="font-semibold">Sectores</h3>
            <p className="text-xs text-muted-foreground">Elegí un sector para acercarte y explorar sus principales empresas.</p>
          </div>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,0.6fr)]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label={selectedSector ? 'Buscar empresa dentro del sector' : 'Buscar sector o empresa'}
            className="pl-9"
            placeholder={selectedSector ? 'Buscar empresa en este sector' : 'Buscar sector o empresa'}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Select value={selectedSector ?? 'all'} onValueChange={(value) => setSelectedSector(value === 'all' ? null : value)}>
          <SelectTrigger aria-label="Filtrar mapa por sector"><SelectValue placeholder="Todos los sectores" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los sectores</SelectItem>
            {sectorOptions.map((sector) => <SelectItem key={sector} value={sector}>{SECTORS[sector] ?? sector}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 rounded-lg bg-muted/40 px-3 py-2 text-xs" aria-live="polite">
        <span className="font-medium">{visibleCompanies.length} {selectedSector ? 'empresas en el sector' : 'empresas representadas'}</span>
        <span className="text-emerald-700 dark:text-emerald-400">{activeMovers.up} suben</span>
        <span className="text-rose-700 dark:text-rose-400">{activeMovers.down} bajan</span>
        <span className="text-muted-foreground">{activeMovers.unchanged} sin cambio</span>
        {activeMovers.unknown > 0 && <span className="text-muted-foreground">{activeMovers.unknown} sin dato</span>}
      </div>
      {mapIsEmpty ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {selectedSector
            ? 'No encontramos empresas con esa búsqueda en el sector.'
            : 'No encontramos empresas con esa búsqueda.'}
        </p>
      ) : (
        <div className="h-[400px] w-full sm:h-[500px] lg:h-[560px]">
          <ResponsiveContainer width="100%" height="100%">
            <Treemap
              data={mapData}
              dataKey="size"
              isAnimationActive={false}
              content={(
                <MarketCell
                  onSelectSector={setSelectedSector}
                  onOpenAsset={(symbol) => void navigate(`/asset/${symbol}`)}
                />
              )}
            >
              <Tooltip
                content={({ active, payload }) => {
                  const item = payload?.[0]?.payload as {
                    kind?: 'sector' | 'company';
                    name?: string;
                    company?: string;
                    companyCount?: number;
                    change?: number | null;
                    size?: number;
                    marketCap?: number;
                  } | undefined;
                  if (!active || !item?.name) return null;
                  const itemSector = item.sector ?? selectedSector ?? '';
                  const title = item.kind === 'sector'
                    ? SECTORS[item.name] ?? item.name
                    : `${item.name} · ${item.company ?? ''}`;
                  return (
                    <div className="rounded-lg border bg-popover p-2 text-xs text-popover-foreground shadow">
                      <p className="font-semibold">{title}</p>
                      {item.kind === 'sector' && <p>{item.companyCount} empresas principales</p>}
                      {item.kind === 'company' && <p className="text-muted-foreground">{SECTORS[itemSector] ?? itemSector}</p>}
                      {item.change != null && <p>{item.change > 0 ? '+' : ''}{item.change.toFixed(2)}% hoy</p>}
                      {(item.marketCap ?? item.size) != null && <p>Capitalización: {formatMarketCap(item.marketCap ?? item.size ?? 0)}</p>}
                    </div>
                  );
                }}
              />
            </Treemap>
          </ResponsiveContainer>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs text-muted-foreground" aria-label="Escala de variación diaria">
        <span className="mr-1">Variación diaria:</span>
        <span>-3%</span>
        {[-3, -1.5, -0.5, 0.5, 1.5, 3].map((value) => (
          <span key={value} className="h-3 w-6 rounded-sm sm:w-8" style={{ background: heatColor(value) }} />
        ))}
        <span>+3%</span>
        <span className="ml-1">· más intenso = mayor variación</span>
      </div>
    </div>
  );
}
