// src/types/dashboard.ts

import { IndicatorConfig } from "../utils/financial";
import type {
    YahooAnalystData,
    YahooGovernance,
    YahooNextEarnings,
    YahooOwnership,
    YahooStatementPeriod,
} from "../services/api/yahoo-finance-api";

export interface AssetData {
    symbol: string;
    profile: AssetProfile;
    keyMetrics: AssetKeyMetrics;
    quote: AssetQuote;
    historicalReturns: AssetHistorical[];
    priceTarget: AssetPriceTarget;
    dcf: AssetDCF[];
    rating: AssetRating;
    geography?: AssetGeography;
    production?: AssetProduction;
    priceTargetConsensus: AssetPriceTargetConsensus;
    keyMetricsYearly: AssetKeyMetricsYearly[];
    dcfLevered: AssetDCFLevered;
    stockPriceChange: AssetStockPriceChange;
    ratios: AssetRatios[];
    analystEstimates: AssetAnalystEstimates[];
    gradesConsensus: AssetGradesConsensus;
    peerValuations?: AssetPeerValuation[];
    analystGradeUpdates?: AssetAnalystGradeUpdate[];
    dataSource?: 'Yahoo Finance';
    /** Shape version of Yahoo-built data; older cached rows are rebuilt. */
    yahooDataVersion?: number;
    /** Provider of the financial statements behind ratios, DCF and rating. */
    fundamentalsSource?: 'Yahoo Finance' | 'SEC EDGAR' | null;
    /** Yahoo-only data with no FMP equivalent in the original model. */
    yahooInsights?: AssetYahooInsights;
    dataFetchedAt?: string;
    yahooMetrics?: Record<string, number | null>;
    yahooAttemptedAt?: string;
    yahooQuoteAttemptedAt?: string;
    yahooError?: string | null;
}

export interface AssetYahooInsights {
    ownership: YahooOwnership | null;
    nextEarnings: YahooNextEarnings | null;
    governance: YahooGovernance | null;
    earningsHistory: YahooAnalystData['earningsHistory'];
    /** Raw annual statements, newest first (Yahoo field names). */
    annualStatements: YahooStatementPeriod[];
    /** Quarterly income statement and cash flow, newest first. */
    quarterlyStatements: YahooStatementPeriod[];
    dividendHistory: { date: string; amount: number }[];
}

export interface AssetAnalystGradeUpdate {
    symbol: string;
    date: string;
    gradingCompany: string;
    previousGrade: string;
    newGrade: string;
    action: string;
}

export interface AssetPeerValuation {
    symbol: string;
    companyName: string;
    price: number | null;
    marketCap: number;
    priceToEarningsRatio: number | null;
    priceToBookRatio: number | null;
    priceToSalesRatio: number | null;
    priceToFreeCashFlowRatio: number | null;
    ebitMargin?: number | null;
    returnOnEquity?: number | null;
    debtToEquity?: number | null;
    evToEBITDA: number | null;
    evToEBIT: number | null;
    evToSales: number | null;
}

export interface AssetProfile {
    symbol: string;
    price: number;
    marketCap: number;
    beta: number;
    lastDividend: number;
    range: string;
    change: number;
    changePercentage: number;
    volume: number;
    averageVolume: number;
    companyName: string;
    currency: string;
    cik: string;
    isin: string;
    cusip: string;
    exchangeFullName: string;
    exchange: string;
    industry: string;
    website: string;
    description: string;
    ceo: string;
    sector: string;
    country: string;
    fullTimeEmployees: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    image: string;
    ipoDate: string;
    defaultImage: boolean;
    isEtf: boolean;
    isActivelyTrading: boolean;
    isAdr: boolean;
    isFund: boolean;
}

export interface AssetKeyMetrics {
    symbol: string;
    marketCap: number;
    enterpriseValueTTM: number | null;
    evToSalesTTM: number | null;
    evToOperatingCashFlowTTM: number | null;
    evToFreeCashFlowTTM: number | null;
    evToEBITDATTM: number | null;
    netDebtToEBITDATTM: number | null;
    currentRatioTTM: number | null;
    incomeQualityTTM: number | null;
    grahamNumberTTM: number | null;
    grahamNetNetTTM: number | null;
    taxBurdenTTM: number | null;
    interestBurdenTTM: number | null;
    workingCapitalTTM: number | null;
    investedCapitalTTM: number | null;
    returnOnAssetsTTM: number | null;
    operatingReturnOnAssetsTTM: number | null;
    returnOnTangibleAssetsTTM: number | null;
    returnOnEquityTTM: number | null;
    returnOnInvestedCapitalTTM: number | null;
    returnOnCapitalEmployedTTM: number | null;
    earningsYieldTTM: number | null;
    freeCashFlowYieldTTM: number | null;
    capexToOperatingCashFlowTTM: number | null;
    capexToDepreciationTTM: number | null;
    capexToRevenueTTM: number | null;
    salesGeneralAndAdministrativeToRevenueTTM: number | null;
    researchAndDevelopementToRevenueTTM: number | null;
    stockBasedCompensationToRevenueTTM: number | null;
    intangiblesToTotalAssetsTTM: number | null;
    averageReceivablesTTM: number | null;
    averagePayablesTTM: number | null;
    averageInventoryTTM: number | null;
    daysOfSalesOutstandingTTM: number | null;
    daysOfPayablesOutstandingTTM: number | null;
    daysOfInventoryOutstandingTTM: number | null;
    operatingCycleTTM: number | null;
    cashConversionCycleTTM: number | null;
    freeCashFlowToEquityTTM: number | null;
    freeCashFlowToFirmTTM: number | null;
    tangibleAssetValueTTM: number | null;
    netCurrentAssetValueTTM: number | null;
}

