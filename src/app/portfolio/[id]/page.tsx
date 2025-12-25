import { createClient } from '@/lib/supabaseServer'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import AddTransactionForm from '@/app/components/AddTransactionForm'
import TransactionActions from '@/app/components/TransactionActions'
import AllocationChart from '@/app/components/AllocationChart'
import TargetAllocationEditor from '@/app/components/TargetAllocationEditor'
import PortfolioManagementTable from '@/app/components/PortfolioManagementTable'
import IntegratedChart from '@/app/components/IntegratedChart'
import { calculateHoldings, calculateRebalancing } from '@/utils/portfolioMath'
import { getCurrentPrices } from '@/services/priceService'
import { Header } from '@/app/components/Header'

interface Transaction {
  id: string
  ticker: string
  type: 'BUY' | 'SELL'
  quantity: number
  price_per_unit: number
  fees?: number
  date: string
}

interface Portfolio {
  id: string
  name: string
  target_allocation?: Record<string, number>
  created_at: string
}

async function getPortfolio(id: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('portfolios')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('[getPortfolio] Query error:', error.message)
    return null
  }

  return data as Portfolio
}

async function getTransactions(portfolioId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('portfolio_id', portfolioId)
    .order('date', { ascending: false })

  if (error) {
    console.error('Error fetching transactions', error)
    return []
  }
  return data as Transaction[]
}

type Props = {
  params: Promise<{ id: string }>
}

