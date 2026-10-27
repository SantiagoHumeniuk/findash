// src/hooks/use-watchlist.test.tsx

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/unbound-method */
 

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useWatchlistMutations } from './use-watchlist';
import { supabase } from '../lib/supabase';
import type { ReactNode } from 'react';

// Mock de Supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

// Mock de Auth
vi.mock('./use-auth', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id' },
    profile: null,
  }),
}));

// Mock de límites del plan (usePlanLimits lee el ConfigProvider, ausente en estos tests)
vi.mock('./use-plan-limits', () => ({
  usePlanLimits: () => ({
    current: 0,
    limit: 100,
    isAtLimit: false,
    isNearLimit: false,
    usagePercentage: 0,
    currentPlan: 'basico',
    limitMessage: '',
  }),
}));

// Mock de logger
vi.mock('../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock de sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('useWatchlistMutations - Optimistic Updates', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe('addToWatchlist', () => {
    it('should add item optimistically before server responds', async () => {
      // Mock successful API response (delayed)
      const mockFrom = vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => 
              new Promise(resolve => 
                setTimeout(() => resolve({
                  data: { 
                    id: 'real-id', 
                    symbol: 'AAPL', 
                    user_id: 'test-user-id', 
                    added_at: new Date().toISOString(), 
                    notes: null 
                  },
                  error: null,
                }), 100)
              )
            ),
          })),
        })),
      }));

      vi.mocked(supabase.from).mockImplementation(mockFrom as any);

      // Set initial empty watchlist
      queryClient.setQueryData(['watchlist', 'test-user-id'], []);

      const { result } = renderHook(() => useWatchlistMutations(), { wrapper });

      // Execute mutation
      result.current.addToWatchlist.mutate({ symbol: 'AAPL' });

      // Verify optimistic update happened immediately (before server responds)
      await waitFor(() => {
        const watchlist = queryClient.getQueryData<{ symbol: string }[]>(['watchlist', 'test-user-id']);
        expect(watchlist).toHaveLength(1);
        expect(watchlist?.[0].symbol).toBe('AAPL');
      });

      // Wait for server response
      await waitFor(() => {
        expect(result.current.addToWatchlist.isSuccess).toBe(true);
      }, { timeout: 200 });
    });

    it('should rollback on error', async () => {
      // Mock failed API response
      const mockFrom = vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: null,
              error: { message: 'Server error', code: '500' },
            })),
          })),
        })),
      }));

      vi.mocked(supabase.from).mockImplementation(mockFrom as any);

      // Set initial watchlist
      const initialWatchlist = [
        { id: 'existing-1', symbol: 'MSFT', user_id: 'test-user-id', added_at: new Date().toISOString(), notes: null },
      ];
      queryClient.setQueryData(['watchlist', 'test-user-id'], initialWatchlist);

      const { result } = renderHook(() => useWatchlistMutations(), { wrapper });

      // Execute mutation
      result.current.addToWatchlist.mutate({ symbol: 'AAPL' });

      // Wait for error
      await waitFor(() => {
        expect(result.current.addToWatchlist.isError).toBe(true);
      });

      // Verify rollback happened
      const finalWatchlist = queryClient.getQueryData(['watchlist', 'test-user-id']);
      expect(finalWatchlist).toEqual(initialWatchlist);
    });
  });

  describe('removeFromWatchlist', () => {
    it('should remove item optimistically', async () => {
      // Mock successful delete
      const mockFrom = vi.fn(() => ({
        delete: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ error: null })),
          })),
        })),
      }));

      vi.mocked(supabase.from).mockImplementation(mockFrom as any);

      // Set initial watchlist with 2 items
      const initialWatchlist = [
        { id: '1', symbol: 'AAPL', user_id: 'test-user-id', added_at: new Date().toISOString(), notes: null },
        { id: '2', symbol: 'MSFT', user_id: 'test-user-id', added_at: new Date().toISOString(), notes: null },
      ];
      queryClient.setQueryData(['watchlist', 'test-user-id'], initialWatchlist);

      const { result } = renderHook(() => useWatchlistMutations(), { wrapper });

      // Execute mutation
      result.current.removeFromWatchlist.mutate('AAPL');

      // Verify optimistic removal
      await waitFor(() => {
        const watchlist = queryClient.getQueryData<{ symbol: string }[]>(['watchlist', 'test-user-id']);
        expect(watchlist).toHaveLength(1);
        expect(watchlist?.[0].symbol).toBe('MSFT');
      });
    });

    it('should rollback removal on error', async () => {
      // Mock failed delete
      const mockFrom = vi.fn(() => ({
        delete: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ error: { message: 'Server error' } })),
          })),
        })),
      }));

      vi.mocked(supabase.from).mockImplementation(mockFrom as any);

      // Set initial watchlist
      const initialWatchlist = [
        { id: '1', symbol: 'AAPL', user_id: 'test-user-id', added_at: new Date().toISOString(), notes: null },
      ];
      queryClient.setQueryData(['watchlist', 'test-user-id'], initialWatchlist);

      const { result } = renderHook(() => useWatchlistMutations(), { wrapper });

      // Execute mutation
      result.current.removeFromWatchlist.mutate('AAPL');

      // Wait for error
      await waitFor(() => {
        expect(result.current.removeFromWatchlist.isError).toBe(true);
      });

      // Verify rollback
      const finalWatchlist = queryClient.getQueryData(['watchlist', 'test-user-id']);
      expect(finalWatchlist).toEqual(initialWatchlist);
    });
  });

  describe('updateWatchlistItem', () => {
    it('should update notes optimistically', async () => {
      // Mock successful update
      const mockFrom = vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({
                  data: { 
                    id: '1', 
                    symbol: 'AAPL', 
                    user_id: 'test-user-id', 
                    added_at: new Date().toISOString(), 
                    notes: 'New note' // Server confirms the update
                  },
                  error: null,
                })),
              })),
            })),
          })),
        })),
      }));

      vi.mocked(supabase.from).mockImplementation(mockFrom as any);

      // Set initial watchlist
      const initialWatchlist = [
        { id: '1', symbol: 'AAPL', user_id: 'test-user-id', added_at: new Date().toISOString(), notes: 'Old note' },
      ];
      queryClient.setQueryData(['watchlist', 'test-user-id'], initialWatchlist);

      const { result } = renderHook(() => useWatchlistMutations(), { wrapper });

      // Execute mutation
      result.current.updateWatchlistItem.mutate({ 
        symbol: 'AAPL', 
        dto: { notes: 'New note' } 
      });

      // Verify optimistic update happened immediately
      await waitFor(() => {
        const watchlist = queryClient.getQueryData<{ symbol: string; notes: string | null }[]>(['watchlist', 'test-user-id']);
        expect(watchlist?.[0].notes).toBe('New note');
      });

      // Verify server response synced correctly
      await waitFor(() => {
        expect(result.current.updateWatchlistItem.isSuccess).toBe(true);
      });
    });
  });
});
