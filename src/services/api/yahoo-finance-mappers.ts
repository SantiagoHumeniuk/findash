import type { AssetData } from '../../types/dashboard';
import type { YahooFinanceQuote } from './yahoo-finance-api';

/**
 * Maps Yahoo Finance's history to the application format in chronological order.
 *
 * Yahoo's chart endpoint returns dates from oldest to newest; sorting here also
 * makes the change calculation reliable if an upstream response changes order.
 */
export function mapYahooHistory(
    symbol: string,
    history: YahooFinanceQuote['history'],
): AssetData['historicalReturns'] {
    const chronologicalHistory = [...history].sort(
        (left, right) => new Date(left.date).getTime() - new Date(right.date).getTime(),
    );
    return chronologicalHistory.map((item, index) => {
        const previousClose = chronologicalHistory[index - 1]?.close ?? item.close;
        const change = item.close - previousClose;
        return {
            symbol,
            ...item,
            change,
            changePercent: previousClose > 0 ? (change / previousClose) * 100 : 0,
            vwap: 0,
        };
    });
}

/**
 * Preserves Yahoo's regularMarketChangePercent, which is already expressed in percent.
 */
export function mapYahooPercentChange(value: number | null): number {
    return value !== null && Number.isFinite(value) ? value : 0;
}

/**
 * Calculates the session change from the live price and previous close instead
 * of relying on provider percentage fields that can be stale during trading.
 */
export function mapYahooDailyChange(
    price: number | null,
    previousClose: number | null,
): { change: number; changePercent: number } | null {
    if (
        price === null ||
        previousClose === null ||
        !Number.isFinite(price) ||
        !Number.isFinite(previousClose) ||
        price <= 0 ||
        previousClose <= 0
    ) {
        return null;
    }
    const change = price - previousClose;
    return { change, changePercent: (change / previousClose) * 100 };
}

/**
 * Calculates a calendar-period return using the closest available historical
 * close on or before the requested period boundary.
 */
export function mapYahooPeriodChange(
    history: YahooFinanceQuote['history'],
    months: number,
): number | null {
    if (!Number.isInteger(months) || months <= 0 || history.length < 2) return null;
    const chronologicalHistory = [...history]
        .filter((item) => Number.isFinite(Date.parse(item.date)) && Number.isFinite(item.close) && item.close > 0)
        .sort((left, right) => left.date.localeCompare(right.date));
    const latest = chronologicalHistory.at(-1);
    if (!latest) return null;

    const periodBoundary = new Date(`${latest.date.slice(0, 10)}T00:00:00Z`);
    const dayOfMonth = periodBoundary.getUTCDate();
    periodBoundary.setUTCDate(1);
    periodBoundary.setUTCMonth(periodBoundary.getUTCMonth() - months);
    const daysInTargetMonth = new Date(
        Date.UTC(periodBoundary.getUTCFullYear(), periodBoundary.getUTCMonth() + 1, 0),
    ).getUTCDate();
    periodBoundary.setUTCDate(Math.min(dayOfMonth, daysInTargetMonth));
    const boundary = periodBoundary.toISOString().slice(0, 10);
    const baseline = chronologicalHistory
        .filter((item) => item.date.slice(0, 10) <= boundary)
        .at(-1);

    return baseline
        ? ((latest.close / baseline.close) - 1) * 100
        : null;
}
