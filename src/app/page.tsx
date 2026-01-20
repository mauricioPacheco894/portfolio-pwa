'use client';

/**
 * Main Home Page
 * 
 * Displays the user's list of portfolios and provides options to create new ones.
 * Handles initial authentication state and portfolio fetching via React Query.
 */

import { Calendar, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { SkeletonCard } from '@/components/ui/SkeletonLoader';
import { useAuth } from '@/contexts/AuthContext';
import { usePortfolios } from '@/hooks/usePortfolios';

import { CreatePortfolioForm } from './components/CreatePortfolioForm';
import { Header } from './components/Header';
import PortfolioActions from './components/PortfolioActions';

export default function Home() {
  const { user, loading: authLoading } = useAuth();

  const {
    data: portfolios = [],
    isLoading: portfoliosLoading,
    error,
    refetch,
  } = usePortfolios({ enabled: !!user });

  useEffect(() => {
    if (error) {
      toast.error('Error al cargar portafolios');
      console.error('Error loading portfolios:', error);
    }
  }, [error]);

  const [showSlowLoadingMessage, setShowSlowLoadingMessage] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (authLoading) {
      timer = setTimeout(() => {
        setShowSlowLoadingMessage(true);
      }, 2000);
    }
    return () => clearTimeout(timer);
  }, [authLoading]);

  const [showSlowPortfolioLoading, setShowSlowPortfolioLoading] =
    useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (portfoliosLoading) {
      timer = setTimeout(() => {
        setShowSlowPortfolioLoading(true);
      }, 3000);
    } else {
      setShowSlowPortfolioLoading(false);
    }
    return () => clearTimeout(timer);
  }, [portfoliosLoading]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-black dark:to-zinc-900">
        <Header />
        <main className="mx-auto flex max-w-6xl flex-col items-center justify-center px-4 py-12">
          <div className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-600 dark:border-zinc-600 dark:border-t-blue-500"></div>
            <p className="text-sm text-zinc-400">Verificando sesión...</p>

            {showSlowLoadingMessage && (
              <div className="mt-4 animate-fade-in text-sm text-zinc-500 dark:text-zinc-400">
                <p>Esto está tardando más de lo habitual.</p>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-2 text-blue-600 hover:text-blue-500 underline dark:text-blue-400"
                >
                  Recargar página
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-black dark:to-zinc-900">
        <Header />
        <main className="mx-auto flex max-w-6xl items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
          <div className="text-center">
            <TrendingUp
              size={64}
              className="mx-auto mb-6 text-zinc-300 dark:text-zinc-600"
            />
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
          <CreatePortfolioForm onPortfolioCreated={refetch} />
        </div>

        {portfoliosLoading ? (
          showSlowPortfolioLoading ? (
            <div className="flex flex-col items-center justify-center rounded-xl border-dashed border-2 border-zinc-300 dark:border-zinc-700 p-12 text-center animate-fade-in">
              <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                La carga de portafolios está tardando demasiado.
              </p>
              <button
                onClick={() => {
                  setShowSlowPortfolioLoading(false);
                  refetch();
                }}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
              >
                Reintentar conexión
              </button>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          )
        ) : portfolios.length === 0 ? (
          <div className="flex min-h-96 items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-800">
            <div className="text-center">
              <div className="mb-4 flex justify-center">
                <TrendingUp
                  size={64}
                  className="text-zinc-300 dark:text-zinc-600"
                />
              </div>
              <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white">
                No tienes portafolios
              </h2>
              <p className="mt-2 text-zinc-600 dark:text-zinc-400">
                Crea tu primer portafolio para comenzar a gestionar tus
                inversiones
              </p>
            </div>
          </div>
        ) : (
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
                    onUpdate={refetch}
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
                    {new Date(portfolio.created_at).toLocaleDateString(
                      'es-ES',
                      {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      }
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
