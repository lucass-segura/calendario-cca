'use client';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { Check, ChevronLeft, ChevronRight, RefreshCw, Utensils } from 'lucide-react';
import { ended, mealLabels, type KitchenMeal } from '../lib/kitchen';

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const money = (cents: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(cents / 100);
const noopSubscribe = () => () => {};

export function KitchenPanel({ canPrepare = false }: { canPrepare?: boolean }) {
  const currentMonth = useSyncExternalStore(noopSubscribe, () => today().slice(0, 7), () => '');
  const [chosenMonth, setMonth] = useState('');
  const month = chosenMonth || currentMonth;
  const [meals, setMeals] = useState<KitchenMeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<KitchenMeal | null>(null);
  const [guests, setGuests] = useState('');
  const [spent, setSpent] = useState('');
  const [performed, setPerformed] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!month) return;
    setLoading(true);
    try {
      const response = await fetch('/api/kitchen?month=' + month, { cache: 'no-store', signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (!signal?.aborted) { setMeals(data); setError(''); }
    } catch (e) { if (!signal?.aborted) setError(e instanceof Error ? e.message : 'No pudimos cargar cocina.'); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [month]);
  useEffect(() => {
    const controller = new AbortController();
    const first = setTimeout(() => void load(controller.signal), 0);
    const refresh = setInterval(() => void load(controller.signal), 60000);
    return () => { controller.abort(); clearTimeout(first); clearInterval(refresh); };
  }, [load]);

  function shiftMonth(delta: number) {
    const date = new Date(month + '-01T12:00:00Z');
    date.setUTCMonth(date.getUTCMonth() + delta);
    setMonth(date.toISOString().slice(0, 7));
    setSelected(null); setNotice('');
  }
  function open(meal: KitchenMeal) {
    setSelected(meal); setGuests(String(meal.report?.actual_guests ?? meal.guests));
    setSpent(meal.report ? (meal.report.spent_cents / 100).toFixed(2) : '');
    setPerformed(!!meal.report); setNote(''); setFormError(''); setNotice('');
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (!selected) return;
    setSaving(true); setFormError('');
    try {
      const response = await fetch('/api/kitchen/' + encodeURIComponent(selected.id), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ performed, actual_guests: guests.trim() === '' ? null : Number(guests), total_spent: spent, expected_revision: selected.report?.revision ?? 0, correction_note: note }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSelected(null); setNotice('Evento confirmado. Los datos reales quedaron registrados.'); await load();
    } catch (e) { setFormError(e instanceof Error ? e.message : 'No pudimos guardar.'); }
    finally { setSaving(false); }
  }
  async function prepare(meal: KitchenMeal) {
    setSaving(true);
    try {
      const response = await fetch('/api/reservations/' + encodeURIComponent(meal.id), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prepared: !meal.prepared }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'No pudimos marcar la preparación.'); }
    finally { setSaving(false); }
  }
  const visible = loading || !!error ? [] : meals;
  const confirmed = visible.filter(meal => meal.report);
  return <section className="kitchen-panel">
    <div className="toolbar"><div className="month-control"><button aria-label="Mes anterior" disabled={!month || saving} onClick={() => shiftMonth(-1)}><ChevronLeft /></button><h2>{month ? new Date(month + '-01T12:00:00').toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }) : 'Cargando…'}</h2><button aria-label="Mes siguiente" disabled={!month || saving} onClick={() => shiftMonth(1)}><ChevronRight /></button></div><button disabled={saving || loading} onClick={() => void load()}><RefreshCw size={17} />Actualizar</button></div>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="notice" role="status">{notice}</p>}
    <section className="stats" aria-label="Resumen de cocina"><div><div><span>Almuerzos previstos</span><strong>{loading || error ? '—' : visible.filter(m => m.meal_type === 'lunch').length}</strong></div></div><div><div><span>Meriendas previstas</span><strong>{loading || error ? '—' : visible.filter(m => m.meal_type === 'snack').length}</strong></div></div><div><div><span>Eventos confirmados</span><strong>{loading || error ? '—' : confirmed.length}<small> / {visible.length}</small></strong></div></div></section>
    {!!visible.filter(m => !m.meal_type).length && <p className="helper kitchen-warning">Hay {visible.filter(m => !m.meal_type).length} compromisos sin tipo de comida. Organización debe indicar si son almuerzo o merienda.</p>}
    {!!confirmed.length && <p className="kitchen-totals">Datos reales del mes: <strong>{confirmed.reduce((total, meal) => total + meal.report!.actual_guests, 0)} comensales</strong> · <strong>{money(confirmed.reduce((total, meal) => total + meal.report!.spent_cents, 0))}</strong> de gasto registrado. Solo incluye eventos confirmados.</p>}
    {loading && <p role="status" className="loading">Cargando compromisos…</p>}
    {!loading && !error && !visible.length && <div className="empty large"><Utensils size={36} /><h3>No hay comidas previstas este mes</h3></div>}
    {visible.map(meal => <article className="kitchen-event" key={meal.id}>
      <div className="kitchen-event-heading"><div><p className="eyebrow">{new Date(meal.date + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })} · {meal.start}–{meal.end}</p><h3>{meal.meal_type ? mealLabels[meal.meal_type] : 'Comida sin clasificar'} · {meal.title}</h3><p className="subtitle">{meal.sector}</p></div><span className={'badge ' + (meal.report ? 'prepared' : 'food')}>{meal.report ? 'Realizado y confirmado' : 'Por confirmar'}</span></div>
      <p className="kitchen-quantity">Previstos: <strong>{meal.guests} comensales</strong></p>{meal.notes && <p className="notes">{meal.notes}</p>}
      {canPrepare && !meal.report && <button className="outline" disabled={saving} onClick={() => void prepare(meal)}>{meal.prepared ? 'Preparación lista (desmarcar)' : 'Marcar preparación lista'}</button>}
      {meal.report && <div className="kitchen-record"><p>Reales: <strong>{meal.report.actual_guests} comensales</strong> · Gasto: <strong>{money(meal.report.spent_cents)}</strong></p><p className="helper">Confirmado el {new Date(meal.report.confirmed_at).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })} · Versión {meal.report.revision}</p></div>}
      <button className={meal.report ? 'outline' : 'primary'} disabled={saving || !meal.meal_type || !ended(meal.date, meal.end)} onClick={() => open(meal)}><Check size={17} />{meal.report ? 'Corregir datos reales' : 'Confirmar reunión realizada'}</button>
      {!ended(meal.date, meal.end) && <p className="helper">Se puede confirmar después del horario de finalización.</p>}
      {selected?.id === meal.id && <form onSubmit={save} className="kitchen-close"><h3>{meal.report ? 'Corregir el cierre' : 'Registrar los datos reales'}</h3><label className="kitchen-checkbox"><input type="checkbox" checked={performed} required onChange={e => setPerformed(e.target.checked)} />Confirmo que la reunión se realizó</label><div className="form-grid"><label>Comensales reales<input type="number" min="0" max="10000" step="1" required value={guests} onChange={e => setGuests(e.target.value)} disabled={saving} /></label><label>Gasto total (pesos argentinos)<input type="text" inputMode="decimal" placeholder="Ej. 12500,50" required value={spent} onChange={e => setSpent(e.target.value)} disabled={saving} /></label></div><p className="helper">Si no hubo gasto, ingresá 0. La cantidad prevista se conserva para comparar después.</p>{meal.report && <label>Motivo de la corrección<textarea required maxLength={1000} value={note} onChange={e => setNote(e.target.value)} disabled={saving} /></label>}{formError && <p role="alert" className="error">{formError}</p>}<div className="modal-actions"><button type="button" disabled={saving} onClick={() => setSelected(null)}>Volver</button><button className="primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar confirmación'}</button></div></form>}
    </article>)}
  </section>;
}
