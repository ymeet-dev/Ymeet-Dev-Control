import { createBrowserClient } from '@supabase/ssr';
import { requireEnv } from './env';
import type { Database, TypedSupabaseClient } from './types';

/**
 * Client para uso em Client Components. A sessão é persistida em cookies
 * (não localStorage), para que Server Components e middleware também a leiam.
 */
export function createBrowserSupabaseClient(): TypedSupabaseClient {
  return createBrowserClient<Database>(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  );
}
