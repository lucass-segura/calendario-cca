import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('administrator assigns access, revocation takes effect and direct escalation is denied', async () => {
  const db = new PGlite();
  const admin='11111111-1111-4111-8111-111111111111', kitchen='22222222-2222-4222-8222-222222222222', member='33333333-3333-4333-8333-333333333333', fresh='44444444-4444-4444-8444-444444444444';
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to anon,authenticated,service_role; grant execute on function auth.uid() to authenticated;`);
    for(const name of ['20261004000000_init.sql','20261004000100_profiles_read_only_for_members.sql','20261005000000_kitchen_access_and_reports.sql']) await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
    await db.exec(`insert into auth.users values('${admin}'),('${kitchen}'),('${member}'),('${fresh}');
      insert into public.profiles(id,username,full_name,role) values('${admin}','lucas.segura','Lucas','member'),('${kitchen}','cocina','Cocina','kitchen'),('${member}','miembro','Miembro','member');
      insert into public.reservations(id,title,sector,responsible,contact,date,start,"end",service,guests,notes,updated,meal_type) values('food','Almuerzo','Sector','Persona','','2020-01-01','12:00','14:00','food',10,'','2020','lunch'),('space','Salón','Sector','Persona','','2020-01-01','16:00','18:00','space',10,'','2020',null);`);
    await db.exec(await readFile(new URL('../supabase/migrations/20261005010000_user_permissions.sql',import.meta.url),'utf8'));
    async function asUser(id, fn) { await db.exec('set role authenticated'); await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]); try{await fn();}finally{await db.exec('reset role');} }
    const save=(id,username,permissions,enabled=true)=>db.query('select public.save_user_access($1,$2,$3,$4,$5)',[id,username,username,JSON.stringify(permissions),enabled]);
    const denied=async(fn,code)=>assert.rejects(fn,e=>e.code===code);
    await asUser(kitchen,async()=>{
      assert.equal((await db.query('select * from public.reservations')).rows.length,1);
      await denied(()=>save(member,'miembro',['users.manage']),'42501');
      await denied(()=>db.query("update public.profiles set permissions='[\"users.manage\"]'"),'42501');
    });
    await asUser(member,async()=>{await denied(()=>save(fresh,'nuevo',[]),'42501');});
    await asUser(admin,async()=>{
      await save(fresh,'nuevo',['missions.read']);
      await denied(()=>save(admin,'lucas.segura',[]),'22023');
      await denied(async()=>save(admin,'lucas.segura',(await db.query("select permissions from public.profiles where id=$1",[admin])).rows[0].permissions,false),'22023');
      await denied(()=>save(fresh,'nuevo',['missions.write']),'22023');
      await denied(()=>save(fresh,'nuevo',['invented']),'22023');
    });
    await asUser(fresh,async()=>{
      assert.equal((await db.query('select * from public.reservations')).rows.length,0);
      assert.equal((await db.query('select * from public.profiles')).rows.length,1);
      await denied(()=>db.query("select public.create_reservations('{}','[]',null,null)"),'42501');
      await denied(()=>db.query("select public.confirm_kitchen_event('food',10,0,0,'')"),'42501');
      assert.equal((await db.query("update public.mission_people set name='hack' returning id")).rows.length,0);
    });
    await asUser(admin,async()=>{ await save(fresh,'nuevo',['kitchen.read']); });
    await asUser(fresh,async()=>{
      assert.equal((await db.query('select * from public.reservations')).rows.length,1);
      await denied(()=>db.query("select public.confirm_kitchen_event('food',10,0,0,'')"),'42501');
    });
    await asUser(admin,async()=>{ await save(fresh,'nuevo',['kitchen.read','kitchen.confirm']); });
    await asUser(fresh,async()=>{await db.query("select public.confirm_kitchen_event('food',9,10000,0,'')");});
    await asUser(admin,async()=>{await save(fresh,'nuevo',['kitchen.read','kitchen.confirm'],false);});
    await asUser(fresh,async()=>{
      assert.equal((await db.query('select * from public.reservations')).rows.length,0);
      assert.equal((await db.query('select * from public.kitchen_reports')).rows.length,0);
      await denied(()=>db.query("select public.confirm_kitchen_event('food',8,10000,1,'corrección')"),'42501');
    });
    await asUser(admin,async()=>{
      const audit=(await db.query('select * from public.user_access_history order by id')).rows;
      assert.equal(audit.length,4); assert.ok(audit.every(a=>a.actor_id===admin));
      assert.equal(audit.at(-1).current.enabled,false);
    });
  } finally { await db.close(); }
});
