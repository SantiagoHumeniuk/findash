// src/services/balanz-api.ts

/**
 * Servicio para conectarse a la API de la Calculadora de Bonos de Balanz
 * Utiliza el proxy de Vite en desarrollo para evitar problemas de CORS.
 */

const API_BASE = '/api/balanz/calculadoraDeBonos';

export interface BondData {
  descripcion: string;
  ticker: string;
  monedaemision: string;
  cupon: string;
  tasaminima: string;
  tasamaxima: string;
  call: string;
  montonorminalvig: string;
  fechaemision: string;
  fechavencimiento: string;
  frecuenciaanual: string;
  basecalculo: string;
  diashabilesprevios: string;
  ajustapor: string;
  valoremision: string;
  valorcalculo: string;
  tasavariable: string;
  proxcupon: string;
  ultimocupon: string;
  proximocuponfecha: string;
}

export interface BondMetrics {
  tir: number;
  precio: number;
  durationmodificada: number;
  paridad: number;
  ceru?: number;
}

export interface BondCashflow {
  fecha: string;
  amortizacion: number;
  interes: number;
  total: number;
  saldo: number;
}

/**
 * Inicia sesión en la calculadora de Balanz para obtener las cookies de sesión.
 */
export async function loginToBalanz(): Promise<boolean> {
  const user = import.meta.env.VITE_BALANZ_USER;
  const pass = import.meta.env.VITE_BALANZ_PASS;

  if (!user || !pass) {
    console.error('Faltan credenciales de Balanz en variables de entorno');
    return false;
  }

  const formData = new URLSearchParams();
  formData.append('usu', user);
  formData.append('pass', pass);

  try {
    const response = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
      credentials: 'include',
    });

    // La API de Balanz suele responder con redirección (302) o 200.
    // Si la respuesta fue exitosa (el proxy manejará las cookies).
    return response.ok || response.redirected;
  } catch (error) {
    console.error('Error al iniciar sesión en Balanz:', error);
    return false;
  }
}

export async function getTickers(): Promise<string[]> {
  try {
    const response = await fetch(`${API_BASE}/tickers`, { headers: { 'Accept': 'application/json' }, credentials: 'include' });
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();
    if (data && data.tickers) {
      return data.tickers.map((t: any) => t.ticker || t.codigoespecie);
    } else if (Array.isArray(data)) {
      return data.map((t: any) => t.ticker || t.codigoespecie || typeof t === 'string' ? t : '');
    }
    return [];
  } catch (error) {
    console.error('Error fetching tickers:', error);
    return [];
  }
}

/**
 * Obtiene los detalles descriptivos de un bono específico.
 * @param ticker El ticker del bono (ej. AL30)
 */
export async function getDatosBono(ticker: string): Promise<BondData | null> {
  try {
    const response = await fetch(`${API_BASE}/datosBono/${ticker}`, { 
      headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      credentials: 'include' 
    });
    if (!response.ok) throw new Error('Network response was not ok');
    
    const text = await response.text();
    // Validar si devolvio HTML
    if (text.trim().startsWith('<')) {
        console.warn(`datosBono retornó HTML para ${ticker}. Es posible que el endpoint no exista.`);
        // Fake de datos mínimos para no romper la interfaz
        return {
          descripcion: `Bono ${ticker}`,
          ticker: ticker,
          monedaemision: 'ARS/USD',
          cupon: '-',
          tasaminima: '-',
          tasamaxima: '-',
          call: '-',
          montonorminalvig: '-',
          fechaemision: '-',
          fechavencimiento: '-',
          frecuenciaanual: '-',
          basecalculo: '-',
          diashabilesprevios: '-',
          ajustapor: '-',
          valoremision: '-',
          valorcalculo: '-',
          tasavariable: '-',
          proxcupon: '-',
          ultimocupon: '-',
          proximocuponfecha: '-'
        } as BondData;
    }
    const data = JSON.parse(text);
    // La API de Balanz suele devolver arrays dentro de propiedades
    if (data && data.datos && data.datos.length > 0) {
      return data.datos[0] as BondData;
    } else if (Array.isArray(data) && data.length > 0) {
      return data[0] as BondData;
    }
    return null;
  } catch (error) {
    console.error(`Error fetching data for ${ticker}:`, error);
    return null;
  }
}

