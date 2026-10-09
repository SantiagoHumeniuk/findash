import { useRef, useState } from 'react';
import { BookOpen, Check, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '../../../components/ui/button';
import { usePortfolio } from '../../../hooks/use-portfolio';
import { getImportUnitConversion, getPriceInUsd, isArsCurrency, isUsdCurrency, parsePortfolioCsv, mapCsvRowsToTransactions } from '../lib/csv-import';
import { useCedearRatios } from '../../../hooks/use-cedear-ratios';
import { useCclRate } from '../../../hooks/use-ccl-rate';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog';

const brokerNames = {
  iol: 'IOL',
  balanz: 'BALANZ',
  cocos: 'COCOS',
  'bull-market': 'Bull Market',
  unknown: 'Formato compatible',
};

interface ImportDraft {
  fileName: string;
  portfolioId: number;
  portfolioName: string;
  broker: keyof typeof brokerNames;
  rows: ReturnType<typeof parsePortfolioCsv>['rows'];
  invalidRows: number;
}

/**
 * Permite importar un portafolio desde CSV exportado por brokers como IOL, Balanz, Cocos y Bull Market.
 *
 * Cada fila válida del archivo se normaliza a transacciones del modelo interno del portafolio.
 */
export function CsvImportButton() {
  const { importTransactions, currentPortfolio } = usePortfolio();
  const { ratios: cedearRatios, loading: loadingRatios } = useCedearRatios();
  const { data: cclQuote, isLoading: loadingCcl } = useCclRate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<ImportDraft | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [showGuide, setShowGuide] = useState(false);
  const [importAsCedears, setImportAsCedears] = useState(false);

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('El archivo supera el límite de 10 MB.');
      event.target.value = '';
      return;
    }

    if (!currentPortfolio) {
      toast.error('Selecciona un portafolio antes de importar un CSV.');
      event.target.value = '';
      return;
    }

    try {
      const csvText = await file.text();
      const parsed = parsePortfolioCsv(csvText, file.name);

      if (parsed.rows.length === 0) {
        throw new Error('No se encontraron filas válidas. El CSV debe incluir símbolo, cantidad y cotización o importe.');
      }

      setDraft({
        fileName: file.name,
        portfolioId: currentPortfolio.id,
        portfolioName: currentPortfolio.name,
        broker: parsed.broker,
        rows: parsed.rows,
        invalidRows: parsed.invalidRows,
      });
      setSelectedRows(new Set(parsed.rows.map((_, index) => index)));
    } catch (error) {
      console.error('CSV import failed', error);
      toast.error('No se pudo importar el CSV', {
        description: error instanceof Error ? error.message : 'Revisa el formato del archivo.',
      });
    } finally {
      event.target.value = '';
    }
  };

  const handleConfirmImport = async () => {
    if (!draft || selectedRows.size === 0) return;

    setLoading(true);
    try {
      const rowsToImport = draft.rows.filter((_, index) => selectedRows.has(index));
      const transactions = mapCsvRowsToTransactions(rowsToImport, draft.portfolioId, {
        asCedears: importAsCedears,
        cedearRatios,
        cclRate: cclQuote?.rate,
      });
      await importTransactions(transactions);
      toast.success(`${transactions.length} operaciones importadas a ${draft.portfolioName}.`, {
        description: draft.invalidRows > 0
          ? `${draft.invalidRows} filas inválidas fueron excluidas.`
          : `${brokerNames[draft.broker]} · ${draft.fileName}`,
      });
      setDraft(null);
      setSelectedRows(new Set());
      setImportAsCedears(false);
    } catch (error) {
      toast.error('No se pudo completar la importación', {
        description: error instanceof Error ? error.message : 'Intenta nuevamente.',
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = (index: number) => {
    setSelectedRows((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const selectedCsvRows = draft?.rows.filter((_, index) => selectedRows.has(index)) ?? [];
  const needsCcl = selectedCsvRows.some((row) => isArsCurrency(row.currency));
  const unsupportedCurrencies = selectedCsvRows.filter((row) => !isUsdCurrency(row.currency) && !isArsCurrency(row.currency));
  const missingCedearRatios = importAsCedears
    ? selectedCsvRows.filter((row) => getImportUnitConversion(row, true, cedearRatios).source === 'fallback')
    : [];

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(event) => void handleFileImport(event)}
      />

      <Button
        type="button"
        variant="outline"
        className="gap-2 shadow-premium hover:shadow-none transition-all"
        onClick={() => fileInputRef.current?.click()}
        disabled={loading}
      >
        <Upload className="h-4 w-4" />
        {loading ? 'Importando...' : 'Importar CSV'}
      </Button>

      <Button type="button" variant="ghost" size="sm" className="gap-2" onClick={() => setShowGuide(true)}>
        <BookOpen className="h-4 w-4" />
        Guía CSV
      </Button>

      <Dialog open={draft !== null} onOpenChange={(open) => !open && !loading && setDraft(null)}>
        <DialogContent className="flex max-h-[85vh] max-w-4xl flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Revisar importación</DialogTitle>
            <DialogDescription>
              {draft && `${brokerNames[draft.broker]} · ${draft.fileName} · destino: ${draft.portfolioName}`}
            </DialogDescription>
          </DialogHeader>

          {draft && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-y py-3 text-sm">
                <p>
                  <span className="font-semibold text-foreground">{selectedRows.size}</span> de {draft.rows.length} operaciones seleccionadas
                  {draft.invalidRows > 0 && (
                    <span className="ml-2 text-amber-600 dark:text-amber-400">· {draft.invalidRows} filas inválidas omitidas</span>
                  )}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedRows(
                    selectedRows.size === draft.rows.length
                      ? new Set()
                      : new Set(draft.rows.map((_, index) => index))
                  )}
                >
                  {selectedRows.size === draft.rows.length ? 'Deseleccionar todas' : 'Seleccionar todas'}
                </Button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Tipo de tenencia</p>
                  <p className="text-xs text-muted-foreground">Todos los costos se guardan en USD; los precios en ARS se convierten con CCL.</p>
                </div>
                <div className="flex gap-2" role="group" aria-label="Tipo de tenencia a importar">
                  <Button type="button" size="sm" variant={importAsCedears ? 'outline' : 'default'} onClick={() => setImportAsCedears(false)}>Acciones</Button>
                  <Button type="button" size="sm" variant={importAsCedears ? 'default' : 'outline'} onClick={() => setImportAsCedears(true)}>CEDEARs</Button>
                </div>
              </div>

              {needsCcl && cclQuote && (
                <p className="text-xs text-muted-foreground">
                  Cotización CCL venta aplicada a precios ARS: ${cclQuote.rate.toLocaleString('es-AR', { maximumFractionDigits: 2 })} ARS/USD.
                </p>
              )}
              {needsCcl && !cclQuote && (
                <p className="text-xs text-destructive">
                  {loadingCcl ? 'Obteniendo cotización CCL...' : 'CCL no disponible; no se pueden confirmar precios en USD.'}
                </p>
              )}
              {importAsCedears && missingCedearRatios.length > 0 && (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  {loadingRatios
                    ? 'Cargando ratios CEDEAR...'
                    : `Sin ratio cargado para ${missingCedearRatios.map((row) => row.symbol).join(', ')}; se importarán con relación 1:1. Revisá estas filas antes de confirmar.`}
                </p>
              )}
              {unsupportedCurrencies.length > 0 && (
                <p className="text-xs text-destructive">
                  Moneda no compatible para: {unsupportedCurrencies.map((row) => `${row.symbol} (${row.currency})`).join(', ')}. Usa ARS o USD.
                </p>
              )}

              {draft.rows.some((row) => row.dateEstimated) && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Sin fecha en el CSV: se usará la fecha de hoy para esas filas.
                </p>
              )}

              <div className="min-h-0 flex-1 overflow-auto rounded-md border">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="sticky top-0 z-10 bg-muted text-left text-muted-foreground">
                    <tr>
                      <th className="w-10 px-3 py-2" scope="col"><span className="sr-only">Incluir</span></th>
                      <th className="px-3 py-2 font-medium" scope="col">Activo</th>
                      <th className="px-3 py-2 text-right font-medium" scope="col">Unidades equivalentes</th>
                      <th className="px-3 py-2 text-right font-medium" scope="col">{importAsCedears ? 'Costo acción equivalente (USD)' : 'Precio promedio (USD)'}</th>
                      <th className="px-3 py-2 text-right font-medium" scope="col">Importe (USD)</th>
                      <th className="px-3 py-2 font-medium" scope="col">Fecha</th>
                      <th className="px-3 py-2 font-medium" scope="col">Operación</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {draft.rows.map((row, index) => (
                      <tr key={`${row.symbol}-${row.date}-${index}`} className="hover:bg-muted/40">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            aria-label={`Incluir ${row.symbol}`}
                            checked={selectedRows.has(index)}
                            onChange={() => toggleRow(index)}
                            className="h-4 w-4 accent-primary"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <span className="block font-medium">{row.symbol}</span>
                          {(row.title || row.market || row.currency) && (
                            <span className="block text-xs text-muted-foreground">
                              {[row.title, row.market, row.currency].filter(Boolean).join(' · ')}
                            </span>
                          )}
                          {importAsCedears && missingCedearRatios.some((missingRow) => missingRow.symbol === row.symbol) && (
                            <span className="block text-xs text-amber-700 dark:text-amber-400">Sin ratio: relación 1:1</span>
                          )}
                          {getImportUnitConversion(row, importAsCedears, cedearRatios).source === 'local-adr' && (
                            <span className="block text-xs text-muted-foreground">Acción local: 10 acciones = 1 ADR</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {(row.quantity / getImportUnitConversion(row, importAsCedears, cedearRatios).factor).toLocaleString('es-AR')}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {(() => {
                            if (!isUsdCurrency(row.currency) && !isArsCurrency(row.currency)) return 'Moneda no compatible';
                            if (isArsCurrency(row.currency) && !cclQuote) return 'CCL pendiente';
                            const usdPrice = getPriceInUsd(row.price, row.currency, cclQuote?.rate);
                            const conversion = getImportUnitConversion(row, importAsCedears, cedearRatios);
                            const previewPrice = usdPrice * conversion.factor;
                            return `${previewPrice.toLocaleString('es-AR', { maximumFractionDigits: 6 })} USD`;
                          })()}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {row.amount === null
                            ? '—'
                            : isArsCurrency(row.currency)
                              ? cclQuote
                                ? (row.amount / cclQuote.rate).toLocaleString('es-AR', { maximumFractionDigits: 2 })
                                : 'CCL pendiente'
                              : row.amount.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-2" title={row.dateEstimated ? 'Fecha asignada durante la importación' : undefined}>
                          {new Date(row.date).toLocaleDateString('es-AR')}{row.dateEstimated ? ' *' : ''}
                        </td>
                        <td className="px-3 py-2">{row.type === 'buy' ? 'Compra' : 'Venta'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <DialogFooter className="gap-2 sm:gap-2">
                <Button type="button" variant="outline" onClick={() => setDraft(null)} disabled={loading}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleConfirmImport()}
                  disabled={loading || selectedRows.size === 0 || (needsCcl && !cclQuote) || unsupportedCurrencies.length > 0 || (importAsCedears && loadingRatios)}
                >
                  <Check className="mr-2 h-4 w-4" />
                  {loading ? 'Guardando...' : `Importar ${selectedRows.size} operaciones`}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showGuide} onOpenChange={setShowGuide}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Guía rápida para CSV</DialogTitle>
            <DialogDescription>
              Una fila por activo u operación. El orden de las columnas puede variar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <section className="space-y-1">
              <h3 className="font-semibold">Columnas de tenencia compatibles</h3>
              <p className="text-muted-foreground">También se acepta este formato de cartera:</p>
              <code className="block overflow-x-auto rounded bg-muted p-2 text-xs">
                Título,Símbolo,Mercado,Cantidad,Moneda,Cotización,Importe
              </code>
            </section>
            <section className="space-y-1">
              <h3 className="font-semibold">Datos necesarios</h3>
              <p className="text-muted-foreground">
                Símbolo o ticker, cantidad y cotización o precio. Si falta el precio unitario, se calcula como Importe dividido por Cantidad.
              </p>
              <p className="text-muted-foreground">
                También reconoce nombres como Especie/Activo, Tenencia/Saldo, Precio promedio/Costo medio, Fecha de concertación y Operación.
              </p>
              <p className="text-muted-foreground">
                Todos los precios de compra se guardan en USD. Los precios en ARS (o sin moneda indicada) se dividen por el CCL venta vigente; los declarados en USD quedan iguales. En modo CEDEAR también se ajusta cantidad y precio según el ratio. Solo se aceptan ARS y USD.
              </p>
              <p className="text-muted-foreground">
                Las acciones argentinas con ADR se normalizan a la unidad del ADR que usa la cotización USD del análisis; para BMA, 10 acciones locales equivalen a 1 ADR.
              </p>
            </section>
            <section className="space-y-1">
              <h3 className="font-semibold">Formato del archivo</h3>
              <p className="text-muted-foreground">
                Guardalo como CSV UTF-8. Se aceptan separadores coma, punto y coma o tabulador; encerrá entre comillas los valores que contengan comas.
              </p>
            </section>
            <p className="border-l-2 border-amber-500 pl-3 text-muted-foreground">
              Si falta la fecha se asigna hoy; si falta la operación se asume compra. En una tenencia, la cotización queda como precio de compra: es una posición inicial y no reconstruye el historial ni la ganancia previa. Título, mercado y moneda se muestran en la vista previa, pero el portafolio actualmente no los almacena.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}