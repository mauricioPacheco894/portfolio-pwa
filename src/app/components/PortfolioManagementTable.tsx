'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Edit2, Check, X, PlusCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface AssetPosition {
    ticker: string
    currentValue: number
    totalInvested: number
}

interface RebalanceSuggestion {
    ticker: string
    currentPct: number
    targetPct: number
    action: 'BUY' | 'SELL' | 'HOLD'
    amount: number
    quantity?: number
}

interface PortfolioManagementTableProps {
    holdings: AssetPosition[]
    currentTarget: Record<string, number> | undefined
    rebalanceSuggestions: RebalanceSuggestion[]
    portfolioId: string
    availableTickers: string[]
    totalValue: number
}

export default function PortfolioManagementTable({
    holdings,
    currentTarget,
    rebalanceSuggestions,
    portfolioId,
    availableTickers,
    totalValue
}: PortfolioManagementTableProps) {
    const router = useRouter()
    const [allocation, setAllocation] = useState<Record<string, number>>(currentTarget || {})
    const [editingTicker, setEditingTicker] = useState<string | null>(null)
    const [editValue, setEditValue] = useState('')
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState('')

    // Para agregar nuevos tickers
    const [ticker, setTicker] = useState('')
    const [percentage, setPercentage] = useState('')



    const handleStartEdit = (ticker: string, currentValue: number) => {
        setEditingTicker(ticker)
        setEditValue(currentValue.toString())
    }

    const handleCancelEdit = () => {
        setEditingTicker(null)
        setEditValue('')
    }

    const handleSaveEdit = () => {
        const newVal = parseFloat(editValue)
        if (isNaN(newVal) || newVal < 0 || newVal > 100) {
            return
        }
        if (editingTicker) {
            setAllocation({ ...allocation, [editingTicker]: newVal })
        }
        handleCancelEdit()
    }

    const handleAdd = () => {
        const trimmedTicker = ticker.trim().toUpperCase()
        const pct = parseFloat(percentage)

        if (!trimmedTicker || isNaN(pct) || pct <= 0 || pct > 100) {
            return
        }

        setAllocation({ ...allocation, [trimmedTicker]: pct })
        setTicker('')
        setPercentage('')
    }

    const handleSaveStrategy = async () => {
        setError('')
        setIsSaving(true)

        const total = Object.values(allocation).reduce((a, b) => a + b, 0)
        if (Math.abs(total - 100) > 0.01) {
            setError(`La asignación suma ${total.toFixed(2)}%, debe ser 100%`)
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

    // Crear mapa de datos combinados
    const allTickers = new Set([...holdings.map(h => h.ticker), ...Object.keys(allocation)])
    const tableData = Array.from(allTickers).map(ticker => {
        const holding = holdings.find(h => h.ticker === ticker)
        const suggestion = rebalanceSuggestions.find(s => s.ticker === ticker)
        const currentPct = holding ? (holding.currentValue / totalValue) * 100 : 0
        const targetPct = allocation[ticker] || 0

        return {
            ticker,
            currentValue: holding?.currentValue || 0,
            currentPct,
            targetPct,
            suggestion
        }
    })

    return (
        <div className="rounded-xl border bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
            <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-semibold text-zinc-900 dark:text-white">Gestión de Portafolio</h3>
                <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${Math.abs(total - 100) < 0.01 ? 'text-green-600' : 'text-amber-600'}`}>
                        Total: {total.toFixed(1)}%
                    </span>
                    {Math.abs(total - 100) >= 0.01 && (
                        <button
                            onClick={handleSaveStrategy}
                            disabled={isSaving}
                            className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                            {isSaving ? 'Guardando...' : 'Guardar Estrategia'}
                        </button>
                    )}
                </div>
            </div>

            {error && (
                <div className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                    {error}
                </div>
            )}

            <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                        <tr>
                            <th className="px-3 py-2 text-left">Activo</th>
                            <th className="px-3 py-2 text-right">Valor</th>
                            <th className="px-3 py-2 text-right">% Actual</th>
                            <th className="px-3 py-2 text-right">% Meta</th>
                            <th className="px-3 py-2 text-right">Diferencia</th>
                            <th className="px-3 py-2 text-center">Acción</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                        {tableData.map(row => (
                            <tr key={row.ticker} className="hover:bg-zinc-50 dark:hover:bg-zinc-700/50">
                                <td className="px-3 py-2 font-bold text-zinc-900 dark:text-white">{row.ticker}</td>
                                <td className="px-3 py-2 text-right font-mono text-zinc-700 dark:text-zinc-300">
                                    ${row.currentValue.toFixed(2)}
                                </td>
                                <td className="px-3 py-2 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <div className="h-1.5 w-16 rounded bg-zinc-200 dark:bg-zinc-600">
                                            <div
                                                className="h-full rounded bg-blue-500"
                                                style={{ width: `${Math.min(row.currentPct, 100)}%` }}
                                            />
                                        </div>
                                        <span className="text-xs text-zinc-600 dark:text-zinc-400">
                                            {row.currentPct.toFixed(1)}%
                                        </span>
                                    </div>
                                </td>
                                <td className="px-3 py-2 text-right">
                                    {editingTicker === row.ticker ? (
                                        <div className="flex items-center justify-end gap-1">
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
                                            <button onClick={handleSaveEdit} className="text-green-600 hover:text-green-700">
                                                <Check size={16} />
                                            </button>
                                            <button onClick={handleCancelEdit} className="text-zinc-400 hover:text-zinc-600">
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-end gap-2">
                                            <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                                                {row.targetPct.toFixed(1)}%
                                            </span>
                                            <button
                                                onClick={() => handleStartEdit(row.ticker, row.targetPct)}
                                                className="text-zinc-400 hover:text-blue-500"
                                                title="Editar"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                        </div>
                                    )}
                                </td>
                                <td className="px-3 py-2 text-right">
                                    {row.targetPct > 0 && (
                                        <span className={`text-xs font-semibold ${row.targetPct - row.currentPct > 0 ? 'text-blue-600' :
                                            row.targetPct - row.currentPct < 0 ? 'text-orange-600' :
                                                'text-zinc-500'
                                            }`}>
                                            {row.targetPct - row.currentPct >= 0 ? '+' : ''}
                                            {(row.targetPct - row.currentPct).toFixed(1)}%
                                        </span>
                                    )}
                                </td>
                                <td className="px-3 py-2 text-center">
                                    {row.suggestion && (
                                        <button
                                            className={`rounded px-2 py-1 text-xs font-bold ${row.suggestion.action === 'BUY'
                                                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400'
                                                : 'bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-400'
                                                }`}
                                        >
                                            {row.suggestion.action === 'BUY' ? 'Comprar' : 'Vender'} ${row.suggestion.amount.toFixed(0)}
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}

                        {/* Fila para agregar nuevo */}
                        <tr className="bg-zinc-50 dark:bg-zinc-900">
                            <td className="px-3 py-2">
                                <input
                                    type="text"
                                    placeholder="Ticker"
                                    className="w-full rounded border border-zinc-300 px-2 py-1 text-sm uppercase dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
                                    value={ticker}
                                    onChange={e => setTicker(e.target.value)}
                                    list="available-tickers"
                                    suppressHydrationWarning
                                />
                                <datalist id="available-tickers">
                                    {availableTickers.map(t => (
                                        <option key={t} value={t} />
                                    ))}
                                </datalist>
                            </td>
                            <td className="px-3 py-2" colSpan={2}></td>
                            <td className="px-3 py-2">
                                <input
                                    type="number"
                                    placeholder="%"
                                    min="0"
                                    max="100"
                                    className="w-full rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
                                    value={percentage}
                                    onChange={e => setPercentage(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                                    suppressHydrationWarning
                                />
                            </td>
                            <td className="px-3 py-2" colSpan={2}>
                                <button
                                    onClick={handleAdd}
                                    className="flex items-center gap-1 rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700"
                                >
                                    <PlusCircle size={14} />
                                    Agregar
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    )
}
