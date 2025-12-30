import { User as SupabaseUser } from '@supabase/supabase-js';

// Re-export Supabase User type
export type User = SupabaseUser;

// Database types
export interface Database {
  public: {
    Tables: {
      portfolios: {
        Row: {
          id: string;
          name: string;
          target_allocation: Record<string, number> | null;
          created_at: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          name: string;
          target_allocation?: Record<string, number> | null;
          created_at?: string;
          user_id: string;
        };
        Update: {
          id?: string;
          name?: string;
          target_allocation?: Record<string, number> | null;
          created_at?: string;
          user_id?: string;
        };
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          portfolio_id: string;
          ticker: string;
          type: 'BUY' | 'SELL';
          quantity: number;
          price_per_unit: number;
          fees: number | null;
          date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          portfolio_id: string;
          ticker: string;
          type: 'BUY' | 'SELL';
          quantity: number;
          price_per_unit: number;
          fees?: number | null;
          date: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          portfolio_id?: string;
          ticker?: string;
          type?: 'BUY' | 'SELL';
          quantity?: number;
          price_per_unit?: number;
          fees?: number | null;
          date?: string;
          created_at?: string;
        };
      };
    };
  };
}
