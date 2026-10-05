import { sameOrigin } from '../../../lib/reservations';
import { authedClient, unauthorized } from '../../../lib/api';

const defaults = { name: 'Mi iglesia', sectors: ['Jóvenes', 'Mujeres', 'Varones', 'Escuela bíblica', 'Misiones', 'Equipo pastoral'] };

export async function GET() {
  const supabase = await authedClient();
  if (!supabase) return unauthorized();
  try {
    const { data, error } = await supabase.from('settings').select('name,sectors').eq('id', 1).maybeSingle();
    if (error) throw error;
    return Response.json(data ? { name: data.name, sectors: data.sectors } : defaults, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'No pudimos cargar los nombres de la comunidad.' }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  const supabase = await authedClient('settings.write');
  if (!supabase) return unauthorized();
  if (!sameOrigin(request)) return Response.json({ error: 'Solicitud no permitida.' }, { status: 403 });
  let body;
  try { body = await request.json() as { name?: unknown; sectors?: unknown }; } catch { return Response.json({ error: 'Datos inválidos.' }, { status: 400 }); }
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const sectors = Array.isArray(body.sectors) ? Array.from(new Set(body.sectors.filter((s: unknown) => typeof s === 'string').map((s: string) => s.trim()).filter(Boolean))) : [];
  if (!name || name.length > 120 || !sectors.length || sectors.length > 50 || sectors.some(s => String(s).length > 120)) return Response.json({ error: 'Ingresá un nombre de iglesia y entre 1 y 50 sectores, de hasta 120 caracteres.' }, { status: 400 });
  try {
    const { error } = await supabase.from('settings').upsert({ id: 1, name, sectors }, { onConflict: 'id' });
    if (error) throw error;
    return Response.json({ name, sectors });
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'No pudimos guardar los nombres.' }, { status: 503 });
  }
}
