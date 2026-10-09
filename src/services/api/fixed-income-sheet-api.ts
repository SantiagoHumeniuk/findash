import { supabase } from '@/lib/supabase';

/** Fixed-income table in the shared Argentine-market workbook. */
export type FixedIncomeCategory = 'sovereign' | 'corporate' | 'provincial' | 'fixed-peso' | 'cer';

/** Dated future payment amount per nominal 100 units from the workbook. */
export interface FixedIncomeCashFlow {
  date: string;
  amount: number;
}

/** Terms, live quote mapping, and remaining contractual payments for one bond. */
export interface FixedIncomeContract {
  symbol: string;
  priceTicker: string;
  name: string;
  category: FixedIncomeCategory;
  market: 'sovereign' | 'corporate';
  currency: 'USD' | 'ARS';
  maturityDate: string | null;
  nextPaymentDate: string | null;
  nextPaymentAmount: number | null;
  law: string | null;
  sector: string | null;
  rating: string | null;
  sourceNote: string | null;
  flowsProjected: boolean;
  cashFlows: FixedIncomeCashFlow[];
}

/** Public workbook response with partial-sheet errors retained for display. */
export interface FixedIncomeSheetResponse {
  fetchedAt: string;
  contracts: FixedIncomeContract[];
  errors: string[];
}

function isCashFlow(value: unknown): value is FixedIncomeCashFlow {
  if (typeof value !== 'object' || value === null) return false;
  return 'date' in value &&
    typeof value.date === 'string' &&
    Number.isFinite(Date.parse(value.date)) &&
    'amount' in value &&
    typeof value.amount === 'number' &&
    Number.isFinite(value.amount) &&
    value.amount > 0;
}

function isContract(value: unknown): value is FixedIncomeContract {
  if (typeof value !== 'object' || value === null) return false;
  return 'symbol' in value && typeof value.symbol === 'string' &&
    'priceTicker' in value && typeof value.priceTicker === 'string' &&
    'name' in value && typeof value.name === 'string' &&
    'category' in value && ['sovereign', 'corporate', 'provincial', 'fixed-peso', 'cer'].includes(String(value.category)) &&
    'market' in value && (value.market === 'sovereign' || value.market === 'corporate') &&
    'currency' in value && (value.currency === 'USD' || value.currency === 'ARS') &&
    'maturityDate' in value && (value.maturityDate === null || typeof value.maturityDate === 'string') &&
    'nextPaymentDate' in value && (value.nextPaymentDate === null || typeof value.nextPaymentDate === 'string') &&
    'nextPaymentAmount' in value &&
    (value.nextPaymentAmount === null || (typeof value.nextPaymentAmount === 'number' && Number.isFinite(value.nextPaymentAmount))) &&
    'law' in value && (value.law === null || typeof value.law === 'string') &&
    'sector' in value && (value.sector === null || typeof value.sector === 'string') &&
    'rating' in value && (value.rating === null || typeof value.rating === 'string') &&
    'sourceNote' in value && (value.sourceNote === null || typeof value.sourceNote === 'string') &&
    'flowsProjected' in value && typeof value.flowsProjected === 'boolean' &&
    'cashFlows' in value && Array.isArray(value.cashFlows) && value.cashFlows.every(isCashFlow);
}

/**
 * Loads public contractual terms and payment schedules for Argentine fixed income.
 */
export async function fetchFixedIncomeSheet(): Promise<FixedIncomeSheetResponse> {
  const { data, error } = await supabase.functions.invoke('fixed-income-sheet-proxy', {
    body: {},
  });
  if (error) {
    console.error('Error fetching fixed-income sheet:', error);
    throw new Error(`No se pudieron consultar los datos del Google Sheet: ${error.message}`);
  }
  if (typeof data !== 'object' || data === null || !('fetchedAt' in data) ||
    typeof data.fetchedAt !== 'string' || !('contracts' in data) ||
    !Array.isArray(data.contracts) || !data.contracts.every(isContract) ||
    !('errors' in data) || !Array.isArray(data.errors) ||
    !data.errors.every((item) => typeof item === 'string')) {
    throw new Error('El proxy del Google Sheet devolvió una respuesta inválida');
  }
  if (data.contracts.length === 0) {
    throw new Error('El Google Sheet no contiene instrumentos reconocibles');
  }
  return data as FixedIncomeSheetResponse;
}