export interface AssetQuote {
    symbol: string;
    name: string;
    price: number;
    changePercentage: number;
    change: number;
    volume: number;
    dayLow: number;
    dayHigh: number;
    yearHigh: number;
    yearLow: number;
    marketCap: number;
    priceAvg50: number;
    priceAvg200: number;
    exchange: string;
    open: number;
    previousClose: number;
    timestamp: number;
    pe?: number;
    forwardPE?: number;
    forwardEPS?: number;
    trailingEPS?: number;
}

export interface AssetHistorical {
    symbol: string;
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    change: number;
    changePercent: number;
    vwap: number;
}

export interface AssetPriceTarget {
    symbol: string;
    lastMonthCount: number;
    lastMonthAvgPriceTarget: number;
    lastQuarterCount: number;
    lastQuarterAvgPriceTarget: number;
    lastYearCount: number;
    lastYearAvgPriceTarget: number;
    allTimeCount: number;
    allTimeAvgPriceTarget: number;
    publishers: string[];
}

export interface AssetDCF {
    year: string;
    symbol: string;
    revenue: number;
    ebitda: number;
    ebit: number;
    depreciation: number;
    totalCash: number;
    receivables: number;
    inventories: number;
    payable: number;
    capitalExpenditure: number;
    price: number;
    beta: number;
    dilutedSharesOutstanding: number;
    costofDebt: number;
    taxRate: number;
    afterTaxCostOfDebt: number;
    riskFreeRate: number;
    marketRiskPremium: number;
    costOfEquity: number;
    totalDebt: number;
    totalEquity: number;
    totalCapital: number;
    debtWeighting: number;
    equityWeighting: number;
    wacc: number;
    taxRateCash: number;
    ebiat: number;
    ufcf: number;
    sumPvUfcf: number;
    longTermGrowthRate: number;
    terminalValue: number;
    presentTerminalValue: number;
    enterpriseValue: number;
    netDebt: number;
    equityValue: number;
    equityValuePerShare: number;
    freeCashFlowT1: number;
}

export interface AssetRating {
    symbol: string;
    rating: string;
    overallScore: number;
    discountedCashFlowScore: number;
    returnOnEquityScore: number;
    returnOnAssetsScore: number;
    debtToEquityScore: number;
    priceToEarningsScore: number;
    priceToBookScore: number;
}


export interface AssetProduction {
    symbol: string;
    fiscalYear: number;
    period: string;
    reportedCurrency: string;
    date: string;
    data: Record<string, number>;
}

export interface AssetGeography {
    symbol: string;
    fiscalYear: number;
    period: string;
    reportedCurrency: string;
    date: string;
    data: Record<string, number>;
}

export interface AssetPriceTargetConsensus {
    symbol: string;
    targetHigh: number;
    targetLow: number;
    targetConsensus: number;
    targetMedian: number;
}

export interface AssetStockPriceChange {
    symbol: string;
    "1D": number;
    "5D": number;
    "1M": number;
    "3M": number;
    "6M": number;
    "ytd": number;
    "1Y": number;
    "3Y": number;
    "5Y": number;
    "10Y": number;
    "max": number;
}

export interface AssetDCFLevered {
    symbol: string;
    date: string;
    dcf: number;
    "Stock Price": number;
}

export interface AssetKeyMetricsYearly {
    symbol: string;
    date: string;
    fiscalYear: string;
    period: string;
    reportedCurrency: string;
    marketCap: number;
    enterpriseValue: number | null;
    evToSales: number | null;
    evToOperatingCashFlow: number | null;
    evToFreeCashFlow: number | null;
    evToEBITDA: number | null;
    netDebtToEBITDA: number | null;
    currentRatio: number | null;
    incomeQuality: number | null;
    grahamNumber: number | null;
    grahamNetNet: number | null;
    taxBurden: number | null;
    interestBurden: number | null;
    workingCapital: number | null;
    investedCapital: number | null;
    returnOnAssets: number | null;
    operatingReturnOnAssets: number | null;
    returnOnTangibleAssets: number | null;
    returnOnEquity: number | null;
    returnOnInvestedCapital: number | null;
    returnOnCapitalEmployed: number | null;
    earningsYield: number | null;
    freeCashFlowYield: number | null;
    capexToOperatingCashFlow: number | null;
    capexToDepreciation: number | null;
    capexToRevenue: number | null;
    salesGeneralAndAdministrativeToRevenue: number | null;
    researchAndDevelopementToRevenue: number | null;
    stockBasedCompensationToRevenue: number | null;
    intangiblesToTotalAssets: number | null;
    averageReceivables: number | null;
    averagePayables: number | null;
    averageInventory: number | null;
    daysOfSalesOutstanding: number | null;
    daysOfPayablesOutstanding: number | null;
    daysOfInventoryOutstanding: number | null;
    operatingCycle: number | null;
    cashConversionCycle: number | null;
    freeCashFlowToEquity: number | null;
    freeCashFlowToFirm: number | null;
    tangibleAssetValue: number | null;
    netCurrentAssetValue: number | null;
}

