// Extra quoteSummary blocks FMP did not cover or that replace lost FMP data:
// ownership, insider activity, the next earnings event and governance scores.

import { asRecord, getNumber, getRaw, getString } from "./http.ts";

const MAX_HOLDERS = 10;
const MAX_INSIDER_TRANSACTIONS = 15;

export type Holder = {
  name: string;
  pctHeld: number | null;
  shares: number | null;
  value: number | null;
  reportDate: string | null;
};

export type Ownership = {
  insidersPercent: number | null;
  institutionsPercent: number | null;
  institutionsFloatPercent: number | null;
  institutionsCount: number | null;
  topInstitutions: Holder[];
  topFunds: Holder[];
  insiderTransactions: Array<{
    name: string;
    relation: string;
    date: string | null;
    text: string;
    shares: number | null;
    value: number | null;
  }>;
  netInsiderActivity: {
    period: string | null;
    buyCount: number | null;
    buyShares: number | null;
    sellCount: number | null;
    sellShares: number | null;
    netShares: number | null;
    netPercentInsiderShares: number | null;
  } | null;
};

export type NextEarnings = {
  date: string | null;
  isEstimate: boolean;
  epsAvg: number | null;
  epsLow: number | null;
  epsHigh: number | null;
  revenueAvg: number | null;
  revenueLow: number | null;
  revenueHigh: number | null;
  exDividendDate: string | null;
  dividendDate: string | null;
};

/** Institutional Shareholder Services scores, 1 (low risk) to 10 (high risk). */
export type Governance = {
  overall: number | null;
  audit: number | null;
  board: number | null;
  compensation: number | null;
  shareholderRights: number | null;
  asOf: string | null;
};

function isoDate(value: unknown): string | null {
  const timestamp = getRaw(value);
  return timestamp === null ? null : new Date(timestamp * 1000).toISOString().slice(0, 10);
}

function parseHolders(value: unknown): Holder[] {
  const list = asRecord(value)?.ownershipList;
  if (!Array.isArray(list)) return [];
  return list.slice(0, MAX_HOLDERS).flatMap((item) => {
    const record = asRecord(item);
    const name = getString(record?.organization);
    if (!record || !name) return [];
    return [{
      name,
      pctHeld: getRaw(record.pctHeld),
      shares: getRaw(record.position),
      value: getRaw(record.value),
      reportDate: isoDate(record.reportDate),
    }];
  });
}

export function parseOwnership(data: Record<string, unknown>): Ownership | null {
  const breakdown = asRecord(data.majorHoldersBreakdown);
  const transactions = asRecord(data.insiderTransactions)?.transactions;
  const net = asRecord(data.netSharePurchaseActivity);
  const ownership: Ownership = {
    insidersPercent: getRaw(breakdown?.insidersPercentHeld),
    institutionsPercent: getRaw(breakdown?.institutionsPercentHeld),
    institutionsFloatPercent: getRaw(breakdown?.institutionsFloatPercentHeld),
    institutionsCount: getRaw(breakdown?.institutionsCount),
    topInstitutions: parseHolders(data.institutionOwnership),
    topFunds: parseHolders(data.fundOwnership),
    insiderTransactions: Array.isArray(transactions)
      ? transactions.slice(0, MAX_INSIDER_TRANSACTIONS).flatMap((item) => {
        const record = asRecord(item);
        const name = getString(record?.filerName);
        if (!record || !name) return [];
        return [{
          name,
          relation: getString(record.filerRelation) ?? "",
          date: isoDate(record.startDate),
          text: getString(record.transactionText) ?? "",
          shares: getRaw(record.shares),
          value: getRaw(record.value),
        }];
      })
      : [],
    netInsiderActivity: net
      ? {
        period: getString(net.period),
        buyCount: getRaw(net.buyInfoCount),
        buyShares: getRaw(net.buyInfoShares),
        sellCount: getRaw(net.sellInfoCount),
        sellShares: getRaw(net.sellInfoShares),
        netShares: getRaw(net.netInfoShares),
        netPercentInsiderShares: getRaw(net.netPercentInsiderShares),
      }
      : null,
  };
  const hasData = ownership.insidersPercent !== null || ownership.institutionsPercent !== null ||
    ownership.topInstitutions.length > 0 || ownership.insiderTransactions.length > 0;
  return hasData ? ownership : null;
}

export function parseNextEarnings(data: Record<string, unknown>): NextEarnings | null {
  const calendar = asRecord(data.calendarEvents);
  const earnings = asRecord(calendar?.earnings);
  if (!calendar) return null;
  const dates = Array.isArray(earnings?.earningsDate) ? earnings.earningsDate : [];
  return {
    date: dates.length > 0 ? isoDate(dates[0]) : null,
    isEstimate: earnings?.isEarningsDateEstimate === true,
    epsAvg: getRaw(earnings?.earningsAverage),
    epsLow: getRaw(earnings?.earningsLow),
    epsHigh: getRaw(earnings?.earningsHigh),
    revenueAvg: getRaw(earnings?.revenueAverage),
    revenueLow: getRaw(earnings?.revenueLow),
    revenueHigh: getRaw(earnings?.revenueHigh),
    exDividendDate: isoDate(calendar.exDividendDate),
    dividendDate: isoDate(calendar.dividendDate),
  };
}

export function parseGovernance(profile: Record<string, unknown> | null): Governance | null {
  if (!profile) return null;
  const governance: Governance = {
    overall: getNumber(profile.overallRisk),
    audit: getNumber(profile.auditRisk),
    board: getNumber(profile.boardRisk),
    compensation: getNumber(profile.compensationRisk),
    shareholderRights: getNumber(profile.shareHolderRightsRisk),
    asOf: isoDate(profile.governanceEpochDate),
  };
  return governance.overall === null && governance.audit === null ? null : governance;
}

// --- Market calendars (Yahoo's visualization endpoint) -----------------------

export type CalendarKind = "economic" | "earnings";

export const CALENDAR_FIELDS: Record<CalendarKind, { entity: string; fields: string[] }> = {
  economic: {
    entity: "economic_event",
    fields: [
      "econ_release", "country_code", "startdatetime", "period", "after_release_actual",
      "consensus_estimate", "prior_release_actual", "originally_reported_actual",
    ],
  },
  earnings: {
    entity: "sp_earnings",
    fields: [
      "ticker", "companyshortname", "startdatetime", "startdatetimetype", "epsestimate", "epsactual",
      "epssurprisepct", "intradaymarketcap",
    ],
  },
};

/** Maps Yahoo's column/row matrix into objects keyed by column id. */
export function parseVisualizationRows(payload: unknown): { total: number; rows: Record<string, unknown>[] } {
  const result = asRecord(asRecord(payload)?.finance)?.result;
  const first = Array.isArray(result) ? asRecord(result[0]) : null;
  const document = Array.isArray(first?.documents) ? asRecord(first.documents[0]) : null;
  const columns = Array.isArray(document?.columns)
    ? document.columns.map((column) => getString(asRecord(column)?.id) ?? "")
    : [];
  const rows = Array.isArray(document?.rows) ? document.rows : [];
  return {
    total: getNumber(first?.total) ?? rows.length,
    rows: rows.flatMap((row) =>
      Array.isArray(row) ? [Object.fromEntries(columns.map((column, index) => [column, row[index] ?? null]))] : []
    ),
  };
}
