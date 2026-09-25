import { createServerClient, type CookieMethodsServer } from '@supabase/ssr';
import { requireEnv } from './env';
import type { Database, TypedSupabaseClient } from './types';

/**
 * Client para uso em Server Components, Route Handlers, Server Actions e
 * middleware. O chamador fornece o adaptador de cookies do framework (ex.:
 * `cookies()` do next/headers, ou os cookies de request/response no
 * middleware) — este pacote não depende do Next.js diretamente.
 */
export function createServerSupabaseClient(cookies: CookieMethodsServer): TypedSupabaseClient {
  return createServerClient<Database>(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    { cookies },
  );
}
