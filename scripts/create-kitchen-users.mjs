// Local administration only. Passwords are generated in memory, never put on the command line.
// Run after applying the kitchen migration: node --env-file=.env.local scripts/create-kitchen-users.mjs
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile, access } from 'node:fs/promises';

const accounts = [
  ['maria.eugenia', 'Maria Eugenia'], ['norma', 'Norma'], ['gladis', 'Gladis'],
  ['mirian', 'Mirian'], ['margarita', 'Margarita'],
];
const output = 'outputs/cocina-accesos-privados.json';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error('Completá las variables locales de Supabase.');
const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const { error: schemaError } = await admin.from('profiles').select('role').limit(1);
if (schemaError) throw new Error('Aplicá primero la migración de cocina.');
await mkdir('outputs', { recursive: true });
let credentials = [];
try { await access(output); throw new Error('Ya existe el archivo privado de accesos. No se sobrescribirá.'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
// Reserve a private output file before provisioning, so partial results can be recovered.
await writeFile(output, '[]\n', { flag: 'wx', mode: 0o600 });
for (const [username, full_name] of accounts) {
  const { data: existing, error: lookupError } = await admin.from('profiles').select('id').eq('username', username).maybeSingle();
  if (lookupError) throw new Error('No pudimos comprobar los usuarios existentes.');
  if (existing) { console.log(`${username}: ya existe; no se modificó.`); continue; }
  const password = randomBytes(18).toString('base64url');
  const { data, error } = await admin.auth.admin.createUser({ email: `${username}@users.cca-sector7.app`, password, email_confirm: true });
  if (error) throw new Error(`No se pudo crear ${username}: ${error.message}`);
  const { error: profileError } = await admin.from('profiles').insert({ id: data.user.id, username, full_name, role: 'kitchen' });
  if (profileError) {
    const { error: rollbackError } = await admin.auth.admin.deleteUser(data.user.id);
    if (rollbackError) throw new Error(`Falló el perfil de ${username} y su reversión. Revisá el usuario en Supabase.`);
    throw new Error(`No se pudo guardar el perfil de ${username}; el usuario de Auth fue eliminado.`);
  }
  credentials = [...credentials, { username, nombre: full_name, password, role: 'kitchen' }];
  await writeFile(output, JSON.stringify(credentials, null, 2) + '\n', { mode: 0o600 });
  console.log(`${username}: cuenta de cocina creada.`);
}
console.log(`Accesos guardados solamente en ${output}. No publicar ni adjuntar a GitHub.`);
