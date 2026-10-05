import { sameOrigin } from '../../../../lib/reservations';
import { authedClient, fetchAll, likeLiteral, unauthorized } from '../../../../lib/api';

const tables = { people: 'mission_people', places: 'mission_places' } as const;

export async function GET() {
  const supabase = await authedClient('missions.read');
  if (!supabase) return unauthorized();
  try {
    const [people, places] = await Promise.all([
      fetchAll((a, b) => supabase.from('mission_people').select('*').order('name').order('id').range(a, b)),
      fetchAll((a, b) => supabase.from('mission_places').select('*').order('name').order('id').range(a, b)),
    ]);
    return Response.json({ people, places }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'No pudimos cargar la nómina y los lugares.' }, { status: 503 });
  }
}

async function write(request: Request, edit: boolean) {
  const supabase = await authedClient('missions.write');
  if (!supabase) return unauthorized();
  if (!sameOrigin(request)) return Response.json({ error: 'Solicitud no permitida.' }, { status: 403 });
  let body;
  try {
    body = await request.json() as Record<string, unknown>;
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Datos inválidos.');
  } catch { return Response.json({ error: 'Datos inválidos.' }, { status: 400 }); }
  const kind = body.kind as keyof typeof tables;
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!['people', 'places'].includes(kind) || !name || name.length > 120 || (edit && (typeof body.id !== 'string' || !body.id)) || (body.active !== undefined && body.active !== 0 && body.active !== 1))
    return Response.json({ error: 'Ingresá un nombre de hasta 120 caracteres.' }, { status: 400 });
  try {
    const table = tables[kind];
    const active = (body.active ?? 1) as number;
    const duplicate = await supabase.from(table).select('id').ilike('name', likeLiteral(name)).neq('id', edit ? (body.id as string) : '').limit(1);
    if (duplicate.error) throw duplicate.error;
    if (duplicate.data.length) return Response.json({ error: 'Ese nombre ya está en la lista.' }, { status: 409 });
    const id = edit ? (body.id as string) : crypto.randomUUID();
    const result = edit
      ? await supabase.from(table).update({ name, active }).eq('id', id).select('id')
      : await supabase.from(table).insert({ id, name, active }).select('id');
    if (result.error) throw result.error;
    if (!result.data.length) return Response.json({ error: 'El registro ya no está disponible.' }, { status: 404 });
    return Response.json({ id, name, active }, { status: edit ? 200 : 201 });
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'No pudimos guardar el nombre.' }, { status: 503 });
  }
}

export const POST = (r: Request) => write(r, false);
export const PUT = (r: Request) => write(r, true);

export async function DELETE(request: Request) {
  const supabase = await authedClient('missions.write');
  if (!supabase) return unauthorized();
  if (!sameOrigin(request)) return Response.json({ error: 'Solicitud no permitida.' }, { status: 403 });
  const query = new URL(request.url).searchParams;
  const kind = query.get('kind');
  const id = query.get('id');
  if (!id || (kind !== 'people' && kind !== 'places')) return Response.json({ error: 'Elegí un registro válido.' }, { status: 400 });
  try {
    const { data, error } = await supabase.from(tables[kind]).update({ active: -1 }).eq('id', id).neq('active', -1).select('id');
    if (error) throw error;
    if (!data.length) return Response.json({ error: 'El registro ya no está disponible.' }, { status: 404 });
    return Response.json({ ok: true });
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'No pudimos eliminar el registro.' }, { status: 503 });
  }
}
