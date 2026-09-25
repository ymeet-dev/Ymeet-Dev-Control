import { createClient } from '@supabase/supabase-js';
import { requireEnv } from './env';
import type { Database, TypedSupabaseClient } from './types';

/**
 * Client com a chave anônima (`anon`), sujeito às policies de RLS.
 * Uso: browser e contextos de servidor que devem respeitar o usuário autenticado.
 */
export function createSupabaseClient(): TypedSupabaseClient {
  return createClient<Database>(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  );
}
