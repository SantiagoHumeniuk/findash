// supabase/functions/fmp-proxy/index.ts
// Forwards a Financial Modeling Prep request with the project's key. The app no longer uses FMP,
// so only administrators may call it: before, anyone with the public key could spend the plan.

import { forbidden, isAdministrator } from "../_shared/admin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const endpointPattern = /^(stable|api\/v3|api\/v4)\/[A-Za-z0-9\-_/]+(\?[A-Za-z0-9\-_.=&,%^]*)?$/;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return Response.json({ error: "Usá POST" }, { status: 405, headers: corsHeaders });
  if (!await isAdministrator(request)) return forbidden();

  const apiKey = Deno.env.get("FMP_API_KEY");
  if (!apiKey) return Response.json({ error: "Falta FMP_API_KEY" }, { status: 500, headers: corsHeaders });

  let endpointPath: unknown;
  try {
    ({ endpointPath } = await request.json());
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400, headers: corsHeaders });
  }
  if (typeof endpointPath !== "string" || !endpointPattern.test(endpointPath.replace(/^\//, ""))) {
    return Response.json({ error: "endpointPath inválido" }, { status: 400, headers: corsHeaders });
  }

  const path = endpointPath.replace(/^\//, "");
  const url = `https://financialmodelingprep.com/${path}${path.includes("?") ? "&" : "?"}apikey=${encodeURIComponent(apiKey)}`;
  const upstream = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: { ...corsHeaders, "Content-Type": upstream.headers.get("Content-Type") ?? "application/json" },
  });
});
