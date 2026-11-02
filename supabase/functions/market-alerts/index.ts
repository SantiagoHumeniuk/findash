// Scheduled checks for price alerts and the daily digest, plus email unsubscribe.
// Deployed with --no-verify-jwt: pg_cron authenticates with CRON_SECRET, and the
// unsubscribe link in an email has no session (its token is the credential).
//
// Secrets: CRON_SECRET (required), RESEND_API_KEY and ALERTS_FROM_EMAIL (email; without
// them only in-app notifications are created), APP_URL (links in emails).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  alertsEmailHtml,
  buildDigest,
  describeTrigger,
  digestEmailHtml,
  type DigestAsset,
  type MarketQuote,
  type PriceAlert,
  shouldTrigger,
  summarizeDigest,
} from "./logic.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const cronSecret = Deno.env.get("CRON_SECRET");
const resendKey = Deno.env.get("RESEND_API_KEY");
const fromEmail = Deno.env.get("ALERTS_FROM_EMAIL");
const appUrl = Deno.env.get("APP_URL") ?? "https://findash-data.vercel.app";

const DIGEST_BATCH = 100;
// Resend's default limit is 2 requests per second.
const EMAIL_GAP_MS = 600;

async function rest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) throw new Error(`Database request failed (${response.status}): ${await response.text()}`);
  // Writes with return=minimal answer with an empty body (201 or 204).
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

const inList = (values: string[]) => `in.(${values.map((value) => `"${value}"`).join(",")})`;

async function fetchQuote(symbol: string): Promise<MarketQuote | null> {
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  url.searchParams.set("range", "5d");
  url.searchParams.set("interval", "1d");
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Financytics/1.0)" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      return null;
    }
    const payload = await response.json();
    const result = payload?.chart?.result?.[0];
    const price = result?.meta?.regularMarketPrice;
    const marketTime = result?.meta?.regularMarketTime;
    if (typeof price !== "number" || typeof marketTime !== "number") return null;
    const timestamps: unknown[] = result.timestamp ?? [];
    const closes: unknown[] = result.indicators?.quote?.[0]?.close ?? [];
    // The close before the candle of the last trade; see findPreviousSessionClose in the Yahoo proxy.
    const candles = timestamps.flatMap((timestamp, index) =>
      typeof timestamp === "number" && timestamp <= marketTime && typeof closes[index] === "number"
        ? [closes[index] as number]
        : []
    );
    const previous = candles.at(-2);
    return {
      symbol,
      price,
      changePercent: previous ? ((price - previous) / previous) * 100 : null,
      tradeDate: new Date(marketTime * 1000).toISOString().slice(0, 10),
      currency: result.meta.currency ?? "USD",
    };
  } catch (error) {
    console.warn(`Quote request failed for ${symbol}:`, error);
    return null;
  }
}

async function fetchQuotes(symbols: string[]): Promise<Map<string, MarketQuote>> {
  const quotes = new Map<string, MarketQuote>();
  for (let index = 0; index < symbols.length; index += 5) {
    const batch = await Promise.all(symbols.slice(index, index + 5).map(fetchQuote));
    for (const quote of batch) if (quote) quotes.set(quote.symbol, quote);
  }
  return quotes;
}

type Preferences = {
  user_id: string;
  email_alerts: boolean;
  daily_digest: boolean;
  unsubscribe_token: string;
  last_digest_date: string | null;
};

/** Default preferences exist for every user, so alerts email users who never opened the settings. */
async function ensurePreferences(userIds: string[]): Promise<Map<string, Preferences>> {
  if (userIds.length === 0) return new Map();
  await rest("alert_preferences?on_conflict=user_id", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify(userIds.map((user_id) => ({ user_id }))),
  });
  const rows = await rest<Preferences[]>(`alert_preferences?user_id=${inList(userIds)}&select=*`);
  return new Map(rows.map((row) => [row.user_id, row]));
}

async function fetchEmails(userIds: string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const rows = await rest<{ id: string; email: string | null }[]>(`profiles?id=${inList(userIds)}&select=id,email`);
  return new Map(rows.flatMap((row) => (row.email ? [[row.id, row.email] as const] : [])));
}

