import { authedClient, fetchAll } from '../../../lib/api';
import type { KitchenMeal, KitchenReport } from '../../../lib/kitchen';

export async function GET(request: Request) {
  try {
    const supabase = await authedClient('kitchen');
    if (!supabase) return Response.json({ error: 'Necesitás una cuenta habilitada.' }, { status: 403 });
    const month = new URL(request.url).searchParams.get('month');
    if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return Response.json({ error: 'Elegí un mes válido.' }, { status: 400 });
    const rows = await fetchAll<Omit<KitchenMeal, 'report'>>((a, b) => supabase.from('reservations')
      .select('id,title,sector,date,start,end,guests,notes,prepared,meal_type').eq('service', 'food')
      .gte('date', month + '-01').lte('date', month + '-31').order('date').order('start').order('id').range(a, b));
    const ids = new Set(rows.map(row => row.id));
    const reports = await fetchAll<KitchenReport>((a, b) => supabase.from('kitchen_reports').select('*')
      .gte('event_date', month + '-01').lte('event_date', month + '-31').order('reservation_id').range(a, b));
    const byId = new Map(reports.filter(report => ids.has(report.reservation_id)).map(report => [report.reservation_id, report]));
    return Response.json(rows.map(row => ({ ...row, report: byId.get(row.id) ?? null })), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'No pudimos cargar cocina. Revisá que la migración esté aplicada.' }, { status: 503 });
  }
}
