import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import toast from 'react-hot-toast';

import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { TransactionFormData } from '@/types/portfolio';

interface UseTransactionOptions {
  portfolioId: string;
  onSuccess?: () => void;
}

export function useTransaction({
  portfolioId,
  onSuccess,
}: UseTransactionOptions) {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createTransaction = async (
    data: Omit<TransactionFormData, 'id' | 'portfolio_id'>
  ) => {
    if (!user) {
      toast.error('Debes iniciar sesión');
      return { success: false, error: 'Not authenticated' };
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        portfolio_id: portfolioId,
        user_id: user.id,
        ticker: data.ticker.toUpperCase(),
        type: data.type,
        quantity: data.quantity,
        price_per_unit: data.price_per_unit,
        fees: data.fees || 0,
        date: data.date
          ? new Date(data.date).toISOString()
          : new Date().toISOString(),
      };

      const { error: insertError } = await supabase
        .from('transactions')
        .insert([payload]);

      if (insertError) {
        throw new Error(insertError.message);
      }

      toast.success('Transacción agregada');
      await queryClient.invalidateQueries({
        queryKey: ['transactions', portfolioId],
      });
      router.refresh();
      onSuccess?.();
      return { success: true };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al crear transacción';
      setError(message);
      toast.error(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  const updateTransaction = async (
    id: string,
    data: Partial<TransactionFormData>
  ) => {
    if (!user) {
      toast.error('Debes iniciar sesión');
      return { success: false, error: 'Not authenticated' };
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        ...(data.ticker && { ticker: data.ticker.toUpperCase() }),
        ...(data.type && { type: data.type }),
        ...(data.quantity !== undefined && { quantity: data.quantity }),
        ...(data.price_per_unit !== undefined && {
          price_per_unit: data.price_per_unit,
        }),
        ...(data.fees !== undefined && { fees: data.fees }),
        ...(data.date && { date: new Date(data.date).toISOString() }),
      };

      const { error: updateError } = await supabase
        .from('transactions')
        .update(payload)
        .eq('id', id)
        .eq('user_id', user.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      toast.success('Transacción actualizada');
      await queryClient.invalidateQueries({
        queryKey: ['transactions', portfolioId],
      });
      router.refresh();
      onSuccess?.();
      return { success: true };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al actualizar transacción';
      setError(message);
      toast.error(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  const deleteTransaction = async (id: string) => {
    if (!user) {
      toast.error('Debes iniciar sesión');
      return { success: false, error: 'Not authenticated' };
    }

    setLoading(true);
    setError(null);

    try {
      const { error: deleteError } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      toast.success('Transacción eliminada');
      await queryClient.invalidateQueries({
        queryKey: ['transactions', portfolioId],
      });
      router.refresh();
      onSuccess?.();
      return { success: true };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al eliminar transacción';
      setError(message);
      toast.error(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    createTransaction,
    updateTransaction,
    deleteTransaction,
  };
}
