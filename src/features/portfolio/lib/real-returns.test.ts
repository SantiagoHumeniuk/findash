import { describe, expect, it } from 'vitest';
import { calculateRealReturns, type DollarFlow } from './real-returns';

const mep = [
  { fecha: '2025-01-10', venta: 1000 },
  { fecha: '2025-02-10', venta: 1200 },
  { fecha: '2025-03-20', venta: 1500 },
];
const inflation = [
  { fecha: '2024-12-31', valor: 5 },
  { fecha: '2025-01-31', valor: 10 },
  { fecha: '2025-02-28', valor: 10 },
];
const buy: DollarFlow = { quantity: 1, purchase_price: 100, purchase_date: '2025-01-15', transaction_type: 'buy' };

describe('calculateRealReturns', () => {
  it('separates the dollar result, the peso result and the inflation-adjusted result', () => {
    const result = calculateRealReturns([buy], 110, mep, inflation)!;
    expect(result.usdPct).toBeCloseTo(10);
    expect(result.arsPct).toBeCloseTo(65);
    expect(result.realPct).toBeCloseTo((165000 / 121000 - 1) * 100);
    expect(result.mepPct).toBeCloseTo(50);
    expect(result.inflationPct).toBeCloseTo(21);
    expect(result.inflationThrough).toBe('2025-02-28');
  });

  it('counts sales at their own date', () => {
    const sale: DollarFlow = { quantity: 1, purchase_price: 50, purchase_date: '2025-02-15', transaction_type: 'sell' };
    const result = calculateRealReturns([buy, sale], 60, mep, inflation)!;
    expect(result.usdPct).toBeCloseTo(10);
    // 50 USD sold at 1200, adjusted by February's 10%; 60 USD still worth 1500 each.
    expect(result.realPct).toBeCloseTo(((90000 + 66000) / 121000 - 1) * 100);
  });

  it('does not adjust purchases made after the last published inflation', () => {
    const recent = { ...buy, purchase_date: '2025-03-25' };
    const result = calculateRealReturns([recent], 100, mep, inflation)!;
    expect(result.inflationPct).toBeCloseTo(0);
  });

  it('returns null when a transaction predates the series', () => {
    expect(calculateRealReturns([{ ...buy, purchase_date: '2017-05-01' }], 110, mep, inflation)).toBeNull();
  });

  it('returns null without purchases', () => {
    expect(calculateRealReturns([], 0, mep, inflation)).toBeNull();
  });
});
