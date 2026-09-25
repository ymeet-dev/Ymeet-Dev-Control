'use server';

import { redirect } from 'next/navigation';
import { getServerSupabaseClient } from '../../lib/supabase/server';

export async function signIn(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const redirectTo = String(formData.get('redirectTo') ?? '/');

  const supabase = await getServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const params = new URLSearchParams({ error: error.message, redirectTo });
    redirect(`/login?${params.toString()}`);
  }

  redirect(redirectTo);
}

export async function signOut(): Promise<void> {
  const supabase = await getServerSupabaseClient();
  await supabase.auth.signOut();
  redirect('/login');
}
