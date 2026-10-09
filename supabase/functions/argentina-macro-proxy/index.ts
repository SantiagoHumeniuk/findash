import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const upstreams = {
  dolares: "https://api.argentinadatos.com/v1/cotizaciones/dolares",
  inflacion: "https://api.argentinadatos.com/v1/finanzas/indices/inflacion",
  "plazos-fijos": "https://api.argentinadatos.com/v1/finanzas/tasas/plazoFijo",
  uva: "https://api.argentinadatos.com/v1/finanzas/indices/uva",
  dolarazo: "https://www.dolarazo.com.ar/api/v1/cotizaciones/dolares",
} as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function latestDollars(payload: unknown[]): unknown[] {
  const latestByCasa = new Map<string, { timestamp: number; quote: Record<string, unknown> }>();
  for (const value of payload) {
    const quote = asRecord(value);
    if (
      !quote ||
      typeof quote.casa !== "string" ||
      typeof quote.compra !== "number" ||
      typeof quote.venta !== "number" ||
      typeof quote.fecha !== "string"
    ) {
      continue;
    }

    const timestamp = Date.parse(quote.fecha);
    const casa = quote.casa.toLowerCase();
    const current = latestByCasa.get(casa);
    if (Number.isFinite(timestamp) && (!current || timestamp >= current.timestamp)) {
      latestByCasa.set(casa, { timestamp, quote });
    }
  }
  return [...latestByCasa.values()].map(({ quote }) => quote);
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return Response.json({ error: "Método no permitido" }, { status: 405, headers: corsHeaders });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "El cuerpo de la solicitud debe ser JSON válido" }, { status: 400, headers: corsHeaders });
  }
  if (
    typeof body !== "object" ||
    body === null ||
    !("resource" in body) ||
    typeof body.resource !== "string" ||
    !Object.prototype.hasOwnProperty.call(upstreams, body.resource)
  ) {
    return Response.json({ error: "Recurso macroeconómico no permitido" }, { status: 400, headers: corsHeaders });
  }

  try {
    const endpoint = upstreams[body.resource as keyof typeof upstreams];
    const upstream = await fetch(endpoint, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!upstream.ok) {
      throw new Error(`ArgentinaDatos respondió HTTP ${upstream.status}`);
    }

    const payload: unknown = await upstream.json();
    if (body.resource === "dolarazo") {
      const record = asRecord(payload);
      if (record?.ok !== true || !Array.isArray(record.data)) {
        throw new Error("dolarazo devolvió un formato inválido");
      }
    } else if (!Array.isArray(payload)) {
      throw new Error(`${body.resource} devolvió un formato inválido`);
    }

    const responsePayload = body.resource === "dolares" && Array.isArray(payload)
      ? latestDollars(payload)
      : payload;
    if (body.resource === "dolares" && Array.isArray(responsePayload) && responsePayload.length === 0) {
      throw new Error("ArgentinaDatos no devolvió cotizaciones válidas");
    }

    return Response.json(responsePayload, {
      headers: { ...corsHeaders, "Cache-Control": "public, max-age=300" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    console.error("Macroeconomic proxy error:", message);
    return Response.json(
      { error: `No se pudieron obtener los datos macroeconómicos: ${message}` },
      { status: 502, headers: corsHeaders },
    );
  }
});
