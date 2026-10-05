begin;
alter table public.profiles add column permissions jsonb not null default '[]', add column enabled boolean not null default true;
update public.profiles set permissions=case when role='kitchen' then '["kitchen.read","kitchen.confirm"]'::jsonb else '["reservations.read","reservations.write","kitchen.read","kitchen.confirm","missions.read","missions.write","stats.read","settings.write"]'::jsonb end;
do $$ begin
 if (select count(*) from public.profiles where username='lucas.segura') <> 1 then raise exception 'No se encontró la cuenta administradora Lucas.Segura.'; end if;
end $$;
update public.profiles set permissions='["reservations.read","reservations.write","kitchen.read","kitchen.confirm","missions.read","missions.write","stats.read","settings.write","users.manage"]'::jsonb where username='lucas.segura';
create function private.valid_permissions(p jsonb) returns boolean language sql immutable set search_path='' as $$
 select case when jsonb_typeof(p) <> 'array' then false else
 not exists(select 1 from jsonb_array_elements(p) v where jsonb_typeof(v) <> 'string' or v #>> '{}' <> all(array['reservations.read','reservations.write','kitchen.read','kitchen.confirm','missions.read','missions.write','stats.read','settings.write','users.manage']))
 and (not p ? 'reservations.write' or p ? 'reservations.read')
 and (not p ? 'kitchen.confirm' or p ? 'kitchen.read')
 and (not p ? 'missions.write' or p ? 'missions.read')
 and (not p ? 'stats.read' or (p ? 'reservations.read' and p ? 'missions.read'))
 and (not p ? 'users.manage' or p @> '["reservations.read","reservations.write","kitchen.read","kitchen.confirm","missions.read","missions.write","stats.read","settings.write","users.manage"]'::jsonb) end
$$;
revoke all on function private.valid_permissions(jsonb) from public,anon;
grant execute on function private.valid_permissions(jsonb) to authenticated,service_role;
alter table public.profiles add constraint valid_profile_permissions check(private.valid_permissions(permissions));
create function private.has_permission(p text) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select enabled and permissions ? p from public.profiles where id=auth.uid()),false)
$$;
revoke all on function private.has_permission(text) from public,anon;
grant execute on function private.has_permission(text) to authenticated;
drop policy reservations_select_members on public.reservations;
create policy reservations_select_members on public.reservations for select to authenticated using (private.has_permission('reservations.read') or (service='food' and private.has_permission('kitchen.read')));
drop policy reservations_insert_members on public.reservations;
create policy reservations_insert_members on public.reservations for insert to authenticated with check (private.has_permission('reservations.write'));
drop policy reservations_update_members on public.reservations;
create policy reservations_update_members on public.reservations for update to authenticated using (private.has_permission('reservations.write')) with check (private.has_permission('reservations.write'));
drop policy reservations_delete_members on public.reservations;
create policy reservations_delete_members on public.reservations for delete to authenticated using (private.has_permission('reservations.write'));
drop policy settings_select_members on public.settings;
create policy settings_select_members on public.settings for select to authenticated using (exists(select 1 from public.profiles where id=auth.uid() and enabled));
drop policy settings_insert_members on public.settings;
create policy settings_insert_members on public.settings for insert to authenticated with check (private.has_permission('settings.write'));
drop policy settings_update_members on public.settings;
create policy settings_update_members on public.settings for update to authenticated using (private.has_permission('settings.write')) with check (private.has_permission('settings.write'));
drop policy settings_delete_members on public.settings;
create policy settings_delete_members on public.settings for delete to authenticated using (private.has_permission('settings.write'));
drop policy mission_people_select_members on public.mission_people;
create policy mission_people_select_members on public.mission_people for select to authenticated using (private.has_permission('missions.read'));
drop policy mission_people_insert_members on public.mission_people;
create policy mission_people_insert_members on public.mission_people for insert to authenticated with check (private.has_permission('missions.write'));
drop policy mission_people_update_members on public.mission_people;
create policy mission_people_update_members on public.mission_people for update to authenticated using (private.has_permission('missions.write')) with check (private.has_permission('missions.write'));
drop policy mission_people_delete_members on public.mission_people;
create policy mission_people_delete_members on public.mission_people for delete to authenticated using (private.has_permission('missions.write'));
drop policy mission_places_select_members on public.mission_places;
create policy mission_places_select_members on public.mission_places for select to authenticated using (private.has_permission('missions.read'));
drop policy mission_places_insert_members on public.mission_places;
create policy mission_places_insert_members on public.mission_places for insert to authenticated with check (private.has_permission('missions.write'));
drop policy mission_places_update_members on public.mission_places;
create policy mission_places_update_members on public.mission_places for update to authenticated using (private.has_permission('missions.write')) with check (private.has_permission('missions.write'));
drop policy mission_places_delete_members on public.mission_places;
create policy mission_places_delete_members on public.mission_places for delete to authenticated using (private.has_permission('missions.write'));
drop policy mission_trips_select_members on public.mission_trips;
create policy mission_trips_select_members on public.mission_trips for select to authenticated using (private.has_permission('missions.read'));
drop policy mission_trips_insert_members on public.mission_trips;
create policy mission_trips_insert_members on public.mission_trips for insert to authenticated with check (private.has_permission('missions.write'));
drop policy mission_trips_update_members on public.mission_trips;
create policy mission_trips_update_members on public.mission_trips for update to authenticated using (private.has_permission('missions.write')) with check (private.has_permission('missions.write'));
drop policy mission_trips_delete_members on public.mission_trips;
create policy mission_trips_delete_members on public.mission_trips for delete to authenticated using (private.has_permission('missions.write'));
drop policy profiles_select_members on public.profiles;
create policy profiles_select_members on public.profiles for select to authenticated using (id=auth.uid() or private.has_permission('users.manage'));
drop policy kitchen_reports_read on public.kitchen_reports;
create policy kitchen_reports_read on public.kitchen_reports for select to authenticated using (private.has_permission('kitchen.read'));
drop policy kitchen_history_read on public.kitchen_report_history;
create policy kitchen_history_read on public.kitchen_report_history for select to authenticated using (private.has_permission('kitchen.read'));
create table public.user_access_history(id bigint generated always as identity primary key, target_id uuid not null, actor_id uuid not null, changed_at timestamptz not null default now(), previous jsonb, current jsonb not null);
alter table public.user_access_history enable row level security;
revoke all on public.user_access_history from public,anon,authenticated;
grant select on public.user_access_history to authenticated;
create policy user_access_history_read on public.user_access_history for select to authenticated using(private.has_permission('users.manage'));
create function public.save_user_access(p_id uuid,p_username text,p_full_name text,p_permissions jsonb,p_enabled boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare previous public.profiles; saved public.profiles;
begin
 perform pg_advisory_xact_lock(7340103);
 if not private.has_permission('users.manage') then raise exception 'Acceso denegado.' using errcode='42501'; end if;
 if p_full_name is null or length(btrim(p_full_name)) not between 1 and 120 or p_username is null or p_username !~ '^[a-z0-9._-]{3,32}$' or p_permissions is null or not private.valid_permissions(p_permissions) or p_enabled is null then raise exception 'Datos o permisos inválidos.' using errcode='22023'; end if;
 if p_id=auth.uid() and (not p_enabled or not p_permissions ? 'users.manage') then raise exception 'No podés quitar tu propio acceso de administrador.' using errcode='22023'; end if;
 select * into previous from public.profiles where id=p_id for update;
 if found and previous.username <> p_username then raise exception 'El usuario de ingreso no se modifica.' using errcode='22023'; end if;
 insert into public.profiles(id,username,full_name,role,permissions,enabled) values(p_id,p_username,btrim(p_full_name),case when p_permissions ? 'reservations.read' or p_permissions ? 'missions.read' or p_permissions ? 'users.manage' then 'member' else 'kitchen' end,p_permissions,p_enabled)
 on conflict(id) do update set full_name=excluded.full_name,role=excluded.role,permissions=excluded.permissions,enabled=excluded.enabled returning * into saved;
 insert into public.user_access_history(target_id,actor_id,previous,current) values(p_id,auth.uid(),case when previous.id is null then null else to_jsonb(previous) end,to_jsonb(saved));
 return to_jsonb(saved);
end $$;
revoke all on function public.save_user_access(uuid,text,text,jsonb,boolean) from public,anon;
grant execute on function public.save_user_access(uuid,text,text,jsonb,boolean) to authenticated;
create or replace function public.confirm_kitchen_event(p_id text, p_actual_guests integer, p_spent_cents bigint, p_expected_revision integer, p_correction_note text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.reservations; previous public.kitchen_reports; saved public.kitchen_reports; snapshot jsonb;
begin
  if not private.has_permission('kitchen.confirm') then
    raise exception 'Acceso denegado.' using errcode = '42501';
  end if;
  if p_actual_guests is null or p_actual_guests < 0 or p_actual_guests > 10000 or p_spent_cents is null or p_spent_cents < 0 or p_spent_cents > 1000000000 or p_expected_revision is null or p_expected_revision < 0 or p_correction_note is null or length(p_correction_note) > 1000 then
    raise exception 'Comensales, gasto o revisión inválidos.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(7340101);
  select * into r from public.reservations where id = p_id for update;
  if not found or r.service <> 'food' or r.meal_type is null then
    raise exception 'La reserva no existe o falta indicar almuerzo o merienda.' using errcode = '22023';
  end if;
  if (r.date || ' ' || r."end")::timestamp > (now() at time zone 'America/Argentina/Buenos_Aires') then
    raise exception 'Esperá al horario de finalización para confirmar la reunión.' using errcode = '22023';
  end if;
  select * into previous from public.kitchen_reports where reservation_id = p_id;
  if coalesce(previous.revision, 0) <> p_expected_revision then
    raise exception 'El evento fue actualizado por otra persona.' using errcode = '40001';
  end if;
  if p_expected_revision > 0 and length(btrim(p_correction_note)) = 0 then
    raise exception 'Indicá el motivo de la corrección.' using errcode = '22023';
  end if;
  snapshot := coalesce(previous.planned_snapshot, jsonb_build_object('title', r.title, 'sector', r.sector, 'date', r.date, 'start', r.start, 'end', r."end", 'meal_type', r.meal_type, 'guests', r.guests));
  insert into public.kitchen_reports values (p_id, r.date, p_actual_guests, p_spent_cents, 'ARS', p_expected_revision + 1, now(), auth.uid(), btrim(p_correction_note), snapshot)
  on conflict (reservation_id) do update set actual_guests = excluded.actual_guests, spent_cents = excluded.spent_cents, revision = excluded.revision, confirmed_at = excluded.confirmed_at, confirmed_by = excluded.confirmed_by, correction_note = excluded.correction_note
  returning * into saved;
  insert into public.kitchen_report_history values (saved.reservation_id, saved.revision, saved.actual_guests, saved.spent_cents, saved.confirmed_at, saved.confirmed_by, saved.correction_note);
  return to_jsonb(saved);
end $$;
revoke all on function public.confirm_kitchen_event(text, integer, bigint, integer, text) from public, anon;
grant execute on function public.confirm_kitchen_event(text, integer, bigint, integer, text) to authenticated;

create or replace function public.create_reservations(
  p_data jsonb,
  p_items jsonb,
  p_series_id text,
  p_rule jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_conflicts text[];
  v_count integer;
begin
  if not private.has_permission('reservations.write') then raise exception 'Acceso denegado.' using errcode = '42501'; end if;
  if p_data ->> 'service' = 'food' and coalesce(p_data ->> 'meal_type', '') not in ('lunch','snack') then raise exception 'Elegí almuerzo o merienda.' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(7340101);

  select coalesce(array_agg(d.date order by d.date), '{}')
    into v_conflicts
  from (
    select distinct r.date
    from public.reservations r
    join jsonb_array_elements(p_items) i(item) on r.date = i.item ->> 'date'
    where r.start < p_data ->> 'end' and r."end" > p_data ->> 'start'
  ) d;

  if cardinality(v_conflicts) > 0 then
    return jsonb_build_object('count', 0, 'conflicts', to_jsonb(v_conflicts));
  end if;

  insert into public.reservations (
    id, title, sector, sectors_json, responsible, contact, date, start, "end",
    service, meal_type, guests, notes, prepared, updated,
    series_id, repeat_ordinal, repeat_weekday, repeat_until, repeat_rule
  )
  select
    i.item ->> 'id', p_data ->> 'title', p_data ->> 'sector', p_data -> 'sectors',
    p_data ->> 'responsible', p_data ->> 'contact', i.item ->> 'date',
    p_data ->> 'start', p_data ->> 'end', p_data ->> 'service', p_data ->> 'meal_type',
    (p_data ->> 'guests')::integer, p_data ->> 'notes', 0, p_data ->> 'updated',
    p_series_id,
    (p_rule ->> 'ordinal')::integer, (p_rule ->> 'weekday')::integer, p_rule ->> 'until',
    case when jsonb_typeof(p_rule) = 'object' then p_rule else null end
  from jsonb_array_elements(p_items) i(item);

  get diagnostics v_count = row_count;
  return jsonb_build_object('count', v_count);
end;
$$;

-- Updates one reservation (including its date) unless it would overlap another one.
-- Returns the number of updated rows (0 = missing or overlapping).
create or replace function public.update_reservation_single(p_id text, p_data jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not private.has_permission('reservations.write') then raise exception 'Acceso denegado.' using errcode = '42501'; end if;
  if p_data ->> 'service' = 'food' and coalesce(p_data ->> 'meal_type', '') not in ('lunch','snack') then raise exception 'Elegí almuerzo o merienda.' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(7340101);

  update public.reservations r
  set title = p_data ->> 'title',
      sector = p_data ->> 'sector',
      sectors_json = p_data -> 'sectors',
      responsible = p_data ->> 'responsible',
      contact = p_data ->> 'contact',
      date = p_data ->> 'date',
      start = p_data ->> 'start',
      "end" = p_data ->> 'end',
      service = p_data ->> 'service',
      meal_type = p_data ->> 'meal_type',
      guests = (p_data ->> 'guests')::integer,
      notes = p_data ->> 'notes',
      prepared = 0,
      updated = p_data ->> 'updated'
  where r.id = p_id
    and not exists (
      select 1
      from public.reservations o
      where o.id <> p_id
        and o.date = p_data ->> 'date'
        and o.start < p_data ->> 'end'
        and o."end" > p_data ->> 'start'
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Updates every reservation of the series that contains p_id (dates are kept), unless any
-- target would overlap a reservation outside the series or the series has duplicate dates.
-- Returns the number of updated rows (0 = missing series, overlap or duplicate dates).
create or replace function public.update_reservation_series(p_id text, p_data jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ids text[];
  v_count integer;
begin
  if not private.has_permission('reservations.write') then raise exception 'Acceso denegado.' using errcode = '42501'; end if;
  if p_data ->> 'service' = 'food' and coalesce(p_data ->> 'meal_type', '') not in ('lunch','snack') then raise exception 'Elegí almuerzo o merienda.' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(7340101);

  select coalesce(array_agg(r.id), '{}')
    into v_ids
  from public.reservations r
  where r.series_id = (select s.series_id from public.reservations s where s.id = p_id);

  if cardinality(v_ids) = 0 then
    return 0;
  end if;

  if exists (
    select 1
    from public.reservations r
    where r.id = any (v_ids)
    group by r.date
    having count(*) > 1
  ) then
    return 0;
  end if;

  if exists (
    select 1
    from public.reservations o
    join public.reservations t on t.id = any (v_ids) and o.date = t.date
    where o.id <> all (v_ids)
      and o.start < p_data ->> 'end'
      and o."end" > p_data ->> 'start'
  ) then
    return 0;
  end if;

  update public.reservations r
  set title = p_data ->> 'title',
      sector = p_data ->> 'sector',
      sectors_json = p_data -> 'sectors',
      responsible = p_data ->> 'responsible',
      contact = p_data ->> 'contact',
      start = p_data ->> 'start',
      "end" = p_data ->> 'end',
      service = p_data ->> 'service',
      meal_type = p_data ->> 'meal_type',
      guests = (p_data ->> 'guests')::integer,
      notes = p_data ->> 'notes',
      prepared = 0,
      updated = p_data ->> 'updated'
  where r.id = any (v_ids);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;



commit;
