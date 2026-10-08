import { authedClient, fetchAll, unauthorized } from '../../../../lib/api';
export async function GET() {
  const supabase = await authedClient('users.manage');
  if (!supabase) return unauthorized();
  try {
    const rows = await fetchAll((from, to) => supabase.from('reservation_annulments').select('*').order('cancelled_at', { ascending: false }).order('reservation_id').range(from, to));
    return Response.json(rows, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch { return Response.json({ error: 'No pudimos cargar el historial de anulaciones.' }, { status: 503 }); }
}
