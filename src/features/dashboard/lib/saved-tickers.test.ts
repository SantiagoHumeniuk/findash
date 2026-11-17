import { describe, expect, it } from 'vitest';
import { hasSavedTickerSelection } from './saved-tickers';

describe('hasSavedTickerSelection', () => {
  it('distinguishes no saved selection from an intentionally empty one', () => {
    expect(hasSavedTickerSelection(null, undefined)).toBe(false);
    expect(hasSavedTickerSelection([], undefined)).toBe(true);
    expect(hasSavedTickerSelection(null, [])).toBe(true);
  });
});
