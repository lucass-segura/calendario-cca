import { authedClient, fetchAll, unauthorized } from '../../../lib/api';
import { adminClient } from '../../../lib/supabase/admin';
import { validateUser } from '../../../lib/permissions';
import { usernameToEmail } from '../../../lib/auth/username';
import { sameOrigin } from '../../../lib/reservations';

export async function GET() {
  const supabase = await authedClient('users.manage');
  if (!supabase) return unauthorized();
  try {
    const users = await fetchAll((a,b) => supabase.from('profiles').select('id,username,full_name,permissions,enabled').order('username').range(a,b));
    return Response.json({ users, canCreate: !!adminClient() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ error: 'No pudimos cargar los usuarios.' }, { status: 503 }); }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'Solicitud no permitida.' }, { status: 403 });
  const supabase = await authedClient('users.manage');
  if (!supabase) return unauthorized();
  let values;
  try { values = validateUser(await request.json()); }
  catch(e) { return Response.json({ error: e instanceof Error ? e.message : 'Datos inválidos.' }, { status: 400 }); }
  const admin = adminClient();
  if (!admin) return Response.json({ error: 'Falta configurar la creación de usuarios en el servidor.' }, { status: 503 });
  const { data: existing, error: lookup } = await supabase.from('profiles').select('id').eq('username',values.username).maybeSingle();
  if (lookup) return Response.json({ error: 'No pudimos verificar el usuario.' }, { status: 503 });
  if (existing) return Response.json({ error: 'Ese usuario ya existe.' }, { status: 409 });
  const { data, error } = await admin.auth.admin.createUser({ email: usernameToEmail(values.username), password: values.password, email_confirm: true });
  if (error || !data.user) return Response.json({ error: 'No pudimos crear la cuenta. Revisá que el usuario no exista y la contraseña cumpla las reglas de seguridad.' }, { status: 400 });
  const { error: saved } = await supabase.rpc('save_user_access', { p_id: data.user.id, p_username: values.username, p_full_name: values.full_name, p_permissions: values.permissions, p_enabled: values.enabled });
  if (saved) {
    const { error: rollback } = await admin.auth.admin.deleteUser(data.user.id);
    // Disable orphan authentication if cleanup cannot complete; never log passwords or tokens.
    if (rollback) await admin.auth.admin.updateUserById(data.user.id, { ban_duration: '876000h' });
    return Response.json({ error: 'No pudimos asignar los permisos. La cuenta no quedó habilitada para ingresar.' }, { status: 503 });
  }
  return Response.json({ id: data.user.id, username: values.username }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}
