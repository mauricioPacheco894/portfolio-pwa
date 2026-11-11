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
  /** Cost basis in MXN using actual fx_rate from transactions */
  totalInvestedMxn?: number;
  lastUpdated?: string;
}

/** Posición consolidada por ticker normalizado (p. ej. NU + NUN:BMV → NU).
 * Valores en USD base; la UI los convierte a la moneda seleccionada. */
export interface ConsolidatedPosition {
  ticker: string;
  /** Cantidad total sumada entre las piernas (mismo activo subyacente). */
  quantity: number;
  /** Valor de mercado total en USD. */
  marketValueUSD: number;
  /** Costo total invertido en USD. */
  totalInvestedUSD: number;
  /** Ganancia/pérdida no realizada en USD. */
  plUSD: number;
  /** Cantidad negativa = se vendió más de lo comprado (sobreventa). */
  isNegative: boolean;
  /** Moneda de la pierna con mayor valor (para el distintivo). */
  currency: 'USD' | 'MXN';
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
  fx_rate: number;
  date: string;
  portfolio_id: string;
}

