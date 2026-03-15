import { User as SupabaseUser } from '@supabase/supabase-js';

/**
 * Global Type Definitions for Supabase and Database Entities
 */

/** Re-export of the core Supabase User type */
export type User = SupabaseUser;

/**
 * Main Database Schema Definition
 */
export interface Database {
  public: {
    Functions: {
      /**
       * Calculates total shares, cost basis, and P&L for a specific portfolio.
       */
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
          total_invested_mxn: number;
        }[];
      };
      /**
       * Calculates realized profits/losses for closed or partially closed positions.
       */
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
          total_cost_basis_mxn: number;
          total_sold_amount_mxn: number;
          realized_pnl_mxn: number;
        }[];
      };
    };
    Tables: {
      /** Asset price snapshots and historical data */
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
      /** User-defined portfolio containers */
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
      /** Individual buy/sell transaction records */
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
          fx_rate: number;
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
          fx_rate?: number;
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
          fx_rate?: number;
          date?: string;
          created_at?: string;
        };
      };
    };
    Views: {};
  };
}

/**
 * Real-time valuation metadata for a specific asset position.
 */
export interface PortfolioValue {
  portfolio_id: string;
  ticker: string;
  total_shares: number;
  current_price: number;
  current_value: number;
  last_updated: string;
}
