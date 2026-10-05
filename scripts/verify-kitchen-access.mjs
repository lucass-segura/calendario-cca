// Tests real database permissions with temporary rows inside a rolled-back transaction.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { databaseClient } from './database-client.mjs';
const client = await databaseClient();
let transaction = false;
try {
  await client.connect();
  await client.query('begin'); transaction = true;
  const accounts = await client.query("select id,username,role from public.profiles where username = any($1)", [['maria.eugenia','norma','gladis','mirian','margarita']]);
  assert.equal(accounts.rows.length, 5);
  assert.ok(accounts.rows.every(row => row.role === 'kitchen'));
  const first = accounts.rows[0].id, second = accounts.rows[1].id;
  const id = 'verification-' + randomUUID();
  await client.query(`insert into public.reservations(id,title,sector,responsible,contact,date,start,"end",service,guests,notes,updated,meal_type)
    values ($1,'Prueba temporal','Prueba','Prueba','','2020-01-01','12:00','14:00','food',100,'','2020-01-01','lunch')`, [id]);
  async function asUser(uid) {
    await client.query('set local role authenticated');
    await client.query("select set_config('request.jwt.claim.sub',$1,true)", [uid]);
  }
  async function denied(sql, args, expected) {
    await client.query('savepoint permission_check');
    try { await client.query(sql,args); throw new Error('La operación prohibida fue aceptada.'); }
    catch (error) { assert.equal(error.code, expected); }
    finally { await client.query('rollback to savepoint permission_check'); }
  }
  await asUser(first);
  assert.equal((await client.query("select count(*)::int as n from public.reservations where service='space'")).rows[0].n, 0);
  assert.equal((await client.query('select count(*)::int as n from public.mission_trips')).rows[0].n, 0);
  assert.equal((await client.query('select count(*)::int as n from public.profiles')).rows[0].n, 1);
  assert.equal((await client.query('update public.reservations set guests=1 where id=$1 returning id', [id])).rowCount, 0);
  await denied("update public.profiles set role='member'", [], '42501');
  await denied("select public.create_reservations('{}','[]',null,null)", [], '42501');
  await client.query('select public.confirm_kitchen_event($1,83,1250050,0,$2)', [id,'']);
  await denied('update public.kitchen_reports set actual_guests=1', [], '42501');
  await client.query('reset role'); await asUser(second);
  await denied('select public.confirm_kitchen_event($1,90,1500000,0,$2)', [id,''], '40001');
  await client.query('select public.confirm_kitchen_event($1,90,1500000,1,$2)', [id,'Se contó nuevamente']);
  const history = await client.query('select revision,actual_guests from public.kitchen_report_history where reservation_id=$1 order by revision', [id]);
  assert.deepEqual(history.rows, [{ revision: 1, actual_guests: 83 }, { revision: 2, actual_guests: 90 }]);
  await client.query('reset role');
  await denied('delete from public.reservations where id=$1', [id], '22023');
  await client.query('rollback'); transaction = false;
  console.log('Cinco cuentas verificadas; permisos, cierres, historial y conflictos comprobados. Datos de prueba revertidos.');
} catch (error) {
  console.error(`Falló la verificación (${error.code ?? error.name}). Los datos de prueba se revierten.`);
  process.exitCode = 1;
} finally {
  if (transaction) await client.query('rollback').catch(() => {});
  await client.end();
}
