import { authedClient } from '../../../../lib/api';
import { validateReport } from '../../../../lib/kitchen';
import { sameOrigin } from '../../../../lib/reservations';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return Response.json({ error: 'Solicitud no permitida.' }, { status: 403 });
  let report;
  try { report = validateReport(await request.json()); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Datos inválidos.' }, { status: 400 }); }
  try {
    const supabase = await authedClient('kitchen');
    if (!supabase) return Response.json({ error: 'Necesitás una cuenta habilitada.' }, { status: 403 });
    const { id } = await params;
    const { data, error } = await supabase.rpc('confirm_kitchen_event', { p_id: id, p_actual_guests: report.actual_guests, p_spent_cents: report.spent_cents, p_expected_revision: report.expected_revision, p_correction_note: report.correction_note });
    if (error) {
      if (error.code === '40001') return Response.json({ error: 'Otra hermana actualizó este evento. Recargalo antes de corregir.' }, { status: 409 });
      if (error.code === '22023') return Response.json({ error: error.message }, { status: 400 });
      if (error.code === '42501') return Response.json({ error: 'No tenés permiso para confirmar eventos.' }, { status: 403 });
      throw error;
    }
    return Response.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'No pudimos guardar el cierre. Conservamos tus datos en el formulario.' }, { status: 503 });
  }
}
