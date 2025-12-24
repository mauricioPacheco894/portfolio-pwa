'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { ToastProvider } from '@/contexts/ToastContext'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Sync session to server via API route
    const syncSessionToServer = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (session?.access_token) {
          // Send token to server so it can create authenticated requests
          await fetch('/api/auth/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              accessToken: session.access_token,
              refreshToken: session.refresh_token,
            }),
          })
        }
      } catch (err) {
        console.error('[Providers] Sync error:', err)
      }
    }

    syncSessionToServer()

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event) => {
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
          await syncSessionToServer()
        }
      }
    )

    return () => {
      subscription?.unsubscribe()
    }
  }, [])

  return (
    <ErrorBoundary>
      <ToastProvider>
        {children}
      </ToastProvider>
    </ErrorBoundary>
  )
}
