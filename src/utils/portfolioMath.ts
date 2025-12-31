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
        realizedPL: 0,
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
      if (newTotalQuantity > 0) {
        position.averageCost =
          (position.totalQuantity * position.averageCost + qty * price) /
          newTotalQuantity;
      }
      position.totalQuantity = newTotalQuantity;
      position.totalInvested = position.totalQuantity * position.averageCost;
    } else if (tx.type === 'SELL') {
      // Al vender, realizamos ganancia/pérdida
      // P/L Realizado = (Precio Venta - Costo Promedio) * Cantidad Vendida
      const realizedGain = (price - position.averageCost) * qty;
      position.realizedPL = (position.realizedPL || 0) + realizedGain;

      position.totalQuantity -= qty;
      position.totalInvested = position.totalQuantity * position.averageCost;
    }

    // Actualizamos el "precio actual" con el último precio de transacción
    position.currentValue = position.totalQuantity * price;
  }

  // Convertimos el objeto en array
  return Object.values(assets).map((asset) => {
    // Ganancia no realizada (solo relevante si quantity > 0)
    asset.plDollars = asset.currentValue - asset.totalInvested;

    // Evitar división por cero
    asset.plPercentage =
      asset.totalInvested > 0.000001
        ? (asset.plDollars / asset.totalInvested) * 100
        : 0;

    // Detectar inconsistencias (Ventas > Compras)
    if (asset.totalQuantity < -0.000001) {
      asset.isNegative = true;
    }

    // Sanitizar valores para evitar NaN en la UI
    if (isNaN(asset.totalInvested) || !isFinite(asset.totalInvested))
      asset.totalInvested = 0;
    if (isNaN(asset.currentValue) || !isFinite(asset.currentValue))
      asset.currentValue = 0;
    if (isNaN(asset.plDollars) || !isFinite(asset.plDollars))
      asset.plDollars = 0;
    if (isNaN(asset.plPercentage) || !isFinite(asset.plPercentage))
      asset.plPercentage = 0;
    if (
      asset.realizedPL &&
      (isNaN(asset.realizedPL) || !isFinite(asset.realizedPL))
    )
      asset.realizedPL = 0;

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
      (existing && existing.totalQuantity > 0
        ? existing.currentValue / existing.totalQuantity
        : 0);

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
