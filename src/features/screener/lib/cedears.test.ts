import { describe, expect, it } from 'vitest';
import { buildCedearRows, cedearPrice, type CedearMarketQuote, withPremiums } from './cedears';

const quote = (symbol: string, overrides: Partial<CedearMarketQuote> = {}): CedearMarketQuote => ({
  symbol,
  bid: 100,
  ask: 102,
  last: 101,
  volume: 10,
  changePercent: 1,
  ...overrides,
});

describe('cedearPrice', () => {
  it('uses the mid price, or the last trade without both sides', () => {
    expect(cedearPrice(quote('A'))).toBe(101);
    expect(cedearPrice(quote('A', { bid: 0, last: 90 }))).toBe(90);
    expect(cedearPrice(quote('A', { bid: 0, ask: 0, last: 0 }))).toBeNull();
  });
});

describe('buildCedearRows', () => {
  it('joins the dollar line and ratio, and skips symbols without a ratio', () => {
    const rows = buildCedearRows([
      quote('AAPL', { bid: 28000, ask: 28000, volume: 100 }),
      quote('AAPLD', { bid: 17.5, ask: 17.5 }),
      quote('BRKB', { bid: 30000, ask: 30000, volume: 1000 }),
    ], { AAPL: 20, BRKB: 22 });
    expect(rows.map(({ symbol }) => symbol)).toEqual(['BRKB', 'AAPL']);
    expect(rows[0].usSymbol).toBe('BRK-B');
    expect(rows[1].impliedMep).toBeCloseTo(1600);
    expect(rows[0].impliedMep).toBeNull();
  });
});

describe('withPremiums', () => {
  const [row] = buildCedearRows([quote('AAPL', { bid: 32000, ask: 32000 })], { AAPL: 20 });

  it('compares the price at CCL against the US share divided by the ratio', () => {
    const [result] = withPremiums([row], new Map([['AAPL', 400]]), 1600);
    expect(result.fairPriceUsd).toBe(20);
    expect(result.impliedCcl).toBeCloseTo(1600);
    expect(result.premiumPercent).toBeCloseTo(0);
    const [cheap] = withPremiums([row], new Map([['AAPL', 420]]), 1600);
    expect(cheap.premiumPercent).toBeCloseTo((20 / 21 - 1) * 100);
  });

  it('leaves the premium blank for implausible gaps or missing inputs', () => {
    expect(withPremiums([row], new Map([['AAPL', 800]]), 1600)[0]).toMatchObject({ premiumPercent: null, impliedCcl: null, fairPriceUsd: null });
    expect(withPremiums([row], new Map(), 1600)[0].premiumPercent).toBeNull();
    expect(withPremiums([row], new Map([['AAPL', 400]]), null)[0]).toMatchObject({ fairPriceUsd: 20, premiumPercent: null });
  });
});
