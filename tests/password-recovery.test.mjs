import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { recoveryDni } from '../lib/auth/recovery.ts';

test('recovery accepts only a DNI, with blank input retaining the saved value', () => {
  assert.equal(recoveryDni('12345678'), '12345678');
  assert.equal(recoveryDni('1234567'), '1234567');
  assert.equal(recoveryDni(''), null);
  for (const input of [null, 12345678, '12.345.678', ' 12345678', '123456', '123456789', 'abcdefgh']) assert.throws(() => recoveryDni(input));
});
test('DNI recovery and reset history are invisible to all browser users', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); grant usage on schema public,auth to anon,authenticated,service_role;
      insert into auth.users values('11111111-1111-4111-8111-111111111111');`);
    await db.exec(await readFile(new URL('../supabase/migrations/20261005030000_private_password_reset.sql', import.meta.url), 'utf8'));
    for (const role of ['anon', 'authenticated']) {
      await db.exec('set role ' + role);
      for (const table of ['user_password_recovery', 'user_password_reset_history']) {
        await assert.rejects(() => db.query('select * from public.' + table), error => error.code === '42501');
        await assert.rejects(() => db.query('delete from public.' + table), error => error.code === '42501');
      }
      await assert.rejects(() => db.query("insert into public.user_password_recovery values('11111111-1111-4111-8111-111111111111','12345678',now())"), error => error.code === '42501');
      await db.exec('reset role');
    }
    await db.exec('set role service_role');
    await db.query("insert into public.user_password_recovery(user_id,dni) values('11111111-1111-4111-8111-111111111111','12345678')");
    assert.equal((await db.query('select dni from public.user_password_recovery')).rows[0].dni, '12345678');
    await db.query("insert into public.user_password_reset_history(user_id,actor_id) values('11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111')");
    assert.equal((await db.query('select * from public.user_password_reset_history')).rows.length, 1);
  } finally { await db.close(); }
});
