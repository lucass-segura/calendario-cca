'use client';
import './kitchen.css';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Check, CheckCircle2, ChevronLeft, ChevronRight, RefreshCw, Utensils, Coffee, Users, Printer, Download, Share2, CalendarDays, Pencil } from 'lucide-react';
import { AlmanacDialog } from './almanac-dialog';
import { KitchenShare } from './kitchen-share';
import { ended, mealLabels, type KitchenMeal } from '../lib/kitchen';

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const money = (cents: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(cents / 100);
const noopSubscribe = () => () => {};

export function KitchenPanel({ canPrepare = false, canConfirm = false }: { canPrepare?: boolean; canConfirm?: boolean }) {
  const currentMonth = useSyncExternalStore(noopSubscribe, () => today().slice(0, 7), () => '');
  const [almanac,setAlmanac]=useState(false);
  const focusMeal=useRef<string|null>(null);
  const [shareAction,setShareAction] = useState<'preview'|'print'|null>(null);
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

  useEffect(()=>{if(loading||!focusMeal.current)return;const element=document.getElementById('kitchen-event-'+focusMeal.current);if(element){element.scrollIntoView({behavior:'smooth',block:'center'});element.focus({preventScroll:true});focusMeal.current=null;}},[loading,meals]);
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
    <div className="kitchen-agenda-heading"><div><p className="eyebrow">NOS ORGANIZAMOS PARA SERVIR</p><h2>Mis compromisos</h2></div><button className="kitchen-refresh" disabled={saving || loading} onClick={() => void load()}><RefreshCw size={17} />Actualizar</button></div>
    <div className="kitchen-month-bar"><div className="month-control"><button aria-label="Mes anterior" disabled={!month || saving} onClick={() => shiftMonth(-1)}><ChevronLeft /></button><h3>{month ? new Date(month + '-01T12:00:00Z').toLocaleDateString('es-AR', { month: 'long', year: 'numeric',timeZone:'UTC' }) : 'Cargando…'}</h3><button aria-label="Mes siguiente" disabled={!month || saving} onClick={() => shiftMonth(1)}><ChevronRight /></button></div><div className="kitchen-export-buttons"><button disabled={!month||saving} onClick={()=>setAlmanac(true)}><CalendarDays size={17}/>Vista almanaque</button><button disabled={!month||saving||loading||!!error} onClick={()=>setShareAction('print')}><Printer size={17}/>Imprimir</button><button disabled={!month||saving||loading||!!error} onClick={()=>setShareAction('preview')}><Download size={17}/>Descargar imagen</button><button className="kitchen-whatsapp" disabled={!month||saving||loading||!!error} onClick={()=>setShareAction('preview')}><Share2 size={17}/>WhatsApp</button></div></div>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="notice" role="status">{notice}</p>}
    <section className="kitchen-summary" aria-label="Resumen de cocina"><div className="kitchen-summary-card lunch"><span className="summary-icon"><Utensils size={24}/></span><div><span>Almuerzos</span><strong>{loading || error ? '—' : visible.filter(m => m.meal_type === 'lunch').length}</strong><small>{visible.filter(m=>m.meal_type==='lunch').reduce((sum,m)=>sum+m.guests,0)} comensales previstos</small></div></div><div className="kitchen-summary-card snack"><span className="summary-icon"><Coffee size={24}/></span><div><span>Meriendas</span><strong>{loading || error ? '—' : visible.filter(m => m.meal_type === 'snack').length}</strong><small>{visible.filter(m=>m.meal_type==='snack').reduce((sum,m)=>sum+m.guests,0)} comensales previstos</small></div></div><div className="kitchen-summary-card completed"><span className="summary-icon"><CheckCircle2 size={24}/></span><div><span>Confirmados</span><strong>{loading || error ? '—' : confirmed.length}<small> / {visible.length}</small></strong><small>Encuentros realizados</small></div></div></section>
    {!!visible.filter(m => !m.meal_type).length && <p className="helper kitchen-warning">Hay {visible.filter(m => !m.meal_type).length} compromisos sin tipo de comida. Organización debe indicar si son almuerzo o merienda.</p>}
    {!!confirmed.length && <p className="kitchen-totals"><CheckCircle2 size={20}/>Datos reales del mes: <strong>{confirmed.reduce((total, meal) => total + meal.report!.actual_guests, 0)} comensales</strong> · <strong>{money(confirmed.reduce((total, meal) => total + meal.report!.spent_cents, 0))}</strong> de gasto registrado.</p>}
    {loading && <p role="status" className="loading">Cargando compromisos…</p>}
    {!loading && !error && !visible.length && <div className="kitchen-empty"><div className="kitchen-empty-icon"><CalendarDays size={34}/></div><h3>Un mes para seguir compartiendo</h3><p>Todavía no hay comidas previstas.<br/>Cuando se agregue un encuentro, lo vas a ver acá.</p></div>}
    <div className="kitchen-events">{visible.map(meal => <article className={'kitchen-event '+(meal.report?'is-confirmed':'')} key={meal.id} id={'kitchen-event-'+meal.id} tabIndex={-1}>
      <div className="kitchen-event-main"><div className="kitchen-date"><span>{new Date(meal.date+'T12:00:00Z').toLocaleDateString('es-AR',{weekday:'short',timeZone:'UTC'})}</span><strong>{Number(meal.date.slice(-2))}</strong><small>{new Date(meal.date+'T12:00:00Z').toLocaleDateString('es-AR',{month:'short',timeZone:'UTC'})}</small></div><div className="kitchen-event-content"><div className="kitchen-event-heading"><span className={'meal-type '+(meal.meal_type||'unknown')}>{meal.meal_type==='snack'?<Coffee size={16}/>:<Utensils size={16}/>} {meal.meal_type ? mealLabels[meal.meal_type] : 'Comida sin clasificar'}</span><span className={'kitchen-event-status '+(meal.report?'done':'pending')}>{meal.report?<><CheckCircle2 size={15}/>Realizado</>:'Por realizar'}</span></div><h3>{meal.title}</h3><p className="kitchen-event-detail">{meal.start}–{meal.end} · {meal.sector}</p><p className="kitchen-quantity"><Users size={21}/><strong>{meal.guests}</strong><span>comensales previstos</span></p>{meal.notes && <p className="notes">{meal.notes}</p>}
      {meal.report && <div className="kitchen-record"><p><strong>{meal.report.actual_guests} comensales reales</strong><span>Gasto total: <strong>{money(meal.report.spent_cents)}</strong></span></p><small>Confirmado el {new Date(meal.report.confirmed_at).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })} · Versión {meal.report.revision}</small></div>}
      <div className="kitchen-event-actions">{canPrepare && !meal.report && <button className="outline" disabled={saving} onClick={() => void prepare(meal)}>{meal.prepared ? 'Preparación lista (desmarcar)' : 'Marcar preparación lista'}</button>}{canConfirm && <button className={'kitchen-confirm '+(meal.report?'confirmed':'primary')} disabled={saving || !meal.meal_type || !ended(meal.date, meal.end)} onClick={() => open(meal)}>{meal.report?<CheckCircle2 size={18}/>:<Check size={18}/>} {meal.report ? 'Confirmado · Editar datos' : 'Confirmar evento realizado'}{meal.report&&<Pencil size={14}/>}</button>}</div>
      {canConfirm && !ended(meal.date, meal.end) && <p className="helper">Podés confirmar cuando termine el encuentro.</p>}
      </div></div>
      {selected?.id === meal.id && <form onSubmit={save} className="kitchen-close"><div><p className="eyebrow">DATOS REALES DEL ENCUENTRO</p><h3>{meal.report ? 'Corregir comensales o gasto' : 'Confirmemos cómo fue'}</h3><p className="helper">Se previeron {meal.guests} comensales. Si asistió otra cantidad, corregila acá.</p></div><div className="form-grid"><label>¿Cuántos comensales asistieron?<input type="number" min="0" max="10000" step="1" required value={guests} onChange={e => setGuests(e.target.value)} disabled={saving} /></label><label>¿Cuánto se gastó en total? (pesos)<input type="text" inputMode="decimal" placeholder="Ej. 12500,50" required value={spent} onChange={e => setSpent(e.target.value)} disabled={saving} /></label></div><p className="helper">Si no hubo gasto, ingresá 0. La cantidad prevista se conserva para poder comparar.</p>{meal.report && <label>Motivo de la corrección<textarea required maxLength={1000} value={note} onChange={e => setNote(e.target.value)} disabled={saving} /></label>}<label className="kitchen-checkbox"><input type="checkbox" checked={performed} required disabled={saving} onChange={e => setPerformed(e.target.checked)} />Confirmo que el evento se realizó</label>{formError && <p role="alert" className="error">{formError}</p>}<div className="modal-actions"><button type="button" disabled={saving} onClick={() => setSelected(null)}>Volver</button><button className="primary kitchen-save-confirm" disabled={saving}>{saving ? 'Guardando…' : meal.report?'Guardar corrección':'Confirmar y guardar'}</button></div></form>}
    </article>)}</div>
    {almanac&&<AlmanacDialog initialMonth={month} name="CCA Sector 7" module="kitchen-meals" onSelectMeal={(id,date)=>{focusMeal.current=id;setMonth(date.slice(0,7));setSelected(null);setAlmanac(false);setTimeout(()=>{const element=document.getElementById('kitchen-event-'+id);if(element){element.scrollIntoView({behavior:'smooth',block:'center'});element.focus({preventScroll:true});focusMeal.current=null;}},0);}} onClose={()=>setAlmanac(false)}/>}
    {shareAction&&<KitchenShare meals={meals} month={month} initialAction={shareAction} onClose={()=>setShareAction(null)}/>}
  </section>;
}
