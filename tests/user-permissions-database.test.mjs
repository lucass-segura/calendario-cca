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
    await db.query("update public.reservations set series_id='shared-series' where id in ('food','space')");
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
    // Model Storage's metadata tables to exercise the actual photo migration's RLS.
    await db.exec(`create schema storage;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(bucket_id text,name text,primary key(bucket_id,name));
      alter table storage.objects enable row level security;
      grant usage on schema storage to authenticated,anon;
      grant select,insert,update,delete on storage.objects to authenticated;`);
    await db.exec(await readFile(new URL('../supabase/migrations/20261005020000_private_profile_photos.sql',import.meta.url),'utf8'));
    assert.equal((await db.query("select public from storage.buckets where id='profile-photos'")).rows[0].public,false);
    await db.query("insert into storage.objects values('profile-photos',$1),('profile-photos',$2)",[kitchen+'/avatar.jpg',admin+'/avatar.jpg']);
    await asUser(kitchen,async()=>{
      assert.equal((await db.query('select * from storage.objects')).rows.length,1);
      await denied(()=>db.query("insert into storage.objects values('profile-photos',$1)",[member+'/avatar.jpg']),'42501');
      await denied(()=>db.query("update storage.objects set name=$1 where name=$2",[member+'/avatar.jpg',kitchen+'/avatar.jpg']),'42501');
      assert.equal((await db.query("delete from storage.objects where name=$1 returning name",[admin+'/avatar.jpg'])).rows.length,0);
      assert.equal((await db.query("delete from storage.objects where name=$1 returning name",[kitchen+'/avatar.jpg'])).rows.length,1);
      await db.query("insert into storage.objects values('profile-photos',$1)",[kitchen+'/avatar.jpg']);
    });
    await asUser(fresh,async()=>{
      assert.equal((await db.query('select * from storage.objects')).rows.length,0);
      await denied(()=>db.query("insert into storage.objects values('profile-photos',$1)",[fresh+'/avatar.jpg']),'42501');
    });
    await db.exec('set role anon');
    await denied(()=>db.query('select * from storage.objects'),'42501');
    await db.exec('reset role');
    await db.exec(await readFile(new URL('../supabase/migrations/20261005040000_kitchen_statistics_access.sql',import.meta.url),'utf8'));
    await asUser(admin,async()=>{await save(fresh,'nuevo',['reservations.read','missions.read','stats.read']);});
    await asUser(fresh,async()=>{
      const reports=(await db.query('select * from public.kitchen_reports')).rows;
      assert.equal(reports.length,1); assert.equal(reports[0].actual_guests,9); assert.equal(reports[0].spent_cents,10000);
      await denied(()=>db.query("select public.confirm_kitchen_event('food',8,20000,1,'corrección')"),'42501');
    });
    await asUser(kitchen,async()=>{assert.equal((await db.query('select * from public.kitchen_reports')).rows.length,1);});
    await asUser(admin,async()=>{await save(fresh,'nuevo',[]);});
    await asUser(fresh,async()=>{assert.equal((await db.query('select * from public.kitchen_reports')).rows.length,0);});
    await asUser(admin,async()=>{await save(fresh,'nuevo',['reservations.read','missions.read','stats.read'],false);});
    await asUser(fresh,async()=>{assert.equal((await db.query('select * from public.kitchen_reports')).rows.length,0);});
    await db.exec(await readFile(new URL('../supabase/migrations/20261008000000_reservation_annulments.sql',import.meta.url),'utf8'));
    // Planning is still immutable after a confirmation, even for the administrator.
    await asUser(admin,async()=>{
      await denied(()=>db.query("update public.reservations set guests=20 where id='food'"),'22023');
      await denied(()=>db.query("delete from public.reservations where id='food'"),'22023');
      await denied(()=>db.query("select public.annul_reservation('food','single','   ')"),'22023');
      await denied(()=>db.query("select public.annul_reservation('food','invalid','Motivo')"),'22023');
      await denied(()=>db.query("insert into public.reservation_annulments(reservation_id) values('forged')"),'42501');
    });
    await asUser(member,async()=>{
      await denied(()=>db.query("select public.annul_reservation('food','single','No autorizado')"),'42501');
      assert.equal((await db.query('select * from public.reservation_annulments')).rows.length,0);
    });
    await asUser(kitchen,async()=>{
      await denied(()=>db.query("select public.annul_reservation('food','series','No autorizado')"),'42501');
      await db.query("select public.confirm_kitchen_event('food',8,12000,1,'Corrección de comensales')");
    });
    const savedReport=(await db.query("select * from public.kitchen_reports where reservation_id='food'")).rows[0];
    await asUser(admin,async()=>{
      assert.equal((await db.query("select public.annul_reservation('food','series','Carga de prueba') as count")).rows[0].count,2);
      assert.equal((await db.query('select * from public.reservations')).rows.length,0);
      assert.equal((await db.query('select * from public.kitchen_reports')).rows.length,0);
      assert.equal((await db.query('select * from public.kitchen_report_history')).rows.length,0);
      const archive=(await db.query('select * from public.reservation_annulments order by reservation_id')).rows;
      assert.equal(archive.length,2); assert.equal(archive[0].cancelled_by,admin);
      assert.equal(archive[0].reason,'Carga de prueba');
      assert.equal(archive[0].report_snapshot.actual_guests,8);
      assert.equal(archive[0].history_snapshot.length,2);
      assert.equal(archive[0].history_snapshot[0].actual_guests,9);
      assert.equal((await db.query("select public.annul_reservation('food','single','Repetida') as count")).rows[0].count,0);
      await denied(()=>db.query("select public.confirm_kitchen_event('food',8,12000,2,'Intento posterior')"),'22023');
      await denied(()=>db.query("delete from public.reservation_annulments"),'42501');
    });
    assert.deepEqual((await db.query("select * from public.kitchen_reports where reservation_id='food'")).rows[0],savedReport);
    assert.equal((await db.query('select * from public.kitchen_report_history')).rows.length,2);
    await asUser(kitchen,async()=>{
      assert.equal((await db.query('select * from public.reservation_annulments')).rows.length,0);
      assert.equal((await db.query('select * from public.kitchen_reports')).rows.length,0);
    });
    await asUser(admin,async()=>{
      await save(fresh,'nuevo',['reservations.read','missions.read','stats.read']);
    });
    await asUser(fresh,async()=>{assert.equal((await db.query('select * from public.kitchen_reports')).rows.length,0);});
    await db.exec('set role anon');
    await denied(()=>db.query("select public.annul_reservation('food','single','Anónimo')"),'42501');
    await db.exec('reset role');
    // The freed time can be booked again, but archived IDs cannot be recycled.
    const draft= {title:'Nuevo almuerzo',sector:'Sector',sectors:['Sector'],responsible:'Persona',contact:'',date:'2020-01-01',start:'12:00',end:'14:00',service:'food',meal_type:'lunch',guests:10,notes:'',updated:'2026'};
    await asUser(admin,async()=>{
      await denied(()=>db.query('select public.create_reservations($1,$2,null,null)',[JSON.stringify(draft),JSON.stringify([{id:'food',date:draft.date}])]),'22023');
      const result=await db.query('select public.create_reservations($1,$2,null,null) as result',[JSON.stringify(draft),JSON.stringify([{id:'replacement',date:draft.date}])]);
      assert.equal(result.rows[0].result.count,1);
    });
  } finally { await db.close(); }
});
