import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { env } from '@/env';

/**
 * Supabase Server Client Factory
 * 
 * Creates an authenticated Supabase client for use in Server Components,
 * Server Actions, and Route Handlers. Automatically handles session state
 * using Next.js cookies.
 * 
 * @returns An authenticated Supabase client instance.
 */
export async function createClient() {
  const cookieStore = await cookies();

  const client = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Note: Server Components cannot write cookies during rendering
          }
        },
      },
    }
  );

  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error) {
    console.error('[supabaseServer] Auth error:', error.message);
  }

  return client;
}
