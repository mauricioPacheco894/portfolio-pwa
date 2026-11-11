/**
 * Per-asset history ("ticker history")
 *
 * Builds, from the transactions the page already loads and the
 * get_realized_pnl RPC, a per-normalized-ticker summary for the desktop
 * expanded detail of the "Posiciones y estrategia" table: counts, first
 * buy, last operation, realized gain/loss, and the latest 5 operations.
 * It creates no new endpoint or RPC and touches no schema.
 *
 * Currency conversion: values end up in USD base, like the consolidated
 * positions from the hook. A :BMV (MXN) price is converted with the
 * current exchange rate, the same convention the table uses for
 * value/cost/price. The total is gross (quantity × price), excluding
 * fees, so each row stays self-consistent. Each operation also keeps its
 * market (MXN for :BMV legs, USD otherwise), so a consolidated asset
 * shows which market each operation belongs to.
 */

import { TickerHistory, TickerHistoryOp } from '@/types/portfolio';
import { Database } from '@/types/supabase';
import { normalizeTicker } from '@/utils/tickerMapping';

type TransactionRow = Database['public']['Tables']['transactions']['Row'];
type RealizedPnlRow =
  Database['public']['Functions']['get_realized_pnl']['Returns'][0];

const RECENT_OPS = 5;

function isMxnTicker(ticker: string): boolean {
  return ticker.toUpperCase().includes(':BMV');
}

function emptyHistory(): TickerHistory {
  return {
    buys: 0,
    sells: 0,
    firstBuyDate: null,
    lastOpDate: null,
    realizedPnlUSD: 0,
    recent: [],
  };
}

export function buildTickerHistoryMap(
  transactions: TransactionRow[],
  realizedPnlRows: RealizedPnlRow[],
  targetKeys: string[],
  usdMxnRate: number
): Record<string, TickerHistory> {
  const map: Record<string, TickerHistory> = {};
  const rate = usdMxnRate > 0 ? usdMxnRate : 1;

  const get = (norm: string): TickerHistory => {
    if (!map[norm]) map[norm] = emptyHistory();
    return map[norm];
  };

  const byDateAsc = (a: TransactionRow, b: TransactionRow) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.id < b.id ? -1 : 1;
  };
  const byDateDesc = (a: TransactionRow, b: TransactionRow) => -byDateAsc(a, b);

  for (const t of [...transactions].sort(byDateAsc)) {
    const h = get(normalizeTicker(t.ticker, targetKeys));
    const date = t.date.slice(0, 10);
    if (t.type === 'BUY') {
      h.buys += 1;
      if (!h.firstBuyDate || date < h.firstBuyDate) h.firstBuyDate = date;
    } else {
      h.sells += 1;
    }
    if (!h.lastOpDate || date > h.lastOpDate) h.lastOpDate = date;
  }

  const byTicker = new Map<string, TransactionRow[]>();
  for (const t of transactions) {
    const norm = normalizeTicker(t.ticker, targetKeys);
    const arr = byTicker.get(norm) ?? [];
    arr.push(t);
    byTicker.set(norm, arr);
  }
  for (const [norm, rows] of byTicker) {
    const h = get(norm);
    h.recent = rows.sort(byDateDesc).slice(0, RECENT_OPS).map((t) => {
      const priceUSD = isMxnTicker(t.ticker)
        ? Number(t.price_per_unit) / rate
        : Number(t.price_per_unit);
      const op: TickerHistoryOp = {
        date: t.date.slice(0, 10),
        type: t.type,
        quantity: Number(t.quantity),
        pricePerUnitUSD: priceUSD,
        totalUSD: Number(t.quantity) * priceUSD,
        currency: isMxnTicker(t.ticker) ? 'MXN' : 'USD',
      };
      return op;
    });
  }

  for (const p of realizedPnlRows) {
    const h = get(normalizeTicker(p.ticker, targetKeys));
    h.realizedPnlUSD +=
      p.currency === 'MXN'
        ? Number(p.realized_pnl) / rate
        : Number(p.realized_pnl);
  }

  return map;
}
