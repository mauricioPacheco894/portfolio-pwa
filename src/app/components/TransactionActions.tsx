'use client'

import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Trash2, Edit2 } from 'lucide-react'
import { useState } from 'react'

type Props = {
  transactionId: string
  onEdit?: (id: string) => void
}

export default function TransactionActions({ transactionId, onEdit }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta transacción?')) {
      return
    }

    setLoading(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        alert('Debes estar autenticado para eliminar')
        setLoading(false)
        return
      }

      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', transactionId)
        .eq('user_id', user.id)

      if (error) {
        console.error('Delete error:', error)
        alert('Error al eliminar: ' + error.message)
        setLoading(false)
        return
      }

      router.refresh()
    } catch (err) {
      console.error('Delete exception:', err)
      alert('Error al eliminar la transacción')
      setLoading(false)
    }
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={handleDelete}
        disabled={loading}
        className="inline-flex items-center gap-1 rounded px-2 py-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
        title="Eliminar"
      >
        <Trash2 size={16} />
      </button>
    </div>
  )
}
