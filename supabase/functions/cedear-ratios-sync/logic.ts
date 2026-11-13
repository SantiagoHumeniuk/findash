// Pure rules of the CEDEAR ratio sync, tested with `deno test`.

export type StoredRatio = {
  symbol: string;
  ratio: number;
  source: "manual" | "mercado";
  implied_ratio: number | null;
  implied_samples: number;
};

export type RatioUpdate = {
  symbol: string;
  ratio: number;
  source: "manual" | "mercado";
  implied_ratio: number;
  implied_samples: number;
  previous_ratio?: number;
  changed_at?: string;
};

/** Within this distance the market agrees with the stored ratio (daily noise is about ±1%). */
export const CONFIRM_TOLERANCE = 0.07;
/** Beyond this the ratio itself must have changed (they move in steps like ×2, ×3, ×10). */
export const CHANGE_THRESHOLD = 0.25;
/** The running average weighs at most this many past days, so it follows a change quickly. */
const MAX_WEIGHTED_SAMPLES = 9;

/** Ratios are whole numbers of CEDEARs per share, or one CEDEAR per whole number of shares. */
export function snapRatio(implied: number): number {
  if (!(implied > 0)) return 0;
  if (implied >= 1) return Math.max(1, Math.round(implied));
  return 1 / Math.round(1 / implied);
}

/** CEDEAR ratio implied by today's prices. */
export function impliedRatio(usPriceUsd: number, ccl: number, cedearPriceArs: number): number | null {
  if (!(usPriceUsd > 0) || !(ccl > 0) || !(cedearPriceArs > 0)) return null;
  return (usPriceUsd * ccl) / cedearPriceArs;
}

/**
 * Applies today's implied ratio. Returns the row to save, or null when the observation is not
 * usable. A stored ratio is only replaced when the market disagrees by more than 25% on two days in
 * a row, or by more than double on one day (a split of that size cannot be noise).
 */
export function applyObservation(stored: StoredRatio | undefined, symbol: string, implied: number, now: string): RatioUpdate | null {
  if (!(implied > 0) || implied > 5000) return null;
  if (!stored) {
    return { symbol, ratio: snapRatio(implied), source: "mercado", implied_ratio: implied, implied_samples: 1 };
  }

  const weight = Math.min(stored.implied_samples, MAX_WEIGHTED_SAMPLES);
  const previousAverage = stored.implied_ratio ?? implied;
  const disagreesToday = Math.abs(implied / stored.ratio - 1) > CHANGE_THRESHOLD;
  const disagreedBefore = stored.implied_ratio !== null && Math.abs(stored.implied_ratio / stored.ratio - 1) > CHANGE_THRESHOLD;
  // After a change the old average no longer describes the ratio: start over from today.
  const average = disagreesToday && !disagreedBefore
    ? implied
    : (previousAverage * weight + implied) / (weight + 1);
  const base = { symbol, implied_ratio: average, implied_samples: Math.min(stored.implied_samples + 1, 1000) };

  const factor = Math.max(implied / stored.ratio, stored.ratio / implied);
  const changed = disagreesToday && (disagreedBefore || factor > 2);
  if (changed) {
    const ratio = snapRatio(disagreedBefore ? average : implied);
    if (ratio !== stored.ratio) {
      return { ...base, ratio, source: "mercado", previous_ratio: stored.ratio, changed_at: now };
    }
  }

  // A ratio first estimated from prices is refined as more days come in.
  if (stored.source === "mercado" && !disagreesToday) {
    return { ...base, ratio: snapRatio(average), source: "mercado" };
  }
  return { ...base, ratio: stored.ratio, source: stored.source };
}

/** BYMA tickers whose US listing uses a different symbol. */
export const US_TICKER: Record<string, string> = {
  BRKB: "BRK-B",
  DISN: "DIS",
};
