'use client';

import { Component, ErrorInfo, ReactNode } from 'react';
import toast from 'react-hot-toast';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    toast.error('Algo salió mal. Por favor, recarga la página.');
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-black dark:to-zinc-900">
            <div className="max-w-md rounded-xl bg-white p-8 text-center shadow-lg dark:bg-zinc-800">
              <div className="mb-4 text-6xl">⚠️</div>
              <h1 className="mb-2 text-2xl font-bold text-zinc-900 dark:text-white">
                Algo salió mal
              </h1>
              <p className="mb-6 text-zinc-600 dark:text-zinc-400">
                Ha ocurrido un error inesperado. Por favor, intenta recargar la
                página.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                Recargar página
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
