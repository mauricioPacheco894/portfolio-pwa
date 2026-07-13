/**
 * Portfolios Hook
 *
 * React Query hook for fetching and managing portfolios.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { Database } from '@/types/supabase';

type Portfolio = Database['public']['Tables']['portfolios']['Row'];

/** Fetches all portfolios for the current user */
export async function fetchPortfolios(): Promise<Portfolio[]> {
  const { data, error } = await supabase
    .from('portfolios')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching portfolios:', error.message);
    throw new Error(error.message);
  }

  return data || [];
}

/**
 * Hook to fetch portfolios with caching.
 *
 * @param options.enabled - Whether to enable the query
 */
export function usePortfolios(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['portfolios'],
    queryFn: fetchPortfolios,
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: options?.enabled,
  });
}

/** Returns a function to invalidate the portfolios cache */
export function useInvalidatePortfolios() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['portfolios'] });
}
