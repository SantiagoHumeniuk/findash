// Shared guard for Edge Functions that spend paid API keys: only FinDash administrators may call them.

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

/** Returns the signed-in user's id, or null for visitors and invalid tokens. */
export async function getSignedInUserId(request: Request): Promise<string | null> {
  const authorization = request.headers.get("Authorization");
  if (!supabaseUrl || !anonKey || !authorization) return null;
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: authorization },
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) {
    await response.body?.cancel();
    return null;
  }
  const user = await response.json() as { id?: unknown };
  return typeof user.id === "string" ? user.id : null;
}

export async function isAdministrator(request: Request): Promise<boolean> {
  const userId = await getSignedInUserId(request);
  if (!userId || !supabaseUrl || !serviceRoleKey) return false;
  const response = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=role`,
    { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` }, signal: AbortSignal.timeout(5_000) },
  );
  if (!response.ok) {
    await response.body?.cancel();
    return false;
  }
  const rows = await response.json() as { role?: string }[];
  return rows[0]?.role === "administrador";
}

export function forbidden(): Response {
  return Response.json({ error: "forbidden", message: "Solo administradores." }, { status: 403 });
}
