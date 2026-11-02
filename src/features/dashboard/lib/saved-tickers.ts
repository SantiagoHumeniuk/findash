// src/features/dashboard/lib/saved-tickers.ts

import { supabase } from '../../../lib/supabase';
import { logger } from '../../../lib/logger';

const storageKey = (userId: string) => `findash:dashboard-tickers:${userId}`;

/** Keeps valid, unique, uppercase symbols from an untrusted stored value. */
export function normalizeSavedTickers(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const symbols = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().toUpperCase())
    .filter((item) => /^[A-Z0-9.^=-]{1,15}$/.test(item));
  return [...new Set(symbols)];
}

/** Null means this device has nothing saved, so the account's list applies. */
export function readLocalTickers(userId: string): string[] | null {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    return raw === null ? null : normalizeSavedTickers(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeLocalTickers(userId: string, tickers: string[]): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(tickers));
  } catch {
    // Without storage the list still syncs to the account.
  }
}

/** Saves the list in the profile so it follows the user to other devices. */
export async function saveAccountTickers(userId: string, tickers: string[]): Promise<void> {
  // Re-read first: the in-memory profile may be missing keys saved elsewhere.
  const { data, error: readError } = await supabase
    .from('profiles')
    .select('onboarding_profile')
    .eq('id', userId)
    .single();
  const { error } = readError
    ? { error: readError }
    : await supabase
      .from('profiles')
      .update({
        onboarding_profile: {
          ...((data as { onboarding_profile?: Record<string, unknown> | null }).onboarding_profile ?? {}),
          dashboardTickers: tickers,
        },
      })
      .eq('id', userId);
  if (error) {
    void logger.warn('DASHBOARD_TICKERS_SAVE_FAILED', 'Could not save dashboard tickers to the account', {
      errorMessage: error.message,
    });
  }
}
