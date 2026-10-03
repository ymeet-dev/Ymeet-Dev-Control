import { cache } from 'react';
import type { ProfileRole } from 'database';
import { getServerSupabaseClient } from '../supabase/server';

export interface CurrentUser {
  id: string;
  email: string | null;
  role: ProfileRole;
  name: string | null;
}

/**
 * Usuário autenticado (via cookie de sessão) combinado com seu profiles.role.
 * Retorna null se não houver sessão válida. A leitura de `profiles` respeita RLS
 * (policy profiles_select: id = auth.uid() ou role admin) — cada usuário sempre
 * consegue ler o próprio perfil.
 *
 * Envolvido em `cache()` porque várias partes da árvore (layout, páginas) chamam
 * isso na mesma requisição — dedup por request, sem persistir entre requests.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await getServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase.from('profiles').select('role, name').eq('id', user.id).single();

  return {
    id: user.id,
    email: user.email ?? null,
    role: profile?.role ?? 'viewer',
    name: profile?.name ?? null,
  };
});
