import { describe, expect, it } from 'vitest';
import { calculateCashFlowYield } from './fixed-income-yield';
import type { Data912BondQuote } from '@/services/api/data912-fixed-income-api';

const quote: Data912BondQuote = {
  symbol: 'TESTD',
  q_bid: 1,
  px_bid: 99,
  px_ask: 101,
  q_ask: 1,
  v: 1,
  q_op: 1,
  c: 100,
  pct_change: 0,
};

describe('calculateCashFlowYield', () => {
  it('solves effective annual yield using the live bid/ask midpoint', () => {
    const asOf = new Date('2026-01-01T12:00:00Z');
    const yieldPercent = calculateCashFlowYield(
      quote,
      [{ date: '2027-01-01', amount: 110 }],
      asOf,
    );

    expect(yieldPercent).toBeCloseTo(10, 1);
  });

  it('uses all remaining coupon and principal cash flows', () => {
    const asOf = new Date('2026-01-01T12:00:00Z');
    const yieldPercent = calculateCashFlowYield(
      quote,
      [
        { date: '2026-07-02', amount: 5 },
        { date: '2027-01-01', amount: 105 },
      ],
      asOf,
    );

    expect(yieldPercent).toBeGreaterThan(9);
    expect(yieldPercent).toBeLessThan(11);
  });

  it('does not calculate a yield when price or future cash flows are missing', () => {
    const asOf = new Date('2026-01-01T12:00:00Z');
    expect(calculateCashFlowYield(null, [{ date: '2027-01-01', amount: 100 }], asOf)).toBeNull();
    expect(calculateCashFlowYield(quote, [{ date: '2025-01-01', amount: 100 }], asOf)).toBeNull();
  });
});
