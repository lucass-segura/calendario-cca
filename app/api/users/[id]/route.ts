import { authedClient, unauthorized } from '../../../../lib/api';
import { validateUser } from '../../../../lib/permissions';
import { sameOrigin } from '../../../../lib/reservations';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return Response.json({ error: 'Solicitud no permitida.' }, { status: 403 });
  const supabase = await authedClient('users.manage');
  if (!supabase) return unauthorized();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: 'Usuario inválido.' }, { status: 400 });
  let values;
  try { values = validateUser(await request.json(), false); }
  catch(e) { return Response.json({ error: e instanceof Error ? e.message : 'Datos inválidos.' }, { status: 400 }); }
  const { data: profile, error: lookup } = await supabase.from('profiles').select('username').eq('id',id).maybeSingle();
  if (lookup) return Response.json({ error: 'No pudimos consultar la cuenta.' }, { status: 503 });
  if (!profile) return Response.json({ error: 'La cuenta ya no existe.' }, { status: 404 });
  const { error } = await supabase.rpc('save_user_access', { p_id: id, p_username: profile.username, p_full_name: values.full_name, p_permissions: values.permissions, p_enabled: values.enabled });
  if (error) return Response.json({ error: error.code === '22023' ? error.message : 'No pudimos guardar los permisos.' }, { status: error.code === '22023' ? 400 : error.code === '42501' ? 403 : 503 });
  return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
