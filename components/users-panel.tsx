'use client';
import { useCallback, useEffect, useState } from 'react';
import { Eye, EyeOff, Plus, RotateCcw, ShieldCheck, X } from 'lucide-react';
import { permissionOptions, togglePermission, type Permission } from '../lib/permissions';

type User = { id: string; username: string; full_name: string; permissions: Permission[]; enabled: boolean };
type Draft = User & { password: string };
const blank = (): Draft => ({ id: '', username: '', full_name: '', password: '', permissions: [], enabled: true });

export function UsersPanel() {
  const [users, setUsers] = useState<User[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [canCreate, setCanCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [resetDni, setResetDni] = useState('');
  const [resetError, setResetError] = useState('');
  async function resetPassword(event: React.FormEvent) {
    event.preventDefault();
    if (!resetUser) return;
    setSaving(true); setResetError(''); setNotice('');
    try {
      const response = await fetch('/api/users/' + resetUser.id + '/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dni: resetDni }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setNotice('Contraseña de ' + resetUser.full_name + ' restablecida. Ingresará con su DNI y podrá cambiarla desde su perfil.' + (result.warning ? ' ' + result.warning : ''));
      setResetUser(null); setResetDni('');
    } catch (cause) { setResetError(cause instanceof Error ? cause.message : 'No pudimos restablecer la contraseña.'); }
    finally { setSaving(false); }
  }
  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/users', { cache: 'no-store', signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (!signal?.aborted) { setUsers(data.users); setCanCreate(data.canCreate); setError(''); }
    } catch(e) { if (!signal?.aborted) setError(e instanceof Error ? e.message : 'No pudimos cargar los usuarios.'); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, []);
  useEffect(() => { const controller = new AbortController(); const timer = setTimeout(() => void load(controller.signal), 0); return () => { clearTimeout(timer); controller.abort(); }; }, [load]);
  function open(user?: User) { setDraft(user ? { ...user, password: '' } : blank()); setShowPassword(false); setFormError(''); setNotice(''); }
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (!draft) return;
    setSaving(true); setFormError('');
    try {
      const response = await fetch('/api/users' + (draft.id ? '/' + draft.id : ''), { method: draft.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setNotice(draft.id ? 'Permisos actualizados. Se aplican en la próxima acción del usuario.' : 'Usuario creado. Compartí su usuario y contraseña de forma privada.');
      setDraft(null); await load();
    } catch(e) { setFormError(e instanceof Error ? e.message : 'No pudimos guardar.'); }
    finally { setSaving(false); }
  }
  return <section className="users-panel">
    <header><div><p className="eyebrow">ADMINISTRACIÓN</p><h1>Usuarios y permisos</h1><p className="subtitle">Cada persona, con los accesos que necesita.</p></div><button className="primary" disabled={loading || !canCreate || !!error} onClick={() => open()}><Plus size={18}/>Nuevo usuario</button></header>
    {notice && <p className="notice" role="status">{notice}</p>}
    {error && <p className="error" role="alert">{error}<button onClick={() => void load()}>Reintentar</button></p>}
    {loading && <p role="status">Cargando usuarios…</p>}
    {!loading && !error && !canCreate && <p className="helper kitchen-warning">La creación de cuentas necesita configurar la clave privada de Supabase en el servidor. Podés modificar los permisos de las cuentas existentes.</p>}
    {!loading && !error && <div className="users-list">{users.map(user => <article className="user-access-card" key={user.id}><div><h2>{user.full_name}</h2><p className="subtitle">{user.username}</p></div><span className={'badge ' + (user.enabled ? 'prepared' : 'space')}>{user.enabled ? 'Habilitada' : 'Deshabilitada'}</span><p className="helper">{user.permissions.includes('users.manage') ? 'Administrador · Todos los accesos' : permissionOptions.filter(p => user.permissions.includes(p.key)).map(p => p.label).join(' · ') || 'Sin accesos asignados'}</p><button className="outline" onClick={() => open(user)}><ShieldCheck size={17}/>Editar permisos</button><button className="outline" disabled={!canCreate || saving} onClick={() => { setResetUser(user); setResetDni(''); setResetError(''); setNotice(''); }}><RotateCcw size={17}/>Restablecer contraseña</button></article>)}</div>}
    {resetUser && <div className="modal-backdrop"><section className="modal users-modal" role="dialog" aria-modal="true" aria-labelledby="reset-title" onKeyDown={event => {
      if (event.key === 'Escape' && !saving) { setResetUser(null); setResetDni(''); }
      if (event.key === 'Tab') { const fields = event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)'); const first = fields[0], last = fields[fields.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } }
    }}><div className="modal-header"><h2 id="reset-title">Restablecer contraseña</h2><button aria-label="Cerrar" disabled={saving} onClick={() => { setResetUser(null); setResetDni(''); }}><X/></button></div><form onSubmit={resetPassword}>
      <p>La contraseña de <strong>{resetUser.full_name}</strong> ({resetUser.username}) volverá a ser su DNI. La clave anterior dejará de servir.</p>
      <label>DNI de restablecimiento (opcional)<input autoFocus type="password" inputMode="numeric" pattern="[0-9]{7,8}" maxLength={8} autoComplete="off" value={resetDni} disabled={saving} onChange={event => setResetDni(event.target.value)}/><span className="helper">Dejalo vacío para usar el DNI registrado. Completalo solo la primera vez o para corregirlo. No se mostrará después.</span></label>
      {!resetUser.enabled && <p className="helper">La cuenta seguirá deshabilitada. Para permitir el ingreso, habilitala desde Editar permisos.</p>}
      {resetError && <p role="alert" className="error">{resetError}</p>}
      <div className="modal-actions"><button type="button" disabled={saving} onClick={() => { setResetUser(null); setResetDni(''); }}>Cancelar</button><button className="primary" disabled={saving}>{saving ? 'Restableciendo…' : 'Confirmar restablecimiento'}</button></div>
    </form></section></div>}
    {draft && <div className="modal-backdrop"><section className="modal users-modal" role="dialog" aria-modal="true" aria-labelledby="users-title" onKeyDown={e => { if(e.key === 'Escape' && !saving) setDraft(null); if(e.key === 'Tab') { const fields=e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)'); const first=fields[0],last=fields[fields.length-1]; if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last?.focus(); } else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first?.focus(); } } }}><div className="modal-header"><div><p className="eyebrow">ACCESOS PERSONALES</p><h2 id="users-title">{draft.id ? 'Editar usuario' : 'Nuevo usuario'}</h2></div><button aria-label="Cerrar" disabled={saving} onClick={() => setDraft(null)}><X/></button></div><form onSubmit={save}>
      <div className="form-grid"><label>Nombre completo<input autoFocus required maxLength={120} autoComplete="off" value={draft.full_name} disabled={saving} onChange={e => setDraft({...draft,full_name:e.target.value})}/></label><label>Usuario de ingreso<input required minLength={3} maxLength={32} pattern="[a-zA-Z0-9._\-]{3,32}" autoComplete="off" disabled={saving || !!draft.id} value={draft.username} onChange={e => setDraft({...draft,username:e.target.value.toLowerCase()})}/></label></div>
      {!draft.id && <label>Contraseña inicial<div className="user-password"><input type={showPassword ? 'text' : 'password'} required minLength={12} maxLength={128} autoComplete="new-password" value={draft.password} disabled={saving} onChange={e => setDraft({...draft,password:e.target.value})}/><button type="button" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div><span className="helper">Mínimo 12 caracteres. Guardala para entregársela a la persona; no se mostrará después.</span></label>}
      <label className="access-option"><input type="checkbox" checked={draft.enabled} disabled={saving} onChange={e => setDraft({...draft,enabled:e.target.checked})}/><span><strong>Cuenta habilitada</strong><small>Desmarcar bloquea el acceso sin borrar su historial.</small></span></label>
      <fieldset className="permissions-field"><legend>Permisos y accesos</legend><p className="helper">Marcá lo que podrá hacer. Los accesos necesarios se incluyen automáticamente.</p><div className="permissions-grid">{permissionOptions.map(p => <label className="access-option" key={p.key}><input type="checkbox" checked={draft.permissions.includes(p.key)} disabled={saving} onChange={e => setDraft({...draft,permissions:togglePermission(draft.permissions,p.key,e.target.checked)})}/><span>{p.label}</span></label>)}</div></fieldset>
      {draft.permissions.includes('users.manage') && <p className="helper kitchen-warning">Esta persona podrá crear usuarios y asignar todos los permisos.</p>}
      {formError && <p className="error" role="alert">{formError}</p>}
      <div className="modal-actions"><button type="button" disabled={saving} onClick={() => setDraft(null)}>Volver</button><button className="primary" disabled={saving}>{saving ? 'Guardando…' : draft.id ? 'Guardar permisos' : 'Crear usuario'}</button></div>
    </form></section></div>}
  </section>;
}
