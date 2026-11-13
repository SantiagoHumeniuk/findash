// src/features/portfolio/components/broker-import-button.tsx

import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, BookOpen, Check, CheckCircle2, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { Input } from '../../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { usePortfolio } from '../../../hooks/use-portfolio';
import { usePortfolioLimits } from '../../../hooks/use-portfolio-limits';
import { useCedearRatios } from '../../../hooks/use-cedear-ratios';
import { fetchCclRate } from '../../../hooks/use-ccl-rate';
import { fetchLocalMarket } from '../../../services/api/local-market-api';
import { fetchYahooMarketQuotes } from '../../../services/api/yahoo-finance-api';
import { cn } from '../../../lib/utils';
import {
  ASSET_KIND_LABELS,
  IMPORTABLE_KINDS,
  classifyRow,
  finalizeRow,
  localSymbol,
  parseBrokerSheets,
  toTransactions,
  type AssetKind,
  type ClassifiedRow,
  type ClassifyContext,
} from '../lib/broker-import';
import { readSpreadsheet } from '../lib/read-spreadsheet';

interface Draft {
  fileName: string;
  broker: string;
  portfolioId: number;
  portfolioName: string;
  rows: ClassifiedRow[];
  skippedLines: number;
  context: ClassifyContext;
}

const ars = (value: number | null) => value === null
  ? '—'
  : value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const number = (value: number) => value.toLocaleString('es-AR', { maximumFractionDigits: 4 });

/** US prices for the tickers that could be US shares or CEDEARs (local bonds and stocks are skipped). */
async function fetchUsPrices(symbols: string[]): Promise<Map<string, number>> {
  const prices = new Map<string, number>();
  const candidates = [...new Set(symbols.filter((symbol) => /^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol)))];
  for (let index = 0; index < candidates.length; index += 20) {
    try {
      const { quotes } = await fetchYahooMarketQuotes(candidates.slice(index, index + 20));
      for (const quote of quotes) {
        if (quote.price.value && quote.price.value > 0 && (quote.currency ?? 'USD') === 'USD') prices.set(quote.symbol, quote.price.value);
      }
    } catch {
      // Without US prices the file's own sections and the local market still classify most rows.
    }
  }
  return prices;
}

/**
 * Imports the holdings of a broker account (IOL, Balanz, Bull Market, Cocos...) from an Excel or
 * CSV file. Every row is classified on its own and shown next to the value FinDash computes, so a
 * wrong type or ratio is caught before anything is saved.
 */
