import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import AddTransactionForm from '@/app/components/AddTransactionForm'

interface Transaction {
  id: string
  ticker: string
  type: 'BUY' | 'SELL'
  quantity: number
  price_per_unit: number
  date: string
}

interface Portfolio {
  id: string
  name: string
}

async function getPortfolio(id: string) {
  const { data, error } = await supabase
    .from('portfolios')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('Error fetching portfolio:', error.message, error.code)
    return null
  }
  return data as Portfolio
}

async function getTransactions(portfolioId: string) {
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

  console.log('[Portfolio Detail] Loading with ID:', id)

  const portfolio = await getPortfolio(id)
  const transactions = await getTransactions(id)

  if (!portfolio) {
    console.error('[Portfolio Detail] Portfolio not found for ID:', id)
    return notFound()
  }

  console.log('[Portfolio Detail] Loaded:', portfolio.name)

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-black dark:to-zinc-900">
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link href="/" className="mb-4 inline-block text-sm text-blue-600 hover:underline dark:text-blue-400">
            ← Volver a mis portafolios
          </Link>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">{portfolio.name}</h1>
        </div>

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
                  <th className="px-4 py-3">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y bg-white dark:divide-zinc-700 dark:bg-zinc-800">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-zinc-600 dark:text-zinc-400">
                      No hay transacciones registradas aún
                    </td>
                  </tr>
                ) : (
                  transactions.map((t) => {
                    const qty = Number(t.quantity)
                    const price = Number(t.price_per_unit)
                    const total = (qty * price).toFixed(2)

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
                        <td className="px-4 py-3 font-medium">${total}</td>
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
