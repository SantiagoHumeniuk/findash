// src/types/dashboard.ts

import { IndicatorConfig } from "../utils/financial";

export interface AssetData {
    symbol: string;
    profile: AssetProfile;
    keyMetrics: AssetKeyMetrics;
    quote: AssetQuote;
    historicalReturns: AssetHistorical[];
    priceTarget: AssetPriceTarget;
    dcf: AssetDCF[];
    rating: AssetRating;
    geography: AssetGeography;
    production: AssetProduction;
    priceTargetConsensus: AssetPriceTargetConsensus;
    keyMetricsYearly: AssetKeyMetricsYearly[];
    dcfLevered: AssetDCFLevered;
    stockPriceChange: AssetStockPriceChange;
    ratios: AssetRatios[];
    analystEstimates: AssetAnalystEstimates[];
    gradesConsensus: AssetGradesConsensus;
    peerValuations?: AssetPeerValuation[];
    analystGradeUpdates?: AssetAnalystGradeUpdate[];
    dataSource?: 'FMP' | 'Yahoo Finance' | 'FMP + Yahoo Finance';
    dataFetchedAt?: string;
    yahooMetrics?: Record<string, number | null>;
    yahooAttemptedAt?: string;
    yahooError?: string | null;
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
    price: number;
    marketCap: number;
    priceToEarningsRatio: number;
    priceToBookRatio: number;
    priceToSalesRatio: number;
    priceToFreeCashFlowRatio: number;
    ebitMargin?: number;
    returnOnEquity?: number;
    debtToEquity?: number;
    evToEBITDA: number;
    evToEBIT: number;
    evToSales: number;
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
    enterpriseValueTTM: number;
    evToSalesTTM: number;
    evToOperatingCashFlowTTM: number;
    evToFreeCashFlowTTM: number;
    evToEBITDATTM: number;
    netDebtToEBITDATTM: number;
    currentRatioTTM: number;
    incomeQualityTTM: number;
    grahamNumberTTM: number;
    grahamNetNetTTM: number;
    taxBurdenTTM: number;
    interestBurdenTTM: number;
    workingCapitalTTM: number;
    investedCapitalTTM: number;
    returnOnAssetsTTM: number;
    operatingReturnOnAssetsTTM: number;
    returnOnTangibleAssetsTTM: number;
    returnOnEquityTTM: number;
    returnOnInvestedCapitalTTM: number;
    returnOnCapitalEmployedTTM: number;
    earningsYieldTTM: number;
    freeCashFlowYieldTTM: number;
    capexToOperatingCashFlowTTM: number;
    capexToDepreciationTTM: number;
    capexToRevenueTTM: number;
    salesGeneralAndAdministrativeToRevenueTTM: number;
    researchAndDevelopementToRevenueTTM: number;
    stockBasedCompensationToRevenueTTM: number;
    intangiblesToTotalAssetsTTM: number;
    averageReceivablesTTM: number;
    averagePayablesTTM: number;
    averageInventoryTTM: number;
    daysOfSalesOutstandingTTM: number;
    daysOfPayablesOutstandingTTM: number;
    daysOfInventoryOutstandingTTM: number;
    operatingCycleTTM: number;
    cashConversionCycleTTM: number;
    freeCashFlowToEquityTTM: number;
    freeCashFlowToFirmTTM: number;
    tangibleAssetValueTTM: number;
    netCurrentAssetValueTTM: number;
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
    enterpriseValue: number;
    evToSales: number;
    evToOperatingCashFlow: number;
    evToFreeCashFlow: number;
    evToEBITDA: number;
    netDebtToEBITDA: number;
    currentRatio: number;
    incomeQuality: number;
    grahamNumber: number;
    grahamNetNet: number;
    taxBurden: number;
    interestBurden: number;
    workingCapital: number;
    investedCapital: number;
    returnOnAssets: number;
    operatingReturnOnAssets: number;
    returnOnTangibleAssets: number;
    returnOnEquity: number;
    returnOnInvestedCapital: number;
    returnOnCapitalEmployed: number;
    earningsYield: number;
    freeCashFlowYield: number;
    capexToOperatingCashFlow: number;
    capexToDepreciation: number;
    capexToRevenue: number;
    salesGeneralAndAdministrativeToRevenue: number;
    researchAndDevelopementToRevenue: number;
    stockBasedCompensationToRevenue: number;
    intangiblesToTotalAssets: number;
    averageReceivables: number;
    averagePayables: number;
    averageInventory: number;
    daysOfSalesOutstanding: number;
    daysOfPayablesOutstanding: number;
    daysOfInventoryOutstanding: number;
    operatingCycle: number;
    cashConversionCycle: number;
    freeCashFlowToEquity: number;
    freeCashFlowToFirm: number;
    tangibleAssetValue: number;
    netCurrentAssetValue: number;
}

