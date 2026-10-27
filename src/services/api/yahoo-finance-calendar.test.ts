import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from '../../lib/supabase';
import {
  fetchYahooEarningsCalendar,
  fetchYahooEconomicCalendar,
  fetchYahooFinanceQuotes,
  fetchYahooLogos,
} from './yahoo-finance-api';

vi.mock('../../lib/supabase', () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));

const invoke = vi.mocked(supabase.functions.invoke);

function metric(value: number | null) {
  return { value };
}

describe('Yahoo calendar and insight parsing', () => {
  beforeEach(() => invoke.mockReset());

  it('maps economic releases and strips Yahoo asterisks', async () => {
    invoke.mockResolvedValueOnce({
      data: {
        total: 1,
        rows: [{
          econ_release: 'Durable Goods *', country_code: 'US', startdatetime: '2026-10-27T12:30:00.000Z',
          period: 'Sep', after_release_actual: '1.8', consensus_estimate: null, prior_release_actual: '-0.1',
          originally_reported_actual: '0.1',
        }],
      },
      error: null,
    } as never);

    await expect(fetchYahooEconomicCalendar('2026-10-26', '2026-11-02', 'US')).resolves.toEqual([{
      event: 'Durable Goods', country: 'US', date: '2026-10-27T12:30:00.000Z', period: 'Sep',
      actual: '1.8', consensus: null, prior: '-0.1', revisedPrior: '0.1',
    }]);
    expect(invoke).toHaveBeenCalledWith('yahoo-finance-proxy', {
      body: { action: 'calendar', kind: 'economic', from: '2026-10-26', to: '2026-11-02', country: 'US' },
    });
  });

  it('maps earnings rows and skips rows without a ticker', async () => {
    invoke.mockResolvedValueOnce({
      data: {
        total: 2,
        rows: [
          { ticker: 'AAPL', companyshortname: 'Apple Inc.', startdatetime: '2026-11-02T20:00:00.000Z', startdatetimetype: 'AMC', epsestimate: 1.98, epsactual: null, epssurprisepct: null, intradaymarketcap: 5e12 },
          { ticker: null, startdatetime: '2026-11-02T20:00:00.000Z' },
        ],
      },
      error: null,
    } as never);

    const rows = await fetchYahooEarningsCalendar('2026-10-26', '2026-11-02');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ symbol: 'AAPL', timing: 'AMC', epsEstimate: 1.98, epsActual: null });
  });

  it('returns logo URLs keyed by symbol', async () => {
    invoke.mockResolvedValueOnce({ data: { logos: { AAPL: 'https://x/AAPL.png', ZZZ: null } }, error: null } as never);
    await expect(fetchYahooLogos(['aapl', 'ZZZ', 'AAPL'])).resolves.toEqual({ AAPL: 'https://x/AAPL.png', ZZZ: null });
  });

  it('keeps quotes valid when an older proxy omits the new blocks', async () => {
    const empty = metric(null);
    invoke.mockResolvedValueOnce({
      data: {
        fetchedAt: '2026-10-27T00:00:00Z',
        quotes: [{
          symbol: 'AAPL', name: 'Apple', currency: 'USD', price: metric(100), trailingPE: empty, forwardPE: empty,
          trailingEPS: empty, forwardEPS: empty, beta: empty, lastDividend: empty, marketCap: empty, change: empty,
          changePercent: empty, volume: empty, averageVolume: empty, dayLow: empty, dayHigh: empty, yearLow: empty,
          yearHigh: empty, priceAvg50: empty, priceAvg200: empty, open: empty, previousClose: empty,
          marketTimestamp: null, marketState: null, exchange: null, delayedByMinutes: null, metrics: {},
          companyProfile: { sector: null, industry: null, country: null, website: null, description: null, employees: null },
          history: [], error: null,
          ownership: { insidersPercent: 0.02, institutionsPercent: 0.6, topInstitutions: [{ name: 'Fund', pctHeld: 0.08 }] },
        }],
      },
      error: null,
    } as never);

    const { quotes } = await fetchYahooFinanceQuotes(['AAPL']);
    expect(quotes[0].ownership).toMatchObject({ insidersPercent: 0.02, topInstitutions: [{ name: 'Fund', pctHeld: 0.08, shares: null }] });
    expect(quotes[0].nextEarnings).toBeNull();
    expect(quotes[0].logoUrl).toBeNull();
    expect(quotes[0].fundamentals.quarterly).toEqual([]);
  });
});
