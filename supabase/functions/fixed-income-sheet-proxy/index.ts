import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const sheetId = "1WlNhXzEogzph-sAsQkNowXogy_lP9sgW67jwmgRp_OE";
const sheetNames = {
  sovereign: "Soberanos USD",
  corporate: "ONs",
  provincial: "Provinciales",
  fixedPesos: "Pesos Tasa Fija",
  cer: "CER",
  terms: "Fichas",
  cashFlows: "Flujos",
} as const;

type BondCategory = "sovereign" | "corporate" | "provincial" | "fixed-peso" | "cer";
type BondFlow = { date: string; amount: number };
type BondContract = {
  symbol: string;
  priceTicker: string;
  name: string;
  category: BondCategory;
  market: "sovereign" | "corporate";
  currency: "USD" | "ARS";
  maturityDate: string | null;
  nextPaymentDate: string | null;
  nextPaymentAmount: number | null;
  law: string | null;
  sector: string | null;
  rating: string | null;
  sourceNote: string | null;
  flowsProjected: boolean;
  cashFlows: BondFlow[];
};

type SheetBundle = {
  fetchedAt: string;
  contracts: BondContract[];
  errors: string[];
};

let cachedBundle: SheetBundle | null = null;
let cacheExpiresAt = 0;

function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  const text = value.trim().replace(/[^\d,.-]/g, "");
  if (!text) return null;
  const comma = text.lastIndexOf(",");
  const dot = text.lastIndexOf(".");
  const normalized = comma >= 0 && comma > dot
    ? text.replace(/\./g, "").replace(",", ".")
    : text.replace(/,/g, "");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function parseDate(value: string | undefined): string | null {
  if (!value) return null;
  const text = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const local = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (!local) return null;
  const day = Number(local[1]);
  const month = Number(local[2]);
  const year = Number(local[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    : null;
}

function findHeaderRow(rows: string[][]): number {
  return rows.findIndex((row) => row[0]?.trim().replace(/^\uFEFF/, "") === "Ticker");
}

function normalizeSymbol(value: string | undefined): string | null {
  const symbol = value?.trim().toUpperCase();
  return symbol && /^[A-Z0-9.=-]{2,15}$/.test(symbol) ? symbol : null;
}

async function fetchSheet(name: string): Promise<string[][]> {
  const url = new URL(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq`);
  url.searchParams.set("tqx", "out:csv");
  url.searchParams.set("sheet", name);
  const response = await fetch(url, { signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`La hoja "${name}" respondió HTTP ${response.status}`);
  return parseCsv(await response.text());
}

function buildContracts(
  category: BondCategory,
  rows: string[][],
  termRows: string[][],
  cashFlowRows: string[][],
): BondContract[] {
  const termHeader = findHeaderRow(termRows);
  const terms = new Map<string, string[]>();
  for (const row of termRows.slice(Math.max(0, termHeader + 1))) {
    const symbol = normalizeSymbol(row[0]);
    if (symbol) terms.set(symbol, row);
  }

  const flowHeader = findHeaderRow(cashFlowRows);
  const flows = new Map<string, BondFlow[]>();
  const today = new Date().toISOString().slice(0, 10);
  for (const row of cashFlowRows.slice(Math.max(0, flowHeader + 1))) {
    const symbol = normalizeSymbol(row[0]);
    const date = parseDate(row[1]);
    const amount = parseNumber(row[8]);
    if (!symbol || !date || date <= today || amount === null || amount <= 0) continue;
    const existing = flows.get(symbol) ?? [];
    existing.push({ date, amount });
    flows.set(symbol, existing);
  }

  const headerRow = findHeaderRow(rows);
  const dataRows = rows.slice(Math.max(0, headerRow + 1));
  return dataRows.flatMap((row) => {
    const symbol = normalizeSymbol(row[0]);
    if (!symbol || row.length < 5) return [];
    const term = terms.get(symbol);
    const maturityDate = parseDate(
      category === "sovereign" || category === "corporate" || category === "provincial"
        ? row[4] ?? term?.[10]
        : row[2] ?? term?.[10],
    );
    const priceTicker = normalizeSymbol(term?.[6]) ??
      (category === "sovereign" || category === "corporate" || category === "provincial"
        ? `${symbol}D`
        : symbol);
    const sourceNote = term?.[24]?.trim() || null;
    const cashFlows = (flows.get(symbol) ?? []).sort((left, right) => left.date.localeCompare(right.date));
    const nextFlow = cashFlows[0] ?? null;
    const name = category === "corporate"
      ? [row[2], symbol].filter(Boolean).join(" · ")
      : category === "sovereign" || category === "provincial"
        ? row[2]?.trim() || symbol
        : [row[1], symbol].filter(Boolean).join(" · ");

    return [{
      symbol,
      priceTicker,
      name,
      category,
      market: category === "corporate" ? "corporate" : "sovereign",
      currency: category === "sovereign" || category === "corporate" || category === "provincial"
        ? "USD"
        : "ARS",
      maturityDate: maturityDate ?? parseDate(term?.[10]),
      nextPaymentDate: nextFlow?.date ?? null,
      nextPaymentAmount: nextFlow?.amount ?? null,
      law: row[3]?.trim() || term?.[4]?.trim() || null,
      sector: category === "corporate" ? row[1]?.trim() || null : null,
      rating: category === "corporate" ? row[33]?.trim() || null : null,
      sourceNote,
      flowsProjected: Boolean(sourceNote && /proyectad|estimad|TAMAR/i.test(sourceNote)),
      cashFlows,
    }];
  });
}

async function loadSheetBundle(): Promise<SheetBundle> {
  const names = Object.values(sheetNames);
  const results = await Promise.allSettled(names.map(fetchSheet));
  const sheets = new Map<string, string[][]>();
  const errors: string[] = [];
  results.forEach((result, index) => {
    if (result.status === "fulfilled") sheets.set(names[index], result.value);
    else {
      const message = result.reason instanceof Error ? result.reason.message : "Error desconocido";
      errors.push(`${names[index]}: ${message}`);
    }
  });

  const terms = sheets.get(sheetNames.terms);
  const cashFlows = sheets.get(sheetNames.cashFlows);
  const categories: [BondCategory, string][] = [
    ["sovereign", sheetNames.sovereign],
    ["corporate", sheetNames.corporate],
    ["provincial", sheetNames.provincial],
    ["fixed-peso", sheetNames.fixedPesos],
    ["cer", sheetNames.cer],
  ];
  const contracts = terms && cashFlows
    ? categories.flatMap(([category, name]) => {
      const rows = sheets.get(name);
      return rows ? buildContracts(category, rows, terms, cashFlows) : [];
    })
    : [];

  return { fetchedAt: new Date().toISOString(), contracts, errors };
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST" && request.method !== "GET") {
    return Response.json({ error: "Método no permitido" }, { status: 405, headers: corsHeaders });
  }

  try {
    if (!cachedBundle || Date.now() >= cacheExpiresAt) {
      cachedBundle = await loadSheetBundle();
      cacheExpiresAt = Date.now() + 15 * 60 * 1000;
    }
    if (cachedBundle.contracts.length === 0) {
      throw new Error(cachedBundle.errors.join(" · ") || "La hoja pública no contiene instrumentos reconocibles");
    }
    return Response.json(cachedBundle, {
      headers: { ...corsHeaders, "Cache-Control": "public, max-age=300" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    console.error("Fixed-income sheet proxy error:", message);
    return Response.json(
      { error: `No se pudieron cargar los términos de renta fija: ${message}` },
      { status: 502, headers: corsHeaders },
    );
  }
});
