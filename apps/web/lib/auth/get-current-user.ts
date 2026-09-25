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
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
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
}
