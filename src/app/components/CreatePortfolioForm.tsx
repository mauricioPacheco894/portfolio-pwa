'use client';

import { Loader,Plus, X } from 'lucide-react';
import { useState } from 'react';

import { supabase } from '@/lib/supabase';

interface CreatePortfolioFormProps {
  onPortfolioCreated: () => void;
}

export function CreatePortfolioForm({
  onPortfolioCreated,
}: CreatePortfolioFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError('Debes iniciar sesión para crear un portafolio');
        setLoading(false);
        return;
      }

      const { error: insertError } = await supabase.from('portfolios').insert([
        {
          name,
          target_allocation: null,
          user_id: user.id,
        },
      ]);

      if (insertError) {
        setError(insertError.message);
        setLoading(false);
        return;
      }

      // Reset form and close modal
      setName('');
      setIsOpen(false);

      // Refresh portfolio list
      onPortfolioCreated();
    } catch (err) {
      setError('Error inesperado al crear portafolio');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Button to Open Modal */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
      >
        <Plus size={20} />
        Nuevo Portafolio
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-lg dark:bg-zinc-800">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-200 p-6 dark:border-zinc-700">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                Crear Nuevo Portafolio
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="space-y-4 p-6">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Nombre del Portafolio
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Mi Portafolio de Acciones"
                  required
                  className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 placeholder-zinc-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white dark:placeholder-zinc-500"
                />
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 rounded-lg border border-zinc-300 py-2 font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || !name.trim()}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-blue-600 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
                >
                  {loading ? (
                    <>
                      <Loader size={18} className="animate-spin" />
                      Creando...
                    </>
                  ) : (
                    'Crear'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
