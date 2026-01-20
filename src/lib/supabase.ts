import { createBrowserClient } from '@supabase/ssr';

import { env } from '@/env';

/**
 * Supabase Browser Client
 * 
 * Initialized with environment variables for use in client-side components.
 * Handles authentication, database queries, and real-time subscriptions in the browser.
 */
export const supabase = createBrowserClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
);
