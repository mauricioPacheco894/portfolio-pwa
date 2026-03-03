'use client';

/**
 * Pagination Controls Component
 * 
 * Simple pagination interface with Next/Prev buttons.
 * Manages the `page` parameter in the URL search params.
 */

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
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

  /**
   * Updates the URL search parameters to switch to a different page.
   */
  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', newPage.toString());
    router.push(`?${params.toString()}`, { scroll: false });
  };

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-3">
      <button
        onClick={() => handlePageChange(1)}
        disabled={currentPage === 1}
        className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        aria-label="Ir al inicio"
      >
        <ChevronsLeft size={18} strokeWidth={2} />
      </button>

      <button
        onClick={() => handlePageChange(currentPage - 1)}
        disabled={!hasPrevPage}
        className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        aria-label="Página anterior"
      >
        <ChevronLeft size={18} strokeWidth={2} />
      </button>

      <span className="text-sm text-muted-foreground select-none px-2 min-w-[5rem] text-center">
        Página <span className="font-semibold text-foreground">{currentPage}</span> de {totalPages}
      </span>

      <button
        onClick={() => handlePageChange(currentPage + 1)}
        disabled={!hasNextPage}
        className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        aria-label="Página siguiente"
      >
        <ChevronRight size={18} strokeWidth={2} />
      </button>

      <button
        onClick={() => handlePageChange(totalPages)}
        disabled={currentPage === totalPages}
        className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        aria-label="Ir al final"
      >
        <ChevronsRight size={18} strokeWidth={2} />
      </button>
    </div>
  );
}
