'use client';

/**
 * Transaction Form Modal Component
 * 
 * A comprehensive modal for creating or editing transactions.
 * Handles validation, price derivation, and timezone-safe date processing.
 */

import { PlusCircle, Save, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import toast from 'react-hot-toast';

import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { KNOWN_TICKERS } from '@/constants/tickers';
import TickerAutocomplete from './TickerAutocomplete';
import { syncSingleTickerPrice } from '@/app/actions/syncPrice';

export interface TransactionData {
  id?: string;
  ticker: string;
  type: 'BUY' | 'SELL';
  quantity: number;
  price_per_unit: number;
  fees: number;
  fx_rate: number;
  date: string;
  portfolio_id: string;
}

type Props = {
  isOpen: boolean;
  onClose: () => void;
  portfolioId: string;
  initialData?: TransactionData | null;
  availableTickers?: string[];
  usdMxnRate?: number;
};

export default function TransactionFormModal({
  isOpen,
  onClose,
  portfolioId,
  initialData,
  availableTickers = [],
  usdMxnRate = 20,
}: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const [isPending, startTransition] = useTransition();

  const [ticker, setTicker] = useState('');
  const [type, setType] = useState<'BUY' | 'SELL'>('BUY');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [price, setPrice] = useState<number | ''>('');
  const [fees, setFees] = useState<number | ''>('');
  const [fxRate, setFxRate] = useState<number | ''>('');
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [isGBM, setIsGBM] = useState(false);
  const [isForeignCurrency, setIsForeignCurrency] = useState(false);

  useEffect(() => {
    if (isOpen && initialData) {
      setTicker(initialData.ticker);
      setType(initialData.type);
      setQuantity(initialData.quantity);
      setPrice(initialData.price_per_unit);
      setFees(initialData.fees || 0);
      setFxRate(initialData.fx_rate ?? 1);
      setIsForeignCurrency(initialData.fx_rate != null && initialData.fx_rate !== 1);

      const dateObj = new Date(initialData.date);
      const formattedDate = dateObj.toISOString().split('T')[0];
      setDate(formattedDate);
    } else if (isOpen && !initialData) {
      setTicker('');
      setType('BUY');
      setQuantity('');
      setPrice('');
      setFees('');
      setFxRate('');
      setDate(new Date().toISOString().split('T')[0]);
      setIsGBM(false);
      setIsForeignCurrency(false);
    }
    setError('');
  }, [isOpen, initialData]);

  // Auto-calculate fees for GBM
  useEffect(() => {
    if (isGBM && quantity && price) {
      const q = Number(quantity);
      const p = Number(price);
      if (!isNaN(q) && !isNaN(p)) {
        // GBM Fee: 0.25% + 16% IVA = 0.29%
        const commission = q * p * 0.0025;
        const iva = commission * 0.16;
        const totalFee = commission + iva;
        setFees(Number(totalFee.toFixed(2)));
      }
    }
  }, [isGBM, quantity, price]);

  /**
   * Processes and submits the transaction data.
   * Handles date timezone offsets by forcing noon local time.
   */
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
      let submitDate: string;
      if (date) {
        const [y, m, d] = date.split('-').map(Number);
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
        fx_rate: isForeignCurrency && fxRate ? Number(fxRate) : 1,
        date: submitDate,
      };

      let result;

      if (initialData?.id) {
        result = await supabase
          .from('transactions')
          .update(payload)
          .eq('id', initialData.id)
          .select();
      } else {
        result = await supabase.from('transactions').insert([payload]).select();
      }

      const { data: opData, error: opError } = result;

      if (opError) {
        throw new Error(opError.message);
      }

      if (opData && opData.length === 0) {
        throw new Error(
          'Operación exitosa pero ningún dato fue modificado. Verifica permisos.'
        );
      }

      // Sincronizar el precio de Yahoo de manera inmediata
      try {
        await syncSingleTickerPrice(payload.ticker);
      } catch (invokeError) {
        console.warn('Excepción al llamar al Server Action:', invokeError);
      }

      toast.success(
        initialData ? 'Transacción actualizada' : 'Transacción agregada'
      );
      onClose();

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
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 py-6 animate-in fade-in duration-200"
        onClick={onClose}
      >
        <div
          className="w-full max-w-lg overflow-hidden rounded-2xl bg-card p-4 sm:p-6 shadow-2xl ring-1 ring-border animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-xl font-bold text-foreground">
              {initialData ? 'Editar Transacción' : 'Nueva Transacción'}
            </h3>
            <button
              onClick={onClose}
              className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">
                Activo
              </label>
              <div className="flex gap-3">
                <TickerAutocomplete
                  value={ticker}
                  onChange={setTicker}
                  suggestions={[...KNOWN_TICKERS, ...availableTickers]}
                  placeholder="Ticker (ej: AAPL)"
                  className="w-full rounded-lg border border-border px-3 py-2.5 text-sm font-medium bg-background text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                  autoFocus={!initialData}
                />
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as 'BUY' | 'SELL')}
                  className="rounded-lg border border-border px-3 py-2.5 text-sm font-bold bg-muted text-foreground"
                >
                  <option value="BUY">BUY</option>
                  <option value="SELL">SELL</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">
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
                  className="w-full rounded-lg border border-border px-3 py-2.5 text-sm bg-background text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">
                  Precio
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-muted-foreground/60">
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
                    className="w-full rounded-lg border border-border py-2.5 pl-7 pr-3 text-sm bg-background text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {/* Comisión */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold uppercase text-muted-foreground">
                    Comisión
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer group">
                    <div className="relative flex items-center">
                      <input
                        type="checkbox"
                        checked={isGBM}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setIsGBM(checked);
                          if (!checked) setFees('');
                        }}
                        className="peer h-3.5 w-3.5 cursor-pointer appearance-none rounded border border-border bg-background checked:bg-primary checked:border-primary transition-all"
                      />
                      <svg
                        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 peer-checked:opacity-100 transition-opacity text-white"
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    </div>
                    <span className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                      GBM
                    </span>
                  </label>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-muted-foreground/60">
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={fees}
                    onChange={(e) => {
                      setFees(
                        e.target.value === '' ? '' : Number(e.target.value)
                      );
                      setIsGBM(false);
                    }}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-border py-2.5 pl-7 pr-2 text-sm bg-background text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              {/* Fecha */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">
                  Fecha
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-lg border border-border px-2 py-2.5 text-sm bg-background text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 dark:[color-scheme:dark]"
                />
              </div>

              {/* T. Cambio */}
              <div className="col-span-2 sm:col-span-1">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold uppercase text-muted-foreground">
                    T. Cambio
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer group">
                    <div className="relative flex items-center">
                      <input
                        type="checkbox"
                        checked={isForeignCurrency}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setIsForeignCurrency(checked);
                          if (checked) {
                            setFxRate(usdMxnRate);
                            setIsGBM(false);
                          } else {
                            setFxRate('');
                          }
                        }}
                        className="peer h-3.5 w-3.5 cursor-pointer appearance-none rounded border border-border bg-background checked:bg-indigo-600 checked:border-indigo-600 transition-all"
                      />
                      <svg
                        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 peer-checked:opacity-100 transition-opacity text-white"
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    </div>
                    <span className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                      USD
                    </span>
                  </label>
                </div>
                <input
                  type="number"
                  step="0.01"
                  value={fxRate}
                  onChange={(e) => {
                    setFxRate(
                      e.target.value === '' ? '' : Number(e.target.value)
                    );
                  }}
                  placeholder={usdMxnRate.toFixed(2)}
                  disabled={!isForeignCurrency}
                  title={isForeignCurrency ? `Spot actual: $${usdMxnRate.toFixed(2)} — Ingresa el TC aplicado` : 'Activa "USD" para ingresar el tipo de cambio'}
                  className={`w-full rounded-lg border border-border px-3 py-2.5 text-sm bg-background text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 ${!isForeignCurrency ? 'opacity-40 cursor-not-allowed' : 'border-indigo-300 dark:border-indigo-700'}`}
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
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-90 disabled:opacity-50 transition-all active:scale-[0.98]"
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
