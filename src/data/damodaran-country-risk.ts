// Typed access to Damodaran's country risk table, regenerated with
// `node scripts/update-damodaran-risk.mjs`. Values are percentages (9.71 = 9.71%).

import dataset from './damodaran-country-risk.json';

export interface DamodaranCountryRisk {
  country: string;
  continent: string;
  moodysRating: string | null;
  defaultSpread: number | null;
  countryRiskPremium: number;
  totalEquityRiskPremium: number | null;
  corporateTaxRate: number | null;
}

export const DAMODARAN_SOURCE_URL: string = dataset.source;
export const DAMODARAN_UPDATED_AT: string | null = dataset.sourceUpdatedAt;
export const DAMODARAN_COUNTRIES: readonly DamodaranCountryRisk[] = dataset.countries;

/** Mature-market equity risk premium (United States), as a fraction. */
export const MATURE_MARKET_ERP: number = (() => {
  const unitedStates = DAMODARAN_COUNTRIES.find((entry) => entry.country === 'United States');
  const premium = (unitedStates?.totalEquityRiskPremium ?? 0) - (unitedStates?.countryRiskPremium ?? 0);
  return premium > 0 ? premium / 100 : 0.0433;
})();