export function BrokerImportButton() {
  const { importTransactions, currentPortfolio, transactions } = usePortfolio();
  const { ratios: cedearRatios } = useCedearRatios();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [replace, setReplace] = useState(true);
  const [showGuide, setShowGuide] = useState(false);

  const existingInPortfolio = currentPortfolio
    ? transactions.filter((transaction) => transaction.portfolio_id === currentPortfolio.id).length
    : 0;

  const importable = useMemo(() => draft?.rows.filter((row) => IMPORTABLE_KINDS.includes(row.kind)) ?? [], [draft]);
  const blocked = importable.filter((row) => row.kind === 'cedear' && !row.ratio);
  const distinctSymbols = new Set(importable.map((row) => (row.kind === 'ar-stock' || row.kind === 'bond' ? localSymbol(row.symbol) : row.symbol))).size;
  const { maxAssets } = usePortfolioLimits(0);
  const overLimit = distinctSymbols > maxAssets;
  const totals = useMemo(() => {
    const sum = (rows: ClassifiedRow[], pick: (row: ClassifiedRow) => number | null) =>
      rows.reduce((total, row) => total + (pick(row) ?? 0), 0);
    const excluded = draft?.rows.filter((row) => !IMPORTABLE_KINDS.includes(row.kind)) ?? [];
    return {
      file: sum(importable, (row) => row.fileValueArs),
      findash: sum(importable, (row) => row.findashValueArs ?? row.fileValueArs),
      excluded: sum(excluded, (row) => row.fileValueArs),
      excludedCount: excluded.length,
    };
  }, [draft, importable]);

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!currentPortfolio) {
      toast.error('Elegí un portafolio antes de importar.', { description: 'Arriba, en el selector de portafolios.' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('El archivo supera los 10 MB.');
      return;
    }

    setReading(true);
    try {
      const sheets = await readSpreadsheet(file);
      const parsed = parseBrokerSheets(sheets, file.name);
      if (parsed.rows.length === 0) {
        throw new Error('No encontramos una tabla con columnas de activo y cantidad. Abrí la guía para ver los formatos que reconocemos.');
      }
      const [local, ccl, usPrices] = await Promise.all([
        fetchLocalMarket(),
        fetchCclRate(),
        fetchUsPrices(parsed.rows.map((row) => row.symbol)),
      ]);
      const context: ClassifyContext = { cedearRatios, local: local.quotes, usPrices, ccl: ccl.rate };
      setDraft({
        fileName: file.name,
        broker: parsed.broker,
        portfolioId: currentPortfolio.id,
        portfolioName: currentPortfolio.name,
        rows: parsed.rows.map((row) => classifyRow(row, context)),
        skippedLines: parsed.skippedLines,
        context,
      });
      setReplace(existingInPortfolio > 0);
    } catch (error) {
      toast.error('No se pudo leer el archivo', {
        description: error instanceof Error ? error.message : 'Probá exportarlo de nuevo desde tu broker.',
      });
    } finally {
      setReading(false);
    }
  };

  const updateRow = (index: number, changes: { kind?: AssetKind; ratio?: number | null }) => {
    setDraft((current) => {
      if (!current) return current;
      const rows = [...current.rows];
      const row = rows[index];
      const kind = changes.kind ?? row.kind;
      const ratio = changes.ratio !== undefined ? changes.ratio : changes.kind ? undefined : row.ratio;
      rows[index] = finalizeRow(row, kind, changes.kind ? 'Elegido por vos' : row.reason, current.context, ratio === undefined ? {} : { ratio });
      return { ...current, rows };
    });
  };

  const handleConfirm = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const toSave = toTransactions(importable, draft.portfolioId, draft.context.ccl);
      await importTransactions(toSave, replace ? { replacePortfolioId: draft.portfolioId } : {});
      toast.success(`Se importaron ${toSave.length} activos a ${draft.portfolioName}.`, {
        description: totals.excludedCount > 0 ? `${totals.excludedCount} filas (efectivo, fondos o sin identificar) quedaron afuera.` : undefined,
      });
      setDraft(null);
    } catch (error) {
      toast.error('No se pudo completar la importación', {
        description: error instanceof Error ? error.message : 'Intentá de nuevo.',
      });
    } finally {
      setSaving(false);
    }
  };

  const difference = totals.file > 0 ? (totals.findash - totals.file) / totals.file : 0;

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
        className="hidden"
        onChange={(event) => void handleFile(event)}
      />
      <Button
        type="button"
        variant="outline"
        className="gap-2 shadow-premium hover:shadow-none transition-all"
        onClick={() => fileInputRef.current?.click()}
        disabled={reading || saving}
      >
        {reading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {reading ? 'Leyendo archivo…' : 'Importar cartera'}
      </Button>
      <Button type="button" variant="ghost" size="sm" className="gap-2" onClick={() => setShowGuide(true)}>
        <BookOpen className="h-4 w-4" />
        Cómo exportar
      </Button>

      <Dialog open={draft !== null} onOpenChange={(open) => !open && !saving && setDraft(null)}>
        <DialogContent className="flex max-h-[90vh] max-w-6xl flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Revisá tu cartera antes de importarla
            </DialogTitle>
            <DialogDescription>
              {draft && `${draft.broker} · ${draft.fileName} · destino: ${draft.portfolioName}. CCL usado: ${draft.context.ccl.toLocaleString('es-AR')}.`}
            </DialogDescription>
          </DialogHeader>

          {draft && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Valor según el archivo</p>
                  <p className="text-lg font-semibold tabular-nums">{ars(totals.file)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Valor según FinDash hoy</p>
                  <p className="text-lg font-semibold tabular-nums">{ars(totals.findash)}</p>
                  {totals.file > 0 && (
                    <p className={cn('text-xs', Math.abs(difference) <= 0.03 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400')}>
                      {Math.abs(difference) <= 0.03 ? 'Coincide con tu broker' : `Diferencia ${(difference * 100).toFixed(1)}%`}
                    </p>
                  )}
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">No se importa</p>
                  <p className="text-lg font-semibold tabular-nums">{ars(totals.excluded)}</p>
                  <p className="text-xs text-muted-foreground">{totals.excludedCount} filas: efectivo, cauciones, fondos o sin identificar</p>
                </div>
              </div>

              {overLimit && (
                <p className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-sm text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  Tu plan permite {maxAssets} activos por portafolio y el archivo tiene {distinctSymbols}. Desmarcá algunos (tipo "Sin identificar") o mejorá tu plan.
                </p>
              )}

              <div className="min-h-0 flex-1 overflow-auto rounded-md border">
                <table className="w-full min-w-[860px] text-sm">
                  <thead className="sticky top-0 z-10 bg-muted text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium" scope="col">Activo</th>
                      <th className="px-3 py-2 font-medium" scope="col">Tipo</th>
                      <th className="px-3 py-2 text-right font-medium" scope="col">Cantidad</th>
                      <th className="px-3 py-2 text-right font-medium" scope="col">Precio de compra</th>
                      <th className="px-3 py-2 text-right font-medium" scope="col">Valor archivo</th>
                      <th className="px-3 py-2 text-right font-medium" scope="col">Valor FinDash</th>
                      <th className="px-3 py-2 font-medium" scope="col">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {draft.rows.map((row, index) => {
                      const excluded = !IMPORTABLE_KINDS.includes(row.kind);
                      return (
                        <tr key={`${row.sheet}-${row.line}`} className={cn('align-top', excluded && 'opacity-60')}>
                          <td className="px-3 py-2">
                            <span className="block font-semibold">{row.symbol}</span>
                            <span className="block max-w-[14rem] truncate text-xs text-muted-foreground">{row.description || row.section || `Fila ${row.line}`}</span>
                          </td>
                          <td className="px-3 py-2">
                            <Select value={row.kind} onValueChange={(kind) => updateRow(index, { kind: kind as AssetKind })}>
                              <SelectTrigger className="h-8 w-48" aria-label={`Tipo de ${row.symbol}`}><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {(Object.keys(ASSET_KIND_LABELS) as AssetKind[]).map((kind) => (
                                  <SelectItem key={kind} value={kind}>{ASSET_KIND_LABELS[kind]}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {row.kind === 'cedear' && (
                              <label className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                                Ratio
                                <Input
                                  type="number"
                                  min={0}
                                  step="any"
                                  className="h-7 w-20"
                                  value={row.ratio ?? ''}
                                  onChange={(event) => updateRow(index, { ratio: Number(event.target.value) > 0 ? Number(event.target.value) : null })}
                                  aria-label={`Ratio del CEDEAR ${row.symbol}`}
                                />
                                : 1
                              </label>
                            )}
                            {row.kind === 'bond' && (
                              <span className="mt-1 block text-xs text-muted-foreground">Precio cada {row.ratio === 1 ? '1' : '100'} nominales</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{number(row.quantity)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {row.costPrice === null ? '—' : `${row.currency === 'USD' ? 'US$' : '$'} ${number(row.costPrice)}`}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{ars(row.fileValueArs)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{excluded ? '—' : ars(row.findashValueArs)}</td>
                          <td className="px-3 py-2 text-xs">
                            {excluded ? (
                              <span className="text-muted-foreground">No se importa</span>
                            ) : row.warnings.length === 0 ? (
                              <span className="flex items-center gap-1 text-green-600 dark:text-green-400"><CheckCircle2 className="h-3.5 w-3.5" />Listo</span>
                            ) : (
                              <ul className="space-y-0.5 text-amber-700 dark:text-amber-400">
                                {row.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                              </ul>
                            )}
                            <span className="mt-0.5 block text-muted-foreground">{row.reason}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {existingInPortfolio > 0 && (
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1 h-4 w-4 accent-primary" checked={replace} onChange={(event) => setReplace(event.target.checked)} />
                  <span>
                    Reemplazar lo que ya hay en {draft.portfolioName} ({existingInPortfolio} operaciones).
                    <span className="block text-xs text-muted-foreground">
                      Dejalo marcado si el archivo es tu tenencia completa: así no se duplican los activos al importar de nuevo.
                    </span>
                  </span>
                </label>
              )}

              <DialogFooter className="gap-2 sm:gap-2">
                <Button type="button" variant="outline" onClick={() => setDraft(null)} disabled={saving}>Cancelar</Button>
                <Button
                  type="button"
                  onClick={() => void handleConfirm()}
                  disabled={saving || importable.length === 0 || blocked.length > 0 || overLimit}
                  title={blocked.length > 0 ? 'Completá el ratio de los CEDEARs marcados' : undefined}
                >
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                  {saving ? 'Guardando…' : `${replace && existingInPortfolio > 0 ? 'Reemplazar e importar' : 'Importar'} ${importable.length} activos`}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showGuide} onOpenChange={setShowGuide}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Cómo exportar tu cartera</DialogTitle>
            <DialogDescription>Subí el Excel o CSV de tu tenencia tal como lo descarga el broker.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li><strong className="text-foreground">IOL:</strong> Mi cuenta → Portafolio → Exportar (Excel).</li>
              <li><strong className="text-foreground">Balanz:</strong> Tenencia → Descargar → Excel.</li>
              <li><strong className="text-foreground">Bull Market:</strong> Cuenta → Tenencia valorizada → Exportar.</li>
              <li><strong className="text-foreground">Cocos:</strong> Portafolio → Descargar tenencia.</li>
            </ul>
            <p className="text-muted-foreground">
              Reconocemos el ticker, la cantidad, el precio de compra (PPC o precio promedio) y el precio o valor actual, aunque las columnas
              tengan otros nombres o el archivo traiga títulos y secciones. CEDEARs, acciones argentinas, bonos, ONs, letras y acciones de EE. UU.
              se identifican fila por fila; el efectivo, las cauciones y los fondos se muestran pero no se importan.
            </p>
            <p className="text-muted-foreground">
              Los montos en pesos se pasan a dólares con el CCL de hoy, el mismo que se usa para valuar, así que la ganancia o pérdida en
              porcentaje es la misma que muestra tu broker. Si una fila no coincide, cambiale el tipo o el ratio antes de importar.
            </p>
            <p className="border-l-2 border-primary/50 pl-3 text-muted-foreground">
              Si tu archivo no se reconoce, mandalo por Sugerencias o Contacto y lo sumamos.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
