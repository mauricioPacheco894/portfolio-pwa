'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Check, Edit2, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { supabase } from '@/lib/supabase';

interface Props {
  portfolioId: string;
  portfolioName: string;
  variant?: 'page' | 'card';
  onUpdate?: () => void;
}

export default function PortfolioActions({
  portfolioId,
  portfolioName,
  variant = 'page',
  onUpdate,
}: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState(portfolioName);
  const [loading, setLoading] = useState(false);

  const TitleTag = variant === 'page' ? 'h1' : 'h3';
  const titleClasses =
    variant === 'page'
      ? 'text-3xl font-bold text-zinc-900 dark:text-white tracking-tight'
      : 'text-xl font-semibold text-zinc-900 dark:text-white';

  const handleUpdate = async (e?: React.MouseEvent | React.KeyboardEvent) => {
    e?.preventDefault();
    e?.stopPropagation();

    if (!newName.trim() || newName === portfolioName) {
      setIsEditing(false);
      setNewName(portfolioName);
      return;
    }

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert('Debes iniciar sesión para editar');
        setLoading(false);
        return;
      }

      const { error } = await supabase
        .from('portfolios')
        .update({ name: newName })
        .eq('id', portfolioId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error updating portfolio:', error);
        alert('Error al actualizar el portafolio');
      } else {
        await queryClient.invalidateQueries({ queryKey: ['portfolios'] });
        router.refresh();
        if (onUpdate) {
          onUpdate();
        }
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Error in handleUpdate:', error);
      alert('Ocurrió un error inesperado');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (
      !confirm(
        '¿Estás seguro de que deseas eliminar este portafolio? Esta acción no se puede deshacer y eliminará todas las transacciones asociadas.'
      )
    ) {
      return;
    }

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert('Debes iniciar sesión para eliminar');
        setLoading(false);
        return;
      }

      const { error } = await supabase
        .from('portfolios')
        .delete()
        .eq('id', portfolioId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting portfolio:', error);
        alert('Error al eliminar el portafolio');
        setLoading(false);
      } else {
        await queryClient.invalidateQueries({ queryKey: ['portfolios'] });
        if (onUpdate) {
          onUpdate();
        }
        router.push('/');
        router.refresh();
      }
    } catch (error) {
      console.error('Error in handleDelete:', error);
      alert('Ocurrió un error inesperado');
      setLoading(false);
    }
  };

  if (isEditing) {
    return (
      <div
        className="flex items-center gap-2"
        onClick={(e) => e.preventDefault()}
      >
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleUpdate(e);
            if (e.key === 'Escape') {
              setIsEditing(false);
              setNewName(portfolioName);
            }
          }}
          className={`rounded-lg border border-zinc-300 bg-white px-2 py-1 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white ${
            variant === 'page'
              ? 'text-2xl font-bold'
              : 'text-lg font-semibold w-full'
          }`}
          autoFocus
        />
        <div className="flex items-center gap-1">
          <button
            onClick={handleUpdate}
            disabled={loading}
            className="rounded p-1 text-green-600 hover:bg-green-50 hover:text-green-700 dark:hover:bg-green-900/20 dark:text-green-500"
          >
            <Check size={20} />
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsEditing(false);
              setNewName(portfolioName);
            }}
            disabled={loading}
            className="rounded p-1 text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:text-red-400"
          >
            <X size={20} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group flex items-center gap-3 ${variant === 'card' ? 'w-full justify-between' : ''}`}
    >
      <TitleTag className={titleClasses}>{portfolioName}</TitleTag>
      <div
        className={`flex items-center gap-1 ${variant === 'page' ? '' : 'bg-transparent'}`}
      >
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsEditing(true);
          }}
          className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-blue-600 dark:hover:bg-zinc-800 dark:hover:text-blue-400"
          title="Renombrar portafolio"
        >
          <Edit2 size={16} />
        </button>
        <button
          onClick={handleDelete}
          className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
          title="Eliminar portafolio"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