export interface AssetRatios {
    symbol: string;
    date: string;
    fiscalYear: string;
    period: string;
    reportedCurrency: string;
    grossProfitMargin: number | null;
    ebitMargin: number | null;
    ebitdaMargin: number | null;
    operatingProfitMargin: number | null;
    pretaxProfitMargin: number | null;
    continuousOperationsProfitMargin: number | null;
    netProfitMargin: number | null;
    bottomLineProfitMargin: number | null;
    receivablesTurnover: number | null;
    payablesTurnover: number | null;
    inventoryTurnover: number | null;
    fixedAssetTurnover: number | null;
    assetTurnover: number | null;
    currentRatio: number | null;
    quickRatio: number | null;
    solvencyRatio: number | null;
    cashRatio: number | null;
    priceToEarningsRatio: number | null;
    priceToEarningsGrowthRatio: number | null;
    forwardPriceToEarningsGrowthRatio: number | null;
    priceToBookRatio: number | null;
    priceToSalesRatio: number | null;
    priceToFreeCashFlowRatio: number | null;
    priceToOperatingCashFlowRatio: number | null;
    debtToAssetsRatio: number | null;
    debtToEquityRatio: number | null;
    debtToCapitalRatio: number | null;
    longTermDebtToCapitalRatio: number | null;
    financialLeverageRatio: number | null;
    workingCapitalTurnoverRatio: number | null;
    operatingCashFlowRatio: number | null;
    operatingCashFlowSalesRatio: number | null;
    freeCashFlowOperatingCashFlowRatio: number | null;
    debtServiceCoverageRatio: number | null;
    interestCoverageRatio: number | null;
    shortTermOperatingCashFlowCoverageRatio: number | null;
    operatingCashFlowCoverageRatio: number | null;
    capitalExpenditureCoverageRatio: number | null;
    dividendPaidAndCapexCoverageRatio: number | null;
    dividendPayoutRatio: number | null;
    dividendYield: number | null;
    dividendYieldPercentage: number | null;
    revenuePerShare: number | null;
    netIncomePerShare: number | null;
    interestDebtPerShare: number | null;
    cashPerShare: number | null;
    bookValuePerShare: number | null;
    tangibleBookValuePerShare: number | null;
    shareholdersEquityPerShare: number | null;
    operatingCashFlowPerShare: number | null;
    capexPerShare: number | null;
    freeCashFlowPerShare: number | null;
    netIncomePerEBT: number | null;
    ebtPerEbit: number | null;
    priceToFairValue: number | null;
    debtToMarketCap: number | null;
    effectiveTaxRate: number | null;
    enterpriseValueMultiple: number | null;
    dividendPerShare: number | null;
    returnOnEquity?: number | null;
    returnOnAssets?: number | null;
}

export interface AssetAnalystEstimates {
    symbol: string;
    date: string;
    revenueLow: number | null;
    revenueHigh: number | null;
    revenueAvg: number | null;
    ebitdaLow: number | null;
    ebitdaHigh: number | null;
    ebitdaAvg: number | null;
    ebitLow: number | null;
    ebitHigh: number | null;
    ebitAvg: number | null;
    netIncomeLow: number | null;
    netIncomeHigh: number | null;
    netIncomeAvg: number | null;
    sgaExpenseLow: number | null;
    sgaExpenseHigh: number | null;
    sgaExpenseAvg: number | null;
    epsAvg: number | null;
    epsHigh: number | null;
    epsLow: number | null;
    numAnalystsRevenue: number | null;
    numAnalystsEps: number | null;
}

export interface AssetGradesConsensus {
    symbol: string;
    strongBuy: number;
    buy: number;
    hold: number;
    sell: number;
    strongSell: number;
    consensus: string;
}

export interface DashboardContextType {
    selectedTickers: string[];
    assetsData?: Record<string, AssetData>; // Opcional
    loading?: boolean; // Opcional
    error?: string; // Opcional
    addTicker: (tickerRaw: string) => void;
    removeTicker: (ticker: string) => void;
    indicatorConfig: IndicatorConfig;
}