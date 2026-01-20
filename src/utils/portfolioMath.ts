/**
 * Portfolio Math Utilities
 *
 * Contains calculations for portfolio rebalancing suggestions.
 * Position data comes from Supabase RPC functions (get_portfolio_positions, get_realized_pnl).
 */

export type { AssetPosition, RebalanceSuggestion } from '@/types/portfolio';

import type { AssetPosition, RebalanceSuggestion } from '@/types/portfolio';
import { normalizeTicker } from './tickerMapping';

/**
 * Calculates rebalancing suggestions based on target allocation vs current holdings.
 *
 * Uses dynamic tolerance bands:
 * - Small positions (≤6%): ±2.5% tolerance
 * - Large positions (>6%): ±3.0% tolerance
 *
 * @param holdings - Current asset positions (from RPC)
 * @param targetAllocation - Target allocation percentages by ticker
 * @param totalPortfolioValue - Total portfolio value in USD
 * @param currentPrices - Current prices per ticker (for quantity estimation)
 * @returns Array of rebalancing suggestions sorted by amount (descending)
 */
export function calculateRebalancing(
  holdings: AssetPosition[],
  targetAllocation: Record<string, number>,
  totalPortfolioValue: number,
  currentPrices: Record<string, number>
): RebalanceSuggestion[] {
  if (!targetAllocation || totalPortfolioValue === 0) return [];

  const suggestions: RebalanceSuggestion[] = [];
  const targetKeys = Object.keys(targetAllocation);

  // Consolidate holdings by normalized ticker (e.g., NU + NUN → NU)
  const consolidatedValues: Record<string, number> = {};
  holdings.forEach((h) => {
    const normTicker = normalizeTicker(h.ticker, targetKeys);
    const val = h.marketValueGlobal || h.currentValue;
    consolidatedValues[normTicker] = (consolidatedValues[normTicker] || 0) + val;
  });

  Object.entries(targetAllocation).forEach(([targetTicker, targetPct]) => {
    const normTarget = normalizeTicker(targetTicker, targetKeys);
    const currentVal = consolidatedValues[normTarget] || 0;
    const price = currentPrices[targetTicker] || currentPrices[normTarget] || 0;

    const currentPct = (currentVal / totalPortfolioValue) * 100;
    const targetVal = totalPortfolioValue * (targetPct / 100);
    const diffVal = targetVal - currentVal;

    // Dynamic tolerance based on position size
    const tolerance = targetPct <= 6.0 ? 2.5 : 3.0;
    const sellThreshold = targetPct + tolerance;

    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';

    if (currentPct >= sellThreshold) {
      action = 'SELL';
    } else if (currentPct < targetPct) {
      action = 'BUY';
    }

    // Only suggest if action is needed and amount is significant (>$10)
    if (action !== 'HOLD' && Math.abs(diffVal) > 10) {
      suggestions.push({
        ticker: targetTicker,
        currentPct,
        targetPct,
        action: action as 'BUY' | 'SELL',
        amount: Math.abs(diffVal),
        quantity: price > 0 ? Math.abs(diffVal) / price : 0,
      });
    }
  });

  return suggestions.sort((a, b) => b.amount - a.amount);
}
