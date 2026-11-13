// src/hooks/use-cedear-ratios.ts

import { useQuery } from '@tanstack/react-query';
import { fetchCedearRatios } from '../services/data/cedear-service';

/**
 * CEDEAR conversion ratios (CEDEARs per underlying share). The table is checked against market
 * prices every business day by the cedear-ratios-sync Edge Function, so ratio changes and new
 * CEDEARs arrive on their own; one copy is shared by every screen for the session.
 */
export function useCedearRatios() {
  const { data, isLoading } = useQuery({
    queryKey: ['cedear-ratios'],
    queryFn: fetchCedearRatios,
    staleTime: 6 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });
  return { ratios: data ?? EMPTY, loading: isLoading };
}

const EMPTY: Record<string, number> = {};
