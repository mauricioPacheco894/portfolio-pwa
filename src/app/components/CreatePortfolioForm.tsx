'use client';

/**
 * Create Portfolio Form Component
 * 
 * Provides a modal dialog to create a new portfolio for the authenticated user.
 */

import { Loader, Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

interface CreatePortfolioFormProps {
  onPortfolioCreated?: () => void;
}

export function CreatePortfolioForm({
  onPortfolioCreated,
}: CreatePortfolioFormProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  /**
   * Handles the creation of a new portfolio record in Supabase.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!user) {
      setError('Debes iniciar sesión para crear un portafolio');
      return;
    }

    setLoading(true);

    try {
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

      setName('');
      setIsOpen(false);
      router.refresh();
      onPortfolioCreated?.();
    } catch (err) {
      setError('Error inesperado al crear portafolio');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground transition-colors hover:opacity-90 shadow-md"
      >
        <Plus size={20} />
        Nuevo Portafolio
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl bg-card shadow-lg ring-1 ring-border">
            <div className="flex items-center justify-between border-b border-border p-6">
              <h2 className="text-xl font-bold text-foreground">
                Crear Nuevo Portafolio
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 p-6">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Nombre del Portafolio
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Mi Portafolio de Acciones…"
                  required
                  autoComplete="off"
                  className="w-full rounded-lg border border-border bg-background px-4 py-2 text-foreground placeholder-muted-foreground/60 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                  className="flex-1 rounded-lg border border-border py-2 font-medium text-foreground transition-colors hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || !name.trim()}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary py-2 font-medium text-primary-foreground transition-colors hover:opacity-90 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader size={18} className="animate-spin" />
                      Creando…
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
