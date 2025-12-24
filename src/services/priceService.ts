import YahooFinance from 'yahoo-finance2'

const yahooFinance = new YahooFinance()

export async function getCurrentPrices(tickers: string[]): Promise<Record<string, number>> {
  if (tickers.length === 0) return {}

  // Eliminamos duplicados
  const uniqueTickers = Array.from(new Set(tickers))
  const priceMap: Record<string, number> = {}

  try {
    // Pedimos todos los precios en una sola llamada
    const results = await yahooFinance.quote(uniqueTickers)

    // Normalizamos a array
    const quotes = Array.isArray(results) ? results : [results]

    quotes.forEach((quote: any) => {
      if (quote.symbol && quote.regularMarketPrice) {
        priceMap[quote.symbol] = quote.regularMarketPrice
      }
    })
  } catch (error) {
    console.error('Error fetching prices from Yahoo:', error)
    // Si falla, devolvemos mapa vacío y usamos precios históricos como fallback
  }

  return priceMap
}
