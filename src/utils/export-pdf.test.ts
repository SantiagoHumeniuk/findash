import { beforeEach, describe, expect, it, vi } from 'vitest';

interface MockPdfDocument {
  lastAutoTable?: { finalY: number };
  pageCount: number;
}

interface MockTableOptions {
  body: unknown[][];
  head?: unknown[][];
}

const { autoTableMock, savedFileNames, pdfTexts, drawnTriangles } = vi.hoisted(() => ({
  autoTableMock: vi.fn<(doc: MockPdfDocument, options: MockTableOptions) => void>(),
  savedFileNames: [] as string[],
  pdfTexts: [] as string[],
  drawnTriangles: [] as number[],
}));

vi.mock('jspdf', () => ({
  default: class MockJsPDF {
    lastAutoTable?: { finalY: number };
    pageCount = 1;
    internal = {
      pageSize: { getWidth: () => 297, getHeight: () => 210 },
      getNumberOfPages: () => this.pageCount,
    };

    setTextColor() {
      return this;
    }
    setFillColor() {
      return this;
    }
    setDrawColor() {
      return this;
    }
    setLineWidth() {
      return this;
    }
    setFontSize() {
      return this;
    }
    text(text: string) {
      pdfTexts.push(text);
      return this;
    }
    line() {
      return this;
    }
    rect() {
      return this;
    }
    circle() {
      return this;
    }
    triangle() {
      drawnTriangles.push(1);
      return this;
    }
    addPage() {
      this.pageCount += 1;
      return this;
    }
    setPage() {
      return this;
    }
    save(fileName: string) {
      savedFileNames.push(fileName);
    }
  },
}));

vi.mock('jspdf-autotable', () => ({ default: autoTableMock }));

import { exportPortfolioToPdf } from './export-pdf';

describe('exportPortfolioToPdf', () => {
  beforeEach(() => {
    autoTableMock.mockReset();
    savedFileNames.length = 0;
    pdfTexts.length = 0;
    drawnTriangles.length = 0;
    autoTableMock.mockImplementation((doc, options) => {
      doc.lastAutoTable = { finalY: (doc.lastAutoTable?.finalY ?? 30) + 20 };
      doc.pageCount = Math.max(doc.pageCount, Math.ceil(options.body.length / 40));
    });
  });

  it('keeps multi-currency holdings separate in the summary and paginates positions', async () => {
    const holdings = Array.from({ length: 70 }, (_, index) => ({
      symbol: `ASSET${index}`,
      name: `Portfolio asset ${index}`,
      currency: index % 2 === 0 ? 'USD' : 'ARS',
      quantity: 10,
      averagePrice: 10,
      currentPrice: 12,
      totalCost: 100,
      currentValue: 120,
      gainLoss: 20,
      gainLossPercentage: 20,
    }));

    await exportPortfolioToPdf({
      holdings,
      stats: {
        totalInvestment: 7000,
        currentValue: 8400,
        totalGainLoss: 1400,
        totalGainLossPercentage: 20,
        averageBuyPrice: 10,
      },
      theme: 'light',
    });

    expect(autoTableMock).toHaveBeenCalledTimes(2);
    expect(autoTableMock.mock.calls[0][1].body[0]).toEqual([
      'Multimoneda',
      'Multimoneda',
      'Multimoneda',
      'No comparable',
      '70',
    ]);
    expect(autoTableMock.mock.calls[1][1].body[0][3]).toContain('US$');
    expect(autoTableMock.mock.calls[1][1].body[1][3]).toContain('$');
    expect(savedFileNames[0]).toMatch(/^Portafolio_Mi_Portafolio_\d{4}-\d{2}-\d{2}\.pdf$/);
  });

  it('exports all supplied metrics and draws line, allocation, and per-asset charts', async () => {
    await exportPortfolioToPdf({
      holdings: [{
        symbol: 'AAPL',
        currency: 'USD',
        quantity: 2,
        averagePrice: 100,
        currentPrice: 120,
        totalCost: 200,
        currentValue: 240,
        gainLoss: 40,
        gainLossPercentage: 20,
      }],
      stats: {
        totalInvestment: 200,
        currentValue: 240,
        totalGainLoss: 40,
        totalGainLossPercentage: 20,
        averageBuyPrice: 100,
      },
      theme: 'light',
      metrics: [{ label: 'Beta ponderado', value: '1,12' }],
      charts: [
        {
          title: 'Evolución histórica',
          kind: 'line',
          data: [{ label: '2025-01-01', value: 100 }, { label: '2026-01-01', value: 120 }],
        },
        {
          title: 'Distribución',
          kind: 'donut',
          data: [{ label: 'AAPL', value: 240 }, { label: 'MSFT', value: 60 }],
        },
        {
          title: 'Rendimiento',
          kind: 'bar',
          data: [{ label: 'AAPL', value: 20 }],
        },
      ],
    });

    expect(autoTableMock).toHaveBeenCalledTimes(3);
    expect(autoTableMock.mock.calls[1][1].body[0]).toEqual(['Beta ponderado', '1,12', '', '']);
    expect(pdfTexts).toContain('Evolución histórica');
    expect(pdfTexts).toContain('Distribución');
    expect(pdfTexts).toContain('Rendimiento');
    expect(drawnTriangles.length).toBeGreaterThan(10);
  });
});
