import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('database enforces kitchen roles, closing time, audit history and optimistic corrections', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema public,auth to anon,authenticated,service_role;
      grant execute on function auth.uid() to anon,authenticated,service_role;`);
    for (const path of ['20261004000000_init.sql','20261004000100_profiles_read_only_for_members.sql','20261005000000_kitchen_access_and_reports.sql']) {
      await db.exec(await readFile(new URL('../supabase/migrations/' + path, import.meta.url), 'utf8'));
    }
    const member = '11111111-1111-4111-8111-111111111111';
    const kitchen = '22222222-2222-4222-8222-222222222222';
    const otherKitchen = '33333333-3333-4333-8333-333333333333';
    const noProfile = '44444444-4444-4444-8444-444444444444';
    await db.exec(`insert into auth.users values ('${member}'),('${kitchen}'),('${otherKitchen}'),('${noProfile}');
      insert into public.profiles(id,username,full_name,role) values ('${member}','organizacion','Organización','member'),('${kitchen}','cocina1','Hermana 1','kitchen'),('${otherKitchen}','cocina2','Hermana 2','kitchen');
      insert into public.settings values (1,'CCA','["Jóvenes"]');
      insert into public.reservations(id,title,sector,responsible,contact,date,start,"end",service,guests,notes,updated,meal_type)
      values ('past','Almuerzo','Jóvenes','Persona','','2020-01-01','12:00','14:00','food',100,'','2020-01-01','lunch'),
      ('future','Merienda','Jóvenes','Persona','','2099-01-01','16:00','18:00','food',50,'','2020-01-01','snack'),
      ('space','Salón','Jóvenes','Persona','','2020-01-01','18:00','19:00','space',50,'','2020-01-01',null),
      ('legacy','Comida antigua','Jóvenes','Persona','','2020-01-02','12:00','14:00','food',100,'','2020-01-01',null);`);
    async function asUser(id, callback) {
      await db.exec('set role authenticated');
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
      try { return await callback(); } finally { await db.exec('reset role'); }
    }
    async function denied(sql, parameters, code) {
      await assert.rejects(db.query(sql, parameters), error => error.code === code);
    }
    await asUser(kitchen, async () => {
      assert.equal((await db.query('select * from public.reservations')).rows.length, 3);
      assert.equal((await db.query('select * from public.mission_people')).rows.length, 0);
      assert.equal((await db.query('select * from public.profiles')).rows.length, 1);
      assert.equal((await db.query("update public.profiles set role='member' returning id").catch(error => ({ error }))).error.code, '42501');
      assert.equal((await db.query("update public.reservations set guests=1 returning id")).rows.length, 0);
      assert.equal((await db.query("delete from public.reservations returning id")).rows.length, 0);
      await denied("insert into public.settings values (2,'Hack','[]')", [], '42501');
      await denied("select public.create_reservations('{}','[]',null,null)", [], '42501');
      await denied("select public.update_reservation_single('past','{}')", [], '42501');
      await denied("select public.update_reservation_series('past','{}')", [], '42501');
      await denied("select public.confirm_kitchen_event('future',1,0,0,'')", [], '22023');
      await denied("select public.confirm_kitchen_event('legacy',1,0,0,'')", [], '22023');
      await denied("select public.confirm_kitchen_event('space',1,0,0,'')", [], '22023');
      await denied("select public.confirm_kitchen_event('past',-1,0,0,'')", [], '22023');
      await denied("select public.confirm_kitchen_event('past',1,-1,0,'')", [], '22023');
      const saved = (await db.query("select public.confirm_kitchen_event('past',83,1250050,0,'') as report")).rows[0].report;
      assert.equal(saved.revision, 1); assert.equal(saved.planned_snapshot.guests, 100);
      assert.equal(saved.confirmed_by, kitchen);
      await denied("update public.kitchen_reports set actual_guests=1", [], '42501');
      await denied("delete from public.kitchen_report_history", [], '42501');
    });
    await asUser(otherKitchen, async () => {
      await denied("select public.confirm_kitchen_event('past',90,1500000,0,'')", [], '40001');
      await denied("select public.confirm_kitchen_event('past',90,1500000,1,'')", [], '22023');
      const saved = (await db.query("select public.confirm_kitchen_event('past',90,1500000,1,'Incluimos a los niños') as report")).rows[0].report;
      assert.equal(saved.revision, 2); assert.equal(saved.confirmed_by, otherKitchen);
      const history = (await db.query('select * from public.kitchen_report_history order by revision')).rows;
      assert.equal(history.length, 2); assert.equal(history[0].actual_guests, 83); assert.equal(history[1].actual_guests, 90);
    });
    await asUser(member, async () => {
      assert.equal((await db.query('select * from public.reservations')).rows.length, 4);
      await denied("update public.reservations set guests=99 where id='past'", [], '22023');
      await denied("delete from public.reservations where id='past'", [], '22023');
      const data = { title: 'Merienda', sector: 'Jóvenes', sectors: ['Jóvenes'], responsible: 'Persona', contact: '', start: '16:00', end: '18:00', service: 'food', meal_type: 'snack', guests: 40, notes: '', updated: '2026-10-05' };
      const result = await db.query('select public.create_reservations($1,$2,null,null) as created', [JSON.stringify(data),JSON.stringify([{ id: 'new', date: '2026-12-01' }])]);
      assert.equal(result.rows[0].created.count, 1);
      assert.equal((await db.query("select meal_type from public.reservations where id='new'")).rows[0].meal_type, 'snack');
    });
    await asUser(noProfile, async () => {
      assert.equal((await db.query('select * from public.reservations')).rows.length, 0);
      await denied("select public.confirm_kitchen_event('past',1,0,2,'Cambio')", [], '42501');
    });
    await db.exec('set role anon');
    await denied("select * from public.kitchen_reports", [], '42501');
    await denied("select public.confirm_kitchen_event('past',1,0,2,'Cambio')", [], '42501');
    await db.exec('reset role');
  } finally { await db.close(); }
});
