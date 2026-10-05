export function kitchenPeriod(query: URLSearchParams) {
  const month = query.get('month'), year = query.get('year');
  if (month && !year && /^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return { from: month + '-01', until: month + '-31' };
  if (year && !month && /^\d{4}$/.test(year) && Number(year) >= 1900 && Number(year) <= 9998) return { from: year + '-01-01', until: year + '-12-31' };
  throw new Error('Elegí un mes o año válido.');
}
