'use client';

import { useId, useState } from 'react';
import { Eye, EyeOff, LockKeyhole } from 'lucide-react';
import styles from './change-password.module.css';

export function ChangePassword() {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/profile/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(data)) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      form.reset(); setVisible(false); setOpen(false); setNotice('Tu contraseña quedó actualizada. Usala la próxima vez que ingreses.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No pudimos cambiar la contraseña.'); }
    finally { setBusy(false); }
  }

  return <div className={styles.root}>
    <button type="button" className={styles.toggle} aria-expanded={open} aria-controls={id} disabled={busy} onClick={() => { setOpen(!open); setError(''); setNotice(''); setVisible(false); }}><LockKeyhole size={16} />{open ? 'Cancelar cambio' : 'Cambiar contraseña'}</button>
    {open && <form id={id} className={styles.form} onSubmit={save}>
      <p>Elegí una clave propia de al menos 8 caracteres. Evitá usar tu DNI.</p>
      <label>Contraseña actual<input name="currentPassword" type={visible ? 'text' : 'password'} autoComplete="current-password" required maxLength={1024} disabled={busy} /></label>
      <label>Nueva contraseña<input name="password" type={visible ? 'text' : 'password'} autoComplete="new-password" required minLength={8} maxLength={72} disabled={busy} /></label>
      <label>Repetir nueva contraseña<input name="confirmation" type={visible ? 'text' : 'password'} autoComplete="new-password" required minLength={8} maxLength={72} disabled={busy} /></label>
      <button className={styles.toggle} type="button" aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={16} /> : <Eye size={16} />}{visible ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}</button>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <button type="submit" className={styles.save} disabled={busy}>{busy ? 'Guardando…' : 'Guardar nueva contraseña'}</button>
    </form>}
    {notice && <p role="status" className={styles.notice}>{notice}</p>}
  </div>;
}