async function sendEmail(to: string, subject: string, html: string, unsubscribeUrl: string): Promise<boolean> {
  if (!resendKey || !fromEmail) return false;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: fromEmail,
      to,
      subject,
      html,
      headers: { "List-Unsubscribe": `<${unsubscribeUrl}>` },
    }),
  });
  await new Promise((resolve) => setTimeout(resolve, EMAIL_GAP_MS));
  if (!response.ok) console.error(`Email to user failed: HTTP ${response.status} ${await response.text()}`);
  else await response.body?.cancel();
  return response.ok;
}

const unsubscribeUrl = (token: string) => `${appUrl}/baja?token=${token}`;

async function runAlerts(): Promise<Record<string, number>> {
  const alerts = await rest<PriceAlert[]>(
    "price_alerts?active=eq.true&select=id,user_id,symbol,condition,target,last_triggered_at",
  );
  if (alerts.length === 0) return { checked: 0, triggered: 0, emailed: 0 };

  const quotes = await fetchQuotes([...new Set(alerts.map((alert) => alert.symbol))]);
  const today = new Date().toISOString().slice(0, 10);
  const triggered = alerts.flatMap((alert) => {
    const quote = quotes.get(alert.symbol);
    return quote && shouldTrigger(alert, quote, today) ? [{ alert, ...describeTrigger(alert, quote) }] : [];
  });
  if (triggered.length === 0) return { checked: alerts.length, triggered: 0, emailed: 0 };

  // Marked before notifying: if a run fails halfway, a repeat notification is worse than a late one.
  const now = new Date().toISOString();
  const onceOnly = triggered.filter(({ alert }) => alert.condition !== "move").map(({ alert }) => alert.id);
  const repeating = triggered.filter(({ alert }) => alert.condition === "move").map(({ alert }) => alert.id);
  const mark = (ids: string[], body: Record<string, unknown>) =>
    ids.length === 0 ? Promise.resolve(null) : rest(`price_alerts?id=${inList(ids)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(body),
    });
  await mark(onceOnly, { active: false, last_triggered_at: now });
  await mark(repeating, { last_triggered_at: now });

  await rest("notifications", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(triggered.map(({ alert, title, body }) => ({
      user_id: alert.user_id,
      kind: "alert",
      symbol: alert.symbol,
      title,
      body,
    }))),
  });

  const userIds = [...new Set(triggered.map(({ alert }) => alert.user_id))];
  const [preferences, emails] = await Promise.all([ensurePreferences(userIds), fetchEmails(userIds)]);
  let emailed = 0;
  for (const userId of userIds) {
    const preference = preferences.get(userId);
    const email = emails.get(userId);
    if (!preference?.email_alerts || !email) continue;
    const items = triggered.filter(({ alert }) => alert.user_id === userId);
    const url = unsubscribeUrl(preference.unsubscribe_token);
    const subject = items.length === 1 ? items[0].title : `${items.length} alertas de FinDash`;
    if (await sendEmail(email, subject, alertsEmailHtml(items, appUrl, url), url)) emailed += 1;
  }
  return { checked: alerts.length, triggered: triggered.length, emailed };
}

type CachedAsset = {
  profile?: { companyName?: string };
  yahooInsights?: {
    nextEarnings?: { date?: string | null; exDividendDate?: string | null; dividendDate?: string | null } | null;
  };
  analystGradeUpdates?: { date: string; gradingCompany: string; action: string; newGrade: string }[];
};

async function runDigest(): Promise<Record<string, number>> {
  const today = new Date().toISOString().slice(0, 10);
  const subscribers = await rest<Preferences[]>(
    `alert_preferences?daily_digest=eq.true&or=(last_digest_date.is.null,last_digest_date.lt.${today})&select=*&limit=${DIGEST_BATCH}`,
  );
  if (subscribers.length === 0) return { users: 0, sent: 0 };

  const userIds = subscribers.map((subscriber) => subscriber.user_id);
  const roles = new Map((await rest<{ id: string; role: string | null }[]>(
    `profiles?id=${inList(userIds)}&select=id,role`,
  )).map((row) => [row.id, row.role]));
  const [watchlist, transactions, emails] = await Promise.all([
    rest<{ user_id: string; symbol: string }[]>(`watchlist?user_id=${inList(userIds)}&select=user_id,symbol`),
    rest<{ user_id: string; symbol: string; quantity: number; transaction_type: string }[]>(
      `transactions?user_id=${inList(userIds)}&select=user_id,symbol,quantity,transaction_type`,
    ),
    fetchEmails(userIds),
  ]);

  const symbolsByUser = new Map<string, Set<string>>(userIds.map((id) => [id, new Set<string>()]));
  for (const row of watchlist) symbolsByUser.get(row.user_id)?.add(row.symbol);
  const positions = new Map<string, number>();
  for (const row of transactions) {
    const key = `${row.user_id}|${row.symbol}`;
    positions.set(key, (positions.get(key) ?? 0) + (row.transaction_type === "sell" ? -row.quantity : row.quantity));
  }
  for (const [key, quantity] of positions) {
    if (quantity <= 0) continue;
    const [userId, symbol] = key.split("|");
    symbolsByUser.get(userId)?.add(symbol);
  }

  const allSymbols = [...new Set([...symbolsByUser.values()].flatMap((symbols) => [...symbols]))];
  const quotes = await fetchQuotes(allSymbols);
  // Dates and analyst changes come from the assets already saved by the app, which costs no Yahoo calls.
  const cached = allSymbols.length === 0 ? [] : await rest<{ symbol: string; data: CachedAsset }[]>(
    `asset_data_cache?symbol=${inList(allSymbols)}&select=symbol,data`,
  );
  const assets = new Map(cached.map((row): [string, DigestAsset] => [row.symbol, {
    symbol: row.symbol,
    name: row.data.profile?.companyName ?? row.symbol,
    nextEarningsDate: row.data.yahooInsights?.nextEarnings?.date ?? null,
    exDividendDate: row.data.yahooInsights?.nextEarnings?.exDividendDate ?? null,
    dividendDate: row.data.yahooInsights?.nextEarnings?.dividendDate ?? null,
    gradeChanges: (row.data.analystGradeUpdates ?? []).map((update) => ({
      date: update.date,
      firm: update.gradingCompany,
      action: update.action,
      toGrade: update.newGrade,
    })),
  }]));

  let sent = 0;
  const now = new Date();
  for (const subscriber of subscribers) {
    const symbols = [...(symbolsByUser.get(subscriber.user_id) ?? [])];
    const digest = buildDigest(
      symbols.flatMap((symbol) => {
        const quote = quotes.get(symbol);
        return quote ? [quote] : [];
      }),
      symbols.flatMap((symbol) => {
        const asset = assets.get(symbol);
        return asset ? [asset] : [];
      }),
      now,
    );
    // Marked first so a failure later in the batch cannot send the same digest twice.
    await rest(`alert_preferences?user_id=eq.${subscriber.user_id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ last_digest_date: today }),
    });
    // The digest belongs to paid plans; a downgraded user is skipped, not unsubscribed.
    if (!digest || (roles.get(subscriber.user_id) ?? 'basico') === 'basico') continue;
    await rest("notifications", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ user_id: subscriber.user_id, kind: "digest", title: "Tu resumen de hoy", body: summarizeDigest(digest) }),
    });
    const email = emails.get(subscriber.user_id);
    const url = unsubscribeUrl(subscriber.unsubscribe_token);
    if (email && await sendEmail(email, "Tu resumen de hoy en FinDash", digestEmailHtml(digest, appUrl, url), url)) sent += 1;
  }
  return { users: subscribers.length, sent };
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: corsHeaders });
}

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Método no permitido" }, 405);

  try {
    const body = await request.json().catch(() => ({})) as { job?: unknown; unsubscribe?: unknown };

    if (typeof body.unsubscribe === "string") {
      if (!/^[0-9a-f-]{36}$/i.test(body.unsubscribe)) return json({ error: "Enlace inválido" }, 400);
      const rows = await rest<unknown[]>(`alert_preferences?unsubscribe_token=eq.${body.unsubscribe}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ email_alerts: false, daily_digest: false, updated_at: new Date().toISOString() }),
      });
      return rows.length > 0 ? json({ ok: true }) : json({ error: "Enlace inválido o vencido" }, 404);
    }

    if (!cronSecret || request.headers.get("x-cron-secret") !== cronSecret) {
      return json({ error: "No autorizado" }, 401);
    }
    if (body.job === "alerts") return json(await runAlerts());
    if (body.job === "digest") return json(await runDigest());
    return json({ error: "Tarea desconocida" }, 400);
  } catch (error) {
    console.error("market-alerts failed:", error);
    return json({ error: "No se pudo completar la tarea" }, 500);
  }
});
