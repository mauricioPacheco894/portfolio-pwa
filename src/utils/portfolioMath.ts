// Re-export types from shared file
export type { AssetPosition, RebalanceSuggestion } from '@/types/portfolio';

import { Database } from '@/types/supabase';
import type { AssetPosition, RebalanceSuggestion } from '@/types/portfolio';

type Transaction = Database['public']['Tables']['transactions']['Row'];

export function calculateHoldings(
  transactions: Transaction[]
): AssetPosition[] {
  const assets: Record<string, AssetPosition> = {};

  // Ordenamos cronológicamente (más antiguo a más nuevo) para calcular bien el promedio
  const sortedTx = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  for (const tx of sortedTx) {
    const ticker = tx.ticker.toUpperCase();

    // Si es el primer movimiento de este activo, inicializamos
    if (!assets[ticker]) {
      assets[ticker] = {
        ticker,
        totalQuantity: 0,
        averageCost: 0,
        totalInvested: 0,
        currentValue: 0,
        plDollars: 0,
        plPercentage: 0,
      };
    }

    const position = assets[ticker];
    const qty = Number(tx.quantity);
    const price = Number(tx.price_per_unit);

    if (tx.type === 'BUY') {
      // Al comprar, actualizamos el Costo Promedio Ponderado
      const newTotalQuantity = position.totalQuantity + qty;
      // Nuevo Costo Promedio = ((Cant. Actual * Costo Prom.) + (Nueva Cant. * Nuevo Precio)) / Total Nuevo
      position.averageCost =
        (position.totalQuantity * position.averageCost + qty * price) /
        newTotalQuantity;
      position.totalQuantity = newTotalQuantity;
      position.totalInvested = position.totalQuantity * position.averageCost;
    } else if (tx.type === 'SELL') {
      // Al vender, solo reducimos cantidad, el costo promedio NO cambia
      // (La ganancia/pérdida se realiza, pero el costo base de lo que queda es el mismo)
      position.totalQuantity -= qty;
      position.totalInvested = position.totalQuantity * position.averageCost;
    }

    // Actualizamos el "precio actual" con el último precio de transacción
    position.currentValue = position.totalQuantity * price;
  }

  // Convertimos el objeto en array, filtramos los que ya vendimos todo (cantidad 0) y calculamos P/L
  return Object.values(assets)
    .filter((asset) => asset.totalQuantity > 0.000001) // Evitamos errores de punto flotante
    .map((asset) => {
      // Ganancia no realizada
      asset.plDollars = asset.currentValue - asset.totalInvested;
      asset.plPercentage =
        asset.totalInvested > 0
          ? (asset.plDollars / asset.totalInvested) * 100
          : 0;
      return asset;
    });
}

// Calcula sugerencias de rebalanceo basado en la asignación objetivo
export function calculateRebalancing(
  holdings: AssetPosition[],
  targetAllocation: Record<string, number>,
  totalPortfolioValue: number,
  currentPrices: Record<string, number>
): RebalanceSuggestion[] {
  if (!targetAllocation || totalPortfolioValue === 0) return [];

  const suggestions: RebalanceSuggestion[] = [];

  Object.entries(targetAllocation).forEach(([ticker, targetPct]) => {
    const existing = holdings.find((h) => h.ticker === ticker);
    const currentVal = existing ? existing.currentValue : 0;

    // Obtenemos el precio real (o fallback al histórico si no hay live)
    const price =
      currentPrices[ticker] ||
      (existing ? existing.currentValue / existing.totalQuantity : 0);

    const currentPct = (currentVal / totalPortfolioValue) * 100;
    const targetVal = totalPortfolioValue * (targetPct / 100);
    const diffVal = targetVal - currentVal;

    if (Math.abs(diffVal) < 10) return;

    suggestions.push({
      ticker,
      currentPct,
      targetPct,
      action: diffVal > 0 ? 'BUY' : 'SELL',
      amount: Math.abs(diffVal),
      // Calculamos acciones: Dinero / Precio Unitario
      quantity: price > 0 ? Math.abs(diffVal) / price : 0,
    });
  });

  return suggestions.sort((a, b) => b.amount - a.amount);
}
