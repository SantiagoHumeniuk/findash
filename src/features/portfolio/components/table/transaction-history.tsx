// src/features/portfolio/components/table/transaction-history.tsx

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Transaction } from "../../../../types/portfolio";
import { DataTable } from '../../../dividends/components';
import { useReactTable, getCoreRowModel, getPaginationRowModel, ColumnDef } from "@tanstack/react-table";
import { formatCurrency } from '../../../../lib/utils';
import { formatDate, formatQuantity } from '../../lib/portfolio.utils';

interface TransactionHistoryProps {
    transactions: Transaction[];
    embedded?: boolean;
}

export function TransactionHistory({ transactions, embedded = false }: TransactionHistoryProps) {
    const columns = useMemo<ColumnDef<Transaction>[]>(() => [
        { accessorKey: "purchase_date", header: "Fecha", cell: ({ getValue }) => formatDate(getValue() as string) },
        { accessorKey: "symbol", header: "Activo" },
        { accessorKey: "transaction_type", header: "Tipo", cell: ({ getValue }) => <span className={`font-semibold ${getValue() === 'buy' ? 'text-green-500' : 'text-red-500'}`}>{getValue() === 'buy' ? 'Compra' : 'Venta'}</span> },
        { accessorKey: "quantity", header: "Cantidad", cell: ({ getValue }) => formatQuantity(getValue() as number) },
        { accessorKey: "purchase_price", header: "Precio", cell: ({ getValue }) => formatCurrency(getValue() as number) },
        { id: "totalValue", header: "Valor Total", cell: ({ row }) => formatCurrency(row.original.quantity * row.original.purchase_price) },
    ], []);

    const table = useReactTable({
        data: transactions,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
    });

    if (transactions.length === 0) {
        return (
            <p className="p-6 text-center text-sm text-muted-foreground">
                Todavía no hay transacciones en este portafolio.
            </p>
        );
    }

    const tableContent = (
        <DataTable
            table={table}
            totalPages={table.getPageCount()}
            currentPage={table.getState().pagination.pageIndex + 1}
            onPageChange={(page) => table.setPageIndex(page - 1)}
        />
    );

    if (embedded) {
        return <div className="p-4 sm:p-6">{tableContent}</div>;
    }

    return (
        <Card>
            <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-lg sm:text-xl">Historial de Transacciones</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
                {tableContent}
            </CardContent>
        </Card>
    );
}