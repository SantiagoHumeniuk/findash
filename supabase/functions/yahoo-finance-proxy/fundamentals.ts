// Financial statements from Yahoo's fundamentals-timeseries endpoint (the one
// yfinance uses), with SEC EDGAR company facts as a fallback for US filers.

import { asRecord, fetchJson, getNumber, getRaw, getString } from "./http.ts";
import { readCache, writeCache } from "./cache.ts";

export type StatementPeriod = {
  date: string;
  currency: string | null;
  values: Record<string, number>;
};

export type Fundamentals = {
  source: "Yahoo Finance" | "SEC EDGAR" | null;
  /** Annual statements, newest first, all in the same reporting currency. */
  annual: StatementPeriod[];
  /** Trailing twelve months for income statement and cash flow items. */
  trailing: Record<string, number>;
  /** Most recent quarterly balance sheet, fresher than the last annual one. */
  latestQuarterBalance: StatementPeriod | null;
};

export const INCOME_FIELDS = [
  "TotalRevenue", "CostOfRevenue", "GrossProfit", "OperatingExpense", "SellingGeneralAndAdministration",
  "ResearchAndDevelopment", "OperatingIncome", "EBIT", "EBITDA", "InterestExpense", "PretaxIncome",
  "TaxProvision", "NetIncome", "NetIncomeContinuousOperations", "DilutedEPS", "DilutedAverageShares",
  "ReconciledDepreciation", "TaxRateForCalcs",
] as const;

export const BALANCE_FIELDS = [
  "TotalAssets", "CurrentAssets", "CashAndCashEquivalents", "CashCashEquivalentsAndShortTermInvestments",
  "AccountsReceivable", "Inventory", "NetPPE", "GoodwillAndOtherIntangibleAssets",
  "TotalLiabilitiesNetMinorityInterest", "CurrentLiabilities", "AccountsPayable", "TotalDebt", "LongTermDebt",
  "NetDebt", "StockholdersEquity", "OrdinarySharesNumber", "WorkingCapital", "InvestedCapital",
  "TangibleBookValue",
] as const;

export const CASH_FLOW_FIELDS = [
  "OperatingCashFlow", "CapitalExpenditure", "FreeCashFlow", "CashDividendsPaid", "StockBasedCompensation",
  "RepurchaseOfCapitalStock", "DepreciationAndAmortization",
] as const;

export const EMPTY_FUNDAMENTALS: Fundamentals = {
  source: null,
  annual: [],
  trailing: {},
  latestQuarterBalance: null,
};

type SeriesPoint = { date: string; currency: string | null; value: number };

function parseTimeseries(payload: unknown): Map<string, SeriesPoint[]> {
  const result = asRecord(asRecord(payload)?.timeseries)?.result;
  const series = new Map<string, SeriesPoint[]>();
  if (!Array.isArray(result)) return series;
  for (const item of result) {
    const record = asRecord(item);
    const type = Array.isArray(asRecord(record?.meta)?.type)
      ? getString((asRecord(record?.meta)?.type as unknown[])[0])
      : null;
    const points = type ? record?.[type] : null;
    if (!type || !Array.isArray(points)) continue;
    series.set(type, points.flatMap((point) => {
      const entry = asRecord(point);
      const date = getString(entry?.asOfDate);
      const value = getRaw(entry?.reportedValue);
      if (!entry || !date || value === null) return [];
      return [{ date, currency: getString(entry.currencyCode), value }];
    }));
  }
  return series;
}

function groupByDate(
  series: Map<string, SeriesPoint[]>,
  prefix: "annual" | "quarterly",
  fields: readonly string[],
): StatementPeriod[] {
  const periods = new Map<string, StatementPeriod>();
  for (const field of fields) {
    for (const point of series.get(`${prefix}${field}`) ?? []) {
      const period = periods.get(point.date) ?? { date: point.date, currency: point.currency, values: {} };
      period.values[field] = point.value;
      period.currency ??= point.currency;
      periods.set(point.date, period);
    }
  }
  return [...periods.values()].sort((left, right) => right.date.localeCompare(left.date));
}

/** Keeps only periods reported in the newest period's currency (e.g. YPF switched from ARS to USD). */
function keepLatestCurrency(periods: StatementPeriod[]): StatementPeriod[] {
  const currency = periods[0]?.currency ?? null;
  return currency ? periods.filter((period) => period.currency === null || period.currency === currency) : periods;
}

