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
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-800 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-400">
        <p className="font-medium text-sm">Error al cargar portafolios: {error.message}</p>
      </div>
    );
  }

  if (!portfolios || portfolios.length === 0) {
    return (
      <div className="flex min-h-[400px] items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card/50 backdrop-blur-sm">
        <div className="text-center">
          <div className="mb-4 flex justify-center">
            <TrendingUp size={48} className="text-muted-foreground/20" />
          </div>
          <h2 className="text-xl font-bold text-foreground">
            No tienes portafolios
          </h2>
          <p className="mt-1 text-sm text-muted-foreground max-w-xs mx-auto">
            Crea tu primer portafolio para comenzar a gestionar tus inversiones de forma inteligente.
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
          className="group relative rounded-2xl bg-card p-6 shadow-sm border border-border transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
        >
          <div className="mb-6">
            <PortfolioActions
              portfolioId={portfolio.id}
              portfolioName={portfolio.name}
              variant="card"
            />
          </div>

          <div className="mb-8 space-y-4">
            {portfolio.target_allocation ? (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Asignación Objetivo
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {Object.entries(portfolio.target_allocation as Record<string, number>).map(
                    ([asset, allocation]) => (
                      <div
                        key={asset}
                        className="rounded-lg bg-muted px-2.5 py-1 text-[11px] font-semibold text-foreground ring-1 ring-inset ring-border tabular-nums"
                      >
                        {asset}: {allocation}%
                      </div>
                    )
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm italic text-muted-foreground">
                Sin asignación configurada
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 border-t border-border pt-4">
            <Calendar size={13} className="text-muted-foreground" />
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-tight">
              Creado el {new Date(portfolio.created_at).toLocaleDateString('es-ES', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
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
      <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-background dark:to-zinc-900/50">
        <Header />
        <main className="mx-auto flex max-w-6xl items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
          <div className="text-center">
            <TrendingUp size={64} className="mx-auto mb-6 text-muted-foreground/20" />
            <h1 className="text-4xl font-bold text-foreground">
              Bienvenido a Portfolio PWA
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Inicia sesión para gestionar tus inversiones
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-background dark:to-zinc-900/50">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-12 flex flex-col items-center justify-between gap-6 sm:flex-row">
          <div>
            <h1 className="text-4xl font-bold text-foreground">
              Mis Portafolios
            </h1>
            <p className="mt-2 text-lg text-muted-foreground">
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
