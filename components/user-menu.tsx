'use client';
import { useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import { createClient } from '../lib/supabase/client';

export function UserMenu() {
  const [label, setLabel] = useState('');
  useEffect(() => {
    let active = true;
    (async () => {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data } = await supabase.from('profiles').select('username,full_name').eq('id', auth.user.id).maybeSingle();
      if (active && data) setLabel(`${data.full_name} (${data.username})`);
    })();
    return () => { active = false; };
  }, []);
  return (
    <form action="/auth/signout" method="post" className="user-menu">
      {label && <span className="user-name">{label}</span>}
      <button type="submit"><LogOut size={18} /> Cerrar sesión</button>
    </form>
  );
}
