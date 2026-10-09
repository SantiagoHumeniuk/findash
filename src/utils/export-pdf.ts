// src/utils/export-pdf.ts

import type { AssetData } from '../types/dashboard';
import type { Indicator, IndicatorConfig } from './financial';
// --- TIPOS Y INTERFACES ---
type Theme = 'light' | 'dark' | 'system';

interface CellWithRawValue {
    content: string;
    rawValue: number | 'N/A';
}

interface PdfSection {
    title: string;
    head: string[][];
    body: (string | number | CellWithRawValue)[][];
    metricKeys?: string[];
    isCorrelation?: boolean;
}

interface ExportOptions {
    title: string;
    subtitle: string;
    sections: PdfSection[];
    assets: AssetData[];
    theme: Theme;
    indicatorConfig: IndicatorConfig;
}

interface ExtendedJsPDF {
    lastAutoTable?: {
        finalY: number;
    };
    internal: {
        pageSize: {
            width: number;
            height: number;
        };
        getNumberOfPages(): number;
    };
    setFillColor(color: string): void;
    setFillColor(r: number, g: number, b: number): void;
    rect(x: number, y: number, w: number, h: number, style: string): void;
    setFontSize(size: number): void;
    setTextColor(r: number, g: number, b: number): void;
    text(text: string, x: number, y: number, options?: { align?: string; baseline?: string }): void;
    setPage(page: number): void;
    save(fileName: string): void;
}

// --- UTILIDADES DE VALIDACIÓN ---
const safeCellToString = (cellValue: unknown): string => {
    if (cellValue === null || cellValue === undefined) return '';
    if (typeof cellValue === 'string') return cellValue;
    if (typeof cellValue === 'number') return cellValue.toString();
    if (typeof cellValue === 'boolean') return cellValue.toString();
    if (typeof cellValue === 'object' && cellValue !== null && 'content' in cellValue) {
        return safeCellToString((cellValue as { content: unknown }).content);
    }
    if (typeof cellValue === 'bigint' || typeof cellValue === 'symbol') {
        return cellValue.toString();
    }
    return '';
};

// --- LÓGICA DE ESTILOS Y FORMATO ---
const resolveTheme = (theme: Theme): 'light' | 'dark' => {
    if (theme === 'system') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return theme;
};

const getThemeStyles = (theme: Theme) => {
    const resolvedTheme = resolveTheme(theme);
    const isDark = resolvedTheme === 'dark';
    return {
        backgroundColor: isDark ? '#1C2135' : '#FFFFFF',
        textColor: isDark ? [240, 241, 249] as [number, number, number] : [33, 41, 72] as [number, number, number],
        mutedColor: isDark ? [160, 167, 200] as [number, number, number] : [122, 130, 163] as [number, number, number],
        borderColor: isDark ? '#414A6E' : '#E1E4F2',
        headerColor: isDark ? [137, 221, 255] as [number, number, number] : [83, 104, 225] as [number, number, number],
        tableHeaderFill: isDark ? '#414A6E' : '#F1F5F9',
    };
};

const getTrafficLightColor = (config: Indicator, value: number, theme: Theme): [number, number, number] | undefined => {
    const { green, yellow, lowerIsBetter } = config;
    const resolvedTheme = resolveTheme(theme);
    const isDark = resolvedTheme === 'dark';
    const colors = {
        green: isDark ? [74, 222, 128] as [number, number, number] : [22, 163, 74] as [number, number, number],
        yellow: isDark ? [234, 179, 8] as [number, number, number] : [202, 138, 4] as [number, number, number],
        red: isDark ? [239, 68, 68] as [number, number, number] : [220, 38, 38] as [number, number, number],
    };
    if (lowerIsBetter) {
        if (value <= green) return colors.green;
        if (value <= yellow) return colors.yellow;
        return colors.red;
    } else {
        if (value >= green) return colors.green;
        if (value >= yellow) return colors.yellow;
        return colors.red;
    }
};

const getCorrelationCellStyle = (value: number) => {
    const v = Math.min(1, Math.max(0, value));
    const hue = v * 120;
    const saturation = 100;
    const lightness = 45;
    const h = hue / 360;
    const s = saturation / 100;
    const l = lightness / 100;
    let r: number, g: number, b: number;
    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p: number, q: number, t: number) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    return { 
        fillColor: [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)] as [number, number, number],
    };
};

const getPercentageColor = (value: number, theme: Theme): [number, number, number] => {
    const resolvedTheme = resolveTheme(theme);
    const isDark = resolvedTheme === 'dark';
    if (value >= 0) {
        return isDark ? [34, 197, 94] : [22, 163, 74];
    } else {
        return isDark ? [239, 68, 68] : [220, 38, 38];
    }
};

