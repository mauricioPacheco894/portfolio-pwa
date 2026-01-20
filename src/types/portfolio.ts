/**
 * Portfolio Types
 *
 * Shared type definitions for portfolio-related data structures.
 */

import { Database } from './supabase';

/** Transaction row from database */
export type Transaction = Database['public']['Tables']['transactions']['Row'];

/** Portfolio row from database */
export type Portfolio = Database['public']['Tables']['portfolios']['Row'];

/** Calculated position for a single asset */
export interface AssetPosition {
  ticker: string;
  totalQuantity: number;
  averageCost: number;
  totalInvested: number;
  currentValue: number;
  marketPrice?: number;
  plDollars: number;
  realizedPL?: number;
  plPercentage: number;
  isNegative?: boolean;
  currency?: 'USD' | 'MXN';
  /** Market value normalized to USD for consistent totals */
  marketValueGlobal?: number;
  /** Cost basis normalized to USD */
  totalInvestedGlobal?: number;
  /** P&L normalized to USD */
  plDollarsGlobal?: number;
  lastUpdated?: string;
}

/** Rebalancing suggestion for a single asset */
export interface RebalanceSuggestion {
  ticker: string;
  currentPct: number;
  targetPct: number;
  action: 'BUY' | 'SELL' | 'HOLD';
  amount: number;
  quantity: number;
}

/** Transaction form data for create/edit operations */
export interface TransactionFormData {
  id?: string;
  ticker: string;
  type: 'BUY' | 'SELL';
  quantity: number;
  price_per_unit: number;
  fees: number;
  date: string;
  portfolio_id: string;
}

/** Aggregated portfolio totals */
export interface PortfolioTotals {
  totalValue: number;
  totalInvested: number;
  plDollars: number;
  plPercentage: number;
}

/**
 * Calculates aggregated totals from an array of holdings.
 *
 * @param holdings - Array of asset positions
 * @returns Aggregated portfolio totals
 */
export function calculatePortfolioTotals(
  holdings: AssetPosition[]
): PortfolioTotals {
  const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
  const totalInvested = holdings.reduce((sum, h) => sum + h.totalInvested, 0);
  const plDollars = holdings.reduce((sum, h) => sum + h.plDollars, 0);
  const plPercentage =
    totalInvested > 0 ? (plDollars / totalInvested) * 100 : 0;

  return {
    totalValue,
    totalInvested,
    plDollars,
    plPercentage,
  };
}
