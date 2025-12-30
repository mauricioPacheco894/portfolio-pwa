import { supabase } from '@/lib/supabase';
import { Database } from '@/types/supabase';

type Portfolio = Database['public']['Tables']['portfolios']['Row'];

export async function getPortfolios(): Promise<Portfolio[]> {
  try {
    const { data, error } = await supabase
      .from('portfolios')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching portfolios:', error.message);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Unexpected error fetching portfolios:', error);
    return [];
  }
}
