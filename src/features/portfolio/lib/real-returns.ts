// src/features/portfolio/lib/real-returns.ts

export interface DollarFlow {
  quantity: number;
  purchase_price: number;
  purchase_date: string;
  transaction_type: 'buy' | 'sell';
}

export interface RealReturns {
  /** Result in dollars: what the portfolio earned over simply holding dollars. */
  usdPct: number;
  arsPct: number;
  /** Result in pesos after adjusting every purchase and sale for inflation. */
  realPct: number;
  /** What holding MEP dollars or keeping up with inflation would have returned since your purchases. */
  mepPct: number;
  inflationPct: number;
  inflationThrough: string;
}

function monthKey(date: string): string {
  return date.slice(0, 7);
}

function previousMonth(key: string): string {
  const [year, month] = key.split('-').map(Number);
  return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`;
}

/**
 * Compares a dollar portfolio with the MEP dollar and Argentine inflation. Each flow is
 * converted to pesos at its date's MEP; a month's inflation counts in full for purchases
 * made during it. Returns null when the series do not cover every transaction.
 */
export function calculateRealReturns(
  flows: DollarFlow[],
  currentValueUsd: number,
  mepHistory: { fecha: string; venta: number }[],
  inflation: { fecha: string; valor: number }[],
): RealReturns | null {
  if (mepHistory.length === 0 || inflation.length === 0) return null;
  const mep = mepHistory.filter((item) => item.venta > 0).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const months = [...inflation].sort((a, b) => a.fecha.localeCompare(b.fecha));
  if (mep.length === 0) return null;

  const priceIndex = new Map<string, number>();
  let accumulated = 1;
  for (const item of months) {
    accumulated *= 1 + item.valor / 100;
    priceIndex.set(monthKey(item.fecha), accumulated);
  }
  const lastMonth = monthKey(months[months.length - 1].fecha);
  const mepNow = mep[mep.length - 1].venta;

  const mepOn = (date: string): number | null => {
    let found: number | null = null;
    for (const item of mep) {
      if (item.fecha > date.slice(0, 10)) break;
      found = item.venta;
    }
    return found;
  };
  // Purchases after the last published month have no inflation to adjust yet.
  const inflationFactor = (date: string): number | null => {
    const start = previousMonth(monthKey(date));
    if (start >= lastMonth) return 1;
    const base = priceIndex.get(start);
    return base === undefined ? null : accumulated / base;
  };

  let boughtUsd = 0, soldUsd = 0, boughtArs = 0, soldArs = 0, boughtReal = 0, soldReal = 0, boughtAtMepNow = 0;
  for (const flow of flows) {
    const usd = flow.quantity * flow.purchase_price;
    const rate = mepOn(flow.purchase_date);
    const factor = inflationFactor(flow.purchase_date);
    if (rate === null || factor === null) return null;
    if (flow.transaction_type === 'buy') {
      boughtUsd += usd;
      boughtArs += usd * rate;
      boughtReal += usd * rate * factor;
      boughtAtMepNow += usd * mepNow;
    } else {
      soldUsd += usd;
      soldArs += usd * rate;
      soldReal += usd * rate * factor;
    }
  }
  if (boughtUsd <= 0) return null;

  const valueArs = currentValueUsd * mepNow;
  return {
    usdPct: ((currentValueUsd + soldUsd) / boughtUsd - 1) * 100,
    arsPct: ((valueArs + soldArs) / boughtArs - 1) * 100,
    realPct: ((valueArs + soldReal) / boughtReal - 1) * 100,
    mepPct: (boughtAtMepNow / boughtArs - 1) * 100,
    inflationPct: (boughtReal / boughtArs - 1) * 100,
    inflationThrough: months[months.length - 1].fecha,
  };
}
