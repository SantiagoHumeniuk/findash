// src/features/daily/lib/daily-brief.ts

import type { AssetData } from '../../../types/dashboard';

const DAY_MS = 24 * 60 * 60 * 1000;
const AGENDA_DAYS = 14;
const ANALYST_NEWS_DAYS = 7;
const INSIDER_NEWS_DAYS = 14;

export interface CurrencySummary {
  currency: string;
  value: number;
  dayChange: number;
  dayChangePercent: number | null;
}

export interface AgendaEvent {
  symbol: string;
  name: string;
  image: string;
  date: string;
  kind: 'earnings' | 'ex-dividend' | 'dividend-payment';
  isEstimate: boolean;
}

export interface BriefNewsItem {
  symbol: string;
  name: string;
  image: string;
  date: string;
  kind: 'upgrade' | 'downgrade' | 'coverage' | 'insider-buy' | 'insider-sell';
  title: string;
  detail: string;
}

/**
 * Today's result per currency. Holdings in different currencies are never added
 * together, because the app has no single conversion rate for them here.
 */
export function buildPortfolioSummary(
  holdings: { quantity: number; assetData?: AssetData }[],
): CurrencySummary[] {
  const totals = new Map<string, { value: number; dayChange: number }>();
  for (const { quantity, assetData } of holdings) {
    const price = assetData?.quote?.price;
    if (!assetData || !price || price <= 0 || quantity <= 0) continue;
    const currency = assetData.profile?.currency || 'USD';
    const total = totals.get(currency) ?? { value: 0, dayChange: 0 };
    total.value += price * quantity;
    total.dayChange += (assetData.quote.change ?? 0) * quantity;
    totals.set(currency, total);
  }
  return [...totals.entries()].map(([currency, { value, dayChange }]) => {
    const previous = value - dayChange;
    return { currency, value, dayChange, dayChangePercent: previous > 0 ? (dayChange / previous) * 100 : null };
  });
}

/** The user's assets by size of today's move. */
export function buildMovers(assets: AssetData[], limit = 6): AssetData[] {
  return assets
    .filter((asset) => asset.quote?.price > 0 && Number.isFinite(asset.quote.changePercentage))
    .sort((left, right) => Math.abs(right.quote.changePercentage) - Math.abs(left.quote.changePercentage))
    .slice(0, limit);
}

function toLocalIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Earnings and dividend dates of the next two weeks, soonest first. */
export function buildAgenda(assets: AssetData[], now = new Date()): AgendaEvent[] {
  const today = toLocalIsoDate(now);
  const limit = toLocalIsoDate(new Date(now.getTime() + AGENDA_DAYS * DAY_MS));
  const inRange = (date: string | null | undefined): date is string => Boolean(date) && date! >= today && date! <= limit;
  return assets.flatMap((asset): AgendaEvent[] => {
    const next = asset.yahooInsights?.nextEarnings;
    if (!next) return [];
    const base = { symbol: asset.symbol, name: asset.profile.companyName, image: asset.profile.image };
    const events: AgendaEvent[] = [];
    if (inRange(next.date)) events.push({ ...base, date: next.date, kind: 'earnings', isEstimate: next.isEstimate });
    if (inRange(next.exDividendDate)) events.push({ ...base, date: next.exDividendDate, kind: 'ex-dividend', isEstimate: false });
    if (inRange(next.dividendDate)) events.push({ ...base, date: next.dividendDate, kind: 'dividend-payment', isEstimate: false });
    return events;
  }).sort((left, right) => left.date.localeCompare(right.date) || left.symbol.localeCompare(right.symbol));
}

function isWithinDays(date: string | null, days: number, now: Date): date is string {
  if (!date) return false;
  const time = Date.parse(date.length === 10 ? `${date}T00:00:00` : date);
  return Number.isFinite(time) && time <= now.getTime() && now.getTime() - time <= days * DAY_MS;
}

/** Analyst changes of the last week and insider trades of the last two weeks, newest first. */
export function buildBriefNews(assets: AssetData[], now = new Date(), limit = 10): BriefNewsItem[] {
  return assets.flatMap((asset): BriefNewsItem[] => {
    const base = { symbol: asset.symbol, name: asset.profile.companyName, image: asset.profile.image };
    const analyst = (asset.analystGradeUpdates ?? []).flatMap((update): BriefNewsItem[] => {
      if (!isWithinDays(update.date, ANALYST_NEWS_DAYS, now)) return [];
      const action = update.action.toLowerCase();
      const kind = action.includes('upgrade') ? 'upgrade'
        : action.includes('downgrade') ? 'downgrade'
          : action.includes('inicia') ? 'coverage' : null;
      if (!kind) return [];
      const titles = { upgrade: 'mejoró su recomendación', downgrade: 'recortó su recomendación', coverage: 'inició cobertura' };
      return [{
        ...base,
        date: update.date,
        kind,
        title: `${update.gradingCompany} ${titles[kind]}`,
        detail: update.previousGrade && kind !== 'coverage' ? `${update.previousGrade} → ${update.newGrade}` : update.newGrade,
      }];
    });
    const insiders = (asset.yahooInsights?.ownership?.insiderTransactions ?? []).flatMap((trade): BriefNewsItem[] => {
      if (!isWithinDays(trade.date, INSIDER_NEWS_DAYS, now) || !trade.value) return [];
      const kind = /purchase|buy/i.test(trade.text) ? 'insider-buy' : /sale|sell/i.test(trade.text) ? 'insider-sell' : null;
      if (!kind) return [];
      return [{
        ...base,
        date: trade.date,
        kind,
        title: `${trade.name} ${kind === 'insider-buy' ? 'compró' : 'vendió'} acciones`,
        detail: trade.relation,
      }];
    });
    return [...analyst, ...insiders];
  }).sort((left, right) => right.date.localeCompare(left.date)).slice(0, limit);
}
