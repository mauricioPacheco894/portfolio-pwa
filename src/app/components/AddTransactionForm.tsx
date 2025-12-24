'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { PlusCircle } from 'lucide-react'

type Props = {
  portfolioId: string
}

export default function AddTransactionForm({ portfolioId }: Props) {
  const router = useRouter()
  const [ticker, setTicker] = useState('')
  const [type, setType] = useState<'BUY' | 'SELL'>('BUY')
  const [quantity, setQuantity] = useState<number | ''>('')
  const [price, setPrice] = useState<number | ''>('')
  const [fees, setFees] = useState<number | ''>('')
  const [date, setDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setError('Debes iniciar sesión para crear transacciones')
        setLoading(false)
        return
      }

      const { error: insertError } = await supabase.from('transactions').insert([
        {
          portfolio_id: portfolioId,
          user_id: user.id,
          ticker: ticker.toUpperCase(),
          type,
          quantity: Number(quantity),
          price_per_unit: Number(price),
          fees: fees ? Number(fees) : 0,
          date: date || new Date().toISOString(),
        },
      ])

      if (insertError) {
        setError(insertError.message)
        setLoading(false)
        return
      }

      // Reset
      setTicker('')
      setQuantity('')
      setPrice('')
      setFees('')
      setDate('')

      router.refresh()
    } catch (err) {
      console.error(err)
      setError('Error al crear la transacción')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-lg border bg-white p-6 shadow-sm dark:bg-zinc-800 dark:border-zinc-700">
      <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">Agregar Transacción</h3>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          value={ticker}
          onChange={(e) => setTicker(e.target.value)}
          placeholder="Ticker (ej: AAPL)"
          required
          className="col-span-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
        />

        <select
          value={type}
          onChange={(e) => setType(e.target.value as 'BUY' | 'SELL')}
          className="col-span-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
        >
          <option value="BUY">BUY</option>
          <option value="SELL">SELL</option>
        </select>

        <input
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
          placeholder="Cantidad"
          required
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
        />

        <input
          type="number"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
          placeholder="Precio unitario"
          required
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
        />

        <input
          type="number"
          step="0.01"
          value={fees}
          onChange={(e) => setFees(e.target.value === '' ? '' : Number(e.target.value))}
          placeholder="Comisión (opcional)"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
        />

        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="col-span-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
        />

        {error && <div className="col-span-2 text-sm text-red-600">{error}</div>}

        <button
          type="submit"
          disabled={loading}
          className="col-span-2 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <PlusCircle />
          {loading ? 'Guardando...' : 'Agregar'}
        </button>
      </form>
    </div>
  )
}
