import type { Data912BondQuote } from '@/services/api/data912-fixed-income-api';
import type { FixedIncomeCashFlow } from '@/services/api/fixed-income-sheet-api';

function getMarketPrice(quote: Data912BondQuote): number | null {
  const bid = Number.isFinite(quote.px_bid) && quote.px_bid > 0 ? quote.px_bid : null;
  const ask = Number.isFinite(quote.px_ask) && quote.px_ask > 0 ? quote.px_ask : null;
  const price = bid !== null && ask !== null
    ? (bid + ask) / 2
    : ask ?? bid ?? quote.c;
  return Number.isFinite(price) && price > 0 ? price : null;
}

/**
 * Solves annual effective yield from future contractual payments and a live market price.
 * Cash flows and the quote must use the same nominal denomination and currency.
 */
export function calculateCashFlowYield(
  quote: Data912BondQuote | null,
  cashFlows: FixedIncomeCashFlow[],
  asOf = new Date(),
): number | null {
  if (!quote || cashFlows.length === 0) return null;
  const price = getMarketPrice(quote);
  if (price === null) return null;
  const asOfDay = Date.UTC(asOf.getFullYear(), asOf.getMonth(), asOf.getDate());
  const futureFlows = cashFlows.flatMap(({ date, amount }) => {
    const flowDay = Date.parse(`${date.slice(0, 10)}T00:00:00Z`);
    if (!Number.isFinite(flowDay) || flowDay <= asOfDay || !Number.isFinite(amount) || amount <= 0) return [];
    return [{ days: (flowDay - asOfDay) / 86_400_000, amount }];
  });
  if (futureFlows.length === 0) return null;

  const presentValueDifference = (annualRate: number) => futureFlows.reduce(
    (sum, flow) => sum + flow.amount / Math.pow(1 + annualRate, flow.days / 365),
    -price,
  );
  let lower = -0.999999;
  let upper = 1;
  while (upper < 1_000_000 && presentValueDifference(upper) > 0) upper *= 2;
  if (presentValueDifference(lower) < 0 || presentValueDifference(upper) > 0) return null;

  for (let iteration = 0; iteration < 100; iteration += 1) {
    const middle = (lower + upper) / 2;
    if (presentValueDifference(middle) > 0) lower = middle;
    else upper = middle;
  }
  const yieldPercent = ((lower + upper) / 2) * 100;
  return Number.isFinite(yieldPercent) ? yieldPercent : null;
}
