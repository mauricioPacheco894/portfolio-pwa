/**
 * Frozen net-cash-flow invested amounts.
 *
 * "Invested" is the net money the user put in (buys minus sells, at the
 * price actually paid), converted once at the FX rate of each transaction
 * and never revalued afterwards. Only the current value moves with the
 * exchange rate; the invested amount only changes when the user trades.
 *
 * - MXN: GBM trades are already in pesos (fx 1). USD trades use the
 *   fx_rate stored on the transaction; old USD rows stored with fx_rate 1
 *   (see TransactionsTable currency inference) fall back to the USD-MXN
 *   daily close on the transaction date.
 * - USD: USD trades contribute their dollar amount as-is. MXN trades are
 *   divided by the USD-MXN daily close on the transaction date, so the
 *   figure is frozen as of each trade. A trade made today uses the latest
 *   close available, which settles to that day's close once the nightly
 *   price sync stores it; the wobble is bounded to one day's FX move on
 *   recent trades, in the USD view only.
 *
 * Fees are intentionally excluded, matching the previous history-based
 * invested figure (get_portfolio_history net cash flow), so this change
 * only freezes the FX treatment and does not redefine the amount.
 */

export interface FrozenInvestedTransaction {
  ticker: string;
  type: 'BUY' | 'SELL';
  quantity: number;
  price_per_unit: number;
  fx_rate: number | null;
  date: string;
}

export interface FrozenInvested {
  frozenInvestedMXN: number;
  frozenInvestedUSD: number;
}

interface UsdMxnClose {
  date: string;
  close: number;
}

/** Latest USD-MXN daily close on or before `date` (YYYY-MM-DD). */
function rateOnDate(
  closes: UsdMxnClose[],
  date: string,
  fallbackRate: number,
): number {
  let rate = fallbackRate;
  for (const c of closes) {
    if (c.date <= date && Number.isFinite(c.close) && c.close > 0) {
      rate = c.close;
    } else if (c.date > date) {
      break;
    }
  }
  return rate > 0 ? rate : 20;
}

export function calculateFrozenInvested(
  transactions: FrozenInvestedTransaction[],
  currencyByTicker: Map<string, 'USD' | 'MXN'>,
  usdMxnCloses: UsdMxnClose[],
  fallbackRate: number,
): FrozenInvested {
  const safeFallback = Number.isFinite(fallbackRate) && fallbackRate > 0
    ? fallbackRate
    : 20;
  const sortedCloses = [...usdMxnCloses].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
  );

  let frozenInvestedMXN = 0;
  let frozenInvestedUSD = 0;

  for (const tx of transactions) {
    const amount = tx.quantity * tx.price_per_unit;
    if (!Number.isFinite(amount)) continue;
    const sign = tx.type === 'BUY' ? 1 : -1;
    const currency =
      currencyByTicker.get(tx.ticker) ??
      (tx.ticker.toUpperCase().endsWith(':BMV') ? 'MXN' : 'USD');
    const rate = rateOnDate(sortedCloses, tx.date, safeFallback);

    // MXN: USD trades convert at their stored rate (or the daily close
    // when the stored rate is missing); MXN trades are already pesos.
    const fxForMxn =
      currency === 'USD'
        ? tx.fx_rate != null && tx.fx_rate >= 2
          ? tx.fx_rate
          : rate
        : 1;
    frozenInvestedMXN += sign * amount * fxForMxn;

    // USD: USD trades contribute dollars as-is; MXN trades divide by the
    // daily close on the transaction date.
    frozenInvestedUSD += sign * amount / (currency === 'MXN' ? rate : 1);
  }

  return { frozenInvestedMXN, frozenInvestedUSD };
}
