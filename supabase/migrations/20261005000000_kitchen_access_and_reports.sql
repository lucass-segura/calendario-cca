begin;

alter table public.profiles add column role text not null default 'member' check (role in ('member', 'kitchen'));
alter table public.reservations add column meal_type text check (meal_type in ('lunch', 'snack'));
alter table public.reservations add constraint meal_type_service check (service = 'food' or meal_type is null);

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
create function private.app_role() returns text language sql stable security definer set search_path = ''
as $$ select p.role from public.profiles p where p.id = auth.uid() $$;
revoke all on function private.app_role() from public, anon;
grant execute on function private.app_role() to authenticated;

-- Replace every former permissive policy. Kitchen can only read food reservations
-- and shared names, and has no access to mission tables or profile administration.
do $$
declare t text; op text;
begin
  foreach t in array array['reservations','settings','mission_people','mission_places','mission_trips'] loop
    foreach op in array array['select','insert','update','delete'] loop
      execute format('drop policy %I on public.%I', t || '_' || op || '_members', t);
      if op = 'insert' then
        execute format('create policy %I on public.%I for insert to authenticated with check ((select private.app_role()) = ''member'')', t || '_insert_members', t);
      elsif op = 'update' then
        execute format('create policy %I on public.%I for update to authenticated using ((select private.app_role()) = ''member'') with check ((select private.app_role()) = ''member'')', t || '_update_members', t);
      elsif op = 'select' and t = 'reservations' then
        execute 'create policy reservations_select_members on public.reservations for select to authenticated using ((select private.app_role()) = ''member'' or ((select private.app_role()) = ''kitchen'' and service = ''food''))';
      elsif op = 'select' and t = 'settings' then
        execute 'create policy settings_select_members on public.settings for select to authenticated using ((select private.app_role()) in (''member'', ''kitchen''))';
      else
        execute format('create policy %I on public.%I for %s to authenticated using ((select private.app_role()) = ''member'')', t || '_' || op || '_members', t, op);
      end if;
    end loop;
  end loop;
end $$;
drop policy profiles_select_members on public.profiles;
create policy profiles_select_members on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select private.app_role()) = 'member');

create table public.kitchen_reports (
  reservation_id text primary key references public.reservations(id) on delete restrict,
  event_date text not null,
  actual_guests integer not null check (actual_guests between 0 and 10000),
  spent_cents bigint not null check (spent_cents between 0 and 1000000000),
  currency text not null default 'ARS' check (currency = 'ARS'),
  revision integer not null check (revision > 0),
  confirmed_at timestamptz not null,
  confirmed_by uuid not null references public.profiles(id) on delete restrict,
  correction_note text not null check (length(correction_note) <= 1000),
  planned_snapshot jsonb not null
);
create index kitchen_reports_date on public.kitchen_reports(event_date);
create table public.kitchen_report_history (
  reservation_id text not null references public.kitchen_reports(reservation_id) on delete restrict,
  revision integer not null,
  actual_guests integer not null,
  spent_cents bigint not null,
  confirmed_at timestamptz not null,
  confirmed_by uuid not null references public.profiles(id) on delete restrict,
  correction_note text not null,
  primary key (reservation_id, revision)
);
alter table public.kitchen_reports enable row level security;
alter table public.kitchen_report_history enable row level security;
revoke all on public.kitchen_reports, public.kitchen_report_history from anon, authenticated;
grant select on public.kitchen_reports, public.kitchen_report_history to authenticated;
grant all on public.kitchen_reports, public.kitchen_report_history to service_role;
create policy kitchen_reports_read on public.kitchen_reports for select to authenticated
using ((select private.app_role()) in ('member', 'kitchen'));
create policy kitchen_history_read on public.kitchen_report_history for select to authenticated
using ((select private.app_role()) in ('member', 'kitchen'));

-- Confirmed planning is immutable. A correction changes the report, preserving
-- the original plan and every prior confirmation. Shared lock also serializes RPCs.
create function private.protect_kitchen_plan() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(7340101);
  if exists (select 1 from public.kitchen_reports where reservation_id = old.id) then
    if tg_op = 'DELETE' then
      raise exception 'No se puede cancelar una reserva con cierre registrado.' using errcode = '22023';
    elsif (to_jsonb(new) - 'prepared' - 'updated') is distinct from (to_jsonb(old) - 'prepared' - 'updated') then
      raise exception 'La reunión ya tiene datos reales. Corregí el cierre sin cambiar la planificación.' using errcode = '22023';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
revoke all on function private.protect_kitchen_plan() from public, anon, authenticated;
create trigger protect_kitchen_plan before update or delete on public.reservations for each row execute function private.protect_kitchen_plan();

create function public.confirm_kitchen_event(p_id text, p_actual_guests integer, p_spent_cents bigint, p_expected_revision integer, p_correction_note text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.reservations; previous public.kitchen_reports; saved public.kitchen_reports; snapshot jsonb;
begin
  if auth.uid() is null or coalesce(private.app_role(), '') not in ('member', 'kitchen') then
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

-- Reservation RPCs are replaced below to persist explicit meal types. Historical
-- food reservations intentionally remain unclassified; never infer from titles.

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
  if coalesce(private.app_role(), '') <> 'member' then raise exception 'Acceso denegado.' using errcode = '42501'; end if;
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
  if coalesce(private.app_role(), '') <> 'member' then raise exception 'Acceso denegado.' using errcode = '42501'; end if;
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
  if coalesce(private.app_role(), '') <> 'member' then raise exception 'Acceso denegado.' using errcode = '42501'; end if;
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
