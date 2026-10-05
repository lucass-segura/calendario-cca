export type KitchenStatReport = { reservation_id: string; event_date: string; actual_guests: number; spent_cents: number; planned_snapshot: { title?: string; meal_type?: string; guests?: number } };
export function kitchenActualTotals(reports: KitchenStatReport[], month?: string) {
  return reports.filter(report => !month || report.event_date.startsWith(month + '-')).reduce((total, report) => ({ events: total.events + 1, guests: total.guests + report.actual_guests, spent_cents: total.spent_cents + report.spent_cents }), { events: 0, guests: 0, spent_cents: 0 });
}
