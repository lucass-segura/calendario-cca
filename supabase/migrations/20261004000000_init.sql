-- CCA SECTOR 7: initial schema (Postgres port of the former D1/SQLite schema).
-- Access model: every authenticated member can read and edit everything; anon has no access.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- Dates and times stay text ('YYYY-MM-DD' / 'HH:MM') because the UI and the API contract use those strings.
create table public.reservations (
  id text primary key,
  title text not null,
  sector text not null,
  sectors_json jsonb,
  responsible text not null,
  contact text not null,
  date text not null check (date ~ '^\d{4}-\d{2}-\d{2}$'),
  start text not null check (start ~ '^([01]\d|2[0-3]):[0-5]\d$'),
  "end" text not null check ("end" ~ '^([01]\d|2[0-3]):[0-5]\d$'),
  service text not null check (service in ('food', 'space')),
  guests integer not null check (guests between 1 and 10000),
  notes text not null,
  prepared smallint not null default 0 check (prepared in (0, 1)),
  updated text not null,
  series_id text,
  repeat_ordinal integer,
  repeat_weekday integer,
  repeat_until text check (repeat_until is null or repeat_until ~ '^\d{4}-\d{2}-\d{2}$'),
  repeat_rule jsonb,
  check (start < "end")
);

create index idx_reservations_date on public.reservations (date);
create index idx_reservations_series on public.reservations (series_id);

create table public.settings (
  id integer primary key check (id = 1),
  name text not null,
  sectors jsonb not null
);

create table public.mission_people (
  id text primary key,
  name text not null,
  active smallint not null default 1 check (active in (-1, 0, 1))
);

create table public.mission_places (
  id text primary key,
  name text not null,
  active smallint not null default 1 check (active in (-1, 0, 1))
);

create table public.mission_trips (
  id text primary key,
  date text not null check (date ~ '^\d{4}-\d{2}-\d{2}$'),
  place_id text not null references public.mission_places (id),
  people_json jsonb not null,
  notes text not null,
  updated text not null
);

create index idx_mission_trips_date on public.mission_trips (date);
create index idx_mission_trips_place on public.mission_trips (place_id);

-- One profile per Auth user. Rows are created by the admin script (service role), never by clients.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9._-]{3,32}$'),
  full_name text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Privileges and row level security
-- ---------------------------------------------------------------------------

revoke all on public.reservations, public.settings, public.mission_people,
  public.mission_places, public.mission_trips, public.profiles from anon;

grant select, insert, update, delete on public.reservations, public.settings,
  public.mission_people, public.mission_places, public.mission_trips to authenticated;
grant select on public.profiles to authenticated;

alter table public.reservations enable row level security;
alter table public.settings enable row level security;
alter table public.mission_people enable row level security;
alter table public.mission_places enable row level security;
alter table public.mission_trips enable row level security;
alter table public.profiles enable row level security;

-- Full access for any signed-in member (by design: no roles). The auth.uid() test is
-- equivalent to "is authenticated" and keeps the policy from being a bare "true".
do $$
declare
  t text;
  op text;
begin
  foreach t in array array['reservations', 'settings', 'mission_people', 'mission_places', 'mission_trips'] loop
    foreach op in array array['select', 'insert', 'update', 'delete'] loop
      if op = 'insert' then
        execute format(
          'create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) is not null)',
          t || '_' || op || '_members', t);
      else
        execute format(
          'create policy %I on public.%I for %s to authenticated using ((select auth.uid()) is not null)',
          t || '_' || op || '_members', t, op);
      end if;
    end loop;
  end loop;
end
$$;

-- Update policies also need WITH CHECK so rows cannot be written back to something invalid.
alter policy reservations_update_members on public.reservations with check ((select auth.uid()) is not null);
alter policy settings_update_members on public.settings with check ((select auth.uid()) is not null);
alter policy mission_people_update_members on public.mission_people with check ((select auth.uid()) is not null);
alter policy mission_places_update_members on public.mission_places with check ((select auth.uid()) is not null);
alter policy mission_trips_update_members on public.mission_trips with check ((select auth.uid()) is not null);

-- Profiles: members can read; no client write policies exist.
create policy profiles_select_members on public.profiles
  for select to authenticated using ((select auth.uid()) is not null);

