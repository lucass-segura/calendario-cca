import { authedClient, fetchAll } from '../../../lib/api';
import type { KitchenMeal, KitchenReport } from '../../../lib/kitchen';
import { kitchenPeriod } from '../../../lib/kitchen-period';

export async function GET(request: Request) {
  try {
    const supabase = await authedClient('kitchen.read');
    if (!supabase) return Response.json({ error: 'Necesitás una cuenta habilitada.' }, { status: 403 });
    let period;
    try { period = kitchenPeriod(new URL(request.url).searchParams); }
    catch { return Response.json({ error: 'Elegí un mes o año válido.' }, { status: 400 }); }
    const rows = await fetchAll<Omit<KitchenMeal, 'report'>>((a, b) => supabase.from('reservations')
      .select('id,title,sector,date,start,end,guests,notes,prepared,meal_type').eq('service', 'food')
      .gte('date', period.from).lte('date', period.until).order('date').order('start').order('id').range(a, b));
    const ids = new Set(rows.map(row => row.id));
    const reports = await fetchAll<KitchenReport>((a, b) => supabase.from('kitchen_reports').select('*')
      .gte('event_date', period.from).lte('event_date', period.until).order('reservation_id').range(a, b));
    const byId = new Map(reports.filter(report => ids.has(report.reservation_id)).map(report => [report.reservation_id, report]));
    return Response.json(rows.map(row => ({ ...row, report: byId.get(row.id) ?? null })), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'No pudimos cargar cocina. Revisá que la migración esté aplicada.' }, { status: 503 });
  }
}
