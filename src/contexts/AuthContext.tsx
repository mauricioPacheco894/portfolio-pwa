'use client';

import { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';

import { supabase } from '@/lib/supabase';

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  error: null,
  signOut: async () => { },
});

export const useAuth = () => useContext(AuthContext);

const AUTH_TIMEOUT_MS = 10000; // 10 seconds timeout for auth operations

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
    } catch (err) {
      console.error('[AuthContext] Sign out error:', err);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let timeoutId: NodeJS.Timeout;

    const initializeAuth = async () => {
      try {
        // Set a timeout to prevent infinite loading
        timeoutId = setTimeout(() => {
          if (mounted && loading) {
            console.warn('[AuthContext] Auth initialization timed out');
            setLoading(false);
            setError('La verificación de sesión tardó demasiado. Recarga la página.');
          }
        }, AUTH_TIMEOUT_MS);

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (!mounted) return;

        if (sessionError) {
          console.error('[AuthContext] Session error:', sessionError.message);
          setError(sessionError.message);
          setLoading(false);
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);
        setError(null);
        setLoading(false);
        clearTimeout(timeoutId);
      } catch (err) {
        if (!mounted) return;
        console.error('[AuthContext] Unexpected error:', err);
        setError('Error al verificar la sesión');
        setLoading(false);
        clearTimeout(timeoutId);
      }
    };

    initializeAuth();

    // Single subscription for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      setError(null);
    });

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading, error, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
