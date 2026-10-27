// Server-side cache shared by every FinDash user. It reuses the existing
// `asset_data_cache` table (symbol text primary key, data jsonb,
// last_updated_at timestamptz) with a `yahoo:` key prefix, so no migration is
// needed. When the service role is unavailable the proxy simply skips caching.

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

function restHeaders(): Record<string, string> | null {
  if (!supabaseUrl || !serviceRoleKey) return null;
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };
}

type CacheEntry<T> = { data: T; updatedAt: string };

export async function readCache<T>(key: string, maxAgeMs: number): Promise<CacheEntry<T> | null> {
  const headers = restHeaders();
  if (!headers) return null;
  try {
    const url = new URL(`${supabaseUrl}/rest/v1/asset_data_cache`);
    url.searchParams.set("symbol", `eq.${key}`);
    url.searchParams.set("select", "data,last_updated_at");
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(3_000) });
    if (!response.ok) {
      await response.body?.cancel();
      return null;
    }
    const rows: unknown = await response.json();
    const row = Array.isArray(rows) ? rows[0] as { data?: T; last_updated_at?: string } | undefined : undefined;
    if (!row?.last_updated_at || row.data === undefined) return null;
    if (Date.now() - Date.parse(row.last_updated_at) > maxAgeMs) return null;
    return { data: row.data, updatedAt: row.last_updated_at };
  } catch (error) {
    console.warn(`Yahoo proxy cache read failed for ${key}:`, error);
    return null;
  }
}

export async function writeCache<T>(key: string, data: T): Promise<void> {
  const headers = restHeaders();
  if (!headers) return;
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/asset_data_cache`, {
      method: "POST",
      headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ symbol: key, data, last_updated_at: new Date().toISOString() }),
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) {
      console.warn(`Yahoo proxy cache write failed for ${key}: HTTP ${response.status}`);
    }
    await response.body?.cancel();
  } catch (error) {
    console.warn(`Yahoo proxy cache write failed for ${key}:`, error);
  }
}

/**
 * Returns a fresh cached value or computes, stores and returns a new one.
 * `cachedAt` lets clients show how old the data is.
 */
export async function withCache<T>(
  key: string,
  maxAgeMs: number,
  compute: () => Promise<T>,
): Promise<{ data: T; cachedAt: string | null }> {
  const cached = await readCache<T>(key, maxAgeMs);
  if (cached) return { data: cached.data, cachedAt: cached.updatedAt };
  const data = await compute();
  await writeCache(key, data);
  return { data, cachedAt: null };
}
