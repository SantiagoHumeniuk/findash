// src/services/macro-api.ts

import { supabase } from '../lib/supabase';

export interface DolarCotizacion {
  casa: string;
  nombre: string;
  compra: number;
  venta: number;
  fecha: string;
  brechaVenta?: number; // % contra Dólar Oficial Venta
  variacion?: number;
}

export interface InflacionDato {
  fecha: string;
  valor: number;
}

export interface PlazoFijoDato {
  entidad: string;
  logo?: string;
  tnaClientes: number;
  tnaNoClientes: number;
  enlace?: string;
  tasas?: {
    plazoMinDias?: number;
    plazoMaxDias?: number;
    tna: number;
  }[];
}

export interface UvaDato {
  fecha: string;
  valor: number;
}

const CASA_NOMBRES: Record<string, string> = {
  oficial: 'Dólar Oficial',
  blue: 'Dólar Blue',
  bolsa: 'Dólar MEP (Bolsa)',
  contadoconliqui: 'Dólar CCL',
  cripto: 'Dólar Cripto',
  mayorista: 'Dólar Mayorista',
  tarjeta: 'Dólar Tarjeta',
  solidario: 'Dólar Solidario',
};

type MacroResource = 'dolares' | 'inflacion' | 'plazos-fijos' | 'uva' | 'dolarazo';

async function fetchMacroResource(resource: MacroResource): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke('argentina-macro-proxy', {
    body: { resource },
  });
  if (error) throw new Error(`No se pudieron cargar los datos de ${resource}.`);
  if (data === null || data === undefined) {
    throw new Error(`No se encontraron datos para ${resource}.`);
  }
  if (
    typeof data === 'object' &&
    'error' in data &&
    typeof data.error === 'string'
  ) {
    throw new Error(data.error);
  }
  return data;
}

/**
 * Obtener cotizaciones de ArgentinaDatos a través del proxy de Supabase.
 */
export async function fetchDolaresArgentinaDatos(): Promise<DolarCotizacion[]> {
  const data = await fetchMacroResource('dolares');
  if (
    !Array.isArray(data) ||
    !data.every((item: unknown) =>
      typeof item === 'object' &&
      item !== null &&
      'casa' in item &&
      typeof item.casa === 'string' &&
      'compra' in item &&
      typeof item.compra === 'number' &&
      'venta' in item &&
      typeof item.venta === 'number' &&
      'fecha' in item &&
      typeof item.fecha === 'string'
    )
  ) {
    throw new Error('Las cotizaciones de dólares tienen un formato inválido.');
  }
  const records = data as { casa: string; compra: number; venta: number; fecha: string }[];

  // El endpoint devuelve histórico cronológico. Agrupamos por casa quedándonos con el último registro disponible
  const mapLatest = new Map<string, { casa: string; compra: number; venta: number; fecha: string }>();
  for (const item of records) {
    if (item.casa) {
      mapLatest.set(item.casa.toLowerCase(), item);
    }
  }

  const order = ['oficial', 'blue', 'bolsa', 'contadoconliqui', 'cripto', 'mayorista', 'tarjeta'];
  const list: DolarCotizacion[] = [];

  for (const casa of order) {
    const item = mapLatest.get(casa);
    if (item && item.venta > 0) {
      list.push({
        casa: item.casa,
        nombre: CASA_NOMBRES[item.casa] || item.casa.toUpperCase(),
        compra: item.compra || item.venta,
        venta: item.venta,
        fecha: item.fecha,
      });
    }
  }

  return list;
}

/**
 * Obtener cotizaciones de Dolarazo API
 */
