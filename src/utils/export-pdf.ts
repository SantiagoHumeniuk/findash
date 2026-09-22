// src/utils/export-pdf.ts

import type { AssetData } from '../types/dashboard';
import type { Indicator, IndicatorConfig } from './financial';
// Importamos el tipo 'HookData' que necesitaremos para el hook
import type { HookData } from 'jspdf-autotable';

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
export const exportToPdf = async ({ title, subtitle, sections, assets, theme, indicatorConfig }: ExportOptions) => {
    const [jsPDFModule, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable')
    ]);
    
    const jsPDF = jsPDFModule.default;
    const doc = new jsPDF() as unknown as ExtendedJsPDF;
    const styles = getThemeStyles(theme);
    let finalY = 0;

    // Esto dibuja el fondo para la PÁGINA 1
    const resolvedTheme = resolveTheme(theme);
    if (resolvedTheme === 'dark') {
        doc.setFillColor(styles.backgroundColor);
        doc.rect(0, 0, doc.internal.pageSize.width, doc.internal.pageSize.height, 'F');
    }

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
                            const color = getTrafficLightColor(config, value, theme);
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
                        const color = getPercentageColor(numericValue, theme);
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
            styles: {
                fillColor: styles.backgroundColor,
                textColor: styles.textColor,
                lineColor: styles.borderColor,
                lineWidth: 0.1,
            },
            headStyles: {
                fillColor: styles.tableHeaderFill,
                textColor: styles.textColor,
                fontStyle: 'bold',
            },
            // ==================================================================
            // INICIO DEL CÓDIGO AÑADIDO
            // ==================================================================
            willDrawPage: (data: HookData) => {
                // Este hook dibuja el fondo en CADA PÁGINA que la tabla crea.
                // No lo aplicamos a la página 1 porque ya lo hicimos manualmente.
                if (data.pageNumber > 1 && resolvedTheme === 'dark') {
                    doc.setFillColor(styles.backgroundColor);
                    doc.rect(0, 0, doc.internal.pageSize.width, doc.internal.pageSize.height, 'F');
                }
            }
            // ==================================================================
            // FIN DEL CÓDIGO AÑADIDO
            // ==================================================================
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
  elementId?: string;
}

/**
 * Exporta el portafolio actual a un archivo PDF (Captura Visual).
 * Utiliza dom-to-image-more para tomar una "foto" del dashboard y exportarlo tal cual se ve,
 * soportando las funciones CSS modernas de Tailwind v4 (como oklch).
 */
export const exportPortfolioToPdf = async ({
  theme,
  portfolioName = 'Mi Portafolio',
  elementId = 'portfolio-export-area',
}: ExportPortfolioOptions) => {
  const [jsPDFModule, domToImageModule] = await Promise.all([
    import('jspdf'),
    // @ts-ignore
    import('dom-to-image-more')
  ]);

  const jsPDF = jsPDFModule.default || jsPDFModule.jsPDF;
  const domtoimage = domToImageModule.default || domToImageModule;

  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Elemento visual con ID '${elementId}' no encontrado para exportar.`);
  }

  // Prevenir barras de scroll internas durante la captura forzando altura máxima
  const originalHeight = element.style.height;
  const originalOverflow = element.style.overflow;
  
  try {
    element.style.height = 'auto';
    element.style.overflow = 'visible';
    
    // Si hay contenedores con overflow interno en la página, intentamos hacerlos visibles temporalmente
    const scrollables = element.querySelectorAll('.overflow-auto, .overflow-y-auto');
    const originalStyles = Array.from(scrollables).map(el => (el as HTMLElement).style.overflow);
    scrollables.forEach(el => ((el as HTMLElement).style.overflow = 'visible'));

    // Aumentar la escala para mejorar la resolución de exportación
    const scale = 2;
    const style = {
      transform: 'scale(' + scale + ')',
      transformOrigin: 'top left',
      width: element.clientWidth + 'px',
      height: element.clientHeight + 'px'
    };
    
    const imgData = await domtoimage.toPng(element, {
      bgcolor: resolveTheme(theme) === 'dark' ? '#0B1120' : '#ffffff',
      width: element.clientWidth * scale,
      height: element.clientHeight * scale,
      style: style
    });

    // Restaurar estilos de scroll
    scrollables.forEach((el, i) => ((el as HTMLElement).style.overflow = originalStyles[i] || ''));

    // A4 paper dimensions (210x297 mm)
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    
    // Padding para los bordes del PDF (ej. 10mm)
    const padding = 10;
    const innerPdfWidth = pdfWidth - padding * 2;
    
    // La imagen está a escala 2x, pero jsPDF se ajusta a las proporciones
    const imgWidth = innerPdfWidth;
    
    // Obtenemos las dimensiones reales del canvas interno para calcular la proporción correcta
    // Creamos una imagen temporal para obtener width y height
    const imgProps = pdf.getImageProperties(imgData);
    const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
    
    let heightLeft = imgHeight;
    let position = padding;
    
    // Agregar primera página
    pdf.addImage(imgData, 'PNG', padding, position, imgWidth, imgHeight);
    heightLeft -= (pdfHeight - padding * 2); // restamos el área utilizable
    
    // Si la imagen excede una página, agregar más páginas hacia abajo
    while (heightLeft > 0) {
      position = position - (pdfHeight - padding * 2); // Subimos la imagen el equivalente a una hoja
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', padding, position, imgWidth, imgHeight);
      heightLeft -= (pdfHeight - padding * 2);
    }
    
    const fileName = `Portafolio_${portfolioName.replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(fileName);
  } finally {
    // Restaurar el contenedor a su estado original
    element.style.height = originalHeight;
    element.style.overflow = originalOverflow;
  }
};