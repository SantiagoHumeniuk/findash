// src/features/screener/components/market-heatmap.tsx

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { ResponsiveContainer, Tooltip, Treemap } from 'recharts';
import { fetchYahooHeatmap } from '../../../services/api/yahoo-finance-api';

/** Green or red by the size of the day's move, saturating at ±3%. */
function heatColor(change: number | null): string {
  if (change === null) return '#475569';
  const strength = Math.min(Math.abs(change) / 3, 1);
  const hue = change >= 0 ? 152 : 350;
  return `hsl(${hue} ${35 + strength * 45}% ${30 + strength * 8}%)`;
}

interface CellProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  depth?: number;
  name?: string;
  change?: number | null;
  onOpen: (symbol: string) => void;
}

function HeatCell({ x = 0, y = 0, width = 0, height = 0, depth = 0, name = '', change = null, onOpen }: CellProps) {
  if (depth !== 2) {
    return (
      <g>
        <rect x={x} y={y} width={width} height={height} fill="none" stroke="hsl(var(--background))" strokeWidth={3} />
      </g>
    );
  }
  const showSymbol = width > 34 && height > 20;
  const showChange = width > 44 && height > 38;
  const fontSize = Math.min(Math.max(width / 6, 10), 18);
  return (
    <g
      role="link"
      aria-label={`Abrir ${name}`}
      tabIndex={0}
      style={{ cursor: 'pointer' }}
      onClick={() => onOpen(name)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onOpen(name);
      }}
    >
      <rect x={x} y={y} width={width} height={height} fill={heatColor(change)} stroke="hsl(var(--background))" strokeWidth={1} />
      {showSymbol && (
        <text x={x + width / 2} y={y + height / 2 - (showChange ? 4 : -4)} textAnchor="middle" fill="#fff" stroke="none" fontSize={fontSize} fontWeight={700}>
          {name}
        </text>
      )}
      {showChange && change !== null && (
        <text x={x + width / 2} y={y + height / 2 + fontSize} textAnchor="middle" fill="#fff" stroke="none" fontSize={Math.max(fontSize - 3, 9)}>
          {change > 0 ? '+' : ''}{change.toFixed(2)}%
        </text>
      )}
    </g>
  );
}

/** Largest US companies per sector: area is market cap, color is today's move. */
export function MarketHeatmap() {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['market-heatmap'],
    queryFn: fetchYahooHeatmap,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
  const tree = useMemo(() => (data ?? []).map(({ sector, companies }) => ({
    name: sector,
    children: companies.flatMap((company) => (company.marketCap
      ? [{ name: company.symbol, company: company.name, sector, size: company.marketCap, change: company.changePercent }]
      : [])),
  })), [data]);

  if (isLoading) return <div className="flex h-96 items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (isError || tree.length === 0) return <p className="p-4 text-sm text-destructive">No se pudo cargar el mapa del mercado.</p>;

  return (
    <div>
      <div className="h-[560px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <Treemap
            data={tree}
            dataKey="size"
            isAnimationActive={false}
            content={<HeatCell onOpen={(symbol) => void navigate(`/asset/${symbol}`)} />}
          >
            <Tooltip
              content={({ active, payload }) => {
                const item = payload?.[0]?.payload as { name?: string; company?: string; sector?: string; change?: number | null } | undefined;
                if (!active || !item?.company) return null;
                return (
                  <div className="rounded-lg border bg-popover p-2 text-xs text-popover-foreground shadow">
                    <p className="font-semibold">{item.name} · {item.company}</p>
                    <p className="text-muted-foreground">{item.sector}</p>
                    {item.change != null && <p>{item.change > 0 ? '+' : ''}{item.change.toFixed(2)}% hoy</p>}
                  </div>
                );
              }}
            />
          </Treemap>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex items-center justify-center gap-1 text-xs text-muted-foreground" aria-label="Escala de color">
        <span>-3%</span>
        {[-3, -1.5, -0.5, 0.5, 1.5, 3].map((value) => (
          <span key={value} className="h-3 w-8 rounded-sm" style={{ background: heatColor(value) }} />
        ))}
        <span>+3%</span>
      </div>
    </div>
  );
}
