// Keeps cedear_ratios current: once a day it compares each CEDEAR's peso price with its US price
// and the CCL. Runs from pg_cron with CRON_SECRET (deployed with --no-verify-jwt).

import { applyObservation, impliedRatio, type RatioUpdate, type StoredRatio, US_TICKER } from "./logic.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const cronSecret = Deno.env.get("CRON_SECRET");

async function rest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (!response.ok) throw new Error(`Database request failed (${response.status}): ${await response.text()}`);
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

async function fetchJson(url: string, init: RequestInit = {}): Promise<unknown> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`${url} answered HTTP ${response.status}`);
  return await response.json();
}

/** Peso lines of every CEDEAR with today's close (the D and C lines are the dollar markets). */
async function fetchCedearPrices(): Promise<Map<string, number>> {
  const rows = await fetchJson("https://data912.com/live/arg_cedears") as { symbol: string; c: number; v: number }[];
  const symbols = new Set(rows.map((row) => row.symbol));
  const prices = new Map<string, number>();
  for (const row of rows) {
    const dollarLine = /[DC]$/.test(row.symbol) && symbols.has(row.symbol.slice(0, -1));
    // Only CEDEARs that traded today: a stale price would imply a wrong ratio.
    if (!dollarLine && row.c > 0 && row.v > 0) prices.set(row.symbol, row.c);
  }
  return prices;
}

async function fetchCcl(): Promise<number> {
  const payload = await fetchJson("https://dolarapi.com/v1/dolares/contadoconliqui") as { venta?: number; compra?: number };
  const rate = payload.venta && payload.venta > 0 ? payload.venta : payload.compra;
  if (!rate || !(rate > 0)) throw new Error("CCL no disponible");
  return rate;
}

/** US prices through the project's own Yahoo proxy (market data only, 20 per call). */
async function fetchUsPrices(tickers: string[]): Promise<Map<string, number>> {
  const prices = new Map<string, number>();
  for (let index = 0; index < tickers.length; index += 20) {
    try {
      const payload = await fetchJson(`${supabaseUrl}/functions/v1/yahoo-finance-proxy`, {
        method: "POST",
        headers: { Authorization: `Bearer ${anonKey}`, apikey: anonKey, "Content-Type": "application/json" },
        body: JSON.stringify({ symbols: tickers.slice(index, index + 20), marketDataOnly: true }),
      }) as { quotes?: { symbol: string; currency: string | null; price: { value: number | null } }[] };
      for (const quote of payload.quotes ?? []) {
        if (quote.price.value && quote.price.value > 0 && (quote.currency ?? "USD") === "USD") prices.set(quote.symbol, quote.price.value);
      }
    } catch (error) {
      console.warn("US price batch failed:", error);
    }
  }
  return prices;
}

async function sync() {
  const [cedears, ccl, stored] = await Promise.all([
    fetchCedearPrices(),
    fetchCcl(),
    rest<StoredRatio[]>("cedear_ratios?select=symbol,ratio,source,implied_ratio,implied_samples"),
  ]);
  const storedBySymbol = new Map(stored.map((row) => [row.symbol, row]));
  const tickers = [...cedears.keys()].map((symbol) => US_TICKER[symbol] ?? symbol).filter((ticker) => /^[A-Z0-9.^=-]{1,15}$/.test(ticker));
  const usPrices = await fetchUsPrices(tickers);

  const now = new Date().toISOString();
  const updates: (RatioUpdate & { checked_at: string })[] = [];
  for (const [symbol, pesoPrice] of cedears) {
    const implied = impliedRatio(usPrices.get(US_TICKER[symbol] ?? symbol) ?? 0, ccl, pesoPrice);
    if (implied === null) continue;
    const update = applyObservation(storedBySymbol.get(symbol), symbol, implied, now);
    if (update) updates.push({ ...update, checked_at: now });
  }

  // Upsert in batches; ratios of CEDEARs that did not trade today are left as they are. A bulk
  // upsert needs every row to have the same columns, so changes (which record the previous ratio)
  // go apart from confirmations (which must not erase it).
  const groups = [
    updates.filter((update) => update.previous_ratio !== undefined),
    updates.filter((update) => update.previous_ratio === undefined),
  ];
  for (const group of groups) {
    for (let index = 0; index < group.length; index += 200) {
      await rest("cedear_ratios?on_conflict=symbol", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(group.slice(index, index + 200)),
      });
    }
  }

  const changed = updates.filter((update) => update.previous_ratio !== undefined);
  const added = updates.filter((update) => !storedBySymbol.has(update.symbol));
  return {
    ccl,
    checked: updates.length,
    added: added.length,
    changed: changed.map((update) => `${update.symbol} ${update.previous_ratio}→${update.ratio}`),
  };
}

Deno.serve(async (request) => {
  if (!cronSecret || request.headers.get("x-cron-secret") !== cronSecret) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    const result = await sync();
    console.log("CEDEAR ratios synced", JSON.stringify(result));
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    console.error("CEDEAR ratio sync failed:", message);
    return Response.json({ error: message }, { status: 500 });
  }
});
