// src/features/daily/pages/daily-page.tsx

import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ArrowDownRight,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  ExternalLink,
  Landmark,
  Newspaper,
  Sparkles,
  Sun,
} from 'lucide-react';
import { AssetLogo } from '../../../components/ui/asset-logo';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { LiveValue } from '../../../components/ui/live-value';
import { PageHeader } from '../../../components/ui/page-header';
import { Skeleton } from '../../../components/ui/skeleton';
import { useAuth } from '../../../hooks/use-auth';
import { useConfig } from '../../../hooks/use-config';
import { useDashboard } from '../../../hooks/use-dashboard';
import { usePortfolio } from '../../../hooks/use-portfolio';
import { useWatchlist } from '../../../hooks/use-watchlist';
import { fetchTickerData } from '../../../services/api/asset-api';
import { fetchStockNews } from '../../../services/api/news-api';
import { fetchYahooEconomicCalendar, fetchYahooMarketQuotes } from '../../../services/api/yahoo-finance-api';
import type { AssetData } from '../../../types/dashboard';
import {
  type AgendaEvent,
  type BriefNewsItem,
  buildAgenda,
  buildBriefNews,
  buildMovers,
  buildPortfolioSummary,
  buildUnifiedTotal,
} from '../lib/daily-brief';
import { useCclRate } from '../../../hooks/use-ccl-rate';

/** Upper bound of extra assets to load, since each one can use the plan's daily queries. */
const MAX_FOLLOWED_ASSETS = 12;
const MARKET_SYMBOLS = ['SPY', 'QQQ', 'DIA', 'IWM'];
const MARKET_NAMES: Record<string, string> = { SPY: 'S&P 500', QQQ: 'Nasdaq 100', DIA: 'Dow Jones', IWM: 'Russell 2000' };

const AGENDA_LABELS: Record<AgendaEvent['kind'], string> = {
  earnings: 'Presenta resultados',
  'ex-dividend': 'Fecha ex-dividendo',
  'dividend-payment': 'Paga dividendo',
};

const NEWS_STYLES: Record<BriefNewsItem['kind'], string> = {
  upgrade: 'text-emerald-600 dark:text-emerald-400',
  downgrade: 'text-rose-600 dark:text-rose-400',
  coverage: 'text-primary',
  'insider-buy': 'text-emerald-600 dark:text-emerald-400',
  'insider-sell': 'text-amber-600 dark:text-amber-400',
};

function formatMoney(value: number, currency: string): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
}

function formatPercent(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function changeColor(value: number): string {
  if (value === 0) return 'text-muted-foreground';
  return value > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';
}

function formatDay(date: string): string {
  return new Date(date.length === 10 ? `${date}T00:00:00` : date)
    .toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buen día';
  return hour < 20 ? 'Buenas tardes' : 'Buenas noches';
}

function localIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function SectionSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => <Skeleton key={index} className="h-10 w-full" />)}
    </div>
  );
}

/**
 * Daily summary of what matters for the user's own assets: today's result,
 * biggest moves, upcoming dates and analyst or insider activity.
 */