export default async function Page({ params }: Props) {
  const { id } = await params

  const portfolio = await getPortfolio(id)

  if (!portfolio) {
    return notFound()
  }

  const transactions = await getTransactions(id)
  let holdings = calculateHoldings(transactions)

  // Obtener precios en tiempo real
  const tickers = holdings.map(h => h.ticker)
  const currentPrices = await getCurrentPrices(tickers)

  // Actualizar holdings con precios reales
  holdings = holdings.map(asset => {
    const livePrice = currentPrices[asset.ticker]

    if (livePrice) {
      const newVal = asset.totalQuantity * livePrice
      return {
        ...asset,
        marketPrice: livePrice,
        currentValue: newVal,
        plDollars: newVal - asset.totalInvested,
        plPercentage: asset.totalInvested > 0
          ? ((newVal - asset.totalInvested) / asset.totalInvested) * 100
          : 0,
      }
    }
    return asset
  })

  const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0)
  const rebalanceSuggestions = calculateRebalancing(
    holdings,
    portfolio.target_allocation || {},
    totalValue,
    currentPrices
  )
  const uniqueTickers = Array.from(new Set(holdings.map(h => h.ticker)))

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-black dark:to-zinc-900">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link href="/" className="mb-3 inline-block text-sm text-blue-600 hover:underline dark:text-blue-400">
            ← Volver a mis portafolios
          </Link>
          <div className="flex items-baseline justify-between gap-4 flex-wrap">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{portfolio.name}</h1>

            {/* KPIs Horizontales */}
            <div className="flex items-center gap-4 text-sm flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-zinc-500 dark:text-zinc-400">Valor:</span>
                <span className="font-bold text-zinc-900 dark:text-white">
                  ${holdings.reduce((sum, h) => sum + h.currentValue, 0).toFixed(2)}
                </span>
              </div>

              <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-600" />

              <div className="flex items-center gap-2">
                <span className="text-zinc-500 dark:text-zinc-400">Invertido:</span>
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                  ${holdings.reduce((sum, h) => sum + h.totalInvested, 0).toFixed(2)}
                </span>
              </div>

              <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-600" />

              <div className="flex items-center gap-2">
                <span className="text-zinc-500 dark:text-zinc-400">Ganancia:</span>
                <span className={`font-bold ${holdings.reduce((sum, h) => sum + h.plDollars, 0) >= 0
                  ? 'text-green-600'
                  : 'text-red-600'
                  }`}>
                  {holdings.reduce((sum, h) => sum + h.plDollars, 0) >= 0 ? '+' : ''}
                  ${holdings.reduce((sum, h) => sum + h.plDollars, 0).toFixed(2)}
                </span>
                <span className={`text-xs font-semibold ${holdings.length > 0 && holdings[0].totalInvested > 0
                  ? holdings.reduce((sum, h) => sum + h.plPercentage * h.totalInvested, 0) / holdings.reduce((sum, h) => sum + h.totalInvested, 0) >= 0
                    ? 'text-green-600'
                    : 'text-red-600'
                  : 'text-zinc-500'
                  }`}>
                  ({holdings.length > 0 && holdings.reduce((sum, h) => sum + h.totalInvested, 0) > 0
                    ? ((holdings.reduce((sum, h) => sum + h.plDollars, 0) / holdings.reduce((sum, h) => sum + h.totalInvested, 0)) * 100).toFixed(2)
                    : '0.00'}%)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabla Maestra de Gestión Unificada */}
        <section className="mb-6">
          <PortfolioManagementTable
            holdings={holdings}
            currentTarget={portfolio.target_allocation || undefined}
            rebalanceSuggestions={rebalanceSuggestions}
            portfolioId={id}
            availableTickers={uniqueTickers}
            totalValue={holdings.reduce((sum, h) => sum + h.currentValue, 0)}
          />
        </section>

        {/* Sección de Posiciones con Gráfica Integrada */}
        <section className="mb-6">
          <h2 className="mb-3 text-lg font-semibold text-zinc-800 dark:text-zinc-100">Mis Posiciones</h2>
          <div className="rounded-xl border bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Tabla de Posiciones Detallada (Ocupa 2 columnas) */}
              <div className="overflow-auto max-h-96 lg:col-span-2 scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-600">
                <table className="w-full text-left text-sm relative">
                  <thead className="sticky top-0 z-10 bg-zinc-50 text-xs uppercase text-zinc-500 shadow-sm dark:bg-zinc-900 dark:text-zinc-400">
                    <tr>
                      <th className="px-3 py-2 bg-zinc-50 dark:bg-zinc-900">Activo</th>
                      <th className="px-3 py-2 text-right bg-zinc-50 dark:bg-zinc-900">Cant.</th>
                      <th className="px-3 py-2 text-right bg-zinc-50 dark:bg-zinc-900">Costo Prom.</th>
                      <th className="px-3 py-2 text-right bg-zinc-50 dark:bg-zinc-900">Precio</th>
                      <th className="px-3 py-2 text-right bg-zinc-50 dark:bg-zinc-900">Valor</th>
                      <th className="px-3 py-2 text-right bg-zinc-50 dark:bg-zinc-900">G/P</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                    {holdings.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-4 text-center text-zinc-500 dark:text-zinc-400">
                          Agrega transacciones para ver tus posiciones.
                        </td>
                      </tr>
                    ) : (
                      holdings.map((asset) => (
                        <tr key={asset.ticker} className="hover:bg-zinc-50 dark:hover:bg-zinc-700/50">
                          <td className="px-3 py-2 font-bold text-zinc-900 dark:text-white">{asset.ticker}</td>
                          <td className="px-3 py-2 text-right text-zinc-600 dark:text-zinc-400">{asset.totalQuantity.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right text-zinc-500 dark:text-zinc-500">${asset.averageCost.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right text-zinc-600 dark:text-zinc-400">
                            <div className="flex items-center justify-end gap-1">
                              ${asset.marketPrice ? asset.marketPrice.toFixed(2) : (asset.currentValue / asset.totalQuantity).toFixed(2)}
                              {asset.marketPrice && (
                                <span className="text-[10px] font-bold text-blue-500" title="Precio en tiempo real">LIVE</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-zinc-900 dark:text-white">
                            ${asset.currentValue.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className={`text-xs font-bold ${asset.plDollars >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {asset.plDollars >= 0 ? '+' : ''}{asset.plPercentage.toFixed(1)}%
                            </div>
                            <div className={`text-[10px] ${asset.plDollars >= 0 ? 'text-green-600/80' : 'text-red-600/80'}`}>
                              {asset.plDollars >= 0 ? '+' : ''}${asset.plDollars.toFixed(0)}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Gráfica de Distribución Integrada (Ocupa 1 columna) */}
              <div className="flex flex-col justify-center border-t pt-4 lg:border-t-0 lg:border-l lg:pl-4 lg:pt-0 dark:border-zinc-700">
                <h3 className="mb-2 text-center text-sm font-semibold text-zinc-700 dark:text-zinc-200">Distribución</h3>
                <IntegratedChart holdings={holdings} />
              </div>
            </div>
          </div>
        </section>

        <section className="mb-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">Transacciones</h2>
            <AddTransactionForm portfolioId={id} />
          </div>

          <div className="overflow-auto max-h-[500px] rounded-lg border dark:border-zinc-700 scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-600">
            <table className="w-full table-auto text-sm relative">
              <thead className="sticky top-0 z-10 bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-600 shadow-sm dark:bg-zinc-800 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3 bg-zinc-50 dark:bg-zinc-800">Fecha</th>
                  <th className="px-4 py-3 bg-zinc-50 dark:bg-zinc-800">Ticker</th>
                  <th className="px-4 py-3 bg-zinc-50 dark:bg-zinc-800">Tipo</th>
                  <th className="px-4 py-3 bg-zinc-50 dark:bg-zinc-800">Cantidad</th>
                  <th className="px-4 py-3 bg-zinc-50 dark:bg-zinc-800">Precio Unit.</th>
                  <th className="px-4 py-3 bg-zinc-50 dark:bg-zinc-800">Comisión</th>
                  <th className="px-4 py-3 bg-zinc-50 dark:bg-zinc-800">Total</th>
                  <th className="px-4 py-3 bg-zinc-50 dark:bg-zinc-800">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y bg-white dark:divide-zinc-700 dark:bg-zinc-800">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center text-zinc-600 dark:text-zinc-400">
                      No hay transacciones registradas aún
                    </td>
                  </tr>
                ) : (
                  transactions.map((t) => {
                    const qty = Number(t.quantity)
                    const price = Number(t.price_per_unit)
                    const fees = t.fees ? Number(t.fees) : 0
                    const total = (qty * price + fees).toFixed(2)

                    return (
                      <tr key={t.id}>
                        <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400">
                          {new Date(t.date).toLocaleDateString('es-ES')}
                        </td>
                        <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">{t.ticker}</td>
                        <td className="px-4 py-3">
                          {t.type === 'BUY' ? (
                            <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800 dark:bg-green-900/20 dark:text-green-400">
                              Compra
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800 dark:bg-red-900/20 dark:text-red-400">
                              Venta
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">{qty}</td>
                        <td className="px-4 py-3">${price.toFixed(2)}</td>
                        <td className="px-4 py-3">${fees.toFixed(2)}</td>
                        <td className="px-4 py-3 font-medium">${total}</td>
                        <td className="px-4 py-3">
                          <TransactionActions transaction={t} portfolioId={id} />
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>


      </main>
    </div>
  )
}
