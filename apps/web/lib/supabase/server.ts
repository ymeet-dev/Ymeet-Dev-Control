import { cookies } from 'next/headers';
import { createServerSupabaseClient, type TypedSupabaseClient } from 'database';

/**
 * Client Supabase para uso em Server Components, Route Handlers e Server Actions.
 * Lê/escreve a sessão via cookies do request atual (next/headers).
 *
 * Em Server Components a escrita de cookies não é permitida pelo Next.js — o erro é
 * silenciado aqui porque a atualização da sessão nesses casos é responsabilidade do
 * middleware (ver lib/supabase/middleware.ts).
 */
export async function getServerSupabaseClient(): Promise<TypedSupabaseClient> {
  const cookieStore = await cookies();

  return createServerSupabaseClient({
    getAll: () => cookieStore.getAll(),
    setAll: (cookiesToSet) => {
      try {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      } catch {
        // Chamado a partir de um Server Component: ignorar, o middleware cuida do refresh.
      }
    },
  });
}
