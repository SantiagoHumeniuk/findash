// Shared HTTP helpers for the Yahoo Finance proxy: parsing, retries and the
// cookie/crumb session Yahoo requires for quoteSummary and sector endpoints.

export const yahooUserAgent = "Mozilla/5.0 (compatible; Financytics/1.0)";

export type YahooSession = { cookie: string; crumb: string };

export function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : null;
}

export function getString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function getNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Reads Yahoo's `{ raw, fmt }` wrapper, also accepting plain numbers. */
export function getRaw(value: unknown): number | null {
  return getNumber(value) ?? getNumber(asRecord(value)?.raw);
}

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

/**
 * Fetches with exponential backoff on throttling and transient upstream errors.
 * Yahoo has no SLA, so a short retry absorbs most momentary 429/5xx responses.
 */
export async function fetchWithRetry(
  url: URL | string,
  init: RequestInit = {},
  attempts = 3,
): Promise<Response> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...init,
        headers: { "User-Agent": yahooUserAgent, ...(init.headers ?? {}) },
        signal: AbortSignal.timeout(10_000),
      });
      if (!RETRYABLE_STATUS.has(response.status) || attempt === attempts - 1) {
        return response;
      }
      await response.body?.cancel();
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1) throw error;
    }
    const delay = 400 * 2 ** attempt + Math.random() * 200;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  throw lastError instanceof Error ? lastError : new Error("Yahoo Finance no respondió");
}

export async function fetchJson(url: URL | string, init: RequestInit = {}): Promise<unknown> {
  const response = await fetchWithRetry(url, init);
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Yahoo Finance respondió HTTP ${response.status}`);
  }
  return await response.json();
}

// Warm isolates reuse the session instead of requesting a new crumb per call.
let cachedSession: { session: YahooSession; expiresAt: number } | null = null;
const SESSION_TTL_MS = 30 * 60 * 1000;

async function createYahooSession(): Promise<YahooSession> {
  const cookieResponse = await fetchWithRetry("https://fc.yahoo.com");
  const setCookieHeaders = typeof cookieResponse.headers.getSetCookie === "function"
    ? cookieResponse.headers.getSetCookie()
    : [];
  const combinedSetCookie = cookieResponse.headers.get("set-cookie");
  await cookieResponse.body?.cancel();
  const cookies = [...setCookieHeaders, ...(combinedSetCookie ? combinedSetCookie.split(/,\s*(?=[^;, ]+=)/) : [])]
    .map((header) => header.split(";")[0])
    .filter(Boolean);
  if (cookies.length === 0) {
    throw new Error(`Yahoo no entregó cookies para iniciar la sesión (HTTP ${cookieResponse.status})`);
  }

  const cookie = [...new Set(cookies)].join("; ");
  const crumbResponse = await fetchWithRetry("https://query1.finance.yahoo.com/v1/test/getcrumb", {
    headers: { Cookie: cookie },
  });
  if (!crumbResponse.ok) {
    await crumbResponse.body?.cancel();
    throw new Error(`Yahoo no permitió obtener el crumb (HTTP ${crumbResponse.status})`);
  }

  const crumb = (await crumbResponse.text()).trim();
  if (!crumb || crumb.includes("\n") || crumb.includes("<")) {
    throw new Error("Yahoo devolvió un crumb inválido");
  }
  return { cookie, crumb };
}

export async function getYahooSession(forceRefresh = false): Promise<YahooSession> {
  if (!forceRefresh && cachedSession && cachedSession.expiresAt > Date.now()) {
    return cachedSession.session;
  }
  const session = await createYahooSession();
  cachedSession = { session, expiresAt: Date.now() + SESSION_TTL_MS };
  return session;
}

/**
 * Calls an endpoint that needs the crumb, renewing the session once when Yahoo
 * rejects a stale crumb (HTTP 401 or an "Invalid Crumb" body).
 */
export async function fetchWithCrumb(
  buildUrl: (crumb: string) => URL,
  session: YahooSession,
): Promise<{ payload: unknown; session: YahooSession }> {
  let activeSession = session;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetchWithRetry(buildUrl(activeSession.crumb), {
      headers: { Cookie: activeSession.cookie },
    });
    const payload: unknown = response.headers.get("content-type")?.includes("json")
      ? await response.json()
      : (await response.body?.cancel(), null);
    const errorCode = getString(asRecord(asRecord(asRecord(payload)?.finance)?.error)?.code) ??
      getString(asRecord(asRecord(asRecord(payload)?.quoteSummary)?.error)?.code);
    const crumbRejected = response.status === 401 || errorCode === "Unauthorized";
    if (crumbRejected && attempt === 0) {
      activeSession = await getYahooSession(true);
      continue;
    }
    if (!response.ok && payload === null) {
      throw new Error(`Yahoo Finance respondió HTTP ${response.status}`);
    }
    return { payload, session: activeSession };
  }
  throw new Error("Yahoo Finance rechazó la sesión");
}

/** Runs async work over items with a fixed concurrency to avoid bursts against Yahoo. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index]);
    }
  });
  await Promise.all(runners);
  return results;
}
