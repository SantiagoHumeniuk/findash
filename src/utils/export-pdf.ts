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

interface PortfolioReportMetric {
  label: string;
  value: string;
}

interface PortfolioReportChart {
  title: string;
  description?: string;
  kind: 'line' | 'bar' | 'donut';
  data: { label: string; value: number }[];
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
  metrics?: PortfolioReportMetric[];
  charts?: PortfolioReportChart[];
}

/**
 * Exports portfolio metrics, positions, and visualizations as a paginated PDF report.
 */
export const exportPortfolioToPdf = async ({
  holdings,
  stats,
  portfolioName = 'Mi Portafolio',
  metrics = [],
  charts = [],
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
  const formatNumber = (value: number) => new Intl.NumberFormat('es-AR', {
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
  const formatPortfolioTotal = (value: number) => commonCurrency
    ? formatMoney(value, commonCurrency)
    : 'Multimoneda';
  const colors: [number, number, number][] = [
    [37, 99, 235], [16, 185, 129], [245, 158, 11], [139, 92, 246],
    [236, 72, 153], [14, 165, 233], [249, 115, 22], [100, 116, 139],
  ];

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
  let nextTableY = table.lastAutoTable?.finalY ?? 42;
  if (!commonCurrency) {
    pdf.setFontSize(8);
    pdf.setTextColor(100, 116, 139);
    pdf.text('Totales no convertidos: las posiciones conservan sus monedas de cotización.', margin, nextTableY + 6);
    nextTableY += 8;
  }

  if (metrics.length > 0) {
    const metricRows: string[][] = [];
    for (let index = 0; index < metrics.length; index += 2) {
      const left = metrics[index];
      const right = metrics[index + 1];
      metricRows.push([left.label, left.value, right?.label ?? '', right?.value ?? '']);
    }
    pdf.setFontSize(12);
    pdf.setTextColor(32, 48, 75);
    pdf.text('Métricas de cartera', margin, nextTableY + 8);
    autoTable(pdf, {
      startY: nextTableY + 11,
      head: [['Métrica', 'Resultado', 'Métrica', 'Resultado']],
      body: metricRows,
      theme: 'grid',
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2.5, textColor: [32, 48, 75], lineColor: [220, 226, 235] },
      headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 58, fontStyle: 'bold' },
        1: { cellWidth: 77 },
        2: { cellWidth: 58, fontStyle: 'bold' },
        3: { cellWidth: 77 },
      },
    });
    table = pdf as typeof pdf & { lastAutoTable?: { finalY: number } };
    nextTableY = table.lastAutoTable?.finalY ?? nextTableY + 20;
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
  const tableStartY = nextTableY + 8;
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
  });

  const drawLineChart = (data: PortfolioReportChart['data']) => {
    const points = data.filter((point) => Number.isFinite(point.value));
    if (points.length < 2) {
      pdf.setFontSize(10);
      pdf.text('No hay suficientes observaciones históricas para graficar.', 20, 60);
      return;
    }
    const left = 25;
    const top = 55;
    const width = pageWidth - 50;
    const height = 112;
    const minimum = Math.min(...points.map((point) => point.value));
    const maximum = Math.max(...points.map((point) => point.value));
    const span = maximum - minimum || 1;
    pdf.setDrawColor(210, 218, 230);
    pdf.setLineWidth(0.25);
    for (let row = 0; row <= 4; row += 1) {
      const y = top + (height * row) / 4;
      pdf.line(left, y, left + width, y);
    }
    const step = Math.max(1, Math.ceil(points.length / 150));
    const sampled = points.filter((_, index) => index % step === 0 || index === points.length - 1);
    pdf.setDrawColor(37, 99, 235);
    pdf.setLineWidth(0.8);
    for (let index = 1; index < sampled.length; index += 1) {
      const previousX = left + ((index - 1) / (sampled.length - 1)) * width;
      const currentX = left + (index / (sampled.length - 1)) * width;
      const previousY = top + height - ((sampled[index - 1].value - minimum) / span) * height;
      const currentY = top + height - ((sampled[index].value - minimum) / span) * height;
      pdf.line(previousX, previousY, currentX, currentY);
    }
    pdf.setFontSize(8);
    pdf.setTextColor(100, 116, 139);
    pdf.text(points[0].label, left, top + height + 7);
    pdf.text(points[points.length - 1].label, left + width, top + height + 7, { align: 'right' });
    pdf.text(`Máx. ${formatNumber(maximum)}`, left, top - 4);
    pdf.text(`Mín. ${formatNumber(minimum)}`, left + width, top - 4, { align: 'right' });
  };

  const drawBarChart = (data: PortfolioReportChart['data'], pageIndex: number, pageTotal: number) => {
    const left = 62;
    const top = 54;
    const width = pageWidth - left - 22;
    const rowHeight = 5.4;
    const pageSize = 24;
    const pageData = data.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
    const maxMagnitude = Math.max(1, ...pageData.map((point) => Math.abs(point.value)));
    const zeroX = left + width * 0.55;
    const maxBarWidth = width * 0.43;
    pdf.setDrawColor(148, 163, 184);
    pdf.line(zeroX, top - 4, zeroX, top + pageData.length * rowHeight);
    pdf.setFontSize(7);
    pageData.forEach((point, index) => {
      const y = top + index * rowHeight;
      const barWidth = (Math.abs(point.value) / maxMagnitude) * maxBarWidth;
      pdf.setTextColor(51, 65, 85);
      pdf.text(point.label.slice(0, 28), left - 4, y + 3, { align: 'right' });
      pdf.setFillColor(...(point.value >= 0 ? [16, 185, 129] : [239, 68, 68]));
      pdf.rect(point.value >= 0 ? zeroX : zeroX - barWidth, y, barWidth, 3, 'F');
      pdf.text(
        `${point.value >= 0 ? '+' : ''}${point.value.toFixed(2)}%`,
        point.value >= 0 ? zeroX + barWidth + 2 : zeroX - barWidth - 2,
        y + 3,
        { align: point.value >= 0 ? 'left' : 'right' },
      );
    });
    if (pageTotal > 1) {
      pdf.setFontSize(8);
      pdf.text(
        `Posiciones ${pageIndex * pageSize + 1}–${Math.min((pageIndex + 1) * pageSize, data.length)} de ${data.length}`,
        pageWidth - 20,
        42,
        { align: 'right' },
      );
    }
  };

  const drawDonutChart = (data: PortfolioReportChart['data']) => {
    const validData = data.filter((point) => Number.isFinite(point.value) && point.value > 0);
    const total = validData.reduce((sum, point) => sum + point.value, 0);
    if (total <= 0) {
      pdf.setFontSize(10);
      pdf.text('No hay datos de composición para graficar.', 20, 60);
      return;
    }
    const centerX = pageWidth * 0.32;
    const centerY = 123;
    const radius = 48;
    let startAngle = -Math.PI / 2;
    validData.forEach((point, index) => {
      const endAngle = startAngle + (point.value / total) * Math.PI * 2;
      pdf.setFillColor(...colors[index % colors.length]);
      const segments = Math.max(1, Math.ceil((endAngle - startAngle) / (Math.PI / 30)));
      for (let segment = 0; segment < segments; segment += 1) {
        const angle1 = startAngle + ((endAngle - startAngle) * segment) / segments;
        const angle2 = startAngle + ((endAngle - startAngle) * (segment + 1)) / segments;
        pdf.triangle(
          centerX,
          centerY,
          centerX + Math.cos(angle1) * radius,
          centerY + Math.sin(angle1) * radius,
          centerX + Math.cos(angle2) * radius,
          centerY + Math.sin(angle2) * radius,
          'F',
        );
      }
      startAngle = endAngle;
    });
    pdf.setFillColor(255, 255, 255);
    pdf.circle(centerX, centerY, radius * 0.52, 'F');
    pdf.setTextColor(32, 48, 75);
    pdf.setFontSize(9);
    pdf.text('Total', centerX, centerY - 1, { align: 'center' });
    pdf.setFontSize(8);
    pdf.text(String(validData.length), centerX, centerY + 5, { align: 'center' });

    const legendX = pageWidth * 0.58;
    const legendY = 57;
    const rowHeight = Math.min(5.5, 132 / validData.length);
    validData.forEach((point, index) => {
      const y = legendY + index * rowHeight;
      pdf.setFillColor(...colors[index % colors.length]);
      pdf.rect(legendX, y - 2.4, 3, 3, 'F');
      pdf.setTextColor(51, 65, 85);
      pdf.setFontSize(Math.min(8, rowHeight * 1.25));
      pdf.text(`${point.label.slice(0, 30)} · ${((point.value / total) * 100).toFixed(1)}%`, legendX + 5, y);
    });
  };

  for (const chart of charts) {
    const pageSize = chart.kind === 'bar' ? 24 : Math.max(chart.data.length, 1);
    const pageTotal = Math.max(1, Math.ceil(chart.data.length / pageSize));
    for (let pageIndex = 0; pageIndex < pageTotal; pageIndex += 1) {
      pdf.addPage('a4', 'landscape');
      pdf.setTextColor(32, 48, 75);
      pdf.setFontSize(15);
      pdf.text(chart.title, margin, 20);
      if (chart.description) {
        pdf.setFontSize(8);
        pdf.setTextColor(100, 116, 139);
        pdf.text(chart.description, margin, 27);
      }
      if (chart.kind === 'line') drawLineChart(chart.data);
      if (chart.kind === 'donut') drawDonutChart(chart.data);
      if (chart.kind === 'bar') drawBarChart(chart.data, pageIndex, pageTotal);
    }
  }

  const pageCount = pdf.internal.getNumberOfPages();
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    pdf.setPage(pageNumber);
    pdf.setFontSize(8);
    pdf.setTextColor(100, 116, 139);
    pdf.text(`FinDash · ${portfolioName}`, margin, pdf.internal.pageSize.getHeight() - 6);
    pdf.text(`Página ${pageNumber} de ${pageCount}`, pageWidth - margin, pdf.internal.pageSize.getHeight() - 6, { align: 'right' });
  }

  const fileName = `Portafolio_${portfolioName.replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  pdf.save(fileName);
};