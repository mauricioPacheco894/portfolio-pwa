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
    const fees = tx.fees ? Number(tx.fees) : 0;

    if (tx.type === 'BUY') {
      // Al comprar, actualizamos el Costo Promedio Ponderado incluyendo comisiones
      const newTotalQuantity = position.totalQuantity + qty;
      // Costo total de esta compra = (Cantidad * Precio) + Comisión
      const transactionCost = qty * price + fees;

      // Nuevo Costo Promedio = ((Cant. Actual * Costo Prom.) + Costo Transacción) / Total Nuevo
      if (newTotalQuantity > 0) {
        position.averageCost =
          (position.totalQuantity * position.averageCost + transactionCost) /
          newTotalQuantity;
      }
      position.totalQuantity = newTotalQuantity;
      position.totalInvested = position.totalQuantity * position.averageCost;
    } else if (tx.type === 'SELL') {
      // Al vender, realizamos ganancia/pérdida DESPUÉS de comisiones
      // Valor de Venta Bruto = Cantidad * Precio
      const grossSaleValue = qty * price;
      // Costo de los activos vendidos
      const costBasis = qty * position.averageCost;

      // Ganancia Neta = (Venta Bruta - Costo Base) - Comisión de Venta
      const realizedGain = grossSaleValue - costBasis - fees;

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

import { normalizeTicker } from './tickerMapping';

// Calcula sugerencias de rebalanceo basado en la asignación objetivo
export function calculateRebalancing(
  holdings: AssetPosition[],
  targetAllocation: Record<string, number>,
  totalPortfolioValue: number,
  currentPrices: Record<string, number>
): RebalanceSuggestion[] {
  if (!targetAllocation || totalPortfolioValue === 0) return [];

  const suggestions: RebalanceSuggestion[] = [];

  // 1. Consolidar holdings actuales por ticker normalizado
  // Mapa: TickerNormalizado -> ValorTotalEnUSD (marketValueGlobal)
  const consolidatedValues: Record<string, number> = {};

  // Extraemos las claves de los targets para ayudar a la inferencia (Inyección de dependencia)
  const targetKeys = Object.keys(targetAllocation);

  holdings.forEach((h) => {
    // Aquí pasamos los targets conocidos para que normalizeTicker sepa que VUAAN -> VUAA
    const normTicker = normalizeTicker(h.ticker, targetKeys);

    // Usamos marketValueGlobal para sumar peras con peras (todo en USD)
    const val = h.marketValueGlobal || h.currentValue;
    consolidatedValues[normTicker] =
      (consolidatedValues[normTicker] || 0) + val;
  });

  Object.entries(targetAllocation).forEach(([targetTicker, targetPct]) => {
    // Normalizamos target también para consistencia
    const normTarget = normalizeTicker(targetTicker, targetKeys);

    // El valor actual es la suma de todas las variantes (NU + NUN + NUN.MX...)
    const currentVal = consolidatedValues[normTarget] || 0;

    // Precio para calcular "cantidad de acciones":
    // Intentamos obtener el precio del ticker objetivo específico, o del normalizado
    // Ojo: Esto es una estimación. Si el usuario compra NUN (pesos) vs NU (dólares), el *número* de acciones diferirá por el tipo de cambio.
    // Aquí usamos el precio del targetTicker original si existe en currentPrices, sino una media.
    const price = currentPrices[targetTicker] || currentPrices[normTarget] || 0;

    const currentPct = (currentVal / totalPortfolioValue) * 100;
    const targetVal = totalPortfolioValue * (targetPct / 100);
    const diffVal = targetVal - currentVal;

    // LÓGICA DE BANDAS DINÁMICAS GENERALIZADA
    // Determinar Acción: BUY, SELL o HOLD
    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';

    // Tolerancia dinámica basada en el tamaño de la posición (evita hardcodear 7.5% o 5%)
    // - Posiciones pequeñas (<= 6%): Tolerancia más ajustada (+2.5%)
    // - Posiciones grandes (> 6%): Tolerancia estándar (+3.0%)
    const tolerance = targetPct <= 6.0 ? 2.5 : 3.0;

    // Umbral de venta
    const sellThreshold = targetPct + tolerance;

    if (currentPct >= sellThreshold) {
      action = 'SELL';
    }
    // Compra (Underweight)
    else if (currentPct < targetPct) {
      action = 'BUY';
    }
    // Mantener (Dentro de banda de tolerancia)
    else {
      action = 'HOLD';
    }

    // Solo generamos sugerencia si la acción NO es HOLD y el monto vale la pena (> $10)
    if (action !== 'HOLD' && Math.abs(diffVal) > 10) {
      suggestions.push({
        ticker: targetTicker,
        currentPct,
        targetPct,
        action: action as 'BUY' | 'SELL', // Cast for now, as types/portfolio only has BUY/SELL usually
        amount: Math.abs(diffVal),
        quantity: price > 0 ? Math.abs(diffVal) / price : 0,
      });
    }
  });

  return suggestions.sort((a, b) => b.amount - a.amount);
}
