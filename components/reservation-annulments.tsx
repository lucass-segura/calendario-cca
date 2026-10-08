'use client';
import { useEffect, useState } from 'react';
import styles from './reservation-annulments.module.css';
type Archive = { reservation_id: string; cancelled_at: string; cancelled_by: string; cancelled_by_name: string; reason: string; reservation_snapshot: { title: string; date: string; guests: number }; report_snapshot: { actual_guests: number; spent_cents: number } | null; history_snapshot: { revision: number; actual_guests: number; spent_cents: number; correction_note: string }[] };
const money = (cents: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(cents / 100);
export function ReservationAnnulments() {
  const [rows, setRows] = useState<Archive[]>([]), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/reservations/annulments', { cache: 'no-store', signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setRows(data); setLoading(false);
    }).catch(e => { if (!controller.signal.aborted) { setError(e instanceof Error ? e.message : 'No pudimos cargar el historial.'); setLoading(false); } });
    return () => controller.abort();
  }, []);
  return <section className="settings-panel"><h2>Historial de anulaciones</h2><p>Los eventos anulados liberan sus horarios y quedan fuera de las estadísticas. Sus datos originales se conservan aquí.</p>{loading && <p role="status">Cargando historial…</p>}{error && <p className="error" role="alert">{error}</p>}{!loading && !error && !rows.length && <p>No hay reservas anuladas.</p>}{rows.map(row => <details key={row.reservation_id} className={styles.record}><summary>{row.reservation_snapshot.date.split('-').reverse().join('/')} · {row.reservation_snapshot.title}</summary><p><strong>Motivo:</strong> {row.reason}</p><p>Anulada el {new Date(row.cancelled_at).toLocaleString('es-AR')} · Administrador: {row.cancelled_by_name}</p><p>Comensales previstos: {row.reservation_snapshot.guests}</p>{row.report_snapshot && <p>Último cierre: {row.report_snapshot.actual_guests} comensales · {money(row.report_snapshot.spent_cents)}</p>}{row.history_snapshot.map(item => <p key={item.revision}>Cierre {item.revision}: {item.actual_guests} comensales · {money(item.spent_cents)}{item.correction_note && ' · ' + item.correction_note}</p>)}</details>)}</section>;
}