// --- FUNCIÓN PRINCIPAL DE EXPORTACIÓN ---
export const exportToPdf = async ({ title, subtitle, sections, assets, indicatorConfig }: ExportOptions) => {
    const [jsPDFModule, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable')
    ]);
    
    const jsPDF = jsPDFModule.default;
    const doc = new jsPDF({ orientation: assets.length > 3 ? 'landscape' : 'portrait' }) as unknown as ExtendedJsPDF;
    const styles = getThemeStyles('light');
    let finalY = 0;

    doc.setFontSize(18);
    doc.setTextColor(styles.headerColor[0], styles.headerColor[1], styles.headerColor[2]);
    doc.text(title, 14, 22);

    doc.setFontSize(11);
    doc.setTextColor(styles.mutedColor[0], styles.mutedColor[1], styles.mutedColor[2]);
    doc.text(subtitle, 14, 30);

    finalY = 35;

    sections.forEach(section => {
        if (section.body.length === 0) return;

        doc.setFontSize(12);
        doc.setTextColor(styles.textColor[0], styles.textColor[1], styles.textColor[2]);
        doc.text(section.title, 14, finalY + 10);

        const processedBody = section.body.map((row, rowIndex) =>
            row.map((cell, colIndex) => {
                if (section.metricKeys && colIndex > 0) {
                    const metricKey = section.metricKeys[rowIndex];
                    const config = metricKey ? indicatorConfig[metricKey] : undefined;
                    if (typeof cell === 'object' && cell !== null && 'rawValue' in cell && config) {
                        const rawValue = cell.rawValue;
                        const value = typeof rawValue === 'number' ? rawValue : null;
                        if (value !== null) {
                            const color = getTrafficLightColor(config, value, 'light');
                            if (color) {
                                return { content: cell.content, styles: { textColor: color } };
                            }
                        }
                        return cell.content;
                    }
                }
                
                if (section.isCorrelation && colIndex > 0) {
                    const cellValue = safeCellToString(cell);
                    const value = parseFloat(cellValue);
                    if (!isNaN(value)) {
                        const cellStyles = getCorrelationCellStyle(value);
                        return { content: cellValue, styles: { textColor: cellStyles.fillColor } };
                    }
                }
                
                if (typeof cell === 'object' && cell !== null && 'content' in cell) {
                    return cell.content;
                }
                
                const cellValue = String(cell);
                const isPercentage = cellValue.includes('%') && cellValue !== 'N/A' && cellValue !== '-';

                if (isPercentage && !section.isCorrelation && !section.metricKeys) {
                    const numericValue = parseFloat(cellValue.replace('%', ''));
                    if (!isNaN(numericValue)) {
                        const color = getPercentageColor(numericValue, 'light');
                        return { content: cellValue, styles: { textColor: color } };
                    }
                }
                return cell;
            })
        );

        autoTable(doc as never, {
            startY: finalY + 15,
            head: section.head,
            body: processedBody,
            theme: 'grid',
            headStyles: {
                fillColor: styles.tableHeaderFill,
                textColor: styles.textColor,
                fontStyle: 'bold',
            },
            margin: { bottom: 18 },
            styles: {
                fillColor: styles.backgroundColor,
                textColor: styles.textColor,
                lineColor: styles.borderColor,
                lineWidth: 0.1,
                fontSize: assets.length > 3 ? 7 : 9,
                cellPadding: 2,
                overflow: 'linebreak',
            },
            rowPageBreak: 'avoid',
        });

        finalY = doc.lastAutoTable?.finalY ?? finalY;
    });

    // El footer se dibuja sobre el fondo correcto en todas las páginas
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(styles.mutedColor[0], styles.mutedColor[1], styles.mutedColor[2]);
        const text = `Reporte generado por FinDash | ${new Date().toLocaleDateString('es-ES')} | Activos: ${assets.map(a => a.symbol).join(', ')}`;
        doc.text(text, 14, doc.internal.pageSize.height - 10);
        doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width - 35, doc.internal.pageSize.height - 10);
    }

    const fileName = `${title.replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
};

// --- EXPORTACIÓN ESPECÍFICA PARA PORTAFOLIO ---

/**
 * Interfaz para las estadísticas del portafolio.
 */
interface PortfolioStats {
  totalInvestment: number;
  currentValue: number;
  totalGainLoss: number;
  totalGainLossPercentage: number;
  averageBuyPrice: number;
}

/**
 * Interfaz para un holding (posición) del portafolio.
 */
interface PortfolioHolding {
  symbol: string;
  name?: string;
  currency?: string;
  quantity: number;
  averagePrice: number;
  currentPrice?: number;
  totalCost: number;
  currentValue: number;
  gainLoss: number;
  gainLossPercentage: number;
}

/**
 * Opciones para exportar el portafolio a PDF.
 */
interface ExportPortfolioOptions {
  holdings: PortfolioHolding[];
  stats: PortfolioStats;
  theme: Theme;
  portfolioName?: string;
}

/**
 * Exports portfolio metrics and every open position as a paginated, printer-friendly PDF.
 */
export const exportPortfolioToPdf = async ({
  holdings,
  stats,
  portfolioName = 'Mi Portafolio',
}: ExportPortfolioOptions) => {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 12;
  const getCurrency = (currency?: string) => {
    const normalized = currency?.trim().toUpperCase();
    if (!normalized) return 'ARS';
    return normalized;
  };
  const currencies = [...new Set(holdings.map(({ currency }) => getCurrency(currency)))];
  const commonCurrency = currencies.length === 1 ? currencies[0] : null;
  const formatMoney = (value: number, currency: string) => new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
  const formatPercent = (value: number) => `${Number.isFinite(value) ? value.toFixed(2) : '0.00'}%`;
  const formatPortfolioTotal = (value: number) => commonCurrency
    ? formatMoney(value, commonCurrency)
    : 'Multimoneda';

  pdf.setTextColor(32, 48, 75);
  pdf.setFontSize(20);
  pdf.text(portfolioName, margin, 18);
  pdf.setFontSize(9);
  pdf.setTextColor(100, 116, 139);
  pdf.text(`Informe de cartera · ${new Date().toLocaleDateString('es-AR')}`, margin, 24);

  autoTable(pdf, {
    startY: 30,
    head: [['Inversión inicial', 'Valor actual', 'Resultado', 'Rendimiento', 'Posiciones']],
    body: [[
      formatPortfolioTotal(stats.totalInvestment),
      formatPortfolioTotal(stats.currentValue),
      formatPortfolioTotal(stats.totalGainLoss),
      commonCurrency ? formatPercent(stats.totalGainLossPercentage) : 'No comparable',
      String(holdings.length),
    ]],
    theme: 'grid',
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 3, textColor: [32, 48, 75], lineColor: [220, 226, 235] },
    headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: 'bold' },
    bodyStyles: { fillColor: [248, 250, 252], fontStyle: 'bold' },
  });
  let table = pdf as typeof pdf & { lastAutoTable?: { finalY: number } };
  const summaryEndY = table.lastAutoTable?.finalY ?? 42;
  if (!commonCurrency) {
    pdf.setFontSize(8);
    pdf.setTextColor(100, 116, 139);
    pdf.text('Totales no convertidos: las posiciones conservan sus monedas de cotización.', margin, summaryEndY + 6);
  }

  const body = holdings.map((holding) => [
    holding.symbol,
    holding.name ?? holding.symbol,
    new Intl.NumberFormat('es-AR', { maximumFractionDigits: 6 }).format(holding.quantity),
    formatMoney(holding.averagePrice, getCurrency(holding.currency)),
    formatMoney(holding.currentPrice ?? 0, getCurrency(holding.currency)),
    formatMoney(holding.totalCost, getCurrency(holding.currency)),
    formatMoney(holding.currentValue, getCurrency(holding.currency)),
    formatMoney(holding.gainLoss, getCurrency(holding.currency)),
    formatPercent(holding.gainLossPercentage),
  ]);
  table = pdf as typeof pdf & { lastAutoTable?: { finalY: number } };
  const tableStartY = Math.max(table.lastAutoTable?.finalY ?? 42, summaryEndY + (commonCurrency ? 0 : 8)) + 8;
  autoTable(pdf, {
    startY: tableStartY,
    head: [['Ticker', 'Activo', 'Cantidad', 'Costo prom.', 'Precio actual', 'Costo total', 'Valor actual', 'G/P', 'G/P %']],
    body,
    theme: 'striped',
    margin: { top: 15, bottom: 16, left: margin, right: margin },
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    styles: { fontSize: 8, cellPadding: 2.5, overflow: 'linebreak', textColor: [32, 48, 75] },
    headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 19, fontStyle: 'bold' },
      1: { cellWidth: 47 },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
      8: { halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index >= 7) {
        const value = holdings[data.row.index]?.gainLoss ?? 0;
        data.cell.styles.textColor = value >= 0 ? [21, 128, 61] : [185, 28, 28];
      }
    },
    didDrawPage: (data) => {
      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139);
      pdf.text(`FinDash · ${portfolioName}`, margin, pdf.internal.pageSize.getHeight() - 6);
      pdf.text(`Página ${data.pageNumber}`, pageWidth - margin, pdf.internal.pageSize.getHeight() - 6, { align: 'right' });
    },
  });

  const fileName = `Portafolio_${portfolioName.replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  pdf.save(fileName);
};