export async function fetchDolaresDolarazo(): Promise<DolarCotizacion[]> {
  const payload = await fetchMacroResource('dolarazo');
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('ok' in payload) ||
    payload.ok !== true ||
    !('data' in payload) ||
    !Array.isArray(payload.data)
  ) {
    throw new Error('Las cotizaciones de dólares tienen un formato inválido.');
  }

  const list: DolarCotizacion[] = [];
  for (const item of payload.data) {
    if (
      typeof item !== 'object' ||
      item === null ||
      !('casa' in item) ||
      typeof item.casa !== 'string' ||
      !('compra' in item) ||
      typeof item.compra !== 'number' ||
      !('venta' in item) ||
      typeof item.venta !== 'number'
    ) {
      throw new Error('Una cotización de dólares tiene un formato inválido.');
    }
    const casa = item.casa.toLowerCase();
    list.push({
      casa,
      nombre: ('nombre' in item && typeof item.nombre === 'string' ? item.nombre : null) ?? CASA_NOMBRES[casa] ?? casa.toUpperCase(),
      compra: item.compra,
      venta: item.venta,
      fecha: ('fechaActualizacion' in item && typeof item.fechaActualizacion === 'string'
        ? item.fechaActualizacion
        : null) ?? new Date().toISOString(),
    });
  }

  return list;
}

/**
 * Servicio unificado de Dólares con cálculo de brechas y soporte dual ArgentinaDatos / Dolarazo
 */
export async function fetchUnifiedDolares(
  preferredSource: 'argentinadatos' | 'dolarazo' = 'argentinadatos'
): Promise<{ dolares: DolarCotizacion[]; sourceUsed: string }> {
  let dolares: DolarCotizacion[] = [];
  let sourceUsed = preferredSource;

  if (preferredSource === 'argentinadatos') {
    try {
      dolares = await fetchDolaresArgentinaDatos();
    } catch {
      dolares = await fetchDolaresDolarazo();
      sourceUsed = 'dolarazo';
    }
  } else {
    try {
      dolares = await fetchDolaresDolarazo();
    } catch {
      dolares = await fetchDolaresArgentinaDatos();
      sourceUsed = 'argentinadatos';
    }
  }

  // Calcular brechas cambiarias con respecto al Dólar Oficial Venta
  const oficial = dolares.find((d) => d.casa === 'oficial');
  const oficialVenta = oficial ? oficial.venta : 0;

  const enriched = dolares.map((d) => {
    let brechaVenta = 0;
    if (oficialVenta > 0 && d.casa !== 'oficial') {
      brechaVenta = Number((((d.venta - oficialVenta) / oficialVenta) * 100).toFixed(2));
    }
    return {
      ...d,
      brechaVenta,
    };
  });

  return { dolares: enriched, sourceUsed };
}

/**
 * Obtener histórico de inflación (IPC) mensual
 */
export async function fetchInflacion(): Promise<InflacionDato[]> {
  const data = await fetchMacroResource('inflacion');
  if (
    !Array.isArray(data) ||
    !data.every((item: unknown) =>
      typeof item === 'object' &&
      item !== null &&
      'fecha' in item &&
      typeof item.fecha === 'string' &&
      'valor' in item &&
      typeof item.valor === 'number' &&
      Number.isFinite(item.valor)
    )
  ) {
    throw new Error('Los datos de inflación tienen un formato inválido.');
  }
  return data as InflacionDato[];
}

/**
 * Obtener tasas de Plazo Fijo bancario
 */
export async function fetchPlazosFijos(): Promise<PlazoFijoDato[]> {
  const data = await fetchMacroResource('plazos-fijos');
  if (
    !Array.isArray(data) ||
    !data.every((item: unknown) =>
      typeof item === 'object' &&
      item !== null &&
      'entidad' in item &&
      typeof item.entidad === 'string' &&
      'tnaClientes' in item &&
      typeof item.tnaClientes === 'number'
    )
  ) {
    throw new Error('Las tasas de plazo fijo tienen un formato inválido.');
  }
  const deposits = data as PlazoFijoDato[];
  // Ordenar por mejor TNA clientes descendente
  return deposits.sort((a, b) => (b.tnaClientes || 0) - (a.tnaClientes || 0));
}

/**
 * Obtener índice UVA / CER
 */
export async function fetchUva(): Promise<UvaDato[]> {
  const data = await fetchMacroResource('uva');
  if (
    !Array.isArray(data) ||
    !data.every((item: unknown) =>
      typeof item === 'object' &&
      item !== null &&
      'fecha' in item &&
      typeof item.fecha === 'string' &&
      'valor' in item &&
      typeof item.valor === 'number' &&
      Number.isFinite(item.valor)
    )
  ) {
    throw new Error('La API UVA devolvió datos incompletos o con formato desconocido');
  }
  return data as UvaDato[];
}
