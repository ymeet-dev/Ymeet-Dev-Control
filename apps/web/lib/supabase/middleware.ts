import { createServerSupabaseClient } from 'database';
import { NextResponse, type NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';

/**
 * Atualiza (refresh) a sessão Supabase a partir dos cookies do request e propaga
 * os cookies atualizados na response. Deve rodar no middleware, em toda rota que
 * dependa de autenticação — é o único lugar em que o Next.js permite escrever
 * cookies de forma confiável antes da renderização.
 */
export async function updateSession(request: NextRequest): Promise<{ response: NextResponse; user: User | null }> {
  let response = NextResponse.next({ request });

  const supabase = createServerSupabaseClient({
    getAll: () => request.cookies.getAll(),
    setAll: (cookiesToSet) => {
      for (const { name, value } of cookiesToSet) {
        request.cookies.set(name, value);
      }
      response = NextResponse.next({ request });
      for (const { name, value, options } of cookiesToSet) {
        response.cookies.set(name, value, options);
      }
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
