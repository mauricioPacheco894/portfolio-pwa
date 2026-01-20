'use client';

/**
 * Universal Providers Wrapper
 * 
 * Composes all frontend context providers including:
 * - ErrorBoundary for runtime stability
 * - ReactQueryProvider for server state management
 * - AuthProvider for user session context
 * - ToastProvider for user notifications
 * 
 * Also handles synchronization of the Supabase session to the server via API routes.
 */

import { useEffect, useRef } from 'react';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AuthProvider } from '@/contexts/AuthContext';
import { ReactQueryProvider } from '@/contexts/ReactQueryProvider';
import { ToastProvider } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';

export function Providers({ children }: { children: React.ReactNode }) {
  const syncInProgress = useRef(false);

  useEffect(() => {
    /**
     * Synchronizes the client-side session to the server by posting to the auth/sync route.
     * This allows server-side components to access the authenticated session.
     */
    const syncSessionToServer = async () => {
      if (syncInProgress.current) return;
      syncInProgress.current = true;

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.access_token) {
          await fetch('/api/auth/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              accessToken: session.access_token,
              refreshToken: session.refresh_token,
            }),
          });
        }
      } catch (err) {
        console.error('[Providers] Sync error:', err);
      } finally {
        syncInProgress.current = false;
      }
    };

    syncSessionToServer();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event) => {
      if (
        event === 'SIGNED_IN' ||
        event === 'SIGNED_OUT' ||
        event === 'TOKEN_REFRESHED'
      ) {
        setTimeout(() => syncSessionToServer(), 100);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  return (
    <ErrorBoundary>
      <ReactQueryProvider>
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </ReactQueryProvider>
    </ErrorBoundary>
  );
}
