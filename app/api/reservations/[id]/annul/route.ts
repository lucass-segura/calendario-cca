import { authedClient, unauthorized } from '../../../../../lib/api';
import { sameOrigin } from '../../../../../lib/reservations';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await authedClient('users.manage');
  if (!supabase) return unauthorized();
  if (!sameOrigin(request)) return Response.json({ error: 'Solicitud no permitida.' }, { status: 403 });
  let reason: string, scope: string;
  try {
    const body = await request.json();
    reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
    scope = body?.scope;
    if (!reason || reason.length > 1000 || !['single', 'series'].includes(scope)) throw new Error();
  } catch { return Response.json({ error: 'Indicá el alcance y un motivo de hasta 1000 caracteres.' }, { status: 400 }); }
  const { id } = await params;
  try {
    const { data, error } = await supabase.rpc('annul_reservation', { p_id: id, p_scope: scope, p_reason: reason });
    if (error) return Response.json({ error: 'No pudimos anular la reserva. Actualizá la agenda y volvé a intentarlo.' }, { status: error.code === '22023' ? 409 : 503 });
    if (!data) return Response.json({ error: 'La reserva ya no está disponible.' }, { status: 404 });
    return Response.json({ ok: true, count: data });
  } catch { return Response.json({ error: 'No pudimos anular la reserva.' }, { status: 503 }); }
}
