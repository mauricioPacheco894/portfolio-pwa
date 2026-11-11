import type { AssetPosition, Transaction } from '@/types/portfolio';

/** One row of the `splits` table (stock split event). */
export interface SplitEvent {
  ticker: string;
  split_date: string;
  ratio: number;
}

/** One ticker where the positions RPC disagrees with the transactions. */
export interface PositionMismatch {
  ticker: string;
  fromTransactions: number;
  fromRpc: number;
}

/**
 * Cumulative split factor for a ticker as of a given date (YYYY-MM-DD).
 * Mirrors public.split_factor in SQL: the product of the ratios of every
 * split that happened after `date`, i.e. the factor that converts a
 * quantity held on `date` into post-split shares.
 */
export function splitFactorFor(
  splits: SplitEvent[],
  ticker: string,
  date: string
): number {
  let factor = 1;
  for (const split of splits) {
    if (split.ticker === ticker && split.split_date > date) {
      factor *= split.ratio;
    }
  }
  return factor;
}

const EPSILON = 1e-6;

/**
 * Independent reconciliation: the net shares from the raw transactions
 * (expressed in post-split shares, like the RPC does) must match the
 * positions the RPC reports. Any difference means the RPC, the data, or
 * the split handling is wrong, and the UI must say so instead of silently
 * showing the RPC numbers.
 *
 * The RPC omits positions at (or below) dust level, so a transaction net
 * that small with no RPC row is not a mismatch.
 */
export function reconcilePositions(
  transactions: Pick<Transaction, 'ticker' | 'type' | 'quantity' | 'date'>[],
  holdings: Pick<AssetPosition, 'ticker' | 'totalQuantity'>[],
  splits: SplitEvent[] = []
): PositionMismatch[] {
  const netByTicker = new Map<string, number>();
  for (const tx of transactions) {
    const txDate = tx.date.slice(0, 10);
    const factor = splitFactorFor(splits, tx.ticker, txDate);
    const delta = (tx.type === 'BUY' ? tx.quantity : -tx.quantity) * factor;
    netByTicker.set(tx.ticker, (netByTicker.get(tx.ticker) ?? 0) + delta);
  }

  const rpcByTicker = new Map(
    holdings.map((h) => [h.ticker, h.totalQuantity])
  );

  const mismatches: PositionMismatch[] = [];
  const tickers = new Set([...netByTicker.keys(), ...rpcByTicker.keys()]);
  for (const ticker of tickers) {
    const fromTransactions = netByTicker.get(ticker) ?? 0;
    const fromRpc = rpcByTicker.get(ticker) ?? 0;
    if (fromRpc === 0 && Math.abs(fromTransactions) <= EPSILON) continue;
    if (Math.abs(fromTransactions - fromRpc) > EPSILON) {
      mismatches.push({ ticker, fromTransactions, fromRpc });
    }
  }
  return mismatches.sort((a, b) => a.ticker.localeCompare(b.ticker));
}
