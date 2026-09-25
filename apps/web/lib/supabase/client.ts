'use client';

import { createBrowserSupabaseClient, type TypedSupabaseClient } from 'database';

/**
 * Client Supabase para uso em Client Components.
 * A sessão fica em cookies (não localStorage), lida também pelo servidor.
 */
export function getBrowserSupabaseClient(): TypedSupabaseClient {
  return createBrowserSupabaseClient();
}
