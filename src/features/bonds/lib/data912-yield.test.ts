import { describe, expect, it } from 'vitest';
import { calculateData912ZeroCouponYield } from './data912-yield';
import type { Data912BondQuote } from '@/services/api/data912-fixed-income-api';

const quote = (overrides: Partial<Data912BondQuote> = {}): Data912BondQuote => ({
  symbol: 'S01E6',
  q_bid: 1,
  px_bid: 90,
  px_ask: 90,
  q_ask: 1,
  v: 1,
  q_op: 1,
  c: 90,
  pct_change: 0,
  ...overrides,
});

describe('calculateData912ZeroCouponYield', () => {
  it('calculates annual effective yield using the bid/ask midpoint', () => {
    const asOf = new Date(2025, 0, 1, 12);
    const result = calculateData912ZeroCouponYield(quote(), asOf);

    expect(result).toBeCloseTo((Math.pow(100 / 90, 365 / 365) - 1) * 100, 5);
  });

  it('normalizes local-currency quotes expressed per 1,000 nominal', () => {
    const result = calculateData912ZeroCouponYield(
      quote({ px_bid: 90_000, px_ask: 90_000, c: 90_000 }),
      new Date(2025, 0, 1, 12),
    );

    expect(result).toBeCloseTo(11.11111, 4);
  });

  it('uses the available side of the book when only one bid/ask is quoted', () => {
    const result = calculateData912ZeroCouponYield(
      quote({ px_bid: 0, px_ask: 90, c: 95 }),
      new Date(2025, 0, 1, 12),
    );

    expect(result).toBeCloseTo(11.11111, 4);
  });

  it('does not annualize a yield for an instrument maturing today', () => {
    expect(calculateData912ZeroCouponYield(
      quote({ symbol: 'S01E6' }),
      new Date(2026, 0, 1, 9),
    )).toBeNull();
  });

  it('returns no estimate for unsupported tickers or invalid prices', () => {
    const asOf = new Date(2025, 0, 1, 12);

    expect(calculateData912ZeroCouponYield(quote({ symbol: 'AL30' }), asOf)).toBeNull();
    expect(calculateData912ZeroCouponYield(quote({ px_bid: 0, px_ask: 0, c: 0 }), asOf)).toBeNull();
    expect(calculateData912ZeroCouponYield(
      quote({ px_bid: 0, px_ask: 0, c: Number.NaN }),
      asOf,
    )).toBeNull();
  });
});
