import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const endpoints = {
  sovereign: "https://data912.com/live/arg_bonds",
  corporate: "https://data912.com/live/arg_corp",
  cedears: "https://data912.com/live/arg_cedears",
  stocks: "https://data912.com/live/arg_stocks",
  notes: "https://data912.com/live/arg_notes",
} as const;

type LocalKind = "stock" | "bond" | "corp" | "note" | "cedear";
type LocalQuote = { symbol: string; price: number; changePercent: number | null; kind: LocalKind };

// Every portfolio and import asks for the same lists; one copy per minute is enough.
let localCache: { at: number; payload: { fetchedAt: string; quotes: LocalQuote[] } } | null = null;
const LOCAL_CACHE_MS = 60_000;

/** Last traded price of every local instrument, in its own market currency. */
async function fetchLocalMarket() {
  if (localCache && Date.now() - localCache.at < LOCAL_CACHE_MS) return localCache.payload;
  const lists: [LocalKind, string][] = [
    ["stock", endpoints.stocks],
    ["cedear", endpoints.cedears],
    ["bond", endpoints.sovereign],
    ["corp", endpoints.corporate],
    ["note", endpoints.notes],
  ];
  const results = await Promise.allSettled(lists.map(([, endpoint]) => fetchMarket(endpoint)));
  const quotes: LocalQuote[] = [];
  results.forEach((result, index) => {
    if (result.status !== "fulfilled") return;
    for (const item of result.value) {
      const row = item as Record<string, unknown>;
      const symbol = typeof row.symbol === "string" ? row.symbol.trim().toUpperCase() : "";
      // Close, or the bid when the instrument has not traded yet today.
      const price = [row.c, row.px_bid, row.px_ask].find((value) => typeof value === "number" && value > 0) as number | undefined;
      if (!symbol || price === undefined) continue;
      quotes.push({
        symbol,
        price,
        changePercent: typeof row.pct_change === "number" ? row.pct_change : null,
        kind: lists[index][0],
      });
    }
  });
  if (quotes.length === 0) throw new Error("DATA912 no devolvió cotizaciones locales");
  const payload = { fetchedAt: new Date().toISOString(), quotes };
  localCache = { at: Date.now(), payload };
  return payload;
}

async function fetchMarket(endpoint: string): Promise<unknown[]> {
  const response = await fetch(endpoint, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`DATA912 respondió HTTP ${response.status}`);
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new Error("DATA912 devolvió un formato inválido");
  return payload;
}

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Error desconocido";
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "GET" && request.method !== "POST") {
    return Response.json({ error: "Método no permitido" }, { status: 405, headers: corsHeaders });
  }

  try {
    const body: unknown = request.method === "POST" ? await request.json().catch(() => null) : null;
    if ((body as { market?: unknown } | null)?.market === "local") {
      return Response.json(await fetchLocalMarket(), { headers: { ...corsHeaders, "Cache-Control": "no-store" } });
    }

    if ((body as { market?: unknown } | null)?.market === "cedears") {
      return Response.json(
        { fetchedAt: new Date().toISOString(), cedears: await fetchMarket(endpoints.cedears) },
        { headers: corsHeaders },
      );
    }

    const [sovereignResult, corporateResult] = await Promise.allSettled([
      fetchMarket(endpoints.sovereign),
      fetchMarket(endpoints.corporate),
    ]);
    const errors = {
      sovereign: sovereignResult.status === "rejected" ? errorMessage(sovereignResult.reason) : null,
      corporate: corporateResult.status === "rejected" ? errorMessage(corporateResult.reason) : null,
    };
    if (sovereignResult.status === "rejected" && corporateResult.status === "rejected") {
      throw new Error(`Soberanos: ${errors.sovereign}; corporativos: ${errors.corporate}`);
    }

    return Response.json(
      {
        fetchedAt: new Date().toISOString(),
        sovereign: sovereignResult.status === "fulfilled" ? sovereignResult.value : [],
        corporate: corporateResult.status === "fulfilled" ? corporateResult.value : [],
        errors,
      },
      { headers: { ...corsHeaders, "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    console.error("DATA912 proxy error:", message);
    return Response.json(
      { error: `No se pudieron obtener las cotizaciones DATA912: ${message}` },
      { status: 502, headers: corsHeaders },
    );
  }
});