/**
 * Obtiene indicadores y flujo de fondos calculados según un precio.
 * Endpoint basado en calcjs.js de Balanz.
 */
export async function getFlujoIndicadores(
  ticker: string,
  fechaLiquidacion: string, // YYYY-MM-DD
  precio: number,
  tipoPrecio: 'Clean' | 'Dirty' = 'Dirty',
  moneda: 'Dolares' | 'Pesos' | 'Euros' | 'Uvas' = 'Dolares',
  tipoCambio: number = 1,
  proxCup: number = 0,
  restCup: number = 0,
  dolarFut: number = 0,
  plazo: 'x' | 'y' | 'T+0' | 'T+1' | 'T+2' | 'MANUAL' = 'x',
  nominales: number = 1
): Promise<{ metrics: BondMetrics; cashflows: BondCashflow[] } | null> {
  try {
    const url = `${API_BASE}/flujoIndicadores/${ticker}/${fechaLiquidacion}/${precio}/${tipoPrecio}/${moneda}/${tipoCambio}/${proxCup}/${restCup}/${dolarFut}/${plazo}/${nominales}`;
    const response = await fetch(url, { headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'include' });
    if (!response.ok) throw new Error('Network response was not ok');
    
    const text = await response.text();
    if (text.trim().startsWith('<')) {
      console.warn('flujoIndicadores devolvió HTML');
      return null;
    }
    
    const data = JSON.parse(text);
    
    // Verificamos si hay error de autorización o sesión caída
    if (data.msg === 'sinAutorizacion' || data.sinAutorizacion === "sinAutorizacion") {
      console.warn('Sesión caducada, re-autenticando...');
      const loggedIn = await loginToBalanz();
      if (loggedIn) {
        // Obtenemos los indicadores pero evitaremos bucle infinito (este login podria ser falso positivo de 302, 
        // pero la configuracion estricta del proxy de vite se estara arreglando).
        return null; // Forzamos un null aquí para que el frontend no estalle iterando infinitamente.
      }
      return null;
    }

    let metrics: BondMetrics | null = null;
    let cashflows: BondCashflow[] = [];

    if (data.indicadores && data.indicadores.length > 0) {
      metrics = {
        tir: parseFloat(data.indicadores[0].tir) || 0,
        precio: parseFloat(data.indicadores[0].precio) || 0,
        durationmodificada: parseFloat(data.indicadores[0].durationmodificada) || 0,
        paridad: parseFloat(data.indicadores[0].paridad) || 0,
      };
      if (data.flujo && data.flujo.length > 0 && data.flujo[0].ceru) {
        metrics.ceru = parseFloat(data.flujo[0].ceru);
      }
    }

    if (data.flujo && data.flujo.length > 0) {
      cashflows = data.flujo.map((f: any) => ({
        fecha: f.fecha,
        amortizacion: parseFloat(f.amortizacion) || 0,
        interes: parseFloat(f.interes) || 0,
        total: parseFloat(f.total) || 0,
        saldo: parseFloat(f.saldo) || 0,
      }));
    }

    if (metrics) {
      return { metrics, cashflows };
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching flujo y indicadores para ${ticker}:`, error);
    return null;
  }
}

/**
 * Helper para obtener la fecha de liquidación en T+1.
 */
export function getFechaLiquidacion(daysToAdd = 1): string {
  const date = new Date();
  let added = 0;
  // Solo sumar días hábiles
  while (added < daysToAdd) {
    date.setDate(date.getDate() + 1);
    if (date.getDay() !== 0 && date.getDay() !== 6) { // Skip weekends
      added++;
    }
  }
  return date.toISOString().split('T')[0];
}
