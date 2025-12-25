import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Database } from '@/types/supabase'
import toast from 'react-hot-toast'

type Portfolio = Database['public']['Tables']['portfolios']['Row']

export async function fetchPortfolios(): Promise<Portfolio[]> {
    const { data, error } = await supabase
        .from('portfolios')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching portfolios:', error.message)
        throw new Error(error.message)
    }

    return data || []
}

export function usePortfolios() {
    return useQuery({
        queryKey: ['portfolios'],
        queryFn: fetchPortfolios,
        staleTime: 2 * 60 * 1000, // 2 minutes
    })
}

export function useInvalidatePortfolios() {
    const queryClient = useQueryClient()
    return () => queryClient.invalidateQueries({ queryKey: ['portfolios'] })
}
