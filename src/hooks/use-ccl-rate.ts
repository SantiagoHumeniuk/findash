import { useQuery } from '@tanstack/react-query';
import { fetchUnifiedDolares } from '../services/macro-api';

/** Obtiene la cotización de venta CCL usada para convertir CEDEARs en ARS a USD. */
export function useCclRate() {
  return useQuery({
    queryKey: ['macro', 'dolar-ccl'],
    queryFn: async () => {
      const { dolares } = await fetchUnifiedDolares();
      const ccl = dolares.find((dolar) => dolar.casa.toLowerCase() === 'contadoconliqui');
      const rate = ccl && ccl.venta > 0 ? ccl.venta : ccl?.compra;
      if (!rate || !Number.isFinite(rate) || rate <= 0) {
        throw new Error('La cotización del dólar CCL no está disponible.');
      }
      return { rate, date: ccl?.fecha ?? new Date().toISOString() };
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}
