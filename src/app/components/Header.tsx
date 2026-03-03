'use client';

/**
 * Global Header Component
 * 
 * Provides top-level navigation, theme switching (dark/light mode),
 * and user authentication actions (login/logout).
 */

import { LogIn, LogOut, Moon, Sun, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useAuth } from '@/contexts/AuthContext';
import { useDarkMode } from '@/hooks/useDarkMode';

export function Header() {
  const router = useRouter();
  const { theme, toggleTheme, mounted } = useDarkMode();
  const { user, loading, signOut } = useAuth();

  /**
   * Performs sign-out and redirects to the login page.
   */
  const handleLogout = async () => {
    await signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-zinc-900 transition-opacity hover:opacity-80 dark:text-white group"
          aria-label="Inicio"
        >
          <div className="flex items-center justify-center p-1.5 bg-blue-600 rounded-lg group-hover:scale-105 transition-transform duration-300">
            <Wallet size={20} className="text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight font-display">
            Portfolio<span className="text-blue-600 dark:text-blue-400">.</span>
          </span>
        </Link>

        <div className="flex items-center gap-4">
          {mounted && (
            <button
              onClick={toggleTheme}
              className="rounded-lg p-2 text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700"
              aria-label="Toggle dark mode"
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          )}

          {!loading && user ? (
            <>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                {user.email}
              </span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 rounded-full bg-red-50 px-4 py-1.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100 dark:bg-red-900/10 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                <LogOut size={16} />
                Salir
              </button>
            </>
          ) : !loading ? (
            <Link
              href="/login"
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              <LogIn size={18} />
              Iniciar Sesión
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}
