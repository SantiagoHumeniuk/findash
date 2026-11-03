// Pure alert and digest rules, kept apart from index.ts (which starts the server
// on import) so they can be tested with `deno test`.

export type PriceAlert = {
  id: string;
  user_id: string;
  symbol: string;
  condition: "above" | "below" | "move";
  target: number;
  last_triggered_at: string | null;
};

export type MarketQuote = {
  symbol: string;
  price: number;
  changePercent: number | null;
  /** Date of the last trade, YYYY-MM-DD in UTC. */
  tradeDate: string;
  currency: string;
};

export type DigestAsset = {
  symbol: string;
  name: string;
  nextEarningsDate: string | null;
  exDividendDate: string | null;
  dividendDate: string | null;
  gradeChanges: { date: string; firm: string; action: string; toGrade: string }[];
};

export type Digest = {
  movers: MarketQuote[];
  agenda: { symbol: string; date: string; label: string }[];
  gradeChanges: { symbol: string; text: string }[];
};

/**
 * Every alert fires once and then deactivates. A daily-move alert only counts a
 * session traded today, so it does not report last Friday's move on Monday morning.
 */
export function shouldTrigger(alert: PriceAlert, quote: MarketQuote, today: string): boolean {
  if (alert.condition === "above") return quote.price >= alert.target;
  if (alert.condition === "below") return quote.price <= alert.target;
  if (quote.tradeDate !== today || quote.changePercent === null) return false;
  if (alert.last_triggered_at?.slice(0, 10) === today) return false;
  return Math.abs(quote.changePercent) >= alert.target;
}

function formatPrice(value: number, currency: string): string {
  return `${currency} ${value.toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;
}

function formatPercent(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function describeTrigger(alert: PriceAlert, quote: MarketQuote): { title: string; body: string } {
  const price = formatPrice(quote.price, quote.currency);
  if (alert.condition === "move") {
    return {
      title: `${alert.symbol} se mueve ${formatPercent(quote.changePercent ?? 0)} hoy`,
      body: `Precio actual: ${price}. Tu alerta era por movimientos de ${alert.target}% o más.`,
    };
  }
  const target = formatPrice(alert.target, quote.currency);
  return {
    title: alert.condition === "above" ? `${alert.symbol} superó ${target}` : `${alert.symbol} cayó por debajo de ${target}`,
    body: `Precio actual: ${price}.`,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const AGENDA_DAYS = 7;
const GRADE_CHANGE_DAYS = 2;

/** Today's summary for one user; null when there is nothing worth sending. */
export function buildDigest(quotes: MarketQuote[], assets: DigestAsset[], now: Date): Digest | null {
  const today = now.toISOString().slice(0, 10);
  const limit = new Date(now.getTime() + AGENDA_DAYS * DAY_MS).toISOString().slice(0, 10);
  const inRange = (date: string | null): date is string => Boolean(date) && date! >= today && date! <= limit;
  const oldestGrade = new Date(now.getTime() - GRADE_CHANGE_DAYS * DAY_MS).toISOString().slice(0, 10);

  const movers = quotes
    .filter((quote) => quote.changePercent !== null)
    .sort((left, right) => Math.abs(right.changePercent!) - Math.abs(left.changePercent!))
    .slice(0, 5);
  const agenda = assets.flatMap((asset) => [
    ...(inRange(asset.nextEarningsDate) ? [{ symbol: asset.symbol, date: asset.nextEarningsDate, label: "Presenta resultados" }] : []),
    ...(inRange(asset.exDividendDate) ? [{ symbol: asset.symbol, date: asset.exDividendDate, label: "Fecha ex-dividendo" }] : []),
    ...(inRange(asset.dividendDate) ? [{ symbol: asset.symbol, date: asset.dividendDate, label: "Paga dividendo" }] : []),
  ]).sort((left, right) => left.date.localeCompare(right.date)).slice(0, 8);
  const gradeChanges = assets.flatMap((asset) =>
    asset.gradeChanges
      .filter((change) => change.date >= oldestGrade && /upgrade|downgrade/i.test(change.action))
      .map((change) => ({
        symbol: asset.symbol,
        text: `${change.firm} ${/upgrade/i.test(change.action) ? "mejoró" : "recortó"} su recomendación a ${change.toGrade}`,
      }))
  ).slice(0, 6);

  return movers.length === 0 && agenda.length === 0 && gradeChanges.length === 0
    ? null
    : { movers, agenda, gradeChanges };
}

/** One-line version for the in-app notification. */
export function summarizeDigest(digest: Digest): string {
  const parts: string[] = [];
  const top = digest.movers[0];
  if (top?.changePercent != null) parts.push(`Mayor movimiento: ${top.symbol} ${formatPercent(top.changePercent)}`);
  if (digest.agenda.length > 0) parts.push(`${digest.agenda.length} ${digest.agenda.length === 1 ? "fecha próxima" : "fechas próximas"}`);
  if (digest.gradeChanges.length > 0) parts.push(`${digest.gradeChanges.length} ${digest.gradeChanges.length === 1 ? "cambio de analistas" : "cambios de analistas"}`);
  return parts.join(" · ");
}

export function escapeHtml(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function section(title: string, rows: string[]): string {
  if (rows.length === 0) return "";
  return `<h3 style="margin:20px 0 8px;font-size:15px">${escapeHtml(title)}</h3><ul style="margin:0;padding-left:18px">${
    rows.map((row) => `<li style="margin:4px 0">${row}</li>`).join("")
  }</ul>`;
}

function layout(body: string, appUrl: string, unsubscribeUrl: string): string {
  return `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1f2937;max-width:560px;margin:auto">${body}
<p style="margin-top:24px"><a href="${escapeHtml(appUrl)}/hoy" style="color:#0284c7">Abrir FinDash</a></p>
<p style="margin-top:24px;font-size:12px;color:#6b7280">Información general con posible demora; no es una recomendación de inversión.<br>
<a href="${escapeHtml(unsubscribeUrl)}" style="color:#6b7280">Dejar de recibir estos correos</a></p></div>`;
}

export function digestEmailHtml(digest: Digest, appUrl: string, unsubscribeUrl: string): string {
  const body = `<h2 style="font-size:18px;margin:0 0 4px">Tu resumen de hoy</h2>${
    section("Lo que más se movió", digest.movers.map((quote) =>
      `<b>${escapeHtml(quote.symbol)}</b> ${formatPercent(quote.changePercent ?? 0)} (${escapeHtml(formatPrice(quote.price, quote.currency))})`
    ))
  }${
    section("Próximas fechas", digest.agenda.map((item) =>
      `<b>${escapeHtml(item.symbol)}</b>: ${escapeHtml(item.label)}, ${escapeHtml(item.date.split("-").reverse().join("/"))}`
    ))
  }${section("Analistas", digest.gradeChanges.map((item) => `<b>${escapeHtml(item.symbol)}</b>: ${escapeHtml(item.text)}`))}`;
  return layout(body, appUrl, unsubscribeUrl);
}

export function alertsEmailHtml(
  triggers: { title: string; body: string }[],
  appUrl: string,
  unsubscribeUrl: string,
): string {
  const rows = triggers.map((item) => `<b>${escapeHtml(item.title)}</b><br>${escapeHtml(item.body)}`);
  return layout(`<h2 style="font-size:18px;margin:0">Tus alertas de FinDash</h2>${section("Se activaron", rows)}`, appUrl, unsubscribeUrl);
}
