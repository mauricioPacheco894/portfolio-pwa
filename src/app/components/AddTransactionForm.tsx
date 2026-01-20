'use client';

/**
 * Add Transaction Form Component
 * 
 * Simple trigger button that opens the TransactionFormModal.
 */

import { PlusCircle } from 'lucide-react';
import { useState } from 'react';

import TransactionFormModal from './TransactionFormModal';

interface Props {
  portfolioId: string;
}

export default function AddTransactionForm({ portfolioId }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
      >
        <PlusCircle size={16} />
        <span className="hidden sm:inline">Nueva Transacción</span>
        <span className="sm:hidden">Nueva</span>
      </button>

      <TransactionFormModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        portfolioId={portfolioId}
      />
    </>
  );
}
