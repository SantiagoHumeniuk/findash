import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildScreenerQuery, parseScreenerRequest } from "./screener.ts";

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