export async function fetchYahooFundamentals(symbol: string): Promise<Fundamentals> {
  const types = [
    ...[...INCOME_FIELDS, ...BALANCE_FIELDS, ...CASH_FLOW_FIELDS].map((field) => `annual${field}`),
    ...[...INCOME_FIELDS, ...CASH_FLOW_FIELDS].map((field) => `trailing${field}`),
    ...BALANCE_FIELDS.map((field) => `quarterly${field}`),
  ];
  const now = Math.floor(Date.now() / 1000);
  const url = new URL(
    `https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(symbol)}`,
  );
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("type", types.join(","));
  url.searchParams.set("period1", String(now - 8 * 365 * 24 * 60 * 60));
  url.searchParams.set("period2", String(now));

  const series = parseTimeseries(await fetchJson(url));
  const annual = keepLatestCurrency(groupByDate(series, "annual", [...INCOME_FIELDS, ...BALANCE_FIELDS, ...CASH_FLOW_FIELDS]));
  const trailing: Record<string, number> = {};
  for (const field of [...INCOME_FIELDS, ...CASH_FLOW_FIELDS]) {
    const latest = (series.get(`trailing${field}`) ?? []).sort((left, right) => right.date.localeCompare(left.date))[0];
    if (latest && (annual[0]?.currency === undefined || latest.currency === null || latest.currency === annual[0].currency)) {
      trailing[field] = latest.value;
    }
  }
  const quarterly = groupByDate(series, "quarterly", BALANCE_FIELDS)
    .filter((period) => !annual[0]?.currency || !period.currency || period.currency === annual[0].currency);

  return {
    source: annual.length > 0 || Object.keys(trailing).length > 0 ? "Yahoo Finance" : null,
    annual,
    trailing,
    latestQuarterBalance: quarterly[0] ?? null,
  };
}

// --- SEC EDGAR fallback ------------------------------------------------------

