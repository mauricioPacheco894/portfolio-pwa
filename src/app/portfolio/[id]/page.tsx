import { createClient } from '@/lib/supabaseServer'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import AddTransactionForm from '@/app/components/AddTransactionForm'
import TransactionActions from '@/app/components/TransactionActions'
import AllocationChart from '@/app/components/AllocationChart'
import TargetAllocationEditor from '@/app/components/TargetAllocationEditor'
import { calculateHoldings, calculateRebalancing } from '@/utils/portfolioMath'

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
  const transactions = await getTransactions(id)
  const holdings = calculateHoldings(transactions)

  const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0)
  const rebalanceSuggestions = calculateRebalancing(
    holdings,
    portfolio.target_allocation || null,
    totalValue
  )
  const uniqueTickers = Array.from(new Set(holdings.map(h => h.ticker)))

  if (!portfolio) {
    return notFound()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-black dark:to-zinc-900">
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link href="/" className="mb-4 inline-block text-sm text-blue-600 hover:underline dark:text-blue-400">
            ← Volver a mis portafolios
          </Link>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">{portfolio.name}</h1>
        </div>

        {/* Sección de Resumen y Gráfico */}
        <section className="mb-8 grid gap-6 lg:grid-cols-3">
          {/* COLUMNA IZQUIERDA: Métricas Clave */}
          <div className="space-y-6">
            <div className="rounded-xl border bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
              <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Valor Total</h3>
              <p className="mt-2 text-4xl font-bold text-zinc-900 dark:text-white">
                ${holdings.reduce((sum, h) => sum + h.currentValue, 0).toFixed(2)}
              </p>
              <div className="mt-4 text-sm">
                <div className="text-zinc-600 dark:text-zinc-400">Total Invertido</div>
                <div className="font-semibold text-zinc-900 dark:text-white">
                  ${holdings.reduce((sum, h) => sum + h.totalInvested, 0).toFixed(2)}
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
              <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Ganancia/Pérdida</h3>
              <p className={`mt-2 text-3xl font-bold ${
                holdings.reduce((sum, h) => sum + h.plDollars, 0) >= 0
                  ? 'text-green-600'
                  : 'text-red-600'
              }`}>
                {holdings.reduce((sum, h) => sum + h.plDollars, 0) >= 0 ? '+' : ''}
                ${holdings.reduce((sum, h) => sum + h.plDollars, 0).toFixed(2)}
              </p>
              <div className="mt-4 text-sm">
                <div className={`font-semibold ${
                  holdings.length > 0 && holdings[0].totalInvested > 0
                    ? holdings.reduce((sum, h) => sum + h.plPercentage * h.totalInvested, 0) / holdings.reduce((sum, h) => sum + h.totalInvested, 0) >= 0
                      ? 'text-green-600'
                      : 'text-red-600'
                    : ''
                }`}>
                  {holdings.length > 0 && holdings.reduce((sum, h) => sum + h.totalInvested, 0) > 0
                    ? ((holdings.reduce((sum, h) => sum + h.plDollars, 0) / holdings.reduce((sum, h) => sum + h.totalInvested, 0)) * 100).toFixed(2)
                    : '0.00'}
                  %
                </div>
              </div>
            </div>
          </div>

          {/* COLUMNA DERECHA: Gráfica */}
          <div className="lg:col-span-2">
            <AllocationChart holdings={holdings} />
          </div>
        </section>

        {/* Sección de Rebalanceo */}
        <section className="mb-8 grid gap-6 lg:grid-cols-2">
          {/* Editor de Objetivo */}
          <TargetAllocationEditor
            portfolioId={id}
            currentTarget={portfolio.target_allocation || undefined}
            availableTickers={uniqueTickers}
          />

          {/* Sugerencias de Rebalanceo */}
          <div className="rounded-xl border bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
            <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">Plan de Rebalanceo</h3>

            {!portfolio.target_allocation ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Define tu objetivo a la izquierda para ver sugerencias.</p>
            ) : rebalanceSuggestions.length === 0 ? (
              <div className="flex h-48 items-center justify-center">
                <p className="text-center text-green-600 font-medium">✨ Tu portafolio está balanceado</p>
              </div>
            ) : (
              <div className="space-y-3">
                {rebalanceSuggestions.map(s => (
                  <div key={s.ticker} className="flex items-center justify-between border-b pb-3 last:border-0 dark:border-zinc-700">
                    <div>
                      <span className="font-bold text-zinc-900 dark:text-white">{s.ticker}</span>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        Actual: {s.currentPct.toFixed(1)}% → Meta: {s.targetPct}%
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block text-xs font-bold px-3 py-1 rounded mb-1 ${
                        s.action === 'BUY'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                      }`}>
                        {s.action === 'BUY' ? 'COMPRAR' : 'VENDER'}
                      </span>
                      <div className="font-mono text-sm font-semibold text-zinc-900 dark:text-white">
                        ${s.amount.toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Sección de Posiciones */}
        <section className="mb-8">
          <h2 className="mb-4 text-xl font-semibold text-zinc-800 dark:text-zinc-100">Mis Posiciones</h2>
          <div className="overflow-x-auto rounded-lg border bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="px-6 py-3">Activo</th>
                  <th className="px-6 py-3 text-right">Cantidad</th>
                  <th className="px-6 py-3 text-right">Costo Prom.</th>
                  <th className="px-6 py-3 text-right">Último Precio</th>
                  <th className="px-6 py-3 text-right">Valor Total</th>
                  <th className="px-6 py-3 text-right">Ganancia/Pérdida</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                {holdings.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-zinc-500 dark:text-zinc-400">
                      Agrega transacciones para ver tus posiciones.
                    </td>
                  </tr>
                ) : (
                  holdings.map((asset) => (
                    <tr key={asset.ticker}>
                      <td className="px-6 py-4 font-bold text-zinc-900 dark:text-white">{asset.ticker}</td>
                      <td className="px-6 py-4 text-right text-zinc-600 dark:text-zinc-400">{asset.totalQuantity.toFixed(4)}</td>
                      <td className="px-6 py-4 text-right text-zinc-600 dark:text-zinc-400">${asset.averageCost.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right text-zinc-600 dark:text-zinc-400">
                        ${(asset.currentValue / asset.totalQuantity).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-zinc-900 dark:text-white">
                        ${asset.currentValue.toFixed(2)}
                      </td>
                      <td className={`px-6 py-4 text-right font-medium ${asset.plDollars >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {asset.plDollars >= 0 ? '+' : ''}{asset.plDollars.toFixed(2)} ({asset.plPercentage.toFixed(2)}%)
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-xl font-semibold text-zinc-800 dark:text-zinc-100">Transacciones</h2>

          <div className="overflow-x-auto rounded-lg border dark:border-zinc-700">
            <table className="w-full table-auto text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Ticker</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Cantidad</th>
                  <th className="px-4 py-3">Precio Unit.</th>
                  <th className="px-4 py-3">Comisión</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Acciones</th>
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
                          <TransactionActions transactionId={t.id} />
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <AddTransactionForm portfolioId={id} />
        </section>
      </main>
    </div>
  )
}
