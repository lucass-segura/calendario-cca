// Admin script (local only, never imported by the app).
//   node --env-file=.env.local scripts/create-user.mjs <username> <password> "<Full Name>"
//   node --env-file=.env.local scripts/create-user.mjs --reset-password <username> <password>
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (server-only).
import { createClient } from '@supabase/supabase-js';

const DOMAIN = 'users.cca-sector7.app'; // keep in sync with lib/auth/username.ts
const PATTERN = /^[a-z0-9._-]{3,32}$/;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) fail('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY (use --env-file=.env.local).');

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const args = process.argv.slice(2);
const roleIndex = args.indexOf('--role');
const role = roleIndex >= 0 ? args[roleIndex + 1] : 'member';
if (!['member', 'kitchen'].includes(role)) fail('Role must be member or kitchen.');
if (roleIndex >= 0) args.splice(roleIndex, 2);

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseUsername(raw) {
  const username = String(raw ?? '').trim().toLowerCase();
  if (!PATTERN.test(username)) fail('Invalid username: use 3-32 characters from a-z, 0-9, dot, underscore or hyphen.');
  return username;
}

function checkPassword(password) {
  if (!password || password.length < 8) fail('The password must have at least 8 characters.');
}

async function findUserIdByUsername(username) {
  const { data, error } = await admin.from('profiles').select('id').eq('username', username).maybeSingle();
  if (error) fail(`Could not look up the user: ${error.message}`);
  return data?.id ?? null;
}

if (args[0] === '--reset-password') {
  const username = parseUsername(args[1]);
  const password = args[2];
  checkPassword(password);
  const id = await findUserIdByUsername(username);
  if (!id) fail(`User "${username}" does not exist.`);
  const { error } = await admin.auth.admin.updateUserById(id, { password });
  if (error) fail(`Could not reset the password: ${error.message}`);
  console.log(`Password updated for "${username}".`);
} else {
  const username = parseUsername(args[0]);
  const password = args[1];
  const fullName = String(args[2] ?? '').trim();
  checkPassword(password);
  if (!fullName) fail('Usage: create-user.mjs <username> <password> "<Full Name>"');

  const { data, error } = await admin.auth.admin.createUser({ email: `${username}@${DOMAIN}`, password, email_confirm: true });
  if (error) fail(`Could not create the auth user: ${error.message}`);

  const { error: profileError } = await admin.from('profiles').insert({ id: data.user.id, username, full_name: fullName, role, permissions: role === 'kitchen' ? ['kitchen.read','kitchen.confirm'] : ['reservations.read','reservations.write','kitchen.read','kitchen.confirm','missions.read','missions.write','stats.read','settings.write'] });
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    fail(`Could not create the profile (auth user rolled back): ${profileError.message}`);
  }
  console.log(`User "${username}" created (${fullName}).`);
}