export default function DailyPage() {
  const { user, profile } = useAuth();
  const config = useConfig();
  const { holdings, loading: portfolioLoading } = usePortfolio();
  const { data: watchlist = [], isLoading: watchlistLoading } = useWatchlist();
  const { selectedTickers, tickersRestored } = useDashboard();

  const heldSymbols = useMemo(() => new Set(holdings.map((holding) => holding.symbol)), [holdings]);
  const followedSymbols = useMemo(
    () => [...new Set([...watchlist.map((item) => item.symbol), ...selectedTickers])]
      .filter((symbol) => !heldSymbols.has(symbol))
      .slice(0, MAX_FOLLOWED_ASSETS),
    [watchlist, selectedTickers, heldSymbols],
  );

  const userId = user?.id ?? null;
  const profileId = profile?.id ?? null;
  const followedQueries = useQueries({
    queries: followedSymbols.map((ticker) => ({
      // Same key as the dashboard, so both screens share one result.
      queryKey: ['assetData', ticker, userId, profileId, config?.useMockData ?? false] as const,
      queryFn: () => fetchTickerData({ queryKey: ['assetData', ticker, config, user, profile], fromPortfolio: true }),
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: 1,
      refetchOnMount: false,
      enabled: Boolean(config?.api && user && profile),
    })),
  });

  const followedAssets = followedQueries.flatMap((query) => (query.data ? [query.data] : []));
  const assets: AssetData[] = useMemo(() => {
    const bySymbol = new Map<string, AssetData>();
    for (const holding of holdings) {
      if (holding.assetData) bySymbol.set(holding.symbol, holding.assetData);
    }
    for (const asset of followedAssets) bySymbol.set(asset.symbol, asset);
    return [...bySymbol.values()];
    // followedAssets is rebuilt each render; its content only changes with the query data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdings, followedQueries.map((query) => query.dataUpdatedAt).join()]);

  const summary = useMemo(() => buildPortfolioSummary(holdings), [holdings]);
  const ccl = useCclRate();
  const unified = buildUnifiedTotal(summary, ccl.data?.rate);
  const movers = useMemo(() => buildMovers(assets), [assets]);
  const agenda = useMemo(() => buildAgenda(assets).slice(0, 8), [assets]);
  const news = useMemo(() => buildBriefNews(assets), [assets]);
  const topMover = movers[0]?.symbol;

  const market = useQuery({
    queryKey: ['daily-market'],
    queryFn: () => fetchYahooMarketQuotes(MARKET_SYMBOLS),
    staleTime: 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
  });
  const today = localIsoDate(new Date());
  const tomorrow = localIsoDate(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const economic = useQuery({
    queryKey: ['daily-economic', today],
    queryFn: () => fetchYahooEconomicCalendar(today, tomorrow, 'US'),
    staleTime: 15 * 60 * 1000,
  });
  const headlines = useQuery({
    queryKey: ['daily-headlines', topMover],
    queryFn: () => fetchStockNews(topMover ?? '', config, 0, 3),
    enabled: Boolean(topMover && config),
    staleTime: 15 * 60 * 1000,
  });

  const isLoadingAssets = portfolioLoading || watchlistLoading || !tickersRestored ||
    followedQueries.some((query) => query.isLoading);
  const hasNoAssets = !isLoadingAssets && assets.length === 0;
  const firstName = profile?.first_name;
  const dateLabel = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="container-wide stack-6">
      <PageHeader
        icon={<Sun className="w-8 h-8 text-primary" />}
        title={`${greeting()}${firstName ? `, ${firstName}` : ''}`}
        description={`Esto es lo que importa hoy, ${dateLabel}.`}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {MARKET_SYMBOLS.map((symbol) => {
          const quote = market.data?.quotes.find((item) => item.symbol === symbol);
          const change = quote?.changePercent.value ?? null;
          return (
            <Card key={symbol} className="p-3 sm:p-4">
              <p className="text-xs text-muted-foreground">{MARKET_NAMES[symbol]}</p>
              {market.isLoading ? <Skeleton className="mt-1 h-6 w-20" /> : (
                <LiveValue value={quote?.price.value} className={`mt-1 inline-block text-lg font-semibold tabular-nums ${changeColor(change ?? 0)}`}>
                  {change !== null ? formatPercent(change) : 'N/D'}
                </LiveValue>
              )}
              <p className="text-[11px] text-muted-foreground">vía {symbol}</p>
            </Card>
          );
        })}
      </div>

      {hasNoAssets ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <Sparkles className="h-10 w-10 text-primary" />
            <div>
              <p className="text-lg font-semibold">Armá tu resumen diario</p>
              <p className="mx-auto max-w-md text-sm text-muted-foreground">
                Sumá tus inversiones o los activos que seguís y acá vas a ver cada día cómo les fue, cuándo reportan
                resultados y qué dicen los analistas.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild><Link to="/portfolio">Cargar mi cartera</Link></Button>
              <Button asChild variant="outline"><Link to="/dashboard">Seguir activos</Link></Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {(summary.length > 0 || portfolioLoading) && (
            <Card className="border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BriefcaseBusiness className="h-4 w-4 text-primary" />
                  Tu cartera hoy
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                {portfolioLoading ? <Skeleton className="h-16 w-full" /> : summary.map((line) => (
                  <div key={line.currency}>
                    <LiveValue value={line.value} className="text-2xl font-bold tabular-nums">
                      {formatMoney(line.value, line.currency)}
                    </LiveValue>
                    <p className={`text-sm font-medium tabular-nums ${changeColor(line.dayChange)}`}>
                      {line.dayChange > 0 ? '+' : ''}{formatMoney(line.dayChange, line.currency)}
                      {line.dayChangePercent !== null && ` (${formatPercent(line.dayChangePercent)})`} hoy
                    </p>
                  </div>
                ))}
                {unified && (
                  <p className="text-sm text-muted-foreground sm:col-span-2">
                    Total al dólar CCL: <b className="text-foreground">{formatMoney(unified.usd, 'USD')}</b> · {formatMoney(unified.ars, 'ARS')}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Lo que más se movió</CardTitle>
                <CardDescription>Entre tus inversiones y los activos que seguís.</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingAssets && movers.length === 0 ? <SectionSkeleton /> : (
                  <ul className="divide-y divide-border">
                    {movers.map((asset) => {
                      const change = asset.quote.changePercentage;
                      const Icon = change >= 0 ? ArrowUpRight : ArrowDownRight;
                      return (
                        <li key={asset.symbol}>
                          <Link to={`/asset/${asset.symbol}`} className="flex items-center gap-3 py-2.5 hover:opacity-80">
                            <AssetLogo morph symbol={asset.symbol} name={asset.profile.companyName} src={asset.profile.image} />
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-semibold">{asset.symbol}</span>
                              <span className="block truncate text-xs text-muted-foreground">{asset.profile.companyName}</span>
                            </span>
                            <span className="text-right">
                              <LiveValue value={asset.quote.price} className="block text-sm font-medium tabular-nums">
                                {formatMoney(asset.quote.price, asset.profile.currency || 'USD')}
                              </LiveValue>
                              <span className={`inline-flex items-center text-xs font-medium tabular-nums ${changeColor(change)}`}>
                                <Icon className="h-3 w-3" />{formatPercent(change)}
                              </span>
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  Próximas fechas
                </CardTitle>
                <CardDescription>Resultados y dividendos de tus activos en las próximas dos semanas.</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingAssets && agenda.length === 0 ? <SectionSkeleton /> : agenda.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Sin fechas importantes en las próximas dos semanas.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {agenda.map((event) => (
                      <li key={`${event.symbol}-${event.kind}-${event.date}`}>
                        <Link to={`/asset/${event.symbol}`} className="flex items-center gap-3 py-2.5 hover:opacity-80">
                          <AssetLogo symbol={event.symbol} name={event.name} src={event.image} className="size-7" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold">{event.symbol}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {AGENDA_LABELS[event.kind]}{event.isEstimate ? ' (fecha estimada)' : ''}
                            </span>
                          </span>
                          <Badge variant="outline" className="capitalize">{formatDay(event.date)}</Badge>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Novedades de tus activos</CardTitle>
                <CardDescription>Cambios de analistas de la última semana y operaciones de directivos.</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingAssets && news.length === 0 ? <SectionSkeleton /> : news.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Sin novedades recientes.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {news.map((item, index) => (
                      <li key={`${item.symbol}-${item.date}-${index}`}>
                        <Link to={`/asset/${item.symbol}`} className="flex items-center gap-3 py-2.5 hover:opacity-80">
                          <AssetLogo symbol={item.symbol} name={item.name} src={item.image} className="size-7" />
                          <span className="min-w-0 flex-1">
                            <span className={`block truncate text-sm font-medium ${NEWS_STYLES[item.kind]}`}>{item.title}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {item.symbol}{item.detail ? ` · ${item.detail}` : ''}
                            </span>
                          </span>
                          <span className="shrink-0 text-xs capitalize text-muted-foreground">{formatDay(item.date)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <div className="space-y-6">
              {topMover && (headlines.data?.length ?? 0) > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Newspaper className="h-4 w-4 text-primary" />
                      Noticias de {topMover}
                    </CardTitle>
                    <CardDescription>Tu activo con mayor movimiento del día.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="divide-y divide-border">
                      {headlines.data?.map((article) => (
                        <li key={article.url}>
                          <a href={article.url} target="_blank" rel="noreferrer" className="flex items-start gap-2 py-2.5 text-sm hover:text-primary">
                            <span className="flex-1">
                              {article.title}
                              <span className="block text-xs text-muted-foreground">{article.site}</span>
                            </span>
                            <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {(economic.data?.length ?? 0) > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Landmark className="h-4 w-4 text-primary" />
                      Economía de EE. UU. hoy
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="divide-y divide-border">
                      {economic.data?.slice(0, 5).map((event, index) => (
                        <li key={`${event.event}-${index}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                          <span className="min-w-0 truncate">{event.event}</span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">
                            {event.actual ?? new Date(event.date).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <Button asChild variant="link" className="mt-1 h-auto p-0 text-xs">
                      <Link to="/economic-calendar">Ver calendario completo</Link>
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
