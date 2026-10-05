import { createClient } from '../supabase/server';

export type AppRole = 'member' | 'kitchen';

export async function currentAccess() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const id = auth?.claims?.sub;
  if (!id) return null;
  const { data, error } = await supabase.from('profiles').select('id,role,username,full_name').eq('id', id).maybeSingle();
  if (error) throw new Error('No pudimos verificar los permisos. Revisá la migración de acceso a cocina.');
  if (!data || !['member', 'kitchen'].includes(data.role)) return null;
  return { supabase, profile: data as { id: string; role: AppRole; username: string; full_name: string } };
}
