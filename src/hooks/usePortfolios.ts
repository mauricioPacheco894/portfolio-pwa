import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { supabase } from '@/lib/supabase';
import { Database } from '@/types/supabase';

type Portfolio = Database['public']['Tables']['portfolios']['Row'];

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

export function usePortfolios(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['portfolios'],
    queryFn: fetchPortfolios,
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: options?.enabled,
  });
}

export function useInvalidatePortfolios() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['portfolios'] });
}
