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
