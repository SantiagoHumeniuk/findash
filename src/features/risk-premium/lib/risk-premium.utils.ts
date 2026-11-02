// src/features/risk-premium/lib/risk-premium.utils.ts

import { RiskPremiumData } from '../types/risk-premium.types';
import { DAMODARAN_COUNTRIES } from '../../../data/damodaran-country-risk';

/**
 * Cache key for risk premium data in Supabase
 */
export const RISK_PREMIUM_CACHE_KEY = 'market_risk_premium';

/**
 * Cache duration in milliseconds (24 hours)
 */
export const CACHE_DURATION_MS = 24 * 60 * 60 * 1000;

/**
 * Gets the color class for risk premium based on value
 * - Green: <= 5%
 * - Yellow: <= 10%
 * - Red: > 10%
 */
export function getRiskColorClass(premium: number): string {
  if (premium <= 5) return 'text-green-600 dark:text-green-400';
  if (premium <= 10) return 'text-yellow-600 dark:text-yellow-500';
  return 'text-red-600 dark:text-red-500';
}

/**
 * Gets the risk level label based on premium value
 */
export function getRiskLevel(premium: number): string {
  if (premium <= 5) return 'Bajo';
  if (premium <= 10) return 'Moderado';
  return 'Alto';
}

/**
 * Sorts risk premium data alphabetically by country
 */
export function sortDataByCountry(data: RiskPremiumData[]): RiskPremiumData[] {
  return [...data].sort((a, b) => a.country.localeCompare(b.country));
}

/**
 * Extracts unique continents from data and sorts them
 */
export function extractContinents(data: RiskPremiumData[]): string[] {
  return [...new Set(data.map((item) => item.continent))].sort();
}

/**
 * Checks if cached data is still valid (less than 24 hours old)
 */
export function isCacheValid(lastUpdatedAt: string): boolean {
  const cacheDate = new Date(lastUpdatedAt);
  const expiryDate = new Date(Date.now() - CACHE_DURATION_MS);
  return cacheDate > expiryDate;
}

/**
 * Returns Damodaran's country risk table bundled with the app (the dataset FMP
 * used to resell). It updates twice a year, so it needs no network call.
 */
export function fetchRiskPremiumData(): Promise<RiskPremiumData[]> {
  return Promise.resolve(DAMODARAN_COUNTRIES.flatMap((entry) =>
    entry.totalEquityRiskPremium === null
      ? []
      : [{
        country: entry.country,
        continent: entry.continent,
        countryRiskPremium: entry.countryRiskPremium,
        totalEquityRiskPremium: entry.totalEquityRiskPremium,
      }]
  ));
}