-- ---------------------------------------------------------------------------
-- Atomic reservation operations (SECURITY INVOKER: RLS applies to the caller)
-- ---------------------------------------------------------------------------

-- Single constant key that serializes every reservation writer, so the overlap check and the
-- write cannot interleave under READ COMMITTED.

-- Creates a batch of reservations (one or a whole series), all or nothing.
-- p_data:  {title, sector, sectors, responsible, contact, start, end, service, guests, notes, updated}
-- p_items: [{id, date}, ...]
-- p_rule:  repeat rule object or null
-- Returns {count: n} on success, or {count: 0, conflicts: [dates]} when any date overlaps.
create function public.create_reservations(
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
    service, guests, notes, prepared, updated,
    series_id, repeat_ordinal, repeat_weekday, repeat_until, repeat_rule
  )
  select
    i.item ->> 'id', p_data ->> 'title', p_data ->> 'sector', p_data -> 'sectors',
    p_data ->> 'responsible', p_data ->> 'contact', i.item ->> 'date',
    p_data ->> 'start', p_data ->> 'end', p_data ->> 'service',
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
create function public.update_reservation_single(p_id text, p_data jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
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
create function public.update_reservation_series(p_id text, p_data jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ids text[];
  v_count integer;
begin
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
      guests = (p_data ->> 'guests')::integer,
      notes = p_data ->> 'notes',
      prepared = 0,
      updated = p_data ->> 'updated'
  where r.id = any (v_ids);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.create_reservations(jsonb, jsonb, text, jsonb) from public, anon;
revoke execute on function public.update_reservation_single(text, jsonb) from public, anon;
revoke execute on function public.update_reservation_series(text, jsonb) from public, anon;
grant execute on function public.create_reservations(jsonb, jsonb, text, jsonb) to authenticated;
grant execute on function public.update_reservation_single(text, jsonb) to authenticated;
grant execute on function public.update_reservation_series(text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Seeds (idempotent). Neuquén and Cutral Có are seeded directly with their accents.
-- ---------------------------------------------------------------------------

insert into public.mission_places (id, name, active) values
  ('ce694319-3908-449e-b984-918413e9b987', 'JJ GOMEZ', 1),
  ('74f5a9e6-30b1-4303-8afa-a3cf716fe002', 'LUIS BELTRAN', 1),
  ('5af16f13-fe08-4932-93fc-6c5207b5a99b', 'PICUN LEUFU', 1),
  ('5732c974-f8c0-4986-bfa0-25a70086a7ad', 'SAUZAL BONITO', 1),
  ('f6c7ed8d-4c76-44d1-98a4-badfdc67f63a', 'ZAPALA', 1),
  ('87062966-9acd-43a7-85f2-d39d15997555', 'ANDACOLLO', 1),
  ('d5d98157-6f5b-4439-821b-f4bc9501590d', 'PLOTTIER', 1),
  ('a7f883c7-46af-4220-8dd1-b7373be15802', 'NEUQUÉN', 1),
  ('d28e91e9-de60-4c81-824c-f2b78ac14272', 'VILLA LA ANGOSTURA', 1),
  ('9489bba6-2f3b-46d7-8efb-15fb24985801', 'CUTRAL CÓ', 1)
on conflict (id) do nothing;

insert into public.mission_people (id, name, active) values
  ('02bd4288-a7f9-48d3-85f2-49cf7c2ef682', 'MAGLIO', 1),
  ('01c44efc-770e-4e46-8fa0-2c0e3f23c2e5', 'JORGE', 1),
  ('93eee71f-22aa-4593-87ff-5105476632a7', 'LUIS', 1),
  ('19db2d8a-c2e2-4a6b-a00a-d34d043bc70f', 'JUAN', 1),
  ('f1443fdb-4f7d-41f7-ab7a-bcdc758949ac', 'LUCAS', 1),
  ('39f1e5d6-1a15-430e-8b85-06473857e1b7', 'ADRIAN', 1),
  ('7e4aed2b-e166-470f-b10e-f63dda2cb79b', 'MARIO', 1),
  ('09ca35fb-c734-4853-924b-6b89ce80b5e9', 'AMADO', 1),
  ('f92d1841-dbb4-4081-b0d2-2f2358f9b4aa', 'YONA', 1)
on conflict (id) do nothing;
