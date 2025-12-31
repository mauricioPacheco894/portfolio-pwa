'use client';

import { useEffect, useRef } from 'react';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AuthProvider } from '@/contexts/AuthContext';
import { ReactQueryProvider } from '@/contexts/ReactQueryProvider';
import { ToastProvider } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';

export function Providers({ children }: { children: React.ReactNode }) {
  const syncInProgress = useRef(false);

  useEffect(() => {
    // Sync session to server via API route (debounced to prevent race conditions)
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

    // Initial sync
    syncSessionToServer();

    // Subscribe to auth changes for syncing to server only
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event) => {
      if (
        event === 'SIGNED_IN' ||
        event === 'SIGNED_OUT' ||
        event === 'TOKEN_REFRESHED'
      ) {
        // Small delay to let AuthContext update first
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
