'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export default function PaginationControls({
  currentPage,
  totalPages,
  hasNextPage,
  hasPrevPage,
}: PaginationControlsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', newPage.toString());
    router.push(`?${params.toString()}`, { scroll: false });
  };

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-4 py-4">
      <button
        onClick={() => handlePageChange(currentPage - 1)}
        disabled={!hasPrevPage}
        className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 disabled:hover:bg-transparent dark:text-zinc-400 dark:hover:bg-zinc-800"
        aria-label="Página anterior"
      >
        <ChevronLeft size={20} />
      </button>

      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Página {currentPage} de {totalPages}
      </span>

      <button
        onClick={() => handlePageChange(currentPage + 1)}
        disabled={!hasNextPage}
        className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 disabled:hover:bg-transparent dark:text-zinc-400 dark:hover:bg-zinc-800"
        aria-label="Página siguiente"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}
