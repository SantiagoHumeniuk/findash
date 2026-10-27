import { MarketMover } from '../types';
import {
    fetchYahooMarketQuotes,
    fetchYahooMarketScreener,
    type YahooFinanceMarketMover,
    type YahooFinanceQuote,
} from '../../../services/api/yahoo-finance-api';
import { mapYahooDailyChange } from '../../../services/api/yahoo-finance-mappers';

/** The 20 largest SPY holdings in weight order (GOOGL and GOOG are both share classes). */
export const S_AND_P_500_LEADERS = [
    'NVDA', 'MSFT', 'AAPL', 'AMZN', 'GOOGL', 'AVGO', 'META', 'BRK-B', 'GOOG', 'TSLA',
    'LLY', 'JPM', 'WMT', 'XOM', 'V', 'MA', 'ORCL', 'COST', 'JNJ', 'NFLX',
] as const;

export function mapYahooMarketMover(quote: YahooFinanceQuote): MarketMover | null {
    const price = quote.price.value;
    const dailyChange = mapYahooDailyChange(price, quote.previousClose.value);
    if (price === null || dailyChange === null) return null;
    return {
        symbol: quote.symbol,
        name: quote.name ?? quote.symbol,
        price,
        change: dailyChange.change,
        changesPercentage: dailyChange.changePercent,
    };
}

function mapYahooScreenerMover(mover: YahooFinanceMarketMover): MarketMover {
    return {
        symbol: mover.symbol,
        name: mover.name,
        price: mover.price,
        change: mover.change,
        changesPercentage: mover.changePercent,
    };
}

/**
 * Loads the 20 largest SPY holdings from Yahoo's market snapshot. The proxy
 * computes the daily change against the previous session's daily candle.
 */
export async function fetchIndexLeaders(): Promise<MarketMover[]> {
    const response = await fetchYahooMarketQuotes([...S_AND_P_500_LEADERS]);
    const quotesBySymbol = new Map(response.quotes.map((quote) => [quote.symbol, quote]));
    return S_AND_P_500_LEADERS.flatMap((symbol) => {
        const quote = quotesBySymbol.get(symbol);
        const mover = quote ? mapYahooMarketMover(quote) : null;
        return mover ? [mover] : [];
    });
}

/**
 * Fetches the biggest gainers reported by Yahoo Finance.
 */
export const fetchGainers = async (): Promise<MarketMover[]> => {
    try {
        return (await fetchYahooMarketScreener('day_gainers')).map(mapYahooScreenerMover);
    } catch (error) {
        console.error('Error fetching gainers:', error);
        return [];
    }
};

/**
 * Fetches the biggest losers reported by Yahoo Finance.
 */
export const fetchLosers = async (): Promise<MarketMover[]> => {
    try {
        return (await fetchYahooMarketScreener('day_losers')).map(mapYahooScreenerMover);
    } catch (error) {
        console.error('Error fetching losers:', error);
        return [];
    }
};

/**
 * Fetches the most active symbols reported by Yahoo Finance.
 */
export const fetchActives = async (): Promise<MarketMover[]> => {
    try {
        return (await fetchYahooMarketScreener('most_actives')).map(mapYahooScreenerMover);
    } catch (error) {
        console.error('Error fetching actives:', error);
        return [];
    }
};
