import { User as SupabaseUser } from '@supabase/supabase-js';

// Re-export Supabase User type
export type User = SupabaseUser;

// Database types
export interface Database {
  public: {
    Functions: {
      get_portfolio_positions: {
        Args: {
          p_portfolio_id: string;
        };
        Returns: {
          ticker: string;
          total_shares: number;
          average_buy_price: number;
          total_invested: number;
          current_value: number;
          unrealized_pnl: number;
          unrealized_pnl_percent: number;
          currency: string;
        }[];
      };
      get_realized_pnl: {
        Args: {
          p_portfolio_id: string;
        };
        Returns: {
          ticker: string;
          total_sold_amount: number;
          total_cost_basis: number;
          realized_pnl: number;
          currency: string;
        }[];
      };
    };
    Tables: {
      asset_prices: {
        Row: {
          ticker: string;
          price: number;
          currency: string | null;
          last_updated: string;
        };
        Insert: {
          ticker: string;
          price: number;
          currency?: string | null;
          last_updated?: string;
        };
        Update: {
          ticker?: string;
          price?: number;
          currency?: string | null;
          last_updated?: string;
        };
      };
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
    Views: {
    };
  };
}

export interface PortfolioValue {
  portfolio_id: string;
  ticker: string;
  total_shares: number;
  current_price: number;
  current_value: number;
  last_updated: string;
}
