import type { Data912BondQuote } from '@/services/api/data912-fixed-income-api';

function getZeroCouponMaturity(symbol: string, asOf: Date): Date | null {
  const match = /^([ST])(\d{2})([A-Z])(\d)$/.exec(symbol);
  if (!match) return null;
  const [, , dayText, monthCode, yearDigit] = match;
  const monthByCode: Record<string, number> = {
    E: 0, F: 1, M: 2, A: 3, Y: 4, J: 5, L: 6, G: 7, S: 8, O: 9, N: 10, D: 11,
  };
  const month = monthByCode[monthCode];
  if (month === undefined) return null;

  const currentDecade = Math.floor(asOf.getFullYear() / 10) * 10;
  for (const year of [currentDecade + Number(yearDigit), currentDecade + Number(yearDigit) + 10]) {
    const maturity = new Date(year, month, Number(dayText), 12);
    if (
      maturity.getFullYear() === year &&
      maturity.getMonth() === month &&
      maturity.getDate() === Number(dayText) &&
      maturity.getTime() > asOf.getTime()
    ) {
      return maturity;
    }
  }
  return null;
}

/**
 * Estimates annual effective yield for a short, zero-coupon S/T instrument.
 *
 * DATA912 does not provide coupon flows, so this deliberately does not estimate
 * yield for instruments whose maturity is not encoded in the ticker.
 * The approximation uses (100 / market price)^(365 / days to maturity) - 1.
 */
export function calculateData912ZeroCouponYield(
  quote: Data912BondQuote,
  asOf = new Date(),
): number | null {
  const maturity = getZeroCouponMaturity(quote.symbol, asOf);
  const bid = Number.isFinite(quote.px_bid) && quote.px_bid > 0 ? quote.px_bid : null;
  const ask = Number.isFinite(quote.px_ask) && quote.px_ask > 0 ? quote.px_ask : null;
  const marketPrice = bid !== null && ask !== null
    ? (bid + ask) / 2
    : ask ?? bid ?? quote.c;
  if (!maturity || !Number.isFinite(marketPrice) || marketPrice <= 0) return null;

  const pesoQuote = !/[CDP]$/.test(quote.symbol);
  const pricePerHundred = pesoQuote && marketPrice > 1000 ? marketPrice / 1000 : marketPrice;
  const maturityDay = Date.UTC(maturity.getFullYear(), maturity.getMonth(), maturity.getDate());
  const asOfDay = Date.UTC(asOf.getFullYear(), asOf.getMonth(), asOf.getDate());
  const daysToMaturity = (maturityDay - asOfDay) / 86_400_000;
  if (!Number.isFinite(pricePerHundred) || pricePerHundred <= 0 || daysToMaturity <= 0) return null;
  const annualEffectiveYield = (Math.pow(100 / pricePerHundred, 365 / daysToMaturity) - 1) * 100;
  return Number.isFinite(annualEffectiveYield) ? annualEffectiveYield : null;
}
