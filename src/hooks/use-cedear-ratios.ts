// src/hooks/use-cedear-ratios.ts

import { useQuery } from '@tanstack/react-query';
import { fetchCedearRatios } from '../services/data/cedear-service';
import bymaCedearRatios from '../data/cedear-ratios.json';

/**
 * Returns BYMA's preloaded CEDEAR conversion ratios, refreshed with automatic market updates.
 */
export function useCedearRatios() {
  const { data, isLoading } = useQuery({
    queryKey: ['cedear-ratios'],
    queryFn: fetchCedearRatios,
    initialData: bymaCedearRatios,
    initialDataUpdatedAt: 0,
    staleTime: 6 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });
  return { ratios: data, loading: isLoading };
}
