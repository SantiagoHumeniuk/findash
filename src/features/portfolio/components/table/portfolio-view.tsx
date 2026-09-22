// src/features/portfolio/components/table/portfolio-view.tsx

import React, { useMemo, useState } from 'react';
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

import { generateAdvisory } from '../../lib/advisory-engine';
import { RecommendationModal } from '../modals/recommendation-modal';

export const PortfolioView = React.memo(function PortfolioView({ holdings, portfolioData, onDeleteAsset, onAddMore, onSell }: PortfolioViewProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<HoldingWithMetrics>[]>(() => [
    {
      accessorKey: 'symbol',
      header: 'Activo',
      cell: ({ getValue }) => <span className="font-semibold">{getValue() as string}</span>,
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
        <p className="text-sm sm:text-base text-muted-foreground">Aún no tienes posiciones abiertas.</p>
        <p className="text-xs sm:text-sm text-muted-foreground mt-2">Agrega tu primera transacción desde el Dashboard.</p>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="text-lg sm:text-xl">Posiciones Abiertas</CardTitle>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        <div className="rounded-md border overflow-x-auto">
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
                <TableRow key={row.id}>
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