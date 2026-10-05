export type MealType = 'lunch' | 'snack';
export const mealLabels: Record<MealType, string> = { lunch: 'Almuerzo', snack: 'Merienda' };
export type KitchenReport = { reservation_id: string; actual_guests: number; spent_cents: number; currency: 'ARS'; revision: number; confirmed_at: string; confirmed_by: string; correction_note: string; planned_snapshot: Record<string, unknown> };
export type KitchenMeal = { id: string; title: string; sector: string; date: string; start: string; end: string; guests: number; notes: string; prepared: number; meal_type: MealType | null; report: KitchenReport | null };

export function validateReport(body: Record<string, unknown>) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Datos inválidos.');
  const guests = body.actual_guests;
  if (typeof guests !== 'number' || !Number.isInteger(guests) || guests < 0 || guests > 10000) throw new Error('Ingresá entre 0 y 10.000 comensales reales.');
  const amount = typeof body.total_spent === 'string' ? body.total_spent.trim().replace(',', '.') : '';
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(amount)) throw new Error('Ingresá un gasto válido en pesos, con hasta dos decimales.');
  const [whole, decimals = ''] = amount.split('.');
  const cents = Number(whole) * 100 + Number(decimals.padEnd(2, '0'));
  if (cents > 1000000000) throw new Error('El gasto no puede superar $10.000.000.');
  if (body.performed !== true) throw new Error('Confirmá que la reunión se realizó.');
  const revision = body.expected_revision;
  if (typeof revision !== 'number' || !Number.isInteger(revision) || revision < 0) throw new Error('Recargá el evento antes de guardar.');
  const note = typeof body.correction_note === 'string' ? body.correction_note.trim() : '';
  if (note.length > 1000 || (revision > 0 && !note)) throw new Error('Para corregir un cierre, indicá el motivo (hasta 1.000 caracteres).');
  return { actual_guests: guests, spent_cents: cents, expected_revision: revision, correction_note: note };
}

export function ended(date: string, end: string, now = new Date()) {
  return new Date(`${date}T${end}:00-03:00`).getTime() <= now.getTime();
}
