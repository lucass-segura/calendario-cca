import { validate, sameOrigin } from '../../../lib/reservations';
import { monthlyDates, type MonthlyRule } from '../../../lib/recurrence';
import { authedClient, fetchAll, reservationOut, unauthorized } from '../../../lib/api';

export async function GET(request: Request) {
  const supabase = await authedClient();
  if (!supabase) return unauthorized();
  const query = new URL(request.url).searchParams;
  const month = query.get('month');
  const year = query.get('year');
  let from: string;
  let until: string;
  if (month && !year && /^\d{4}-(0[1-9]|1[0-2])$/.test(month)) { from = month + '-01'; until = month + '-31'; }
  else if (year && !month && /^\d{4}$/.test(year) && Number(year) >= 1900 && Number(year) <= 9998) { from = year + '-01-01'; until = year + '-12-31'; }
  else return Response.json({ error: 'Elegí un mes o año válido.' }, { status: 400 });
  try {
    const rows = await fetchAll<Record<string, unknown>>((a, b) =>
      supabase.from('reservations').select('*').gte('date', from).lte('date', until)
        .order('date').order('start').order('id').range(a, b));
    return Response.json(rows.map(reservationOut), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'No pudimos cargar las reservas. Intentá nuevamente.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const supabase = await authedClient();
  if (!supabase) return unauthorized();
  if (!sameOrigin(request)) return Response.json({ error: 'Solicitud no permitida.' }, { status: 403 });
  let d;
  let rule: MonthlyRule | null = null;
  let dates: string[];
  try {
    const body = await request.json() as Record<string, unknown>;
    d = validate(body);
    if (body.repeat !== undefined && body.repeat !== null) {
      if (typeof body.repeat !== 'object') throw new Error('Repetición inválida.');
      rule = body.repeat as MonthlyRule;
      dates = monthlyDates(d.date, rule);
      rule = { ordinal: rule.ordinal, weekday: rule.weekday, until: rule.until, weekend: rule.weekend ?? false, frequency: rule.frequency ?? 'all', ...(rule.frequency === 'selected' ? { months: [...new Set(rule.months)].sort() } : {}) };
    } else dates = [d.date];
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'Datos inválidos.' }, { status: 400 });
  }
  try {
    const incoming = dates.map(date => ({ id: crypto.randomUUID(), date }));
    const series = rule ? crypto.randomUUID() : null;
    const { data, error } = await supabase.rpc('create_reservations', {
      p_data: { title: d.title, sector: d.sector, sectors: d.sectors, responsible: d.responsible, contact: d.contact, start: d.start, end: d.end, service: d.service, meal_type: d.meal_type, guests: d.guests, notes: d.notes, updated: new Date().toISOString() },
      p_items: incoming,
      p_series_id: series,
      p_rule: rule,
    });
    if (error) throw error;
    const result = data as { count: number; conflicts?: string[] };
    if (!result.count) return Response.json({ error: 'Hay horarios ocupados en las fechas indicadas. No se creó ninguna reserva. Cambiá el horario o el período.', conflicts: result.conflicts ?? [] }, { status: 409 });
    return Response.json({ id: incoming[0].id, count: result.count, firstDate: dates[0], series_id: series }, { status: 201 });
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'No pudimos guardar. Tus datos siguen en el formulario.' }, { status: 503 });
  }
}
