'use client';

import { ArrowLeft, Mail, Send } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { supabase } from '@/lib/supabase';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
      });

      if (resetError) {
        setError(resetError.message);
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch (err) {
      setError('Error inesperado. Intenta de nuevo.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-background dark:to-zinc-900/50 px-4">
      <div className="w-full max-w-md">
        <div className="rounded-xl bg-card shadow-lg ring-1 ring-border p-8">
          <div className="mb-8">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-6"
            >
              <ArrowLeft size={16} />
              Volver al inicio de sesión
            </Link>
            <h1 className="text-3xl font-bold text-foreground">
              Recuperar Contraseña
            </h1>
            <p className="mt-2 text-muted-foreground">
              Ingresa tu correo para recibir un enlace de recuperación.
            </p>
          </div>

          {success ? (
            <div className="rounded-lg bg-green-50 p-4 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
              <p className="font-semibold mb-1">¡Correo enviado!</p>
              Hemos enviado un enlace de recuperación a <strong>{email}</strong>. Revisa tu bandeja de entrada y sigue las instrucciones.
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Email
                </label>
                <div className="relative">
                  <Mail
                    className="absolute left-3 top-3 text-muted-foreground/50"
                    size={20}
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    required
                    className="w-full rounded-lg border border-border bg-background pl-10 pr-4 py-2 text-foreground placeholder-muted-foreground/40 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-primary py-2 font-medium text-primary-foreground transition-colors hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 mt-6"
              >
                {loading ? (
                  'Enviando...'
                ) : (
                  <>
                    <Send size={18} />
                    Enviar Enlace
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
