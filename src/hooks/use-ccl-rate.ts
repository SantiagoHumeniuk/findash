import { useQuery } from '@tanstack/react-query';
import { fetchUnifiedDolares } from '../services/macro-api';

/** CCL sell rate, used to turn peso prices (CEDEARs, local stocks, bonds) into dollars. */
export async function fetchCclRate(): Promise<{ rate: number; date: string }> {
  const { dolares } = await fetchUnifiedDolares();
  const ccl = dolares.find((dolar) => dolar.casa.toLowerCase() === 'contadoconliqui');
  const rate = ccl && ccl.venta > 0 ? ccl.venta : ccl?.compra;
  if (!rate || !Number.isFinite(rate) || rate <= 0) {
    throw new Error('La cotización del dólar CCL no está disponible.');
  }
  return { rate, date: ccl?.fecha ?? new Date().toISOString() };
}

/** Obtiene la cotización de venta CCL usada para convertir CEDEARs en ARS a USD. */
export function useCclRate() {
  return useQuery({
    queryKey: ['macro', 'dolar-ccl'],
    queryFn: fetchCclRate,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}
