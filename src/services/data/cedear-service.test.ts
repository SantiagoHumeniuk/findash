import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({ supabase: { from: mocks.from } }));
vi.mock('../../lib/logger', () => ({ logger: { error: mocks.logError } }));

import { fetchCedearRatios } from './cedear-service';

describe('fetchCedearRatios', () => {
  beforeEach(() => {
    mocks.from.mockReturnValue({ select: mocks.select });
    mocks.select.mockResolvedValue({ data: [], error: null });
    mocks.logError.mockClear();
  });

  it('preloads the complete BYMA catalog and preserves punctuation in tickers', async () => {
    const ratios = await fetchCedearRatios();

    expect(Object.keys(ratios).length).toBeGreaterThan(400);
    expect(ratios.AAPL).toBe(20);
    expect(ratios['AKO.B']).toBe(1);
    expect(ratios['BA.C']).toBe(4);
    expect(ratios.CIBR).toBe(10);
    expect(ratios.XLU).toBe(15);
    expect(ratios.RCTB4).toBe(0.001);
  });

  it('prefers official ratios over manual rows but accepts automatic market updates', async () => {
    mocks.select.mockResolvedValue({
      data: [
        { symbol: 'BA.C', ratio: 99, source: 'manual' },
        { symbol: 'MELI', ratio: 121, source: 'mercado' },
        { symbol: 'NEW.A', ratio: 7, source: 'mercado' },
      ],
      error: null,
    });

    const ratios = await fetchCedearRatios();

    expect(ratios['BA.C']).toBe(4);
    expect(ratios.MELI).toBe(121);
    expect(ratios['NEW.A']).toBe(7);
  });

  it('still returns the official catalog when Supabase is unavailable', async () => {
    mocks.select.mockResolvedValue({ data: null, error: new Error('offline') });

    const ratios = await fetchCedearRatios();

    expect(ratios.MELI).toBe(120);
    expect(mocks.logError).toHaveBeenCalledOnce();
  });
});
