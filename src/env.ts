import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

/**
 * Environment Variables Schema
 * 
 * Validates and provides type-safe access to environment variables.
 * Uses t3-oss/env-nextjs to ensure all required variables are present at runtime.
 */
export const env = createEnv({
  server: {},
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url().min(1),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY: z.string().min(1),
  },
  runtimeEnv: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
  },
});
