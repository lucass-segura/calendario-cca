'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { MissionTrip } from '../lib/missions';
import { kitchenActualTotals, type KitchenStatReport } from '../lib/kitchen-stats';
type KitchenRow = { date: string; service: string; guests: number };
type StatsData = { kitchen: KitchenRow[]; missions: MissionTrip[]; reports: KitchenStatReport[] };
const money = (cents: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(cents / 100);

export function OrganizationStats({ name }: { name: string }) {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [loaded, setData] = useState<StatsData | null>(null);
  const [fetchError, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const validYear = /^\d{4}$/.test(year) && Number(year) >= 1900 && Number(year) <= 9998;
  const error = validYear ? fetchError : 'Elegí un año válido.';
  const data = validYear && !error ? loaded : null;
  const load = useCallback(async (signal?: AbortSignal) => {
    if (!validYear) return;
    const requestGeneration = ++generation.current;
    setLoading(true);
    async function get<T>(url: string): Promise<T> {
      const response = await fetch(url + year, { signal, cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No pudimos cargar las estadísticas.');
      return result;
    }
    try {
      const [kitchen, missions, reports] = await Promise.all([get<KitchenRow[]>('/api/reservations?year='), get<MissionTrip[]>('/api/missions?year='), get<KitchenStatReport[]>('/api/stats/kitchen?year=')]);
      if (!signal?.aborted && requestGeneration === generation.current) { setData({ kitchen, missions, reports }); setError(''); }
    } catch (cause) { if (!signal?.aborted && requestGeneration === generation.current) setError(cause instanceof Error ? cause.message : 'No pudimos cargar las estadísticas.'); }
    finally { if (!signal?.aborted && requestGeneration === generation.current) setLoading(false); }
  }, [year, validYear]);
  useEffect(() => {
    const controller = new AbortController();
    const first = setTimeout(() => void load(controller.signal), 0);
    const refresh = setInterval(() => void load(controller.signal), 60000);
    return () => { controller.abort(); clearTimeout(first); clearInterval(refresh); };
  }, [load]);
  const actual = kitchenActualTotals(data?.reports || []);
  return <>
    <header><div><p className="eyebrow">{name} / Organización</p><h1>Estadísticas generales</h1><p className="subtitle">Lo previsto y lo confirmado por cocina, junto a los viajes misioneros.</p></div><label>Año<input type="number" min={1900} max={9998} value={year} onChange={event => { generation.current++; setYear(event.target.value); setData(null); setError(''); }}/></label><button disabled={!validYear || loading} onClick={() => void load()}><RefreshCw size={17}/>{loading ? 'Actualizando…' : 'Actualizar'}</button></header>
    {error && <p className="error" role="alert">{error}</p>}
    {!data && !error && <p className="loading" role="status">Cargando estadísticas…</p>}
    {data && <>
      <section className="stats">
        <div><div><span>Actividades de ambos módulos</span><strong>{data.kitchen.length + data.missions.length}</strong><small>reservas + atenciones</small></div></div>
        <div><div><span>Comensales previstos con comida</span><strong>{data.kitchen.filter(row => row.service === 'food').reduce((sum, row) => sum + row.guests, 0)}</strong></div></div>
        <div><div><span>Asignaciones de viaje</span><strong>{data.missions.reduce((sum, trip) => sum + trip.person_ids.length, 0)}</strong><small>hermanos por atención</small></div></div>
      </section>
      <section className="stats" aria-label="Datos confirmados por cocina">
        <div><div><span>Eventos confirmados por cocina</span><strong>{actual.events}</strong><small>encuentros realizados</small></div></div>
        <div><div><span>Comensales confirmados</span><strong>{actual.guests}</strong><small>cantidad real informada por cocina</small></div></div>
        <div><div><span>Gasto total registrado</span><strong>{money(actual.spent_cents)}</strong><small>pesos argentinos · solo eventos confirmados</small></div></div>
      </section>
      {!actual.events && <p className="helper">Todavía no hay eventos confirmados por cocina en este año. Las cantidades previstas no se cuentan como asistencia real.</p>}
      <section className="settings-panel stats-table"><h2>Resumen por mes</h2><p>Los comensales reales y los gastos se agrupan por la fecha del evento. Las correcciones reemplazan el dato anterior; no suman un evento nuevo.</p><div className="table-scroll"><table><thead><tr><th>Mes</th><th>Reservas de cocina</th><th>Comensales previstos</th><th>Eventos confirmados</th><th>Comensales confirmados</th><th>Gasto registrado</th><th>Atenciones</th><th>Asignaciones de viaje</th><th>Total actividades</th></tr></thead><tbody>{Array.from({ length: 12 }, (_, index) => {
        const month = year + '-' + String(index + 1).padStart(2, '0'), kitchen = data.kitchen.filter(row => row.date.startsWith(month)), missions = data.missions.filter(row => row.date.startsWith(month)), totals = kitchenActualTotals(data.reports, month);
        return <tr key={month}><th>{new Date(month + '-01T12:00:00Z').toLocaleDateString('es-AR', { month: 'long', timeZone: 'UTC' })}</th><td>{kitchen.length}</td><td>{kitchen.filter(row => row.service === 'food').reduce((sum, row) => sum + row.guests, 0)}</td><td>{totals.events}</td><td>{totals.guests}</td><td>{money(totals.spent_cents)}</td><td>{missions.length}</td><td>{missions.reduce((sum, row) => sum + row.person_ids.length, 0)}</td><td>{kitchen.length + missions.length}</td></tr>;
      })}</tbody></table></div></section>
      <section className="settings-panel stats-table"><h2>Detalle de eventos confirmados</h2><p>Últimos datos guardados por cocina para cada encuentro del año.</p>{data.reports.length ? <div className="table-scroll"><table><thead><tr><th>Fecha del evento</th><th>Evento</th><th>Comida</th><th>Comensales confirmados</th><th>Gasto registrado</th></tr></thead><tbody>{data.reports.map(report => <tr key={report.reservation_id}><td>{report.event_date.split('-').reverse().join('/')}</td><td>{report.planned_snapshot.title || 'Encuentro de cocina'}</td><td>{report.planned_snapshot.meal_type === 'lunch' ? 'Almuerzo' : report.planned_snapshot.meal_type === 'snack' ? 'Merienda' : 'Comida'}</td><td>{report.actual_guests}</td><td>{money(report.spent_cents)}</td></tr>)}</tbody></table></div> : <p>No hay cierres registrados.</p>}</section>
    </>}
  </>;
}