/** us-gaap concepts mapped to Yahoo field names; capex and dividends are cash outflows (negated). */
const SEC_CONCEPTS: Record<string, { concepts: string[]; negate?: boolean; unit?: string }> = {
  TotalRevenue: { concepts: ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax", "SalesRevenueNet"] },
  CostOfRevenue: { concepts: ["CostOfRevenue", "CostOfGoodsAndServicesSold"] },
  GrossProfit: { concepts: ["GrossProfit"] },
  OperatingIncome: { concepts: ["OperatingIncomeLoss"] },
  NetIncome: { concepts: ["NetIncomeLoss"] },
  PretaxIncome: {
    concepts: ["IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest"],
  },
  TaxProvision: { concepts: ["IncomeTaxExpenseBenefit"] },
  InterestExpense: { concepts: ["InterestExpense"] },
  ResearchAndDevelopment: { concepts: ["ResearchAndDevelopmentExpense"] },
  SellingGeneralAndAdministration: { concepts: ["SellingGeneralAndAdministrativeExpense"] },
  DilutedEPS: { concepts: ["EarningsPerShareDiluted"], unit: "USD/shares" },
  DilutedAverageShares: { concepts: ["WeightedAverageNumberOfDilutedSharesOutstanding"], unit: "shares" },
  DepreciationAndAmortization: { concepts: ["DepreciationDepletionAndAmortization", "DepreciationAndAmortization"] },
  TotalAssets: { concepts: ["Assets"] },
  CurrentAssets: { concepts: ["AssetsCurrent"] },
  CashAndCashEquivalents: { concepts: ["CashAndCashEquivalentsAtCarryingValue"] },
  AccountsReceivable: { concepts: ["AccountsReceivableNetCurrent"] },
  Inventory: { concepts: ["InventoryNet"] },
  TotalLiabilitiesNetMinorityInterest: { concepts: ["Liabilities"] },
  CurrentLiabilities: { concepts: ["LiabilitiesCurrent"] },
  AccountsPayable: { concepts: ["AccountsPayableCurrent"] },
  LongTermDebt: { concepts: ["LongTermDebtNoncurrent", "LongTermDebt"] },
  StockholdersEquity: { concepts: ["StockholdersEquity"] },
  OperatingCashFlow: { concepts: ["NetCashProvidedByUsedInOperatingActivities"] },
  CapitalExpenditure: { concepts: ["PaymentsToAcquirePropertyPlantAndEquipment"], negate: true },
  CashDividendsPaid: { concepts: ["PaymentsOfDividends", "PaymentsOfDividendsCommonStock"], negate: true },
  StockBasedCompensation: { concepts: ["ShareBasedCompensation"] },
};

const secUserAgent = Deno.env.get("SEC_USER_AGENT");

export function isSecConfigured(): boolean {
  return Boolean(secUserAgent);
}

async function fetchSec(url: string): Promise<unknown> {
  if (!secUserAgent) throw new Error("SEC_USER_AGENT no está configurado");
  return await fetchJson(url, { headers: { "User-Agent": secUserAgent, Accept: "application/json" } });
}

let tickerMap: Map<string, string> | null = null;

/** Resolves a ticker to its zero-padded CIK using SEC's public ticker list (cached for a week). */
export async function resolveCik(symbol: string): Promise<string | null> {
  if (!tickerMap) {
    const cached = await readCache<Record<string, string>>("yahoo:sec:tickers", 7 * 24 * 60 * 60 * 1000);
    if (cached) {
      tickerMap = new Map(Object.entries(cached.data));
    } else {
      const payload = asRecord(await fetchSec("https://www.sec.gov/files/company_tickers.json"));
      const entries: Record<string, string> = {};
      for (const value of Object.values(payload ?? {})) {
        const record = asRecord(value);
        const ticker = getString(record?.ticker);
        const cik = getNumber(record?.cik_str);
        if (ticker && cik !== null) entries[ticker.toUpperCase()] = String(cik).padStart(10, "0");
      }
      tickerMap = new Map(Object.entries(entries));
      await writeCache("yahoo:sec:tickers", entries);
    }
  }
  return tickerMap.get(symbol.toUpperCase().replace(".", "-")) ?? null;
}

export async function fetchSecFundamentals(symbol: string): Promise<Fundamentals> {
  const cik = await resolveCik(symbol);
  if (!cik) return EMPTY_FUNDAMENTALS;
  const facts = asRecord(asRecord(asRecord(await fetchSec(
    `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`,
  ))?.facts)?.["us-gaap"]);
  if (!facts) return EMPTY_FUNDAMENTALS;

  const periods = new Map<string, StatementPeriod>();
  for (const [field, mapping] of Object.entries(SEC_CONCEPTS)) {
    for (const concept of mapping.concepts) {
      const units = asRecord(asRecord(facts[concept])?.units);
      const values = units?.[mapping.unit ?? "USD"];
      if (!Array.isArray(values)) continue;
      let found = false;
      for (const item of values) {
        const entry = asRecord(item);
        const value = getNumber(entry?.val);
        const end = getString(entry?.end);
        const frame = getString(entry?.frame);
        // Annual 10-K facts carry a calendar frame like "CY2023" (duration) or "CY2023Q4I" (instant).
        if (getString(entry?.form) !== "10-K" || value === null || !end || !frame || !/^CY\d{4}(Q4I)?$/.test(frame)) {
          continue;
        }
        const period = periods.get(end) ?? { date: end, currency: "USD", values: {} };
        period.values[field] ??= mapping.negate ? -Math.abs(value) : value;
        periods.set(end, period);
        found = true;
      }
      if (found) break;
    }
  }

  const annual = [...periods.values()]
    .filter((period) => Object.keys(period.values).length >= 5)
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 10);
  for (const period of annual) {
    const { OperatingCashFlow, CapitalExpenditure } = period.values;
    if (OperatingCashFlow !== undefined && CapitalExpenditure !== undefined) {
      period.values.FreeCashFlow = OperatingCashFlow + CapitalExpenditure;
    }
  }
  return {
    source: annual.length > 0 ? "SEC EDGAR" : null,
    annual,
    trailing: {},
    latestQuarterBalance: null,
  };
}

/** Recent 8-K, 10-K and 10-Q filings, used as the press-release feed for US issuers. */
export async function fetchSecFilings(symbol: string, count: number): Promise<Record<string, unknown>[]> {
  const cik = await resolveCik(symbol);
  if (!cik) return [];
  const submissions = asRecord(await fetchSec(`https://data.sec.gov/submissions/CIK${cik}.json`));
  const recent = asRecord(asRecord(submissions?.filings)?.recent);
  const forms = Array.isArray(recent?.form) ? recent.form : [];
  const companyName = getString(submissions?.name) ?? symbol;
  const filings: Record<string, unknown>[] = [];
  for (let index = 0; index < forms.length && filings.length < count; index += 1) {
    const form = getString(forms[index]);
    if (form !== "8-K" && form !== "10-K" && form !== "10-Q") continue;
    const accession = getString((recent?.accessionNumber as unknown[])?.[index]);
    const document = getString((recent?.primaryDocument as unknown[])?.[index]);
    const filingDate = getString((recent?.filingDate as unknown[])?.[index]);
    const items = getString((recent?.items as unknown[])?.[index]) ?? "";
    if (!accession || !document || !filingDate) continue;
    filings.push({
      symbol,
      companyName,
      form,
      filingDate,
      items,
      description: getString((recent?.primaryDocDescription as unknown[])?.[index]) ?? form,
      url: `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accession.replaceAll("-", "")}/${document}`,
    });
  }
  return filings;
}
