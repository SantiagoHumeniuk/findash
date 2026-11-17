// src/features/portfolio/components/table/portfolio-view.tsx

import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { PlusCircle, MinusCircle, Trash2 } from 'lucide-react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  flexRender,
  ColumnDef,
} from '@tanstack/react-table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../../../../components/ui/alert-dialog';
import { PortfolioViewProps } from '../../types/portfolio.types';
import { HoldingWithMetrics } from '../../../../types/portfolio';
import { formatCurrency, formatPercent } from '../../../../lib/utils';
import { formatQuantity } from '../../lib/portfolio.utils';
import { AssetLogo } from '../../../../components/ui/asset-logo';

import { generateAdvisory } from '../../lib/advisory-engine';
import { RecommendationModal } from '../modals/recommendation-modal';

export const PortfolioView = React.memo(function PortfolioView({ holdings, portfolioData, onDeleteAsset, onAddMore, onSell }: PortfolioViewProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<HoldingWithMetrics>[]>(() => [
    {
      accessorKey: 'symbol',
      header: 'Activo',
      cell: ({ row }) => {
        const asset = row.original.assetData;
        const symbol = row.original.symbol;
        const assetSymbol = symbol.replace(/\.BA$/, '');
        const name = asset.profile?.companyName ?? symbol;
        return (
          <Link
            to={`/asset/${assetSymbol}`}
            aria-label={`Ver detalle de ${assetSymbol}`}
            className="flex items-center gap-2 hover:opacity-80"
          >
            <AssetLogo symbol={assetSymbol} name={name} src={asset.profile?.image} className="size-8" />
            <span className="block">
              <span className="font-semibold">{assetSymbol}</span>
              {asset.localMarket && (
                <span className="block text-[11px] text-muted-foreground">
                  {asset.localMarket.kind === 'cedear' ? 'CEDEAR' : asset.profile.industry} · $ {asset.localMarket.arsPrice.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                  {asset.localMarket.impliedCcl && ` · CCL implícito $${asset.localMarket.impliedCcl.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`}
                </span>
              )}
              {asset.priceUnavailable && (
                <span className="block text-[11px] text-amber-600 dark:text-amber-400" title="Sin cotización hoy: se muestra a precio de compra">
                  Sin cotización hoy
                </span>
              )}
            </span>
          </Link>
        );
      },
    },
    {
      accessorKey: 'quantity',
      header: 'Cantidad',
      cell: ({ getValue }) => formatQuantity(getValue() as number),
    },
    {
      accessorKey: 'avgPurchasePrice',
      header: 'Precio Prom.',
      cell: ({ getValue }) => formatCurrency(getValue() as number),
    },
    {
      accessorKey: 'currentPrice',
      header: 'Precio Actual',
      cell: ({ getValue }) => formatCurrency(getValue() as number),
    },
    {
      accessorKey: 'marketValue',
      header: 'Valor Mercado',
      cell: ({ getValue }) => formatCurrency(getValue() as number),
    },
    {
      accessorKey: 'pl',
      header: 'G/P ($)',
      cell: ({ getValue }) => {
        const val = Number(getValue());
        return <span className={val >= 0 ? 'text-green-500 font-medium' : 'text-red-500 font-medium'}>{formatCurrency(val)}</span>;
      },
    },
    {
      accessorKey: 'plPercent',
      header: 'G/P (%)',
      cell: ({ getValue }) => {
        const val = Number(getValue());
        return <span className={val >= 0 ? 'text-green-500 font-medium' : 'text-red-500 font-medium'}>{formatPercent(val)}</span>;
      },
    },
    {
      accessorKey: 'holdingDays',
      header: 'Días',
      cell: ({ getValue }) => <span>{getValue() as number}d</span>,
    },
    {
      id: 'advisory',
      header: 'Recomendación IA',
      cell: ({ row }) => {
        const holding = row.original;
        const result = generateAdvisory(holding.symbol, portfolioData, holdings);
        return <RecommendationModal symbol={holding.symbol} result={result} />;
      }
    },
    {
      id: 'actions',
      header: () => <div className="text-center">Acciones</div>,
      cell: ({ row }) => {
        const holding = row.original;
        return (
          <div className="flex items-center justify-center gap-1 sm:gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 sm:h-10 sm:w-10"
              onClick={() => onAddMore(holding.symbol, holding.currentPrice)}
              aria-label={`Agregar más ${holding.symbol}`}
            >
              <PlusCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-500" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 sm:h-10 sm:w-10"
              onClick={() => onSell(holding)}
              aria-label={`Vender ${holding.symbol}`}
            >
              <MinusCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-500" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10" aria-label={`Eliminar ${holding.symbol}`}>
                  <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="glass-morphism border-none shadow-premium">
                <AlertDialogHeader>
                  <AlertDialogTitle className="heading-premium">¿Estás seguro?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción eliminará permanentemente el activo <strong className="text-foreground">{holding.symbol}</strong> y todo su historial de
                    transacciones.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDeleteAsset(holding.symbol)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        );
      },
    },
  ], [onAddMore, onSell, onDeleteAsset, portfolioData, holdings]);

  const table = useReactTable({
    data: holdings,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (holdings.length === 0) {
    return (
      <Card className="text-center py-8 sm:py-10 px-4">
        <p className="text-sm sm:text-base text-muted-foreground">Todavía no tenés posiciones abiertas.</p>
        <p className="text-xs sm:text-sm text-muted-foreground mt-2">Agregá tu primera transacción desde el Dashboard.</p>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="text-lg sm:text-xl">Posiciones Abiertas</CardTitle>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        <div className="space-y-3 sm:hidden">
          {table.getRowModel().rows.map(({ original: holding }) => {
            const asset = holding.assetData;
            const assetSymbol = holding.symbol.replace(/\.BA$/, '');
            const name = asset.profile?.companyName ?? holding.symbol;
            return (
              <article key={holding.symbol} className="rounded-xl border bg-card p-3">
                <div className="flex items-start justify-between gap-3">
                  <Link
                    to={`/asset/${assetSymbol}`}
                    aria-label={`Ver detalle de ${assetSymbol}`}
                    className="flex min-w-0 items-center gap-2"
                  >
                    <AssetLogo symbol={assetSymbol} name={name} src={asset.profile?.image} className="size-9 shrink-0" />
                    <span className="min-w-0">
                      <span className="block font-semibold">{assetSymbol}</span>
                      <span className="block truncate text-xs text-muted-foreground">{name}</span>
                    </span>
                  </Link>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                    {holding.holdingDays} días
                  </span>
                </div>
                {asset.localMarket && (
                  <p className="mt-2 break-words text-xs text-muted-foreground">
                    {asset.localMarket.kind === 'cedear' ? 'CEDEAR' : asset.profile.industry}
                    {' · $'}{asset.localMarket.arsPrice.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                    {asset.localMarket.impliedCcl && ` · CCL implícito $${asset.localMarket.impliedCcl.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`}
                  </p>
                )}
                {asset.priceUnavailable && (
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">Sin cotización hoy; se muestra el precio de compra.</p>
                )}
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3 border-t pt-3 text-sm">
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">Cantidad</dt>
                    <dd className="break-words font-medium">{formatQuantity(holding.quantity)}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">Precio promedio</dt>
                    <dd className="break-words font-medium">{formatCurrency(holding.avgPurchasePrice)}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">Precio actual</dt>
                    <dd className="break-words font-medium">{formatCurrency(holding.currentPrice)}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">Valor de mercado</dt>
                    <dd className="break-words font-medium">{formatCurrency(holding.marketValue)}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">Ganancia / pérdida</dt>
                    <dd className={`break-words font-medium ${holding.pl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {formatCurrency(holding.pl)}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">Rendimiento</dt>
                    <dd className={`break-words font-medium ${holding.plPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {formatPercent(holding.plPercent)}
                    </dd>
                  </div>
                </dl>
                <div className="mt-2 flex justify-end border-t pt-2">
                  <RecommendationModal
                    symbol={holding.symbol}
                    result={generateAdvisory(holding.symbol, portfolioData, holdings)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10"
                    onClick={() => onAddMore(holding.symbol, holding.currentPrice)}
                    aria-label={`Agregar más ${holding.symbol}`}
                  >
                    <PlusCircle className="h-4 w-4 text-green-500" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10"
                    onClick={() => onSell(holding)}
                    aria-label={`Vender ${holding.symbol}`}
                  >
                    <MinusCircle className="h-4 w-4 text-red-500" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-10 w-10" aria-label={`Eliminar ${holding.symbol}`}>
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="glass-morphism border-none shadow-premium">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="heading-premium">¿Estás seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta acción eliminará permanentemente el activo <strong className="text-foreground">{holding.symbol}</strong> y todo su historial de transacciones.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onDeleteAsset(holding.symbol)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </article>
            );
          })}
        </div>
        <div className="hidden rounded-md border overflow-x-auto sm:block">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className={header.id === 'actions' ? 'text-left' : ''}
                    >
                      {header.isPlaceholder ? null : (
                        <Button
                          variant="ghost"
                          onClick={header.column.getToggleSortingHandler()}
                          disabled={!header.column.getCanSort()}
                          className="hover:bg-transparent"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {{
                            asc: ' ▲',
                            desc: ' ▼',
                          }[header.column.getIsSorted() as string] ?? null}
                        </Button>
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-primary/10">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cell.column.id === 'actions' ? '' : ' pl-6 text-left'}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
});