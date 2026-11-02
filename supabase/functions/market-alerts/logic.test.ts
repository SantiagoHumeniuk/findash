import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildDigest,
  describeTrigger,
  digestEmailHtml,
  type DigestAsset,
  type MarketQuote,
  type PriceAlert,
  shouldTrigger,
} from "./logic.ts";

const TODAY = "2026-11-02";
const quote = (overrides: Partial<MarketQuote> = {}): MarketQuote => ({
  symbol: "AAPL",
  price: 100,
  changePercent: 1,
  tradeDate: TODAY,
  currency: "USD",
  ...overrides,
});
const alert = (overrides: Partial<PriceAlert> = {}): PriceAlert => ({
  id: "1",
  user_id: "u",
  symbol: "AAPL",
  condition: "above",
  target: 90,
  last_triggered_at: null,
  ...overrides,
});

Deno.test("price targets compare against the current price", () => {
  assert(shouldTrigger(alert({ target: 100 }), quote(), TODAY));
  assert(!shouldTrigger(alert({ target: 101 }), quote(), TODAY));
  assert(shouldTrigger(alert({ condition: "below", target: 100 }), quote(), TODAY));
  assert(!shouldTrigger(alert({ condition: "below", target: 99 }), quote(), TODAY));
});

Deno.test("move alerts use either direction, once a day, only for today's session", () => {
  const move = alert({ condition: "move", target: 3 });
  assert(shouldTrigger(move, quote({ changePercent: -3.5 }), TODAY));
  assert(!shouldTrigger(move, quote({ changePercent: 2 }), TODAY));
  assert(!shouldTrigger(move, quote({ changePercent: 5, tradeDate: "2026-10-30" }), TODAY));
  assert(!shouldTrigger({ ...move, last_triggered_at: `${TODAY}T14:00:00Z` }, quote({ changePercent: 5 }), TODAY));
  assert(shouldTrigger({ ...move, last_triggered_at: "2026-10-30T14:00:00Z" }, quote({ changePercent: 5 }), TODAY));
});

Deno.test("trigger messages name the symbol and the target", () => {
  assertStringIncludes(describeTrigger(alert({ target: 90 }), quote()).title, "AAPL superó USD 90");
  assertStringIncludes(describeTrigger(alert({ condition: "move", target: 3 }), quote({ changePercent: -4 })).title, "-4.00%");
});

const asset = (overrides: Partial<DigestAsset> = {}): DigestAsset => ({
  symbol: "AAPL",
  name: "Apple",
  nextEarningsDate: null,
  exDividendDate: null,
  dividendDate: null,
  gradeChanges: [],
  ...overrides,
});

Deno.test("the digest keeps upcoming dates and recent real analyst changes", () => {
  const digest = buildDigest([quote({ changePercent: 2 }), quote({ symbol: "KO", changePercent: -5 })], [
    asset({
      nextEarningsDate: "2026-11-05",
      exDividendDate: "2026-12-30",
      dividendDate: "2026-10-01",
      gradeChanges: [
        { date: "2026-11-01", firm: "Firm A", action: "upgrade", toGrade: "Buy" },
        { date: "2026-11-01", firm: "Firm B", action: "maintain", toGrade: "Buy" },
        { date: "2026-10-01", firm: "Firm C", action: "downgrade", toGrade: "Hold" },
      ],
    }),
  ], new Date(`${TODAY}T11:00:00Z`));
  assertEquals(digest?.movers.map(({ symbol }) => symbol), ["KO", "AAPL"]);
  assertEquals(digest?.agenda.map(({ label }) => label), ["Presenta resultados"]);
  assertEquals(digest?.gradeChanges.map(({ text }) => text), ["Firm A mejoró su recomendación a Buy"]);
});

Deno.test("an empty digest is not sent", () => {
  assertEquals(buildDigest([], [asset()], new Date(`${TODAY}T11:00:00Z`)), null);
});

Deno.test("emails escape provider text and include the unsubscribe link", () => {
  const html = digestEmailHtml(
    { movers: [], agenda: [], gradeChanges: [{ symbol: "AAPL", text: "<script>x</script>" }] },
    "https://app.test",
    "https://app.test/baja?token=abc",
  );
  assert(!html.includes("<script>"));
  assertStringIncludes(html, "https://app.test/baja?token=abc");
});
