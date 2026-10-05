import { currentAccess } from '../../../../../lib/auth/access';
import { recoveryDni } from '../../../../../lib/auth/recovery';
import { adminClient } from '../../../../../lib/supabase/admin';
import { sameOrigin } from '../../../../../lib/reservations';

const headers = { 'Cache-Control': 'private, no-store' };
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return Response.json({ error: 'Solicitud no permitida.' }, { status: 403, headers });
  const session = await currentAccess();
  if (!session?.profile.permissions.includes('users.manage')) return Response.json({ error: 'Necesitás permisos de administrador.' }, { status: 403, headers });
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return Response.json({ error: 'Usuario inválido.' }, { status: 400, headers });
  let supplied;
  try { const body = await request.json(); supplied = recoveryDni(body.dni); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Solicitud inválida.' }, { status: 400, headers }); }
  const admin = adminClient();
  if (!admin) return Response.json({ error: 'Falta configurar la clave privada de Supabase en el servidor.' }, { status: 503, headers });
  const { data: target, error: lookup } = await session.supabase.from('profiles').select('id').eq('id', id).maybeSingle();
  if (lookup || !target) return Response.json({ error: 'No pudimos consultar la cuenta.' }, { status: 404, headers });
  const { data: recovery, error: recoveryError } = await admin.from('user_password_recovery').select('dni').eq('user_id', id).maybeSingle();
  if (recoveryError) return Response.json({ error: 'No pudimos consultar los datos de restablecimiento.' }, { status: 503, headers });
  const dni = supplied || recovery?.dni;
  if (!dni) return Response.json({ error: 'Esta cuenta todavía no tiene DNI registrado. Completalo para restablecer su contraseña.' }, { status: 400, headers });
  // Save first; if Auth fails the administrator can retry with the recorded recovery value.
  if (supplied) {
    const { error } = await admin.from('user_password_recovery').upsert({ user_id: id, dni, updated_at: new Date().toISOString() });
    if (error) return Response.json({ error: 'No pudimos guardar el dato de restablecimiento.' }, { status: 503, headers });
  }
  const { error } = await admin.auth.admin.updateUserById(id, { password: dni });
  if (error) return Response.json({ error: 'No pudimos restablecer la contraseña. La clave debe cumplir las reglas de Supabase.' }, { status: 400, headers });
  const { error: audit } = await admin.from('user_password_reset_history').insert({ user_id: id, actor_id: session.profile.id });
  return Response.json({ ok: true, warning: audit ? 'La contraseña cambió, pero no pudimos registrar el historial administrativo.' : undefined }, { headers });
}
