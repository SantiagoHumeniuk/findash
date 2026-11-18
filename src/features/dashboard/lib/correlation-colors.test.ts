import { describe, expect, it } from 'vitest';
import { getCorrelationCellColors } from './correlation-colors';

describe('getCorrelationCellColors', () => {
  it('uses green for no correlation and red for strong correlation in either direction', () => {
    expect(getCorrelationCellColors(0).backgroundColor).toContain('hsl(120,');
    expect(getCorrelationCellColors(0.9).backgroundColor).toContain('hsl(12,');
    expect(getCorrelationCellColors(-0.9)).toEqual(getCorrelationCellColors(0.9));
  });

  it('colors perfect self-correlation as strong and keeps unavailable values neutral', () => {
    expect(getCorrelationCellColors(1).backgroundColor).toContain('hsl(0,');
    expect(getCorrelationCellColors(null).backgroundColor).toBe('var(--muted)');
  });
});
