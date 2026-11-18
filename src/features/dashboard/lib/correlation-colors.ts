/**
 * Maps correlation magnitude to a neutral-to-strong color scale.
 */
export function getCorrelationCellColors(
  value: number | null,
): { backgroundColor: string; color: string; fontWeight: 'bold' } {
  if (value === null || !Number.isFinite(value)) {
    return {
      backgroundColor: 'var(--muted)',
      color: 'var(--muted-foreground)',
      fontWeight: 'bold',
    };
  }

  const strength = Math.min(1, Math.abs(value));
  const hue = Math.round(120 * (1 - strength));

  return {
    backgroundColor: `hsl(${hue}, 90%, 55%)`,
    color: `hsl(${hue}, 100%, 15%)`,
    fontWeight: 'bold',
  };
}
