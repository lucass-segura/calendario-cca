import { validate, sameOrigin } from '../../../../lib/reservations';
import { authedClient, unauthorized } from '../../../../lib/api';

function getScope(request: Request) {
  const scope = new URL(request.url).searchParams.get('scope') || 'single';
  if (!['single', 'series'].includes(scope)) throw new Error('Elegí esta fecha o toda la serie.');
  return scope;
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await authedClient('reservations.write');
  if (!supabase) return unauthorized();
  if (!sameOrigin(request)) return Response.json({ error: 'Solicitud no permitida.' }, { status: 403 });
  const { id } = await params;
  let d;
  let scope;
  try {
    d = validate(await request.json() as Record<string, unknown>);
    scope = getScope(request);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'Datos inválidos.' }, { status: 400 });
  }
  try {
    const p_data = { title: d.title, sector: d.sector, sectors: d.sectors, responsible: d.responsible, contact: d.contact, date: d.date, start: d.start, end: d.end, service: d.service, meal_type: d.meal_type, guests: d.guests, notes: d.notes, updated: new Date().toISOString() };
    const { data, error } = await supabase.rpc(scope === 'series' ? 'update_reservation_series' : 'update_reservation_single', { p_id: id, p_data });
    if (error) throw error;
    const count = data as number;
    if (!count) return Response.json({ error: scope === 'series' ? 'La serie ya no está disponible o algún horario está ocupado. No se modificó ninguna fecha.' : 'La reserva cambió o ese horario ya está ocupado.' }, { status: 409 });
    return Response.json({ ok: true, count });
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'No pudimos actualizar la reserva.' }, { status: 503 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await authedClient('reservations.write');
  if (!supabase) return unauthorized();
  if (!sameOrigin(request)) return Response.json({ error: 'Solicitud no permitida.' }, { status: 403 });
  const { id } = await params;
  let body;
  try {
    body = await request.json() as { prepared?: unknown };
    if (typeof body?.prepared !== 'boolean') throw new Error();
  } catch {
    return Response.json({ error: 'Estado inválido.' }, { status: 400 });
  }
  try {
    const { data, error } = await supabase.from('reservations')
      .update({ prepared: body.prepared ? 1 : 0, updated: new Date().toISOString() })
      .eq('id', id).eq('service', 'food').select('id');
    if (error) throw error;
    const changed = data.length > 0;
    return Response.json({ ok: changed }, { status: changed ? 200 : 404 });
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'No pudimos guardar el estado.' }, { status: 503 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await authedClient('reservations.write');
  if (!supabase) return unauthorized();
  if (!sameOrigin(request)) return Response.json({ error: 'Solicitud no permitida.' }, { status: 403 });
  const { id } = await params;
  let scope;
  try { scope = getScope(request); } catch { return Response.json({ error: 'Alcance inválido.' }, { status: 400 }); }
  try {
    let seriesId: string | null = null;
    if (scope === 'series') {
      const { data: row, error } = await supabase.from('reservations').select('series_id').eq('id', id).maybeSingle();
      if (error) throw error;
      seriesId = row?.series_id ?? null;
    }
    // A reservation without a series (or a missing one) matches nothing, as before.
    const query = scope === 'series'
      ? (seriesId ? supabase.from('reservations').delete().eq('series_id', seriesId) : null)
      : supabase.from('reservations').delete().eq('id', id);
    let count = 0;
    if (query) {
      const { data, error } = await query.select('id');
      if (error) throw error;
      count = data.length;
    }
    if (!count) return Response.json({ error: 'La reserva ya no está disponible.' }, { status: 404 });
    return Response.json({ ok: true, count });
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'No pudimos cancelar la reserva.' }, { status: 503 });
  }
}
