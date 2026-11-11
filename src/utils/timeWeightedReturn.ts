/**
 * Pure time-weighted return (TWR) math over a portfolio history series.
 *
 * This module has no server imports on purpose: it runs in client
 * components (the Month/YTD stats are computed in a client hook), so it
 * must never import the Supabase server client (which needs next/headers).
 * The server-side fetch of the series lives in historyCalculations.ts.
 */

export interface HistoryDataPoint {
  date: string; // YYYY-MM-DD
  valueUSD: number;
  valueMXN: number;
  investedUSD: number;
  investedMXN: number;
  formattedDate: string;
}

/**
 * Time-weighted return of the portfolio from a start date to the end of the
 * series, in the given currency.
 *
 * The history series carries both the portfolio value and the net invested
 * amount per day, so each day's return nets out that day's cash flow:
 * r = (V_t - (I_t - I_{t-1})) / V_{t-1}. Compounding those daily returns
 * gives the return of the portfolio itself, unaffected by deposits or
 * withdrawals (unlike value/invested ratios, which contributions distort).
 *
 * The base point is the last point on or before `startDate` (never a later
 * point: with gaps in the history, the first point on or after the target
 * would silently measure a shorter, arbitrary period). If the series starts
 * after the target date, the first point is the base.
 */
export function calculateTimeWeightedReturn(
  history: HistoryDataPoint[],
  startDate: string,
  currency: 'USD' | 'MXN'
): number {
  if (!history || history.length < 2) return 0;
  const valueKey = currency === 'USD' ? 'valueUSD' : 'valueMXN';
  const investedKey = currency === 'USD' ? 'investedUSD' : 'investedMXN';

  let baseIndex = -1;
  for (let i = 0; i < history.length; i++) {
    if (history[i].date <= startDate) baseIndex = i;
    else break;
  }
  if (baseIndex < 0) baseIndex = 0;
  if (baseIndex >= history.length - 1) return 0;

  let factor = 1;
  for (let i = baseIndex + 1; i < history.length; i++) {
    const prev = history[i - 1];
    const curr = history[i];
    const prevValue = prev[valueKey];
    if (prevValue > 0) {
      const cashFlow = curr[investedKey] - prev[investedKey];
      factor *= (curr[valueKey] - cashFlow) / prevValue;
    }
  }
  return factor - 1;
}
