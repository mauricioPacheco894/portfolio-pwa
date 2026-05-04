/**
 * Portfolio Math Utilities
 *
 * Contains calculations for portfolio rebalancing suggestions.
 * Position data comes from Supabase RPC functions (get_portfolio_positions, get_realized_pnl).
 */

export type { AssetPosition, RebalanceSuggestion } from '@/types/portfolio';

import type { AssetPosition, RebalanceSuggestion } from '@/types/portfolio';
import { normalizeTicker } from './tickerMapping';

// ============================================================================
// REBALANCING STRATEGIES
// ============================================================================

/**
 * Input structure for rebalancing calculations.
 * All monetary values should be normalized to a single currency (e.g., USD).
 */
export interface RebalanceItem {
  ticker: string;
  currentValue: number;      // Current market value
  targetPercentage: number;  // Target allocation (0.10 = 10%)
  currentPercentage: number; // Calculated: currentValue / totalPortfolio
}

/**
 * Output structure representing a proposed order.
 */
export interface OrderProposal {
  ticker: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  amount: number;            // Amount of money to move (always positive)
  shares?: number;           // Optional: calculated if unit price is available
  currentPct: number;        // Current percentage
  targetPct: number;         // Target percentage
  projectedPct?: number;     // Percentage after executing the order
}

/**
 * STRATEGY 1: Classic Rebalance (Maintenance)
 *
 * Sells overweight positions and buys underweight positions.
 * Net cash flow is approximately zero.
 *
 * Use case: Periodic rebalancing every 3, 6, or 12 months.
 *
 * @param positions - Current portfolio positions with targets
 * @param minimumThreshold - Minimum amount to trigger action (default: $10)
 * @returns Array of order proposals
 */
export function calculateClassicRebalance(
  positions: RebalanceItem[],
  minimumThreshold: number = 10
): OrderProposal[] {
  // 1. Calculate total portfolio value
  const totalPortfolioValue = positions.reduce(
    (sum, p) => sum + p.currentValue,
    0
  );

  if (totalPortfolioValue === 0) return [];

  return positions.map((pos) => {
    // 2. Calculate ideal value based on target
    const targetValue = totalPortfolioValue * pos.targetPercentage;

    // 3. Calculate difference
    const difference = targetValue - pos.currentValue;

    // 4. Determine action (use threshold to avoid noise)
    if (Math.abs(difference) < minimumThreshold) {
      return {
        ticker: pos.ticker,
        action: 'HOLD' as const,
        amount: 0,
        currentPct: pos.currentPercentage * 100,
        targetPct: pos.targetPercentage * 100,
        projectedPct: pos.currentPercentage * 100,
      };
    }

    return {
      ticker: pos.ticker,
      action: difference > 0 ? ('BUY' as const) : ('SELL' as const),
      amount: Math.abs(difference),
      currentPct: pos.currentPercentage * 100,
      targetPct: pos.targetPercentage * 100,
      projectedPct: pos.targetPercentage * 100, // After execution, should match target
    };
  });
}

/**
 * STRATEGY 2: Smart Deposit (Contributions)
 *
 * Injects new money EXCLUSIVELY into underweight positions.
 * Never sells anything - only buys.
 *
 * Use case: Regular contributions (weekly, bi-weekly, monthly).
 *
 * Mathematical challenge: If an asset is overweight, its "ideal buy" would be
 * negative. Since this is a deposit, we don't want to sell. We simply assign
 * $0 and distribute the money proportionally among the "thirsty" positions.
 *
 * @param positions - Current portfolio positions with targets
 * @param cashInjection - Amount of new money to invest
 * @returns Array of order proposals
 */
