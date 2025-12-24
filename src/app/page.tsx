
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { User } from '@/types/supabase'
import { TrendingUp, Calendar } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { CreatePortfolioForm } from './components/CreatePortfolioForm'
import { Header } from './components/Header'
import { SkeletonCard } from '@/components/ui/SkeletonLoader'
import { usePortfolios } from '@/hooks/usePortfolios'

export default function Home() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)

  // Use React Query for portfolios
  const { data: portfolios = [], isLoading, error, refetch } = usePortfolios()

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      setUser(user)
      setCheckingAuth(false)

      if (user) {
        refetch()
      }
    }

    checkAuth()
  }, [refetch])

  // Show error toast if query fails
  useEffect(() => {
    if (error) {
      toast.error('Error al cargar portafolios')
      console.error('Error loading portfolios:', error)
    }
  }, [error])

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-black dark:to-zinc-900">
        <Header />
        <main className="mx-auto flex max-w-6xl items-center justify-center px-4 py-12">
          <div className="text-center">
            <div className="mb-4 flex justify-center">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-zinc-300 border-t-blue-600 dark:border-zinc-600 dark:border-t-blue-500"></div>
            </div>
            <p className="text-zinc-600 dark:text-zinc-400">Verificando sesión...</p>
          </div>
        </main>
      </div>
    )
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
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-black dark:to-zinc-900">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
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

        {/* Content */}
        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : portfolios.length === 0 ? (
          // Empty State
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
                Crea tu primer portafolio para comenzar a gestionar tus inversiones
              </p>
            </div>
          </div>
        ) : (
          // Portfolio Grid
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {portfolios.map((portfolio) => (
              <Link
                key={portfolio.id}
                href={`/portfolio/${portfolio.id}`}
                className="group rounded-xl bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-lg dark:bg-zinc-800"
              >
                {/* Card Header */}
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-zinc-900 dark:text-white">
                      {portfolio.name}
                    </h3>
                  </div>
                  <div className="rounded-full bg-blue-100 p-2 dark:bg-blue-900">
                    <TrendingUp
                      size={20}
                      className="text-blue-600 dark:text-blue-400"
                    />
                  </div>
                </div>

                {/* Card Body */}
                <div className="mb-6 space-y-3">
                  {portfolio.target_allocation ? (
                    <div>
                      <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                        Asignación Objetivo
                      </p>
                      <div className="mt-2 flex gap-2">
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

                {/* Card Footer */}
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
        )}
      </main>
    </div>
  )
}
