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
  const [isOpen, setIsOpen] = useState(false)

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

      // Crear una promesa con timeout
      const insertPromise = supabase.from('transactions').insert([
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

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('La solicitud tardó demasiado. Verifica tu conexión.')), 10000)
      )

      const { error: insertError } = await Promise.race([insertPromise, timeoutPromise]) as any

      if (insertError) {
        throw new Error(insertError.message)
      }

      // Reset y cerrar
      setTicker('')
      setQuantity('')
      setPrice('')
      setFees('')
      setDate('')
      setIsOpen(false)

      router.refresh()
    } catch (err) {
      console.error(err)
      setError('Error al crear la transacción')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 py-4 text-sm font-medium text-zinc-500 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-600 dark:border-zinc-700 dark:bg-zinc-800/50 dark:hover:border-blue-500/50 dark:hover:bg-blue-900/10 dark:hover:text-blue-400 transition-all"
      >
        <PlusCircle size={20} />
        Agregar Nueva Transacción
      </button>
    )
  }

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-zinc-800 dark:border-zinc-700">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Agregar Transacción</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          Cancelar
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            placeholder="Ticker (ej: AAPL)"
            required
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm bg-white dark:border-zinc-600 dark:bg-zinc-700 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
            autoFocus
          />

          <select
            value={type}
            onChange={(e) => setType(e.target.value as 'BUY' | 'SELL')}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm bg-white dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
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
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm bg-white dark:border-zinc-600 dark:bg-zinc-700 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
          />

          <input
            type="number"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
            placeholder="Precio unitario"
            required
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm bg-white dark:border-zinc-600 dark:bg-zinc-700 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
          />

          <input
            type="number"
            step="0.01"
            value={fees}
            onChange={(e) => setFees(e.target.value === '' ? '' : Number(e.target.value))}
            placeholder="Comisión (opcional)"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm bg-white dark:border-zinc-600 dark:bg-zinc-700 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
          />

          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm bg-white dark:border-zinc-600 dark:bg-zinc-700 dark:text-white dark:[color-scheme:dark]"
          />
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}

        <button
          type="submit"
          disabled={loading}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <PlusCircle size={18} />
          {loading ? 'Guardando...' : 'Agregar'}
        </button>
      </form>
    </div>
  )
}