export function calculateSmartDeposit(
  positions: RebalanceItem[],
  cashInjection: number
): OrderProposal[] {
  if (cashInjection <= 0) {
    return positions.map((pos) => ({
      ticker: pos.ticker,
      action: 'HOLD' as const,
      amount: 0,
      currentPct: pos.currentPercentage * 100,
      targetPct: pos.targetPercentage * 100,
      projectedPct: pos.currentPercentage * 100,
    }));
  }

  // 1. Calculate the "new universe" (current total + cash injection)
  const currentTotal = positions.reduce((sum, p) => sum + p.currentValue, 0);
  const projectedTotal = currentTotal + cashInjection;

  // 2. Calculate how much each position needs to reach its ideal value
  // in this new, larger universe
  const deficits: { ticker: string; needed: number }[] = [];

  positions.forEach((pos) => {
    const idealValue = projectedTotal * pos.targetPercentage;
    const deficit = idealValue - pos.currentValue;

    // Only care about positions that need money (positive deficit)
    if (deficit > 0) {
      deficits.push({ ticker: pos.ticker, needed: deficit });
    }
  });

  // 3. Sum the total "thirst" of the portfolio
  const totalNeeded = deficits.reduce((sum, item) => sum + item.needed, 0);

  // 4. Distribute available money
  return positions.map((pos) => {
    const deficitItem = deficits.find((d) => d.ticker === pos.ticker);

    if (!deficitItem) {
      // If no deficit (overweight), don't buy anything
      const projectedPct =
        projectedTotal > 0 ? (pos.currentValue / projectedTotal) * 100 : 0;
      return {
        ticker: pos.ticker,
        action: 'HOLD' as const,
        amount: 0,
        currentPct: pos.currentPercentage * 100,
        targetPct: pos.targetPercentage * 100,
        projectedPct,
      };
    }

    let amountToBuy = 0;

    if (totalNeeded <= cashInjection) {
      // RARE CASE: Injection is large enough to cover all deficits
      // and there's money left over. Simply fill the gap.
      amountToBuy = deficitItem.needed;
    } else {
      // COMMON CASE: Money isn't enough to fix the entire portfolio.
      // Distribute proportionally (pro-rata).
      // If you represent 20% of the "need", you get 20% of the cash.
      const weightOfNeed = deficitItem.needed / totalNeeded;
      amountToBuy = cashInjection * weightOfNeed;
    }

    const projectedValue = pos.currentValue + amountToBuy;
    const projectedPct =
      projectedTotal > 0 ? (projectedValue / projectedTotal) * 100 : 0;

    return {
      ticker: pos.ticker,
      action: 'BUY' as const,
      amount: amountToBuy,
      currentPct: pos.currentPercentage * 100,
      targetPct: pos.targetPercentage * 100,
      projectedPct,
    };
  });
}

/**
 * Helper function to convert holdings and targets to RebalanceItem format.
 * Useful for bridging existing data structures to the rebalancing functions.
 */
export function prepareRebalanceItems(
  consolidatedHoldingsUSD: Record<string, number>,
  targetAllocation: Record<string, number>, // Values as percentages (e.g., 10 for 10%)
  totalPortfolioValue: number
): RebalanceItem[] {
  const allTickers = new Set([
    ...Object.keys(consolidatedHoldingsUSD),
    ...Object.keys(targetAllocation),
  ]);

  return Array.from(allTickers)
    .filter((ticker) => {
      const hasValue = (consolidatedHoldingsUSD[ticker] || 0) > 0.01;
      const hasTarget = (targetAllocation[ticker] || 0) > 0;
      return hasValue || hasTarget;
    })
    .map((ticker) => {
      const currentValue = consolidatedHoldingsUSD[ticker] || 0;
      const targetPct = targetAllocation[ticker] || 0;
      const currentPercentage =
        totalPortfolioValue > 0 ? currentValue / totalPortfolioValue : 0;

      return {
        ticker,
        currentValue,
        targetPercentage: targetPct / 100, // Convert to decimal
        currentPercentage,
      };
    });
}

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

    // Tolerancia base: 20% del porcentaje meta
    const relativeTolerance = 0.20;
    const calculatedTolerance = targetPct * relativeTolerance;
    
    // Límite para la tolerancia inferior (compra): entre 1.5% y 5.0% absoluto
    const lowerTolerance = Math.max(1.5, Math.min(calculatedTolerance, 5.0));
    
    // Banda superior más amplia: 1.5 veces la inferior para dejar "correr" más las ganancias
    const upperTolerance = lowerTolerance * 1.5;

    const sellThreshold = targetPct + upperTolerance;
    const buyThreshold = targetPct - lowerTolerance;

    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';

    if (currentPct >= sellThreshold) {
      action = 'SELL';
    } else if (currentPct <= buyThreshold) {
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
