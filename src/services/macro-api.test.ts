import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('../lib/supabase', () => ({
  supabase: { functions: { invoke } },
}));

import {
  fetchDolaresArgentinaDatos,
  fetchDolaresDolarazo,
  fetchInflacion,
  fetchPlazosFijos,
  fetchUva,
  getCurvaLecapYTasaFija,
  recalcularMetricasLecap,
} from './macro-api';

beforeEach(() => {
  invoke.mockReset();
});

describe('LECAP return projections', () => {
  it('projects maturity value from each instrument TEM and remaining days', () => {
    const referenceDate = new Date(2026, 8, 28, 12);
    const instruments = getCurvaLecapYTasaFija(referenceDate);
    const nearMaturity = instruments.find((instrument) => instrument.ticker === 'S30S6');
    const laterMaturity = instruments.find((instrument) => instrument.ticker === 'S28N6');

    expect(nearMaturity).toBeDefined();
    expect(laterMaturity).toBeDefined();

    const nearReturn = recalcularMetricasLecap(nearMaturity!, nearMaturity!.precio).tea;
    const laterReturn = recalcularMetricasLecap(laterMaturity!, laterMaturity!.precio).tea;

    expect(nearMaturity!.valorTecnico).toBeCloseTo(
      nearMaturity!.precio * Math.pow(1 + nearMaturity!.tem / 100, nearMaturity!.diasAlVencimiento / 30),
      2,
    );
    expect(laterMaturity!.valorTecnico).toBeCloseTo(
      laterMaturity!.precio * Math.pow(1 + laterMaturity!.tem / 100, laterMaturity!.diasAlVencimiento / 30),
      2,
    );
    expect(laterReturn).toBeGreaterThan(nearReturn);
  });
});

describe('UVA data proxy', () => {
  it('loads and validates UVA values through the Supabase proxy', async () => {
    invoke.mockResolvedValue({
      data: [{ fecha: '2026-10-08', valor: 1234.56 }],
      error: null,
    });

    await expect(fetchUva()).resolves.toEqual([{ fecha: '2026-10-08', valor: 1234.56 }]);
    expect(invoke).toHaveBeenCalledWith('argentina-macro-proxy', { body: { resource: 'uva' } });
  });

  it('surfaces proxy errors and rejects malformed UVA values', async () => {
    invoke.mockResolvedValueOnce({ data: null, error: { message: 'proxy offline' } });
    await expect(fetchUva()).rejects.toThrow('No se pudo consultar uva: proxy offline');

    invoke.mockResolvedValueOnce({ data: [{ fecha: '2026-10-08', valor: 'invalid' }], error: null });
    await expect(fetchUva()).rejects.toThrow('La API UVA devolvió datos incompletos o con formato desconocido');
  });
});

describe('ArgentinaDatos macro proxy', () => {
  it('maps ArgentinaDatos dollar quotes and requests them through the proxy', async () => {
    invoke.mockResolvedValue({
      data: [
        { casa: 'oficial', compra: 100, venta: 101, fecha: '2026-10-08' },
        { casa: 'blue', compra: 120, venta: 122, fecha: '2026-10-08' },
      ],
      error: null,
    });

    await expect(fetchDolaresArgentinaDatos()).resolves.toEqual([
      expect.objectContaining({ casa: 'oficial', venta: 101 }),
      expect.objectContaining({ casa: 'blue', venta: 122 }),
    ]);
    expect(invoke).toHaveBeenCalledWith('argentina-macro-proxy', { body: { resource: 'dolares' } });
  });

  it('loads inflation and fixed-deposit rates through the proxy', async () => {
    invoke
      .mockResolvedValueOnce({ data: [{ fecha: '2026-09-30', valor: 2.1 }], error: null })
      .mockResolvedValueOnce({
        data: [{ entidad: 'Banco', tnaClientes: 0.2, tnaNoClientes: 0.1 }],
        error: null,
      });

    await expect(fetchInflacion()).resolves.toEqual([{ fecha: '2026-09-30', valor: 2.1 }]);
    await expect(fetchPlazosFijos()).resolves.toEqual([
      expect.objectContaining({ entidad: 'Banco', tnaClientes: 0.2 }),
    ]);
    expect(invoke).toHaveBeenNthCalledWith(1, 'argentina-macro-proxy', { body: { resource: 'inflacion' } });
    expect(invoke).toHaveBeenNthCalledWith(2, 'argentina-macro-proxy', { body: { resource: 'plazos-fijos' } });
  });
});

describe('Dolarazo data proxy', () => {
  it('loads alternate dollar quotes through the Supabase proxy', async () => {
    invoke.mockResolvedValue({
      data: {
        ok: true,
        data: [{ casa: 'oficial', nombre: 'Oficial', compra: 1490, venta: 1540 }],
      },
      error: null,
    });

    await expect(fetchDolaresDolarazo()).resolves.toEqual([
      expect.objectContaining({ casa: 'oficial', nombre: 'Oficial', compra: 1490, venta: 1540 }),
    ]);
    expect(invoke).toHaveBeenCalledWith('argentina-macro-proxy', { body: { resource: 'dolarazo' } });
  });
});
