'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Trash2, Edit2, Check, X } from 'lucide-react'

interface Props {
  portfolioId: string
  currentTarget?: Record<string, number>
  availableTickers: string[]
}

export default function TargetAllocationEditor({ portfolioId, currentTarget, availableTickers }: Props) {
  const [allocation, setAllocation] = useState<Record<string, number>>(currentTarget || {})
  const [ticker, setTicker] = useState('')
  const [percentage, setPercentage] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [editingTicker, setEditingTicker] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const router = useRouter()

  const handleAdd = () => {
    if (!ticker || !percentage) return
    const pct = Number(percentage)
    if (pct <= 0 || pct > 100) {
      setError('El porcentaje debe estar entre 1 y 100')
      return
    }
    setError('')
    setAllocation(prev => ({
      ...prev,
      [ticker.toUpperCase()]: pct
    }))
    setTicker('')
    setPercentage('')
  }

  const handleRemove = (key: string) => {
    const newAlloc = { ...allocation }
    delete newAlloc[key]
    setAllocation(newAlloc)
  }

  const handleStartEdit = (ticker: string, currentPercentage: number) => {
    setEditingTicker(ticker)
    setEditValue(currentPercentage.toString())
  }

  const handleSaveEdit = () => {
    if (!editingTicker) return
    const newPct = Number(editValue)
    if (newPct <= 0 || newPct > 100) {
      setError('El porcentaje debe estar entre 1 y 100')
      return
    }
    setAllocation(prev => ({
      ...prev,
      [editingTicker]: newPct
    }))
    setEditingTicker(null)
    setEditValue('')
    setError('')
  }

  const handleCancelEdit = () => {
    setEditingTicker(null)
    setEditValue('')
  }


  const handleSave = async () => {
    setError('')
    setIsSaving(true)

    // Validamos que sume 100%
    const total = Object.values(allocation).reduce((a, b) => a + b, 0)
    if (total !== 100) {
      setError(`La asignación suma ${total}%, debería ser 100%`)
      setIsSaving(false)
      return
    }

    try {
      const { error: updateError } = await supabase
        .from('portfolios')
        .update({ target_allocation: allocation })
        .eq('id', portfolioId)

      if (updateError) {
        setError(updateError.message)
        setIsSaving(false)
        return
      }

      router.refresh()
    } catch (err) {
      setError('Error al guardar')
      console.error(err)
    } finally {
      setIsSaving(false)
    }
  }

  const total = Object.values(allocation).reduce((a, b) => a + b, 0)

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
      <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">Definir Objetivo (Target)</h3>

      {/* Lista actual */}
      {Object.entries(allocation).length > 0 && (
        <div className="mb-4 space-y-2">
          {Object.entries(allocation).map(([t, p]) => (
            <div key={t} className="flex items-center justify-between rounded bg-zinc-50 p-3 dark:bg-zinc-700">
              <div>
                <span className="font-semibold text-zinc-900 dark:text-white">{t}</span>
                <div className="mt-1 h-1.5 w-24 rounded bg-zinc-200 dark:bg-zinc-600">
                  <div
                    className="h-full rounded bg-blue-500"
                    style={{ width: `${p}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                {editingTicker === t ? (
                  <>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      className="w-16 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleSaveEdit()
                        if (e.key === 'Escape') handleCancelEdit()
                      }}
                      autoFocus
                    />
                    <button
                      onClick={handleSaveEdit}
                      className="text-green-600 hover:text-green-700"
                      title="Guardar"
                    >
                      <Check size={18} />
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="text-zinc-400 hover:text-zinc-600"
                      title="Cancelar"
                    >
                      <X size={18} />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">{p}%</span>
                    <button
                      onClick={() => handleStartEdit(t, p)}
                      className="text-zinc-400 hover:text-blue-500"
                      title="Editar"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => handleRemove(t)}
                      className="text-zinc-400 hover:text-red-500"
                      title="Eliminar"
                    >
                      <Trash2 size={18} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Inputs para agregar */}
      <div className="mb-4 space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Ticker (ej: AAPL)"
            className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
            value={ticker}
            onChange={e => setTicker(e.target.value.toUpperCase())}
            list="available-tickers"
          />
          <datalist id="available-tickers">
            {availableTickers.map(t => <option key={t} value={t} />)}
          </datalist>
          <input
            type="number"
            placeholder="%"
            min="0"
            max="100"
            className="w-20 rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
            value={percentage}
            onChange={e => setPercentage(e.target.value)}
          />
          <button
            onClick={handleAdd}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            +
          </button>
        </div>
      </div>

      {/* Indicador de suma */}
      {Object.entries(allocation).length > 0 && (
        <div className="mb-4 rounded bg-zinc-50 p-2 text-sm dark:bg-zinc-700">
          <span className={total === 100 ? 'text-green-600 font-semibold' : 'text-orange-600 font-semibold'}>
            Total: {total}%
          </span>
        </div>
      )}

      {error && <div className="mb-4 text-sm text-red-600">{error}</div>}

      <button
        onClick={handleSave}
        disabled={isSaving || Object.entries(allocation).length === 0}
        className="w-full rounded bg-zinc-900 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-100"
      >
        {isSaving ? 'Guardando...' : 'Guardar Estrategia'}
      </button>
    </div>
  )
}
