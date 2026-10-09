import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const endpoints = {
  sovereign: "https://data912.com/live/arg_bonds",
  corporate: "https://data912.com/live/arg_corp",
} as const;

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
