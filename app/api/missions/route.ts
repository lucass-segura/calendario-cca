import { sameOrigin } from '../../../lib/reservations';
import { dateRange, validDate, type MissionEntry } from '../../../lib/missions';
import { authedClient, fetchAll, unauthorized } from '../../../lib/api';

type TripRow = { id: string; date: string; place_id: string; people_json: string[]; notes: string; updated: string };

export async function GET(request: Request) {
  const supabase = await authedClient('missions.read');
  if (!supabase) return unauthorized();
  let range;
  try { range = dateRange(request); } catch (e) { return Response.json({ error: (e as Error).message }, { status: 400 }); }
  try {
    const [trips, people, places] = await Promise.all([
      fetchAll<TripRow>((a, b) => supabase.from('mission_trips').select('*').gte('date', range[0]).lte('date', range[1]).order('date').order('id').range(a, b)),
      fetchAll<MissionEntry>((a, b) => supabase.from('mission_people').select('*').order('id').range(a, b)),
      fetchAll<MissionEntry>((a, b) => supabase.from('mission_places').select('*').order('id').range(a, b)),
    ]);
    const placeNames = new Map(places.map(p => [p.id, p.name]));
    const personNames = new Map(people.map(p => [p.id, p.name]));
    return Response.json(trips.map(({ people_json, ...r }) => {
      const ids = people_json;
      return { ...r, person_ids: ids, place: placeNames.get(r.place_id) || 'Lugar no disponible', people: ids.map(id => personNames.get(id) || 'Hermano no disponible') };
    }), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'No pudimos cargar las atenciones.' }, { status: 503 });
  }
}

async function write(request: Request, edit: boolean) {
  const supabase = await authedClient('missions.write');
  if (!supabase) return unauthorized();
  if (!sameOrigin(request)) return Response.json({ error: 'Solicitud no permitida.' }, { status: 403 });
  let b;
  try {
    b = await request.json() as Record<string, unknown>;
    if (!b || typeof b !== 'object' || Array.isArray(b)) throw new Error('Datos inválidos.');
  } catch { return Response.json({ error: 'Datos inválidos.' }, { status: 400 }); }
  if (!validDate(b.date) || typeof b.place_id !== 'string' || !b.place_id || !Array.isArray(b.person_ids) || !b.person_ids.length || b.person_ids.length > 30 || b.person_ids.some(id => typeof id !== 'string' || !id) || typeof b.notes !== 'string' || b.notes.length > 2000 || (edit && (typeof b.id !== 'string' || !b.id)))
    return Response.json({ error: 'Elegí una fecha, un lugar y al menos un hermano. Las observaciones admiten hasta 2.000 caracteres.' }, { status: 400 });
  try {
    const ids = [...new Set(b.person_ids as string[])];
    let previous: { place_id: string; people_json: string[] } | null = null;
    if (edit) {
      const { data, error } = await supabase.from('mission_trips').select('place_id,people_json').eq('id', b.id as string).maybeSingle();
      if (error) throw error;
      previous = data;
      if (!previous) return Response.json({ error: 'La atención ya no está disponible.' }, { status: 404 });
    }
    const [placeResult, peopleResult] = await Promise.all([
      supabase.from('mission_places').select('active').eq('id', b.place_id).maybeSingle(),
      supabase.from('mission_people').select('id,active').in('id', ids),
    ]);
    if (placeResult.error) throw placeResult.error;
    if (peopleResult.error) throw peopleResult.error;
    const place = placeResult.data;
    const people = peopleResult.data;
    const oldIds = previous?.people_json ?? [];
    if (!place || (place.active !== 1 && previous?.place_id !== b.place_id) || people.length !== ids.length || people.some(p => p.active !== 1 && !oldIds.includes(p.id)))
      return Response.json({ error: 'Elegí nombres y lugares disponibles en la nómina.' }, { status: 400 });
    const id = edit ? (b.id as string) : crypto.randomUUID();
    const updated = new Date().toISOString();
    const values = { date: b.date, place_id: b.place_id, people_json: ids, notes: b.notes.trim(), updated };
    const result = edit
      ? await supabase.from('mission_trips').update(values).eq('id', id).select('id')
      : await supabase.from('mission_trips').insert({ id, ...values }).select('id');
    if (result.error) throw result.error;
    if (!result.data.length) return Response.json({ error: 'La atención ya no está disponible.' }, { status: 404 });
    return Response.json({ id }, { status: edit ? 200 : 201 });
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'No pudimos guardar la atención.' }, { status: 503 });
  }
}

export const POST = (r: Request) => write(r, false);
export const PUT = (r: Request) => write(r, true);

export async function DELETE(request: Request) {
  const supabase = await authedClient('missions.write');
  if (!supabase) return unauthorized();
  if (!sameOrigin(request)) return Response.json({ error: 'Solicitud no permitida.' }, { status: 403 });
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return Response.json({ error: 'Falta la atención.' }, { status: 400 });
  try {
    const { data, error } = await supabase.from('mission_trips').delete().eq('id', id).select('id');
    if (error) throw error;
    const changed = data.length > 0;
    return Response.json({ ok: changed }, { status: changed ? 200 : 404 });
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'No pudimos cancelar la atención.' }, { status: 503 });
  }
}
