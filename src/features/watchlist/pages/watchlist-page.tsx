// src/features/watchlist/pages/watchlist-page.tsx

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderPlus, Star, Trash2 } from 'lucide-react';
import { useWatchlist, useWatchlistMutations } from '../../../hooks/use-watchlist';
import { usePlanLimits } from '../../../hooks/use-plan-limits';
import { usePrefetchAsset } from '../../../hooks/use-prefetch-asset';
import { AssetLogo } from '../../../components/ui/asset-logo';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { LiveValue } from '../../../components/ui/live-value';
import { PageHeader } from '../../../components/ui/page-header';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Skeleton } from '../../../components/ui/skeleton';
import { UpgradeHint } from '../../../components/shared/upgrade-hint';
import { cn } from '../../../lib/utils';
import { TickerAddForm } from '../../dashboard/components/ticker-input/ticker-add-form';
import { useWatchlistQuotes } from '../hooks/use-watchlist-quotes';

const ALL = 'Todas';
const DEFAULT_LIST = 'General';

function formatPercent(value: number | null): string {
  if (value === null) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function changeColor(value: number | null): string {
  if (value === null || value === 0) return 'text-muted-foreground';
  return value > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
}

/** The assets a user follows, grouped into lists, with how each one moves today. */
export default function WatchlistPage() {
  const { data: watchlist = [], isLoading, error } = useWatchlist();
  const { addToWatchlist, removeFromWatchlist, moveToList } = useWatchlistMutations();
  const { limit, isAtLimit } = usePlanLimits('watchlist', watchlist.length);
  const { prefetchAssetIfNotCached } = usePrefetchAsset();
  const [selectedList, setSelectedList] = useState(ALL);
  const [newListName, setNewListName] = useState('');
  const [pendingLists, setPendingLists] = useState<string[]>([]);

  const lists = useMemo(() => {
    const names = new Set([DEFAULT_LIST, ...watchlist.map((item) => item.list_name ?? DEFAULT_LIST), ...pendingLists]);
    return [...names].sort((a, b) => (a === DEFAULT_LIST ? -1 : b === DEFAULT_LIST ? 1 : a.localeCompare(b, 'es')));
  }, [watchlist, pendingLists]);
  const visible = selectedList === ALL
    ? watchlist
    : watchlist.filter((item) => (item.list_name ?? DEFAULT_LIST) === selectedList);

  const { data: live, isLoading: quotesLoading } = useWatchlistQuotes(watchlist.map((item) => item.symbol));
  const changes = visible
    .map((item) => live?.quotes.get(item.symbol)?.changePercent.value ?? null)
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const average = changes.length > 0 ? changes.reduce((total, value) => total + value, 0) / changes.length : null;

  const addSymbol = (symbol: string) => {
    if (watchlist.some((item) => item.symbol === symbol)) {
      const existing = watchlist.find((item) => item.symbol === symbol);
      if (selectedList !== ALL && existing && existing.list_name !== selectedList) {
        moveToList.mutate({ symbol, listName: selectedList });
      }
      return;
    }
    addToWatchlist.mutate({ symbol, list_name: selectedList === ALL ? DEFAULT_LIST : selectedList });
  };

  const createList = () => {
    const name = newListName.trim().slice(0, 40);
    if (!name || name === ALL) return;
    if (!lists.includes(name)) setPendingLists((current) => [...current, name]);
    setSelectedList(name);
    setNewListName('');
  };

  return (
    <div className="container-wide stack-6">
      <PageHeader
        icon={<Star className="w-8 h-8 text-primary" />}
        title="Watchlist"
        description="Seguí tus activos en listas y mirá cómo se mueven hoy, en vivo."
      />

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Agregar activo</CardTitle>
              <CardDescription>
                Se suma a {selectedList === ALL ? `la lista ${DEFAULT_LIST}` : `la lista ${selectedList}`}.
              </CardDescription>
            </div>
            <Badge variant={isAtLimit ? 'destructive' : 'secondary'}>{watchlist.length} / {limit}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {isAtLimit
            ? <UpgradeHint message={`Llegaste al límite de ${limit} activos de tu plan.`} />
            : <TickerAddForm onAddTicker={addSymbol} />}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        {[ALL, ...lists].map((name) => (
          <Button
            key={name}
            size="sm"
            variant={selectedList === name ? 'default' : 'outline'}
            onClick={() => setSelectedList(name)}
          >
            {name}
            <span className="ml-1.5 text-xs opacity-70">
              {name === ALL ? watchlist.length : watchlist.filter((item) => (item.list_name ?? DEFAULT_LIST) === name).length}
            </span>
          </Button>
        ))}
        <form
          className="flex items-center gap-1.5"
          onSubmit={(event) => { event.preventDefault(); createList(); }}
        >
          <Input
            value={newListName}
            onChange={(event) => setNewListName(event.target.value)}
            placeholder="Nueva lista"
            maxLength={40}
            className="h-9 w-36"
            aria-label="Nombre de la nueva lista"
          />
          <Button type="submit" size="sm" variant="outline" className="gap-1.5" disabled={!newListName.trim()}>
            <FolderPlus className="h-4 w-4" />
            Crear
          </Button>
        </form>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <CardTitle className="text-base">{selectedList === ALL ? 'Todos tus activos' : selectedList}</CardTitle>
            {average !== null && (
              <p className="text-sm text-muted-foreground">
                Promedio de hoy <span className={cn('font-semibold tabular-nums', changeColor(average))}>{formatPercent(average)}</span>
                {' · '}{changes.filter((value) => value > 0).length} suben · {changes.filter((value) => value < 0).length} bajan
              </p>
            )}
          </div>
          {live && (
            <CardDescription>
              Se actualiza cada minuto. Última: {new Date(live.fetchedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="py-8 text-center text-sm text-destructive">No se pudo cargar tu watchlist. Probá de nuevo en unos minutos.</p>
          ) : isLoading ? (
            <div className="space-y-2">{[0, 1, 2].map((key) => <Skeleton key={key} className="h-12 w-full" />)}</div>
          ) : visible.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {watchlist.length === 0
                ? 'Todavía no seguís ningún activo. Buscalo arriba o tocá la estrella en la página de cualquier activo.'
                : 'Esta lista está vacía. Agregá un activo arriba o mové uno desde otra lista.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Activo</th>
                    <th className="py-2 pr-3 text-right font-medium">Precio</th>
                    <th className="py-2 pr-3 text-right font-medium">Hoy</th>
                    <th className="hidden py-2 pr-3 text-right font-medium sm:table-cell">Variación</th>
                    <th className="hidden py-2 pr-3 font-medium md:table-cell">Lista</th>
                    <th className="py-2"><span className="sr-only">Quitar</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visible.map((item) => {
                    const quote = live?.quotes.get(item.symbol);
                    const price = quote?.price.value ?? null;
                    const changePercent = quote?.changePercent.value ?? null;
                    const change = quote?.change.value ?? null;
                    return (
                      <tr key={item.id} className="hover:bg-muted/40">
                        <td className="py-2.5 pr-3">
                          <Link
                            to={`/asset/${item.symbol}`}
                            className="flex min-w-0 items-center gap-3"
                            onMouseEnter={() => prefetchAssetIfNotCached(item.symbol)}
                          >
                            <AssetLogo symbol={item.symbol} className="size-8" />
                            <span className="min-w-0">
                              <span className="block font-semibold">{item.symbol}</span>
                              <span className="block max-w-[14rem] truncate text-xs text-muted-foreground">{quote?.name ?? ''}</span>
                            </span>
                          </Link>
                        </td>
                        <td className="py-2.5 pr-3 text-right tabular-nums">
                          {price === null
                            ? (quotesLoading ? <Skeleton className="ml-auto h-4 w-16" /> : '—')
                            : <LiveValue value={price}>{price.toLocaleString('es-AR', { maximumFractionDigits: 2 })} {quote?.currency ?? ''}</LiveValue>}
                        </td>
                        <td className={cn('py-2.5 pr-3 text-right font-semibold tabular-nums', changeColor(changePercent))}>
                          {formatPercent(changePercent)}
                        </td>
                        <td className={cn('hidden py-2.5 pr-3 text-right tabular-nums sm:table-cell', changeColor(change))}>
                          {change === null ? '—' : `${change > 0 ? '+' : ''}${change.toFixed(2)}`}
                        </td>
                        <td className="hidden py-2.5 pr-3 md:table-cell">
                          <Select
                            value={item.list_name ?? DEFAULT_LIST}
                            onValueChange={(listName) => moveToList.mutate({ symbol: item.symbol, listName })}
                          >
                            <SelectTrigger className="h-8 w-36" aria-label={`Lista de ${item.symbol}`}><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {lists.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-2.5 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Dejar de seguir ${item.symbol}`}
                            onClick={() => removeFromWatchlist.mutate(item.symbol)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
