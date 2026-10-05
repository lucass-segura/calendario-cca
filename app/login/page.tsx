'use client';

import { useActionState, useState } from 'react';
import Image from 'next/image';
import { ArrowRight, Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { signIn, type LoginState } from './actions';
import styles from './login.module.css';

const initialState: LoginState = { error: null };

export default function LoginPage() {
  const [state, action, pending] = useActionState(signIn, initialState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="login-title">
        <div className={styles.brand}>
          <Image src="/cca-logo.png" alt="Congregación Cristiana en la Argentina" width={454} height={228} priority className={styles.logo} />
          <p className={styles.sector}>CCA SECTOR 7</p>
        </div>
        <div className={styles.content}>
          <h1 id="login-title" className={styles.title}>Bienvenido</h1>
          <p className={styles.description}>Ingresá para organizar las actividades de nuestra comunidad.</p>
          <form action={action} className={styles.form}>
            <label htmlFor="username" className={styles.field}>
              Usuario
              <input id="username" name="username" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="Tu usuario" required className={styles.input} />
            </label>
            <div className={styles.field}>
              <label htmlFor="password" className={styles.passwordLabel}>Contraseña</label>
              <div className={styles.passwordWrapper}>
                <input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Tu contraseña" required className={`${styles.input} ${styles.passwordInput}`} />
                <button type="button" className={styles.visibility} onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-controls="password" title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                  {showPassword ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
                </button>
              </div>
            </div>
            {state.error && <p role="alert" className={styles.error}>{state.error}</p>}
            <button type="submit" disabled={pending} className={styles.submit}>
              {pending ? 'Ingresando…' : 'Ingresar'}
              {!pending && <ArrowRight size={18} aria-hidden="true" />}
            </button>
          </form>
          <p className={styles.access}><LockKeyhole size={15} aria-hidden="true" />Acceso para miembros de la comunidad</p>
        </div>
      </section>
      <p className={styles.footer}>Nos organizamos para servir mejor.</p>
    </main>
  );
}
