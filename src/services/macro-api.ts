// src/services/macro-api.ts

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
  tasas?: Array<{
    plazoMinDias?: number;
    plazoMaxDias?: number;
    tna: number;
  }>;
}

export interface UvaDato {
  fecha: string;
  valor: number;
}

export interface LecapInstrumento {
  ticker: string;
  nombre: string;
  tipo: 'LECAP' | 'BONCAP' | 'TASA_FIJA';
  fechaVencimiento: string;
  diasAlVencimiento: number;
  precio: number; // Por cada $100 VN
  valorTecnico: number;
  tem: number; // Tasa Efectiva Mensual (%)
  tna: number; // Tasa Nominal Anual (%)
  tea: number; // Tasa Efectiva Anual / TIR (%)
  tasaEmision?: string;
  moneda: 'ARS';
  liquidez: 'Alta' | 'Media' | 'Baja';
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

/**
 * Obtener cotizaciones de ArgentinaDatos API (100% gratuita, CORS habilitado)
 */
export async function fetchDolaresArgentinaDatos(): Promise<DolarCotizacion[]> {
  const res = await fetch('https://api.argentinadatos.com/v1/cotizaciones/dolares');
  if (!res.ok) throw new Error(`ArgentinaDatos HTTP ${res.status}`);
  const data: Array<{ casa: string; compra: number; venta: number; fecha: string }> = await res.json();

  // El endpoint devuelve histórico cronológico. Agrupamos por casa quedándonos con el último registro disponible
  const mapLatest = new Map<string, { casa: string; compra: number; venta: number; fecha: string }>();
  for (const item of data) {
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
  // Intentar primero a través del proxy de Vite si estamos en dev o directamente
  const urls = ['/api/dolarazo/api/v1/cotizaciones/dolares', 'https://www.dolarazo.com.ar/api/v1/cotizaciones/dolares'];
  let json: any = null;

  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        json = await res.json();
        if (json && json.ok && Array.isArray(json.data)) break;
      }
    } catch {
      // Intentar siguiente URL
    }
  }

  if (!json || !json.data) throw new Error('No se pudo contactar con Dolarazo');

  const list: DolarCotizacion[] = [];
  for (const item of json.data) {
    const casa = item.casa.toLowerCase();
    list.push({
      casa,
      nombre: item.nombre || CASA_NOMBRES[casa] || casa.toUpperCase(),
      compra: item.compra,
      venta: item.venta,
      fecha: item.fechaActualizacion || new Date().toISOString(),
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
  const res = await fetch('https://api.argentinadatos.com/v1/finanzas/indices/inflacion');
  if (!res.ok) throw new Error(`Inflacion HTTP ${res.status}`);
  const data: Array<{ fecha: string; valor: number }> = await res.json();
  return data;
}

/**
 * Obtener tasas de Plazo Fijo bancario
 */
export async function fetchPlazosFijos(): Promise<PlazoFijoDato[]> {
  const res = await fetch('https://api.argentinadatos.com/v1/finanzas/tasas/plazoFijo');
  if (!res.ok) throw new Error(`Plazos Fijos HTTP ${res.status}`);
  const data: PlazoFijoDato[] = await res.json();
  // Ordenar por mejor TNA clientes descendente
  return data.sort((a, b) => (b.tnaClientes || 0) - (a.tnaClientes || 0));
}

/**
 * Obtener índice UVA / CER
 */
export async function fetchUva(): Promise<UvaDato[]> {
  const res = await fetch('https://api.argentinadatos.com/v1/finanzas/indices/uva');
  if (!res.ok) throw new Error(`UVA HTTP ${res.status}`);
  const data: UvaDato[] = await res.json();
  return data;
}

/**
 * Catálogo e instrumental de la Curva LECAP y Curva Tasa Fija (BONCAPs y Letras del Tesoro)
 */
const INSTRUMENTOS_BASE: Array<{
  ticker: string;
  nombre: string;
  tipo: 'LECAP' | 'BONCAP' | 'TASA_FIJA';
  fechaVencimiento: string; // YYYY-MM-DD
  tasaNominalMensualBase: number; // TEM % aproximada de mercado
  precioBase: number;
  liquidez: 'Alta' | 'Media' | 'Baja';
}> = [
  {
    ticker: 'S30S6',
    nombre: 'LECAP 30 Sep 2026',
    tipo: 'LECAP',
    fechaVencimiento: '2026-09-30',
    tasaNominalMensualBase: 1.85,
    precioBase: 125.8,
    liquidez: 'Alta',
  },
  {
    ticker: 'S14O6',
    nombre: 'LECAP 14 Oct 2026',
    tipo: 'LECAP',
    fechaVencimiento: '2026-10-14',
    tasaNominalMensualBase: 1.95,
    precioBase: 124.6,
    liquidez: 'Alta',
  },
  {
    ticker: 'T17O6',
    nombre: 'BONCAP 17 Oct 2026',
    tipo: 'BONCAP',
    fechaVencimiento: '2026-10-17',
    tasaNominalMensualBase: 2.0,
    precioBase: 123.9,
    liquidez: 'Media',
  },
  {
    ticker: 'S31O6',
    nombre: 'LECAP 31 Oct 2026',
    tipo: 'LECAP',
    fechaVencimiento: '2026-10-31',
    tasaNominalMensualBase: 2.05,
    precioBase: 123.1,
    liquidez: 'Alta',
  },
  {
    ticker: 'S28N6',
    nombre: 'LECAP 28 Nov 2026',
    tipo: 'LECAP',
    fechaVencimiento: '2026-11-28',
    tasaNominalMensualBase: 2.15,
    precioBase: 121.4,
    liquidez: 'Alta',
  },
  {
    ticker: 'S15D6',
    nombre: 'LECAP 15 Dic 2026',
    tipo: 'LECAP',
    fechaVencimiento: '2026-12-15',
    tasaNominalMensualBase: 2.2,
    precioBase: 119.8,
    liquidez: 'Alta',
  },
  {
    ticker: 'T15D6',
    nombre: 'BONCAP 15 Dic 2026',
    tipo: 'BONCAP',
    fechaVencimiento: '2026-12-15',
    tasaNominalMensualBase: 2.22,
    precioBase: 119.5,
    liquidez: 'Media',
  },
  {
    ticker: 'S31E7',
    nombre: 'LECAP 31 Ene 2027',
    tipo: 'LECAP',
    fechaVencimiento: '2027-01-31',
    tasaNominalMensualBase: 2.28,
    precioBase: 116.5,
    liquidez: 'Alta',
  },
  {
    ticker: 'S28F7',
    nombre: 'LECAP 28 Feb 2027',
    tipo: 'LECAP',
    fechaVencimiento: '2027-02-28',
    tasaNominalMensualBase: 2.32,
    precioBase: 114.2,
    liquidez: 'Media',
  },
  {
    ticker: 'S31M7',
    nombre: 'LECAP 31 Mar 2027',
    tipo: 'LECAP',
    fechaVencimiento: '2027-03-31',
    tasaNominalMensualBase: 2.35,
    precioBase: 112.1,
    liquidez: 'Alta',
  },
  {
    ticker: 'S30A7',
    nombre: 'LECAP 30 Abr 2027',
    tipo: 'LECAP',
    fechaVencimiento: '2027-04-30',
    tasaNominalMensualBase: 2.38,
    precioBase: 110.3,
    liquidez: 'Media',
  },
  {
    ticker: 'S29M7',
    nombre: 'LECAP 29 May 2027',
    tipo: 'LECAP',
    fechaVencimiento: '2027-05-29',
    tasaNominalMensualBase: 2.4,
    precioBase: 108.4,
    liquidez: 'Media',
  },
  {
    ticker: 'S30J7',
    nombre: 'LECAP 30 Jun 2027',
    tipo: 'LECAP',
    fechaVencimiento: '2027-06-30',
    tasaNominalMensualBase: 2.42,
    precioBase: 106.8,
    liquidez: 'Alta',
  },
  {
    ticker: 'T30J7',
    nombre: 'BONCAP 30 Jun 2027',
    tipo: 'BONCAP',
    fechaVencimiento: '2027-06-30',
    tasaNominalMensualBase: 2.45,
    precioBase: 106.3,
    liquidez: 'Media',
  },
  {
    ticker: 'TO26',
    nombre: 'Bono Tasa Fija 15.5% 2026',
    tipo: 'TASA_FIJA',
    fechaVencimiento: '2026-10-17',
    tasaNominalMensualBase: 2.1,
    precioBase: 89.2,
    liquidez: 'Baja',
  },
];

/**
 * Calcula la estructura temporal de la Curva LECAP y Tasa Fija calculando días al vencimiento,
 * TEM (Tasa Efectiva Mensual), TNA (Tasa Nominal Anual) y TEA/TIR (Tasa Efectiva Anual).
 */
export function getCurvaLecapYTasaFija(
  referenceDate: Date = new Date()
): LecapInstrumento[] {
  const refTime = referenceDate.getTime();

  return INSTRUMENTOS_BASE.map((item) => {
    const vtoParts = item.fechaVencimiento.split('-').map(Number);
    const vtoDate = new Date(vtoParts[0], vtoParts[1] - 1, vtoParts[2]);
    const diffDays = Math.max(
      1,
      Math.round((vtoDate.getTime() - refTime) / (1000 * 60 * 60 * 24))
    );

    const tem = item.tasaNominalMensualBase;
    // TNA = TEM * (365 / 30)
    const tna = Number((tem * (365 / 30)).toFixed(2));
    // TEA / TIR = ((1 + TEM/100)^(365/30) - 1) * 100
    const tea = Number(
      ((Math.pow(1 + tem / 100, 365 / 30) - 1) * 100).toFixed(2)
    );

    // Valor técnico estimado
    const valorTecnico = Number((item.precioBase * 1.005).toFixed(2));

    return {
      ticker: item.ticker,
      nombre: item.nombre,
      tipo: item.tipo,
      fechaVencimiento: item.fechaVencimiento,
      diasAlVencimiento: diffDays,
      precio: item.precioBase,
      valorTecnico,
      tem,
      tna,
      tea,
      moneda: 'ARS' as const,
      liquidez: item.liquidez,
    };
  }).sort((a, b) => a.diasAlVencimiento - b.diasAlVencimiento);
}

/**
 * Recalcula métricas para un instrumento en base a un precio personalizado
 */
export function recalcularMetricasLecap(
  instrumento: LecapInstrumento,
  nuevoPrecio: number
): { tem: number; tna: number; tea: number } {
  if (nuevoPrecio <= 0 || instrumento.diasAlVencimiento <= 0) {
    return { tem: instrumento.tem, tna: instrumento.tna, tea: instrumento.tea };
  }

  // Rendimiento directo = (Valor Final / Precio de Compra) - 1
  // Asumiendo valor técnico final a vto
  const valorFinal = instrumento.valorTecnico > 0 ? instrumento.valorTecnico : 130;
  const gananciaDirecta = (valorFinal - nuevoPrecio) / nuevoPrecio;

  if (gananciaDirecta <= -1) {
    return { tem: 0, tna: 0, tea: 0 };
  }

  const factorDiario = Math.pow(1 + gananciaDirecta, 1 / instrumento.diasAlVencimiento);
  const tem = Number(((Math.pow(factorDiario, 30) - 1) * 100).toFixed(2));
  const tna = Number((tem * (365 / 30)).toFixed(2));
  const tea = Number(((Math.pow(factorDiario, 365) - 1) * 100).toFixed(2));

  return { tem, tna, tea };
}
