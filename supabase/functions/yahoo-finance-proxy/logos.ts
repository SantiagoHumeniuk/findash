// Company logos. FMP served one image per ticker; without it, logos come from
// Parqet's public logo CDN (by ticker) or the company website's favicon, and are
// copied once into the public `asset-logos` Storage bucket so the app never
// depends on those third parties at render time.

import { readCache, writeCache } from "./cache.ts";
import { fetchWithRetry } from "./http.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const BUCKET = "asset-logos";
const FOUND_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const MISSING_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_IMAGE_BYTES = 200;

type LogoCacheEntry = { url: string | null };

function storageHeaders(extra: Record<string, string> = {}): Record<string, string> | null {
  if (!supabaseUrl || !serviceRoleKey) return null;
  return { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, ...extra };
}

function fileName(symbol: string): string {
  return `${symbol.toUpperCase().replace(/[^A-Z0-9.-]/g, "_")}.png`;
}

export function publicLogoUrl(symbol: string): string | null {
  return supabaseUrl ? `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${fileName(symbol)}` : null;
}

/** Candidate image URLs, best first. Exchange suffixes fall back to the base ticker (GGAL.BA → GGAL). */
export function logoCandidates(symbol: string, website: string | null): string[] {
  const upper = symbol.toUpperCase();
  const base = upper.includes(".") ? upper.split(".")[0] : null;
  const candidates = [upper, ...(base ? [base] : [])]
    .map((ticker) => `https://assets.parqet.com/logos/symbol/${encodeURIComponent(ticker)}?format=png&size=128`);
  if (website) {
    try {
      const domain = new URL(website.startsWith("http") ? website : `https://${website}`).hostname.replace(/^www\./, "");
      candidates.push(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`);
    } catch {
      // Ignore malformed websites; the ticker sources may still work.
    }
  }
  return candidates;
}

async function downloadImage(url: string): Promise<ArrayBuffer | null> {
  try {
    const response = await fetchWithRetry(url, {}, 2);
    const type = response.headers.get("content-type") ?? "";
    if (!response.ok || !type.startsWith("image/")) {
      await response.body?.cancel();
      return null;
    }
    const bytes = await response.arrayBuffer();
    return bytes.byteLength >= MIN_IMAGE_BYTES ? bytes : null;
  } catch {
    return null;
  }
}

async function createBucket(): Promise<void> {
  const headers = storageHeaders({ "Content-Type": "application/json" });
  if (!headers) return;
  const response = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
    method: "POST",
    headers,
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true, allowed_mime_types: ["image/png", "image/x-icon", "image/jpeg", "image/svg+xml", "image/webp"] }),
  });
  await response.body?.cancel();
}

async function uploadLogo(symbol: string, bytes: ArrayBuffer): Promise<boolean> {
  const headers = storageHeaders({ "Content-Type": "image/png", "x-upsert": "true", "Cache-Control": "max-age=2592000" });
  if (!headers) return false;
  const upload = () => fetch(`${supabaseUrl}/storage/v1/object/${BUCKET}/${fileName(symbol)}`, {
    method: "POST",
    headers,
    body: bytes,
  });
  let response = await upload();
  if (!response.ok) {
    // The bucket is created on first use, so a fresh project needs no manual setup.
    await response.body?.cancel();
    await createBucket();
    response = await upload();
  }
  const ok = response.ok;
  if (!ok) console.warn(`Logo upload failed for ${symbol}: HTTP ${response.status}`);
  await response.body?.cancel();
  return ok;
}

/** Returns the stored public logo URL, fetching and storing it the first time. */
export async function ensureLogo(symbol: string, website: string | null): Promise<string | null> {
  const key = `yahoo:logo:${symbol.toUpperCase()}`;
  const cached = await readCache<LogoCacheEntry>(key, FOUND_TTL_MS);
  if (cached && (cached.data.url !== null || Date.now() - Date.parse(cached.updatedAt) < MISSING_TTL_MS)) {
    return cached.data.url;
  }
  for (const candidate of logoCandidates(symbol, website)) {
    const bytes = await downloadImage(candidate);
    if (bytes && await uploadLogo(symbol, bytes)) {
      const url = publicLogoUrl(symbol);
      await writeCache<LogoCacheEntry>(key, { url });
      return url;
    }
  }
  await writeCache<LogoCacheEntry>(key, { url: null });
  return null;
}
