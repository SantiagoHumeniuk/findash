// Builds the FMP-shaped analysis blocks of AssetData (ratios, key metrics,
// estimates, analyst consensus, peers, DCF and rating) from raw Yahoo Finance
// statements. Every value is derived from reported figures; when an input is
// missing the metric is null instead of zero so screens can show "N/D".

import type {
  AssetAnalystEstimates,
  AssetAnalystGradeUpdate,
  AssetDCF,
  AssetDCFLevered,
  AssetGradesConsensus,
  AssetKeyMetrics,
  AssetKeyMetricsYearly,
  AssetPeerValuation,
  AssetPriceTarget,
  AssetPriceTargetConsensus,
  AssetRating,
  AssetRatios,
  AssetStockPriceChange,
} from '../../types/dashboard';
import type {
  YahooAnalystData,
  YahooFinanceQuote,
  YahooPeerQuote,
  YahooStatementPeriod,
} from './yahoo-finance-api';
import { MATURE_MARKET_ERP } from '../../data/damodaran-country-risk';

type Values = Record<string, number>;

function finite(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Division that yields null for missing inputs or a zero denominator. */
function ratio(numerator: number | null | undefined, denominator: number | null | undefined): number | null {
  const top = finite(numerator);
  const bottom = finite(denominator);
  if (top === null || bottom === null || bottom === 0) return null;
  return top / bottom;
}

function sum(...values: (number | null | undefined)[]): number | null {
  if (values.some((value) => finite(value) === null)) return null;
  return values.reduce<number>((total, value) => total + (value!), 0);
}

function abs(value: number | null | undefined): number | null {
  const number = finite(value);
  return number === null ? null : Math.abs(number);
}

function average(current: number | null | undefined, previous: number | null | undefined): number | null {
  const now = finite(current);
  const before = finite(previous);
  if (now === null) return null;
  return before === null ? now : (now + before) / 2;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Statement line items with the fallbacks used when Yahoo omits a subtotal. */
function lineItems(values: Values) {
  const revenue = finite(values.TotalRevenue);
  const costOfRevenue = finite(values.CostOfRevenue);
  const depreciation = finite(values.ReconciledDepreciation) ?? finite(values.DepreciationAndAmortization);
  const operatingIncome = finite(values.OperatingIncome);
  const ebit = finite(values.EBIT) ?? operatingIncome;
  const cash = finite(values.CashAndCashEquivalents);
  const cashAndInvestments = finite(values.CashCashEquivalentsAndShortTermInvestments) ?? cash;
  const totalDebt = finite(values.TotalDebt) ?? finite(values.LongTermDebt);
  const equity = finite(values.StockholdersEquity);
  const currentAssets = finite(values.CurrentAssets);
  const currentLiabilities = finite(values.CurrentLiabilities);
  const intangibles = finite(values.GoodwillAndOtherIntangibleAssets);
  const operatingCashFlow = finite(values.OperatingCashFlow);
  const capex = finite(values.CapitalExpenditure);
  return {
    revenue,
    costOfRevenue,
    grossProfit: finite(values.GrossProfit) ?? sum(revenue, costOfRevenue === null ? null : -costOfRevenue),
    operatingIncome,
    ebit,
    ebitda: finite(values.EBITDA) ?? sum(ebit, depreciation),
    depreciation,
    interestExpense: abs(values.InterestExpense),
    pretaxIncome: finite(values.PretaxIncome),
    taxProvision: finite(values.TaxProvision),
    netIncome: finite(values.NetIncome),
    netIncomeContinuing: finite(values.NetIncomeContinuousOperations),
    dilutedEps: finite(values.DilutedEPS),
    sga: finite(values.SellingGeneralAndAdministration),
    researchAndDevelopment: finite(values.ResearchAndDevelopment),
    taxRate: finite(values.TaxRateForCalcs),
    totalAssets: finite(values.TotalAssets),
    currentAssets,
    cash,
    cashAndInvestments,
    receivables: finite(values.AccountsReceivable),
    inventory: finite(values.Inventory),
    netPPE: finite(values.NetPPE),
    intangibles,
    totalLiabilities: finite(values.TotalLiabilitiesNetMinorityInterest),
    currentLiabilities,
    payables: finite(values.AccountsPayable),
    totalDebt,
    longTermDebt: finite(values.LongTermDebt),
    netDebt: finite(values.NetDebt) ?? sum(totalDebt, cashAndInvestments === null ? null : -cashAndInvestments),
    equity,
    shares: finite(values.OrdinarySharesNumber) ?? finite(values.DilutedAverageShares),
    dilutedShares: finite(values.DilutedAverageShares) ?? finite(values.OrdinarySharesNumber),
    workingCapital: finite(values.WorkingCapital) ?? sum(currentAssets, currentLiabilities === null ? null : -currentLiabilities),
    investedCapital: finite(values.InvestedCapital) ?? sum(equity, totalDebt, cash === null ? null : -cash),
    tangibleBook: finite(values.TangibleBookValue) ?? sum(equity, intangibles === null ? null : -intangibles),
    operatingCashFlow,
    capex,
    freeCashFlow: finite(values.FreeCashFlow) ?? sum(operatingCashFlow, capex),
    dividendsPaid: abs(values.CashDividendsPaid),
    stockBasedCompensation: finite(values.StockBasedCompensation),
  };
}

type Items = ReturnType<typeof lineItems>;

/** Price on or just before the period end, from the weekly 5-year history. */
function priceAt(history: YahooFinanceQuote['history'], date: string): number | null {
  const candidates = history.filter((entry) => entry.date <= date && entry.close > 0);
  const match = candidates.at(-1);
  if (!match) return null;
  // Skip periods older than the available history instead of using a distant price.
  const gapDays = (Date.parse(date) - Date.parse(match.date)) / 86_400_000;
  return gapDays <= 14 ? match.close : null;
}

function computeRatios(items: Items, marketCap: number | null, previous: Items | null) {
  const enterpriseValue = marketCap !== null ? sum(marketCap, items.netDebt) : null;
  const eps = items.dilutedEps ?? ratio(items.netIncome, items.dilutedShares);
  const bookValuePerShare = ratio(items.equity, items.shares);
  const previousEps = previous ? previous.dilutedEps ?? ratio(previous.netIncome, previous.dilutedShares) : null;
  const epsGrowthPct = eps !== null && previousEps !== null && previousEps > 0 ? (eps / previousEps - 1) * 100 : null;
  const priceToEarnings = ratio(marketCap, items.netIncome);
  const capexAbs = abs(items.capex);
  const effectiveTaxRate = ratio(items.taxProvision, items.pretaxIncome);
  const taxRate = items.taxRate ?? (effectiveTaxRate !== null ? clamp(effectiveTaxRate, 0, 0.5) : null);
  const averageReceivables = average(items.receivables, previous?.receivables);
  const averagePayables = average(items.payables, previous?.payables);
  const averageInventory = average(items.inventory, previous?.inventory);
  const costOfRevenue = abs(items.costOfRevenue);
  const daysSales = averageReceivables !== null ? ratio(averageReceivables * 365, items.revenue) : null;
  const daysPayables = averagePayables !== null ? ratio(averagePayables * 365, costOfRevenue) : null;
  const daysInventory = averageInventory !== null ? ratio(averageInventory * 365, costOfRevenue) : null;
  const grahamProduct = eps !== null && bookValuePerShare !== null ? 22.5 * eps * bookValuePerShare : null;

  const ratios = {
    grossProfitMargin: ratio(items.grossProfit, items.revenue),
    ebitMargin: ratio(items.ebit, items.revenue),
    ebitdaMargin: ratio(items.ebitda, items.revenue),
    operatingProfitMargin: ratio(items.operatingIncome, items.revenue),
    pretaxProfitMargin: ratio(items.pretaxIncome, items.revenue),
    continuousOperationsProfitMargin: ratio(items.netIncomeContinuing, items.revenue),
    netProfitMargin: ratio(items.netIncome, items.revenue),
    bottomLineProfitMargin: ratio(items.netIncome, items.revenue),
    receivablesTurnover: ratio(items.revenue, items.receivables),
    payablesTurnover: ratio(costOfRevenue, items.payables),
    inventoryTurnover: ratio(costOfRevenue, items.inventory),
    fixedAssetTurnover: ratio(items.revenue, items.netPPE),
    assetTurnover: ratio(items.revenue, items.totalAssets),
    currentRatio: ratio(items.currentAssets, items.currentLiabilities),
    quickRatio: ratio(sum(items.cashAndInvestments, items.receivables), items.currentLiabilities),
    solvencyRatio: ratio(sum(items.netIncome, items.depreciation), items.totalLiabilities),
    cashRatio: ratio(items.cash, items.currentLiabilities),
    priceToEarningsRatio: priceToEarnings,
    priceToEarningsGrowthRatio: priceToEarnings !== null && epsGrowthPct !== null && epsGrowthPct > 0
      ? priceToEarnings / epsGrowthPct
      : null,
    forwardPriceToEarningsGrowthRatio: null,
    priceToBookRatio: ratio(marketCap, items.equity),
    priceToSalesRatio: ratio(marketCap, items.revenue),
    priceToFreeCashFlowRatio: ratio(marketCap, items.freeCashFlow),
    priceToOperatingCashFlowRatio: ratio(marketCap, items.operatingCashFlow),
    debtToAssetsRatio: ratio(items.totalDebt, items.totalAssets),
    debtToEquityRatio: ratio(items.totalDebt, items.equity),
    debtToCapitalRatio: ratio(items.totalDebt, sum(items.totalDebt, items.equity)),
    longTermDebtToCapitalRatio: ratio(items.longTermDebt, sum(items.longTermDebt, items.equity)),
    financialLeverageRatio: ratio(items.totalAssets, items.equity),
    workingCapitalTurnoverRatio: ratio(items.revenue, items.workingCapital),
    operatingCashFlowRatio: ratio(items.operatingCashFlow, items.currentLiabilities),
    operatingCashFlowSalesRatio: ratio(items.operatingCashFlow, items.revenue),
    freeCashFlowOperatingCashFlowRatio: ratio(items.freeCashFlow, items.operatingCashFlow),
    // Needs scheduled principal repayments, which Yahoo does not report.
    debtServiceCoverageRatio: null,
    interestCoverageRatio: ratio(items.ebit, items.interestExpense),
    shortTermOperatingCashFlowCoverageRatio: null,
    operatingCashFlowCoverageRatio: ratio(items.operatingCashFlow, items.totalDebt),
    capitalExpenditureCoverageRatio: ratio(items.operatingCashFlow, capexAbs),
    dividendPaidAndCapexCoverageRatio: ratio(items.operatingCashFlow, sum(capexAbs, items.dividendsPaid ?? 0)),
    dividendPayoutRatio: items.dividendsPaid !== null ? ratio(items.dividendsPaid, items.netIncome) : null,
    dividendYield: items.dividendsPaid !== null ? ratio(items.dividendsPaid, marketCap) : null,
    dividendYieldPercentage: items.dividendsPaid !== null && marketCap ? (items.dividendsPaid / marketCap) * 100 : null,
    revenuePerShare: ratio(items.revenue, items.shares),
    netIncomePerShare: eps,
    interestDebtPerShare: ratio(items.interestExpense, items.shares),
    cashPerShare: ratio(items.cashAndInvestments, items.shares),
    bookValuePerShare,
    tangibleBookValuePerShare: ratio(items.tangibleBook, items.shares),
    shareholdersEquityPerShare: bookValuePerShare,
    operatingCashFlowPerShare: ratio(items.operatingCashFlow, items.shares),
    capexPerShare: ratio(capexAbs, items.shares),
    freeCashFlowPerShare: ratio(items.freeCashFlow, items.shares),
    netIncomePerEBT: ratio(items.netIncome, items.pretaxIncome),
    ebtPerEbit: ratio(items.pretaxIncome, items.ebit),
    priceToFairValue: null,
    debtToMarketCap: ratio(items.totalDebt, marketCap),
    effectiveTaxRate,
    enterpriseValueMultiple: ratio(enterpriseValue, items.ebitda),
    dividendPerShare: items.dividendsPaid !== null ? ratio(items.dividendsPaid, items.shares) : null,
    returnOnEquity: ratio(items.netIncome, items.equity),
    returnOnAssets: ratio(items.netIncome, items.totalAssets),
  };

  const keyMetrics = {
    marketCap,
    enterpriseValue,
    evToSales: ratio(enterpriseValue, items.revenue),
    evToOperatingCashFlow: ratio(enterpriseValue, items.operatingCashFlow),
    evToFreeCashFlow: ratio(enterpriseValue, items.freeCashFlow),
    evToEBITDA: ratio(enterpriseValue, items.ebitda),
    netDebtToEBITDA: ratio(items.netDebt, items.ebitda),
    currentRatio: ratios.currentRatio,
    incomeQuality: ratio(items.operatingCashFlow, items.netIncome),
    grahamNumber: grahamProduct !== null && grahamProduct > 0 ? Math.sqrt(grahamProduct) : null,
    grahamNetNet: ratio(
      sum(items.cashAndInvestments, (items.receivables ?? 0) * 0.75, (items.inventory ?? 0) * 0.5,
        items.totalLiabilities === null ? null : -items.totalLiabilities),
      items.shares,
    ),
    taxBurden: ratio(items.netIncome, items.pretaxIncome),
    interestBurden: ratio(items.pretaxIncome, items.ebit),
    workingCapital: items.workingCapital,
    investedCapital: items.investedCapital,
    returnOnAssets: ratios.returnOnAssets,
    operatingReturnOnAssets: ratio(items.operatingIncome, items.totalAssets),
    returnOnTangibleAssets: ratio(items.netIncome, sum(items.totalAssets, items.intangibles === null ? 0 : -items.intangibles)),
    returnOnEquity: ratios.returnOnEquity,
    returnOnInvestedCapital: items.ebit !== null && taxRate !== null
      ? ratio(items.ebit * (1 - taxRate), items.investedCapital)
      : null,
    returnOnCapitalEmployed: ratio(items.ebit, sum(items.totalAssets, items.currentLiabilities === null ? null : -items.currentLiabilities)),
    earningsYield: ratio(items.netIncome, marketCap),
    freeCashFlowYield: ratio(items.freeCashFlow, marketCap),
    capexToOperatingCashFlow: ratio(capexAbs, items.operatingCashFlow),
    capexToDepreciation: ratio(capexAbs, items.depreciation),
    capexToRevenue: ratio(capexAbs, items.revenue),
    salesGeneralAndAdministrativeToRevenue: ratio(items.sga, items.revenue),
    researchAndDevelopementToRevenue: ratio(items.researchAndDevelopment, items.revenue),
    stockBasedCompensationToRevenue: ratio(items.stockBasedCompensation, items.revenue),
    intangiblesToTotalAssets: ratio(items.intangibles, items.totalAssets),
    averageReceivables,
    averagePayables,
    averageInventory,
    daysOfSalesOutstanding: daysSales,
    daysOfPayablesOutstanding: daysPayables,
    daysOfInventoryOutstanding: daysInventory,
    operatingCycle: daysSales !== null && daysInventory !== null ? daysSales + daysInventory : daysSales,
    cashConversionCycle: daysSales !== null && daysPayables !== null
      ? daysSales + (daysInventory ?? 0) - daysPayables
      : null,
    freeCashFlowToEquity: items.freeCashFlow,
    freeCashFlowToFirm: items.freeCashFlow !== null && items.interestExpense !== null && taxRate !== null
      ? items.freeCashFlow + items.interestExpense * (1 - taxRate)
      : items.freeCashFlow,
    tangibleAssetValue: sum(items.totalAssets, items.intangibles === null ? 0 : -items.intangibles,
      items.totalLiabilities === null ? null : -items.totalLiabilities),
    netCurrentAssetValue: sum(items.currentAssets, items.totalLiabilities === null ? null : -items.totalLiabilities),
  };
  return { ratios, keyMetrics };
}

export interface YahooFinancials {
  ratios: AssetRatios[];
  keyMetricsYearly: AssetKeyMetricsYearly[];
  keyMetricsTTM: Omit<AssetKeyMetrics, 'symbol' | 'marketCap'> | null;
  reportedCurrency: string | null;
}

/**
 * Annual ratios and key metrics (newest first, like FMP) plus TTM metrics that
 * combine trailing income/cash flow with the latest quarterly balance sheet.
 */
export function buildYahooFinancials(
  symbol: string,
  quote: YahooFinanceQuote,
  currentMarketCap: number | null,
): YahooFinancials {
  const { annual, trailing, latestQuarterBalance } = quote.fundamentals;
  const reportedCurrency = annual[0]?.currency ?? latestQuarterBalance?.currency ?? null;
  // Statements in a currency other than the quote's cannot be combined with its price.
  const sameCurrency = !reportedCurrency || !quote.currency || reportedCurrency === quote.currency;
  const itemsByPeriod = annual.map((period) => lineItems(period.values));

  const yearly = annual.map((period: YahooStatementPeriod, index) => {
    const items = itemsByPeriod[index];
    const price = sameCurrency ? priceAt(quote.history, period.date) : null;
    const marketCap = price !== null && items.shares !== null ? price * items.shares : null;
    const computed = computeRatios(items, marketCap, itemsByPeriod[index + 1] ?? null);
    const header = {
      symbol,
      date: period.date,
      fiscalYear: period.date.slice(0, 4),
      period: 'FY',
      reportedCurrency: period.currency ?? reportedCurrency ?? '',
    };
    return {
      ratios: { ...header, ...computed.ratios } satisfies AssetRatios,
      keyMetrics: { ...header, ...computed.keyMetrics, marketCap: marketCap ?? 0 } satisfies AssetKeyMetricsYearly,
    };
  });

  let keyMetricsTTM: YahooFinancials['keyMetricsTTM'] = null;
  if (Object.keys(trailing).length > 0 || annual.length > 0) {
    const balance = latestQuarterBalance?.values ?? annual[0]?.values ?? {};
    const ttmValues: Values = { ...(annual[0]?.values ?? {}), ...balance, ...trailing };
    const marketCap = sameCurrency ? currentMarketCap : null;
    const { keyMetrics } = computeRatios(lineItems(ttmValues), marketCap, itemsByPeriod[0] ?? null);
    keyMetricsTTM = Object.fromEntries(
      Object.entries(keyMetrics)
        .filter(([key]) => key !== 'marketCap')
        .map(([key, value]) => [key === 'enterpriseValue' ? 'enterpriseValueTTM' : `${key}TTM`, value]),
    ) as YahooFinancials['keyMetricsTTM'];
  }

  return {
    ratios: yearly.map((entry) => entry.ratios),
    keyMetricsYearly: yearly.map((entry) => entry.keyMetrics),
    keyMetricsTTM,
    reportedCurrency,
  };
}

// --- Analysts -----------------------------------------------------------------

export function buildAnalystEstimates(symbol: string, analyst: YahooAnalystData): AssetAnalystEstimates[] {
  // Yahoo publishes current and next fiscal year ("0y", "+1y"); quarters are not FMP-comparable.
  return analyst.estimates
    .filter((estimate) => (estimate.period === '0y' || estimate.period === '+1y') && estimate.endDate)
    .map((estimate) => ({
      symbol,
      date: estimate.endDate!,
      revenueLow: estimate.revenueLow,
      revenueHigh: estimate.revenueHigh,
      revenueAvg: estimate.revenueAvg,
      ebitdaLow: null,
      ebitdaHigh: null,
      ebitdaAvg: null,
      ebitLow: null,
      ebitHigh: null,
      ebitAvg: null,
      netIncomeLow: null,
      netIncomeHigh: null,
      netIncomeAvg: null,
      sgaExpenseLow: null,
      sgaExpenseHigh: null,
      sgaExpenseAvg: null,
      epsAvg: estimate.epsAvg,
      epsHigh: estimate.epsHigh,
      epsLow: estimate.epsLow,
      numAnalystsRevenue: estimate.revenueAnalysts,
      numAnalystsEps: estimate.epsAnalysts,
    }))
    .sort((left, right) => right.date.localeCompare(left.date));
}

function consensusFromMean(mean: number | null): string {
  if (mean === null) return '';
  if (mean <= 1.5) return 'Strong Buy';
  if (mean <= 2.5) return 'Buy';
  if (mean <= 3.5) return 'Hold';
  if (mean <= 4.5) return 'Sell';
  return 'Strong Sell';
}

export function buildGradesConsensus(
  symbol: string,
  analyst: YahooAnalystData,
  recommendationMean: number | null,
): AssetGradesConsensus {
  const current = analyst.recommendationTrend.find((trend) => trend.period === '0m') ?? analyst.recommendationTrend[0];
  const counts = current ?? { strongBuy: 0, buy: 0, hold: 0, sell: 0, strongSell: 0 };
  const total = counts.strongBuy + counts.buy + counts.hold + counts.sell + counts.strongSell;
  const computedMean = total > 0
    ? (counts.strongBuy + 2 * counts.buy + 3 * counts.hold + 4 * counts.sell + 5 * counts.strongSell) / total
    : null;
  return {
    symbol,
    strongBuy: counts.strongBuy,
    buy: counts.buy,
    hold: counts.hold,
    sell: counts.sell,
    strongSell: counts.strongSell,
    consensus: consensusFromMean(recommendationMean ?? computedMean),
  };
}

const GRADE_ACTIONS: Record<string, string> = {
  up: 'upgrade',
  down: 'downgrade',
  main: 'maintain',
  init: 'Inicia cobertura',
  reit: 'Reitera',
};

export function buildGradeUpdates(symbol: string, analyst: YahooAnalystData): AssetAnalystGradeUpdate[] {
  return analyst.gradeUpdates.map((update) => ({
    symbol,
    date: update.date,
    gradingCompany: update.firm,
    previousGrade: update.fromGrade,
    newGrade: update.toGrade,
    action: GRADE_ACTIONS[update.action] ?? update.action,
  }));
}

/** Price-target activity by window, from firms' published targets in the grade history. */
export function buildPriceTarget(symbol: string, analyst: YahooAnalystData, now = Date.now()): AssetPriceTarget {
  const withTargets = analyst.gradeUpdates.filter((update) =>
    update.currentPriceTarget !== null && update.currentPriceTarget > 0);
  const windowStats = (days: number | null) => {
    const entries = days === null
      ? withTargets
      : withTargets.filter((update) => now - Date.parse(update.date) <= days * 86_400_000);
    const total = entries.reduce((accumulated, update) => accumulated + (update.currentPriceTarget ?? 0), 0);
    return { count: entries.length, average: entries.length > 0 ? total / entries.length : 0 };
  };
  const month = windowStats(30);
  const quarter = windowStats(90);
  const year = windowStats(365);
  const allTime = windowStats(null);
  return {
    symbol,
    lastMonthCount: month.count,
    lastMonthAvgPriceTarget: month.average,
    lastQuarterCount: quarter.count,
    lastQuarterAvgPriceTarget: quarter.average,
    lastYearCount: year.count,
    lastYearAvgPriceTarget: year.average,
    allTimeCount: allTime.count,
    allTimeAvgPriceTarget: allTime.average,
    publishers: [...new Set(withTargets.map((update) => update.firm))],
  };
}

export function buildPriceTargetConsensus(
  symbol: string,
  metrics: Record<string, number | null>,
): AssetPriceTargetConsensus {
  return {
    symbol,
    targetHigh: metrics['financialData.targetHighPrice'] ?? 0,
    targetLow: metrics['financialData.targetLowPrice'] ?? 0,
    targetConsensus: metrics['financialData.targetMeanPrice'] ?? 0,
    targetMedian: metrics['financialData.targetMedianPrice'] ?? 0,
  };
}

export function buildPeerValuations(peers: YahooPeerQuote[]): AssetPeerValuation[] {
  return peers.flatMap((peer) => {
    if (peer.price === null || peer.marketCap === null) return [];
    return [{
      symbol: peer.symbol,
      companyName: peer.name ?? peer.symbol,
      price: peer.price,
      marketCap: peer.marketCap,
      priceToEarningsRatio: peer.trailingPE,
      priceToBookRatio: peer.priceToBook,
      priceToSalesRatio: peer.priceToSales,
      priceToFreeCashFlowRatio: ratio(peer.marketCap, peer.freeCashflow),
      // Yahoo only reports the operating margin, which matches EBIT margin for most issuers.
      ebitMargin: peer.operatingMargins,
      returnOnEquity: peer.returnOnEquity,
      // Yahoo expresses debt/equity as a percentage (150 = 1.5x).
      debtToEquity: peer.debtToEquity !== null ? peer.debtToEquity / 100 : null,
      evToEBITDA: peer.evToEbitda,
      evToEBIT: null,
      evToSales: peer.evToRevenue,
    }];
  });
}

// --- Price performance -------------------------------------------------------

function changeSince(history: YahooFinanceQuote['history'], price: number, boundary: Date): number | null {
  const date = boundary.toISOString().slice(0, 10);
  const baseline = history.filter((entry) => entry.date <= date && entry.close > 0).at(-1);
  if (!baseline || (Date.parse(date) - Date.parse(baseline.date)) / 86_400_000 > 14) return null;
  return ((price / baseline.close) - 1) * 100;
}

export function buildStockPriceChange(
  symbol: string,
  history: YahooFinanceQuote['history'],
  price: number,
  dailyChangePercent: number | null,
): AssetStockPriceChange {
  const sorted = [...history].sort((left, right) => left.date.localeCompare(right.date));
  const latest = sorted.at(-1);
  const anchor = latest ? new Date(`${latest.date}T00:00:00Z`) : new Date();
  const monthsAgo = (months: number) => {
    const date = new Date(anchor);
    date.setUTCMonth(date.getUTCMonth() - months);
    return changeSince(sorted, price, date);
  };
  const yearStart = new Date(Date.UTC(anchor.getUTCFullYear(), 0, 1));
  const weekAgo = new Date(anchor.getTime() - 7 * 86_400_000);
  const first = sorted.find((entry) => entry.close > 0);
  return {
    symbol,
    '1D': dailyChangePercent ?? 0,
    '5D': changeSince(sorted, price, weekAgo) ?? 0,
    '1M': monthsAgo(1) ?? 0,
    '3M': monthsAgo(3) ?? 0,
    '6M': monthsAgo(6) ?? 0,
    ytd: changeSince(sorted, price, new Date(yearStart.getTime() - 86_400_000)) ?? 0,
    '1Y': monthsAgo(12) ?? 0,
    '3Y': monthsAgo(36) ?? 0,
    '5Y': monthsAgo(60) ?? 0,
    // The proxy keeps five years of weekly history; longer windows are not available.
    '10Y': 0,
    max: first ? ((price / first.close) - 1) * 100 : 0,
  };
}

// --- DCF and rating -------------------------------------------------------------

export interface DcfInputs {
  symbol: string;
  price: number;
  beta: number | null;
  riskFreeRate: number | null;
  financials: YahooFinancials;
  quote: YahooFinanceQuote;
}

const PROJECTION_YEARS = 5;
const TERMINAL_GROWTH = 0.025;
const DEFAULT_RISK_FREE_RATE = 0.042;

/**
 * Five-year unlevered DCF in FMP's row format. Revenue growth starts from the
 * analysts' next-year estimate (or the historical CAGR) and fades linearly to
 * the terminal rate; margins and reinvestment use the last three fiscal years.
 * The WACC uses a Blume-adjusted beta and excludes country risk, which the
 * valuation engine adds later.
 */
export function buildFinDashDcf({ symbol, price, beta, riskFreeRate, financials, quote }: DcfInputs): {
  dcf: AssetDCF[];
  dcfLevered: AssetDCFLevered;
} {
  const emptyLevered: AssetDCFLevered = { symbol, date: '', dcf: 0, 'Stock Price': price };
  const sameCurrency = !financials.reportedCurrency || !quote.currency || financials.reportedCurrency === quote.currency;
  const history = quote.fundamentals.annual.slice(0, 4).map((period) => lineItems(period.values));
  const latest = history[0];
  const baseRevenue = finite(quote.fundamentals.trailing.TotalRevenue) ?? latest?.revenue ?? null;
  const shares = latest?.dilutedShares ?? latest?.shares ?? null;
  if (!sameCurrency || !latest || baseRevenue === null || baseRevenue <= 0 || shares === null || shares <= 0) {
    return { dcf: [], dcfLevered: emptyLevered };
  }

  const recent = history.slice(0, 3).filter((items) => items.revenue !== null && items.revenue > 0);
  const meanShare = (pick: (items: Items) => number | null, fallback: number) => {
    const shares = recent.flatMap((items) => {
      const value = ratio(pick(items), items.revenue);
      return value === null ? [] : [value];
    });
    return shares.length > 0 ? shares.reduce((total, value) => total + value, 0) / shares.length : fallback;
  };
  const ebitdaMargin = meanShare((items) => items.ebitda, 0);
  const depreciationShare = meanShare((items) => items.depreciation, 0.03);
  const capexShare = meanShare((items) => abs(items.capex), depreciationShare);
  const workingCapitalShare = meanShare((items) => items.workingCapital, 0);
  if (ebitdaMargin <= 0) return { dcf: [], dcfLevered: emptyLevered };

  const oldest = history.at(-1);
  const years = history.length - 1;
  const historicalCagr = oldest?.revenue && latest.revenue && years > 0 && oldest.revenue > 0
    ? (latest.revenue / oldest.revenue) ** (1 / years) - 1
    : null;
  const nextYearEstimate = quote.analyst.estimates.find((estimate) => estimate.period === '+1y');
  const analystGrowth = nextYearEstimate?.revenueAvg && baseRevenue > 0
    ? nextYearEstimate.revenueAvg / baseRevenue - 1
    : null;
  const startGrowth = clamp(analystGrowth ?? historicalCagr ?? 0.04, -0.1, 0.3);

  const taxRates = recent.flatMap((items) => {
    const rate = items.taxRate ?? ratio(items.taxProvision, items.pretaxIncome);
    return rate === null ? [] : [clamp(rate, 0, 0.35)];
  });
  const taxRate = taxRates.length > 0 ? taxRates.reduce((total, value) => total + value, 0) / taxRates.length : 0.21;

  const rf = riskFreeRate !== null && riskFreeRate > 0 && riskFreeRate < 0.15 ? riskFreeRate : DEFAULT_RISK_FREE_RATE;
  // Blume-adjusted beta (0.67β + 0.33), the market convention that pulls raw betas toward 1.
  const rawBeta = beta !== null && beta > 0 && beta < 4 ? beta : 1;
  const assetBeta = 0.67 * rawBeta + 0.33;
  const costOfEquity = rf + assetBeta * MATURE_MARKET_ERP;
  const totalDebt = latest.totalDebt ?? 0;
  const costOfDebt = clamp(ratio(latest.interestExpense, totalDebt) ?? rf + 0.015, 0.02, 0.15);
  const afterTaxCostOfDebt = costOfDebt * (1 - taxRate);
  const marketValueOfEquity = price * shares;
  const totalCapital = marketValueOfEquity + totalDebt;
  const debtWeighting = totalCapital > 0 ? totalDebt / totalCapital : 0;
  const equityWeighting = 1 - debtWeighting;
  const wacc = equityWeighting * costOfEquity + debtWeighting * afterTaxCostOfDebt;
  const longTermGrowthRate = Math.min(TERMINAL_GROWTH, wacc - 0.02);
  if (wacc <= longTermGrowthRate) return { dcf: [], dcfLevered: emptyLevered };

  const baseYear = Number(quote.fundamentals.annual[0].date.slice(0, 4));
  let revenue = baseRevenue;
  let previousWorkingCapital = baseRevenue * workingCapitalShare;
  let sumPvUfcf = 0;
  const projections = Array.from({ length: PROJECTION_YEARS }, (_, index) => {
    const growth = startGrowth + (longTermGrowthRate - startGrowth) * (index / (PROJECTION_YEARS - 1));
    revenue *= 1 + growth;
    const ebitda = revenue * ebitdaMargin;
    const depreciation = revenue * depreciationShare;
    const ebit = ebitda - depreciation;
    const capitalExpenditure = -revenue * capexShare;
    const workingCapital = revenue * workingCapitalShare;
    const changeInWorkingCapital = workingCapital - previousWorkingCapital;
    previousWorkingCapital = workingCapital;
    const ebiat = ebit * (1 - taxRate);
    const ufcf = ebiat + depreciation + capitalExpenditure - changeInWorkingCapital;
    sumPvUfcf += ufcf / (1 + wacc) ** (index + 1);
    return { year: String(baseYear + index + 1), revenue, ebitda, ebit, depreciation, capitalExpenditure, ebiat, ufcf };
  });

  const lastUfcf = projections[PROJECTION_YEARS - 1].ufcf;
  const terminalValue = lastUfcf * (1 + longTermGrowthRate) / (wacc - longTermGrowthRate);
  const presentTerminalValue = terminalValue / (1 + wacc) ** PROJECTION_YEARS;
  const enterpriseValue = sumPvUfcf + presentTerminalValue;
  const netDebt = latest.netDebt ?? totalDebt - (latest.cashAndInvestments ?? 0);
  const equityValue = enterpriseValue - netDebt;
  const equityValuePerShare = equityValue / shares;

  const dcf: AssetDCF[] = projections.map((projection) => ({
    ...projection,
    symbol,
    totalCash: latest.cashAndInvestments ?? 0,
    receivables: latest.receivables ?? 0,
    inventories: latest.inventory ?? 0,
    payable: latest.payables ?? 0,
    price,
    beta: assetBeta,
    dilutedSharesOutstanding: shares,
    costofDebt: costOfDebt * 100,
    taxRate: taxRate * 100,
    afterTaxCostOfDebt: afterTaxCostOfDebt * 100,
    riskFreeRate: rf * 100,
    marketRiskPremium: MATURE_MARKET_ERP * 100,
    costOfEquity: costOfEquity * 100,
    totalDebt,
    totalEquity: marketValueOfEquity,
    totalCapital,
    debtWeighting: debtWeighting * 100,
    equityWeighting: equityWeighting * 100,
    wacc: wacc * 100,
    taxRateCash: taxRate * 100,
    sumPvUfcf,
    longTermGrowthRate: longTermGrowthRate * 100,
    terminalValue,
    presentTerminalValue,
    enterpriseValue,
    netDebt,
    equityValue,
    equityValuePerShare,
    freeCashFlowT1: lastUfcf * (1 + longTermGrowthRate),
  }));

  // Levered DCF: free cash flow to equity grown at the same fading rate, discounted at Ke.
  const baseFcf = finite(quote.fundamentals.trailing.FreeCashFlow) ?? latest.freeCashFlow;
  let leveredValue: number | null = null;
  if (baseFcf !== null && baseFcf > 0 && costOfEquity > longTermGrowthRate) {
    let fcf = baseFcf;
    let presentValue = 0;
    for (let index = 0; index < PROJECTION_YEARS; index += 1) {
      const growth = startGrowth + (longTermGrowthRate - startGrowth) * (index / (PROJECTION_YEARS - 1));
      fcf *= 1 + growth;
      presentValue += fcf / (1 + costOfEquity) ** (index + 1);
    }
    const terminal = fcf * (1 + longTermGrowthRate) / (costOfEquity - longTermGrowthRate);
    leveredValue = (presentValue + terminal / (1 + costOfEquity) ** PROJECTION_YEARS) / shares;
  }

  return {
    dcf: equityValuePerShare > 0 ? dcf : [],
    dcfLevered: {
      symbol,
      date: new Date().toISOString().slice(0, 10),
      dcf: leveredValue !== null && leveredValue > 0 ? leveredValue : 0,
      'Stock Price': price,
    },
  };
}

function scoreByThresholds(value: number | null, thresholds: [number, number, number, number], higherIsBetter: boolean): number {
  if (value === null) return 0;
  const [best, good, fair, weak] = thresholds;
  if (higherIsBetter) {
    if (value >= best) return 5;
    if (value >= good) return 4;
    if (value >= fair) return 3;
    if (value >= weak) return 2;
    return 1;
  }
  if (value <= best) return 5;
  if (value <= good) return 4;
  if (value <= fair) return 3;
  if (value <= weak) return 2;
  return 1;
}

function letterGrade(score: number): string {
  if (score >= 4.5) return 'A+';
  if (score >= 4) return 'A';
  if (score >= 3.5) return 'B+';
  if (score >= 3) return 'B';
  if (score >= 2.5) return 'C+';
  if (score >= 2) return 'C';
  if (score >= 1.5) return 'D+';
  return 'D';
}

/**
 * FinDash scorecard with the same six factors FMP rated (1–5 each). Scores of 0
 * mean the input is missing and are excluded from the overall average.
 */
export function buildFinDashRating(
  symbol: string,
  latestRatios: AssetRatios | undefined,
  dcfValuePerShare: number | null,
  price: number,
): AssetRating {
  const dcfRatio = dcfValuePerShare !== null && price > 0 ? dcfValuePerShare / price : null;
  const priceToEarnings = latestRatios?.priceToEarningsRatio ?? null;
  const scores = {
    discountedCashFlowScore: scoreByThresholds(dcfRatio, [1.4, 1.15, 0.95, 0.8], true),
    returnOnEquityScore: scoreByThresholds(latestRatios?.returnOnEquity ?? null, [0.2, 0.15, 0.1, 0.05], true),
    returnOnAssetsScore: scoreByThresholds(latestRatios?.returnOnAssets ?? null, [0.1, 0.07, 0.04, 0.01], true),
    debtToEquityScore: scoreByThresholds(latestRatios?.debtToEquityRatio ?? null, [0.3, 0.6, 1, 2], false),
    priceToEarningsScore: priceToEarnings !== null && priceToEarnings <= 0
      ? 1
      : scoreByThresholds(priceToEarnings, [12, 18, 25, 35], false),
    priceToBookScore: scoreByThresholds(latestRatios?.priceToBookRatio ?? null, [1.5, 3, 5, 10], false),
  };
  const available = Object.values(scores).filter((score) => score > 0);
  const overall = available.length >= 3
    ? available.reduce((total, score) => total + score, 0) / available.length
    : 0;
  return {
    symbol,
    rating: overall > 0 ? letterGrade(overall) : '',
    overallScore: Math.round(overall),
    ...scores,
  };
}
