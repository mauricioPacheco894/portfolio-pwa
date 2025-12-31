// Shared portfolio-related types

import { Database } from './supabase';

// Database row types
export type Transaction = Database['public']['Tables']['transactions']['Row'];
export type Portfolio = Database['public']['Tables']['portfolios']['Row'];

// Calculated position for a single asset
export interface AssetPosition {
    ticker: string;
    totalQuantity: number;
    averageCost: number;
    totalInvested: number;
    currentValue: number;
    marketPrice?: number;
    plDollars: number;
    plPercentage: number;
}

// Rebalancing suggestion
export interface RebalanceSuggestion {
    ticker: string;
    currentPct: number;
    targetPct: number;
    action: 'BUY' | 'SELL' | 'HOLD';
    amount: number;
    quantity: number;
}

// Transaction form data (for create/edit)
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

// Portfolio totals (calculated from holdings)
export interface PortfolioTotals {
    totalValue: number;
    totalInvested: number;
    plDollars: number;
    plPercentage: number;
}

// Helper function to calculate totals from holdings
export function calculatePortfolioTotals(
    holdings: AssetPosition[]
): PortfolioTotals {
    const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
    const totalInvested = holdings.reduce((sum, h) => sum + h.totalInvested, 0);
    const plDollars = holdings.reduce((sum, h) => sum + h.plDollars, 0);
    const plPercentage = totalInvested > 0 ? (plDollars / totalInvested) * 100 : 0;

    return {
        totalValue,
        totalInvested,
        plDollars,
        plPercentage,
    };
}
