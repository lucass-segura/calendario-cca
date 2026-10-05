import type { KitchenMeal } from './kitchen';

export const mealsPerPage = 6;
export function kitchenExportPages(meals: KitchenMeal[], month: string): KitchenMeal[][] {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Mes inválido.');
  const rows = meals.filter(m=>m.date.startsWith(month+'-')).sort((a,b)=>a.date.localeCompare(b.date)||a.start.localeCompare(b.start)||a.id.localeCompare(b.id));
  if (!rows.length) return [[]];
  return Array.from({length:Math.ceil(rows.length/mealsPerPage)},(_,i)=>rows.slice(i*mealsPerPage,(i+1)*mealsPerPage));
}
