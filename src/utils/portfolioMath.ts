// Definimos la estructura de una "Posición"
export interface AssetPosition {
  ticker: string
  totalQuantity: number
  averageCost: number
  totalInvested: number
  currentValue: number // Por ahora usaremos el último precio pagado como referencia
  plDollars: number // Ganancia/Pérdida en dinero
  plPercentage: number // Ganancia/Pérdida en %
}

interface Transaction {
  ticker: string
  type: 'BUY' | 'SELL'
  quantity: number
  price_per_unit: number
  date: string
}

export function calculateHoldings(transactions: Transaction[]): AssetPosition[] {
  const assets: Record<string, AssetPosition> = {}

  // Ordenamos cronológicamente (más antiguo a más nuevo) para calcular bien el promedio
  const sortedTx = [...transactions].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  for (const tx of sortedTx) {
    const ticker = tx.ticker.toUpperCase()
    
    // Si es el primer movimiento de este activo, inicializamos
    if (!assets[ticker]) {
      assets[ticker] = {
        ticker,
        totalQuantity: 0,
        averageCost: 0,
        totalInvested: 0,
        currentValue: 0,
        plDollars: 0,
        plPercentage: 0
      }
    }

    const position = assets[ticker]
    const qty = Number(tx.quantity)
    const price = Number(tx.price_per_unit)

    if (tx.type === 'BUY') {
      // Al comprar, actualizamos el Costo Promedio Ponderado
      const newTotalQuantity = position.totalQuantity + qty
      // Nuevo Costo Promedio = ((Cant. Actual * Costo Prom.) + (Nueva Cant. * Nuevo Precio)) / Total Nuevo
      position.averageCost = ((position.totalQuantity * position.averageCost) + (qty * price)) / newTotalQuantity
      position.totalQuantity = newTotalQuantity
      position.totalInvested = position.totalQuantity * position.averageCost
    } else if (tx.type === 'SELL') {
      // Al vender, solo reducimos cantidad, el costo promedio NO cambia
      // (La ganancia/pérdida se realiza, pero el costo base de lo que queda es el mismo)
      position.totalQuantity -= qty
      position.totalInvested = position.totalQuantity * position.averageCost
    }
    
    // Actualizamos el "precio actual" con el último precio de transacción
    position.currentValue = position.totalQuantity * price
  }

  // Convertimos el objeto en array, filtramos los que ya vendimos todo (cantidad 0) y calculamos P/L
  return Object.values(assets)
    .filter(asset => asset.totalQuantity > 0.000001) // Evitamos errores de punto flotante
    .map(asset => {
      // Ganancia no realizada
      asset.plDollars = asset.currentValue - asset.totalInvested
      asset.plPercentage = asset.totalInvested > 0 ? (asset.plDollars / asset.totalInvested) * 100 : 0
      return asset
    })
}
