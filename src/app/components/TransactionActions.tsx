'use client';

import { Edit2,Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { supabase } from '@/lib/supabase';
import { Database } from '@/types/supabase';

import TransactionFormModal, { TransactionData } from './TransactionFormModal';

type Transaction = Database['public']['Tables']['transactions']['Row'];

type Props = {
  transaction: Transaction;
  portfolioId: string;
};

export default function TransactionActions({
  transaction,
  portfolioId,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const handleDelete = async () => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta transacción?')) {
      return;
    }

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert('Debes estar autenticado para eliminar');
        setLoading(false);
        return;
      }

      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', transaction.id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Delete error:', error);
        alert('Error al eliminar: ' + error.message);
        setLoading(false);
        return;
      }

      router.refresh();
    } catch (err) {
      console.error('Delete exception:', err);
      alert('Error al eliminar la transacción');
      setLoading(false);
    }
  };

  // Mapear transaction de Supabase a TransactionData del Form
  const transactionData: TransactionData = {
    id: transaction.id,
    ticker: transaction.ticker,
    type: transaction.type,
    quantity: transaction.quantity,
    price_per_unit: transaction.price_per_unit,
    fees: transaction.fees || 0,
    date: transaction.date,
    portfolio_id: portfolioId,
  };

  return (
    <>
      <div className="flex gap-2">
        <button
          onClick={() => setIsEditOpen(true)}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-zinc-500 hover:bg-zinc-100 hover:text-blue-600 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-blue-400"
          title="Editar"
        >
          <Edit2 size={16} />
        </button>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
          title="Eliminar"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <TransactionFormModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        portfolioId={portfolioId}
        initialData={transactionData}
      />
    </>
  );
}
