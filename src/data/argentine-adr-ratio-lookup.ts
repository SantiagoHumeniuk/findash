import argentineAdrRatios from './argentine-adr-ratios.json';

export interface ArgentineAdrRatio {
  /** BYMA ticker of the Argentine ordinary share represented by the ADR. */
  localSymbol: string;
  /** Number of Argentine shares represented by one ADR. */
  sharesPerAdr: number;
}

const ARGENTINE_ADR_RATIOS = argentineAdrRatios as Record<string, ArgentineAdrRatio>;

/** Looks up the local-share conversion ratio for a US-listed Argentine ADR ticker. */
export function getArgentineAdrRatio(symbol: string): ArgentineAdrRatio | null {
  const ticker = symbol.trim().toUpperCase().replace(/\.BA$/, '');
  const ratio = ARGENTINE_ADR_RATIOS[ticker];
  return ratio && Number.isFinite(ratio.sharesPerAdr) && ratio.sharesPerAdr > 0
    ? ratio
    : null;
}
