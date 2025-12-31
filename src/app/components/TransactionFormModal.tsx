'use client';

import { PlusCircle, Save, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import toast from 'react-hot-toast';

import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export interface TransactionData {
  id?: string;
  ticker: string;
  type: 'BUY' | 'SELL';
  quantity: number;
  price_per_unit: number;
  fees: number;
  date: string;
  portfolio_id: string;
}

type Props = {
  isOpen: boolean;
  onClose: () => void;
  portfolioId: string;
  initialData?: TransactionData | null;
};

export default function TransactionFormModal({
  isOpen,
  onClose,
  portfolioId,
  initialData,
}: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const [isPending, startTransition] = useTransition();

  const [ticker, setTicker] = useState('');
  const [type, setType] = useState<'BUY' | 'SELL'>('BUY');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [price, setPrice] = useState<number | ''>('');
  const [fees, setFees] = useState<number | ''>('');
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Cargar datos si es edición
  useEffect(() => {
    if (isOpen && initialData) {
      setTicker(initialData.ticker);
      setType(initialData.type);
      setQuantity(initialData.quantity);
      setPrice(initialData.price_per_unit);
      setFees(initialData.fees || 0);
      // Formatear fecha para input type=date (YYYY-MM-DD)
      const dateObj = new Date(initialData.date);
      const formattedDate = dateObj.toISOString().split('T')[0];
      setDate(formattedDate);
    } else if (isOpen && !initialData) {
      // Reset para nueva transacción
      setTicker('');
      setType('BUY');
      setQuantity('');
      setPrice('');
      setFees('');
      setDate(new Date().toISOString().split('T')[0]);
    }
    setError('');
  }, [isOpen, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!user) {
      setError('Debes iniciar sesión');
      toast.error('Debes iniciar sesión');
      return;
    }

    setLoading(true);

    try {
      // Corregir problema de timezone: Crear fecha a mediodía local para evitar desfases
      // El input date regresa YYYY-MM-DD. Si usamos new Date(date), asume UTC 00:00
      // que en zonas horarias como UTC-6 resulta en el día anterior.
      let submitDate: string;
      if (date) {
        const [y, m, d] = date.split('-').map(Number);
        // Crear fecha en tiempo local a las 12:00 PM
        const localDate = new Date(y, m - 1, d, 12, 0, 0);
        submitDate = localDate.toISOString();
      } else {
        submitDate = new Date().toISOString();
      }

      const payload = {
        portfolio_id: portfolioId,
        user_id: user.id,
        ticker: ticker.toUpperCase(),
        type,
        quantity: Number(quantity),
        price_per_unit: Number(price),
        fees: fees ? Number(fees) : 0,
        date: submitDate,
      };

      let result;

      if (initialData?.id) {
        // UPDATE
        result = await supabase
          .from('transactions')
          .update(payload)
          .eq('id', initialData.id)
          .select();
      } else {
        // INSERT
        result = await supabase.from('transactions').insert([payload]).select();
      }

      const { data: opData, error: opError } = result;

      if (opError) {
        throw new Error(opError.message);
      }

      // Verificación de que realmente se guardó algo
      if (opData && opData.length === 0) {
        throw new Error(
          'Operación exitosa pero ningún dato fue modificado. Verifica permisos.'
        );
      }

      // UI Optimista: Éxito inmediato
      toast.success(
        initialData ? 'Transacción actualizada' : 'Transacción agregada'
      );
      onClose();

      // Refresco de datos en segundo plano
      startTransition(() => {
        router.refresh();
      });
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Error al guardar';
      toast.error(message);
      setError(message);
    } finally {
      if (isOpen) setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay Backdrop */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
        onClick={onClose}
      >
        {/* Modal Content */}
        <div
          className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/10 animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
              {initialData ? 'Editar Transacción' : 'Nueva Transacción'}
            </h3>
            <button
              onClick={onClose}
              className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                Activo
              </label>
              <div className="flex gap-3">
                <input
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value)}
                  placeholder="Ticker (ej: AAPL)"
                  required
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm font-medium bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-blue-500"
                  autoFocus={!initialData} // No autoFocus en edición para evitar saltos molestos
                  suppressHydrationWarning
                />
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as 'BUY' | 'SELL')}
                  className="rounded-lg border border-zinc-300 px-3 py-2.5 text-sm font-bold bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                >
                  <option value="BUY">BUY</option>
                  <option value="SELL">SELL</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                  Cantidad
                </label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(
                      e.target.value === '' ? '' : Number(e.target.value)
                    )
                  }
                  placeholder="0.00"
                  required
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                  Precio
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-zinc-400">
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={price}
                    onChange={(e) =>
                      setPrice(
                        e.target.value === '' ? '' : Number(e.target.value)
                      )
                    }
                    placeholder="0.00"
                    required
                    className="w-full rounded-lg border border-zinc-300 py-2.5 pl-7 pr-3 text-sm bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                  Comisión
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-zinc-400">
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={fees}
                    onChange={(e) =>
                      setFees(
                        e.target.value === '' ? '' : Number(e.target.value)
                      )
                    }
                    placeholder="0.00"
                    className="w-full rounded-lg border border-zinc-300 py-2.5 pl-7 pr-3 text-sm bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                  Fecha
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:[color-scheme:dark]"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700 hover:shadow-blue-500/30 disabled:opacity-50 transition-all active:scale-[0.98]"
              >
                {loading ? (
                  <>
                    <svg
                      className="h-4 w-4 animate-spin text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Guardando...
                  </>
                ) : (
                  <>
                    {initialData ? (
                      <Save size={18} />
                    ) : (
                      <PlusCircle size={18} />
                    )}
                    {initialData ? 'Guardar Cambios' : 'Agregar Transacción'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
