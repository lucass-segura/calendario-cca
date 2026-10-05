import { authedClient, fetchAll, unauthorized } from '../../../../lib/api';
import { kitchenPeriod } from '../../../../lib/kitchen-period';
import type { KitchenStatReport } from '../../../../lib/kitchen-stats';
export async function GET(request: Request) {
  const supabase = await authedClient('stats.read');
  if (!supabase) return unauthorized();
  let period;
  try { const query = new URL(request.url).searchParams; if (!query.get('year') || query.get('month')) throw new Error(); period = kitchenPeriod(query); }
  catch { return Response.json({ error: 'Elegí un año válido.' }, { status: 400 }); }
  try {
    const reports = await fetchAll<KitchenStatReport>((from, until) => supabase.from('kitchen_reports').select('reservation_id,event_date,actual_guests,spent_cents,planned_snapshot').gte('event_date', period.from).lte('event_date', period.until).order('event_date').order('reservation_id').range(from, until));
    return Response.json(reports, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch { return Response.json({ error: 'No pudimos cargar los cierres de cocina.' }, { status: 503 }); }
}
