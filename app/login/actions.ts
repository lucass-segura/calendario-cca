'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isValidUsername, normalizeUsername, usernameToEmail } from '@/lib/auth/username';

export type LoginState = { error: string | null };

const GENERIC_ERROR = 'Usuario o contraseña incorrectos.';

export async function signIn(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const username = normalizeUsername(String(formData.get('username') ?? ''));
  const password = String(formData.get('password') ?? '');
  if (!isValidUsername(username) || !password) return { error: GENERIC_ERROR };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password });
  if (error) return { error: GENERIC_ERROR };

  redirect('/');
}
