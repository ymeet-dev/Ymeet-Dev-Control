import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { requireEnv } from './env';
import type { Database, TypedSupabaseClient } from './types';

/**
 * Client com a service role key, ignora RLS.
 * Uso: apenas em contexto de servidor confiável (ex.: orchestrator). Nunca expor ao browser.
 * O import 'server-only' faz o build falhar se este módulo for incluído em um bundle de cliente.
 */
export function createSupabaseAdminClient(): TypedSupabaseClient {
  return createClient<Database>(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