export interface AssetRatios {
    symbol: string;
    date: string;
    fiscalYear: string;
    period: string;
    reportedCurrency: string;
    grossProfitMargin: number;
    ebitMargin: number;
    ebitdaMargin: number;
    operatingProfitMargin: number;
    pretaxProfitMargin: number;
    continuousOperationsProfitMargin: number;
    netProfitMargin: number;
    bottomLineProfitMargin: number;
    receivablesTurnover: number;
    payablesTurnover: number;
    inventoryTurnover: number;
    fixedAssetTurnover: number;
    assetTurnover: number;
    currentRatio: number;
    quickRatio: number;
    solvencyRatio: number;
    cashRatio: number;
    priceToEarningsRatio: number;
    priceToEarningsGrowthRatio: number;
    forwardPriceToEarningsGrowthRatio: number;
    priceToBookRatio: number;
    priceToSalesRatio: number;
    priceToFreeCashFlowRatio: number;
    priceToOperatingCashFlowRatio: number;
    debtToAssetsRatio: number;
    debtToEquityRatio: number;
    debtToCapitalRatio: number;
    longTermDebtToCapitalRatio: number;
    financialLeverageRatio: number;
    workingCapitalTurnoverRatio: number;
    operatingCashFlowRatio: number;
    operatingCashFlowSalesRatio: number;
    freeCashFlowOperatingCashFlowRatio: number;
    debtServiceCoverageRatio: number;
    interestCoverageRatio: number;
    shortTermOperatingCashFlowCoverageRatio: number;
    operatingCashFlowCoverageRatio: number;
    capitalExpenditureCoverageRatio: number;
    dividendPaidAndCapexCoverageRatio: number;
    dividendPayoutRatio: number;
    dividendYield: number;
    dividendYieldPercentage: number;
    revenuePerShare: number;
    netIncomePerShare: number;
    interestDebtPerShare: number;
    cashPerShare: number;
    bookValuePerShare: number;
    tangibleBookValuePerShare: number;
    shareholdersEquityPerShare: number;
    operatingCashFlowPerShare: number;
    capexPerShare: number;
    freeCashFlowPerShare: number;
    netIncomePerEBT: number;
    ebtPerEbit: number;
    priceToFairValue: number;
    debtToMarketCap: number;
    effectiveTaxRate: number;
    enterpriseValueMultiple: number;
    dividendPerShare: number;
}

export interface AssetAnalystEstimates {
    symbol: string;
    date: string;
    revenueLow: number;
    revenueHigh: number;
    revenueAvg: number;
    ebitdaLow: number;
    ebitdaHigh: number;
    ebitdaAvg: number;
    ebitLow: number;
    ebitHigh: number;
    ebitAvg: number;
    netIncomeLow: number;
    netIncomeHigh: number;
    netIncomeAvg: number;
    sgaExpenseLow: number;
    sgaExpenseHigh: number;
    sgaExpenseAvg: number;
    epsAvg: number;
    epsHigh: number;
    epsLow: number;
    numAnalystsRevenue: number;
    numAnalystsEps: number;
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