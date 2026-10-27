import { describe, expect, it } from 'vitest';
import { normalizeFixedIncomeTicker } from './fixed-income-ticker';

describe('normalizeFixedIncomeTicker', () => {
  it.each(['AL30', 'AL30C', 'AL30O', 'AL30D'])('uses the D listing for USD ticker %s', (symbol) => {
    expect(normalizeFixedIncomeTicker(symbol, 'USD')).toBe('AL30D');
  });

  it('leaves ARS tickers unchanged', () => {
    expect(normalizeFixedIncomeTicker('S30S6', 'ARS')).toBe('S30S6');
  });
});
