import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { findPreviousSessionClose, inferDividendFrequency } from "./calc.ts";

const day = (date: string, hour = 13) => Date.parse(`${date}T${String(hour).padStart(2, "0")}:30:00Z`) / 1000;

Deno.test("previous close is the candle before the current session during trading", () => {
  const candles = [
    { timestamp: day("2026-10-23"), close: 210.96 },
    { timestamp: day("2026-10-26"), close: 216 },
    { timestamp: day("2026-10-27"), close: 216.07 },
  ];
  assertEquals(findPreviousSessionClose(candles, day("2026-10-27", 15)), 216);
});

Deno.test("previous close ignores candles stamped after the market time", () => {
  const candles = [
    { timestamp: day("2026-10-23"), close: 210.96 },
    { timestamp: day("2026-10-26"), close: 216 },
    { timestamp: day("2026-10-27"), close: 216.07 },
  ];
  // After Monday's close and before Tuesday's candle is relevant.
  assertEquals(findPreviousSessionClose(candles, day("2026-10-26", 20)), 210.96);
});

Deno.test("previous close is null without an earlier session", () => {
  assertEquals(findPreviousSessionClose([{ timestamp: day("2026-10-27"), close: 5 }], null), null);
  assertEquals(findPreviousSessionClose([], null), null);
});

Deno.test("dividend frequency follows the number of payments in the last year", () => {
  const monthly = Array.from({ length: 13 }, (_, index) => ({
    date: new Date(Date.UTC(2025, index, 15)).toISOString().slice(0, 10),
  }));
  const quarterly = ["2025-08-10", "2025-11-10", "2026-02-10", "2026-05-11", "2026-08-10"].map((date) => ({ date }));
  assertEquals(inferDividendFrequency(monthly), "monthly");
  assertEquals(inferDividendFrequency(quarterly), "quarterly");
  assertEquals(inferDividendFrequency([{ date: "2025-04-01" }, { date: "2025-10-01" }]), "semi-annual");
  assertEquals(inferDividendFrequency([{ date: "2026-04-01" }]), "annual");
  assertEquals(inferDividendFrequency([]), "");
});
