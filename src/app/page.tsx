/**
 * Main Home Page (Server Component)
 * 
 * Fetches initial authentication state and stream portfolios via Suspense.
 * Follows Vercel Best Practices for Server-Side Performance.
 */

import { Calendar, TrendingUp } from 'lucide-react';
import { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { SkeletonCard } from '@/components/ui/SkeletonLoader';
import { createClient } from '@/lib/supabaseServer';

import { CreatePortfolioForm } from './components/CreatePortfolioForm';
import { Header } from './components/Header';
import PortfolioActions from './components/PortfolioActions';

export const metadata: Metadata = {
  title: 'Mis Portafolios',
};

/**
 * Component that fetches and renders the user's portfolios.
 * Executed on the server for instant data delivery.
 */
async function PortfolioGrid() {
  const supabase = await createClient();

  const { data: portfolios, error } = await supabase
    .from('portfolios')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return (
      <div className="rounded-xl border-red-200 bg-red-50 p-6 text-center text-red-800 dark:bg-red-900/20 dark:text-red-400">
        <p>Error al cargar portafolios: {error.message}</p>
      </div>
    );
  }

  if (!portfolios || portfolios.length === 0) {
    return (
      <div className="flex min-h-96 items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-800">
        <div className="text-center">
          <div className="mb-4 flex justify-center">
            <TrendingUp size={64} className="text-zinc-300 dark:text-zinc-600" />
          </div>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white">
            No tienes portafolios
          </h2>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Crea tu primer portafolio para comenzar a gestionar tus inversiones
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {portfolios.map((portfolio) => (
        <Link
          key={portfolio.id}
          href={`/portfolio/${portfolio.id}`}
          className="group rounded-xl bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-lg dark:bg-zinc-800"
        >
          <div className="mb-4">
            <PortfolioActions
              portfolioId={portfolio.id}
              portfolioName={portfolio.name}
              variant="card"
            />
          </div>

          <div className="mb-6 space-y-3">
            {portfolio.target_allocation ? (
              <div>
                <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  Asignación Objetivo
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(portfolio.target_allocation).map(
                    ([asset, allocation]) => (
                      <div
                        key={asset}
                        className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300"
                      >
                        {asset}: {allocation}%
                      </div>
                    )
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Sin asignación configurada
              </p>
            )}
          </div>

          <div className="border-t border-zinc-200 pt-4 dark:border-zinc-700">
            <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <Calendar size={14} />
              {new Date(portfolio.created_at).toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-black dark:to-zinc-900">
        <Header />
        <main className="mx-auto flex max-w-6xl items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
          <div className="text-center">
            <TrendingUp size={64} className="mx-auto mb-6 text-zinc-300 dark:text-zinc-600" />
            <h1 className="text-4xl font-bold text-zinc-900 dark:text-white">
              Bienvenido a Portfolio PWA
            </h1>
            <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
              Inicia sesión para gestionar tus inversiones
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-black dark:to-zinc-900">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-12 flex flex-col items-center justify-between gap-6 sm:flex-row">
          <div>
            <h1 className="text-4xl font-bold text-zinc-900 dark:text-white">
              Mis Portafolios
            </h1>
            <p className="mt-2 text-lg text-zinc-600 dark:text-zinc-400">
              Gestiona y monitorea tus inversiones
            </p>
          </div>
          <CreatePortfolioForm />
        </div>

        <Suspense
          fallback={
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          }
        >
          <PortfolioGrid />
        </Suspense>
      </main>
    </div>
  );
}
