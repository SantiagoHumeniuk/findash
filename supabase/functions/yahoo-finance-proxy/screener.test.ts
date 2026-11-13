import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildScreenerQuery, parseScreenerRequest, summarizeSector } from "./screener.ts";

Deno.test("screener requests only accept allowlisted fields and sectors", () => {
  assertEquals(parseScreenerRequest({ sortField: "__proto__" }), null);
  assertEquals(parseScreenerRequest({ sector: "Anything" }), null);
  assertEquals(parseScreenerRequest({ filters: [{ field: "region", min: 1 }] }), null);
  assertEquals(parseScreenerRequest({ size: 500 }), null);
});

Deno.test("empty filters are dropped and limits become Yahoo operators", () => {
  const request = parseScreenerRequest({
    region: "ar",
    sector: "Energy",
    filters: [{ field: "pe", min: 5, max: 20 }, { field: "roe", min: null, max: null }],
    sortField: "dividendYield",
  });
  assertEquals(request?.filters.length, 1);
  const query = buildScreenerQuery(request!) as { sortField: string; query: { operands: unknown[] } };
  assertEquals(query.sortField, "forward_dividend_yield");
  assertEquals(query.query.operands, [
    { operator: "eq", operands: ["region", "ar"] },
    { operator: "eq", operands: ["sector", "Energy"] },
    { operator: "gte", operands: ["peratio.lasttwelvemonths", 5] },
    { operator: "lte", operands: ["peratio.lasttwelvemonths", 20] },
  ]);
});

Deno.test("sector figures weigh companies by size and ignore unusable multiples", () => {
  const stats = summarizeSector("Technology", [
    { marketCap: 900, forwardPE: 30, trailingPE: 36, priceToBook: 10 },
    { marketCap: 100, forwardPE: 10, trailingPE: 10, priceToBook: 2 },
    { marketCap: 500, forwardPE: -4, trailingPE: null, priceToBook: 3 },
    { marketCap: 500, forwardPE: 400, trailingPE: 20, priceToBook: null },
  ]);
  assertEquals(stats.count, 2);
  // 1000 of value over 900/30 + 100/10 = 40 of earnings.
  assertEquals(stats.forwardPe, 25);
  // Forward earnings 40 against trailing 900/36 + 100/10 = 35.
  assertEquals(Math.round((stats.growth ?? 0) * 1000), 143);
  assertEquals(stats.priceToBook, 3);
});
