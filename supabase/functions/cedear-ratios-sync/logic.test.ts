import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { applyObservation, impliedRatio, snapRatio, type StoredRatio } from "./logic.ts";

const NOW = "2026-11-16T21:30:00Z";
const stored = (overrides: Partial<StoredRatio> = {}): StoredRatio => ({
  symbol: "MELI", ratio: 120, source: "manual", implied_ratio: 120.4, implied_samples: 5, ...overrides,
});

Deno.test("implied ratio from prices", () => {
  // MELI at US$1760, CCL 1500, CEDEAR at $22.000 → 120 CEDEARs per share.
  assertEquals(impliedRatio(1760, 1500, 22_000), 120);
  assertEquals(impliedRatio(0, 1500, 22_000), null);
});

Deno.test("ratios snap to whole numbers or whole fractions", () => {
  assertEquals(snapRatio(119.6), 120);
  assertEquals(snapRatio(4.96), 5);
  assertEquals(snapRatio(0.21), 0.2);
  assertEquals(snapRatio(0.5), 0.5);
});

Deno.test("daily noise confirms the stored ratio", () => {
  const update = applyObservation(stored(), "MELI", 121.5, NOW)!;
  assertEquals(update.ratio, 120);
  assertEquals(update.source, "manual");
  assertEquals(update.implied_samples, 6);
  assertEquals(update.previous_ratio, undefined);
});

Deno.test("a doubling is a change on the first day", () => {
  const update = applyObservation(stored({ symbol: "SPY", ratio: 20, implied_ratio: 20 }), "SPY", 59.9, NOW)!;
  assertEquals(update.ratio, 60);
  assertEquals(update.previous_ratio, 20);
  assertEquals(update.source, "mercado");
});

Deno.test("a smaller disagreement needs a second day", () => {
  const first = applyObservation(stored({ ratio: 10, implied_ratio: 10 }), "X", 13, NOW)!;
  assertEquals(first.ratio, 10);
  const second = applyObservation(stored({ ratio: 10, implied_ratio: first.implied_ratio, implied_samples: first.implied_samples }), "X", 13.1, NOW)!;
  assertEquals(second.ratio, 13);
  assertEquals(second.previous_ratio, 10);
});

Deno.test("new CEDEARs get a ratio and refine it", () => {
  const first = applyObservation(undefined, "DELL", 74.3, NOW)!;
  assertEquals(first, { symbol: "DELL", ratio: 74, source: "mercado", implied_ratio: 74.3, implied_samples: 1 });
  const later = applyObservation({ ...first, source: "mercado" }, "DELL", 73.8, NOW)!;
  assertEquals(later.ratio, 74);
  assert(Math.abs(later.implied_ratio - 74.05) < 0.01);
});
