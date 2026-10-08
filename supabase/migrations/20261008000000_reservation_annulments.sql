begin;

-- Keep cancelled planning and every kitchen revision, outside the active agenda.
create table public.reservation_annulments (
  reservation_id text primary key,
  cancelled_at timestamptz not null default now(),
  cancelled_by uuid not null references public.profiles(id) on delete restrict,
  cancelled_by_name text not null,
  reason text not null check (length(btrim(reason)) between 1 and 1000),
  reservation_snapshot jsonb not null,
  report_snapshot jsonb,
  history_snapshot jsonb not null
);
alter table public.reservation_annulments enable row level security;
revoke all on public.reservation_annulments from public, anon, authenticated;
grant select on public.reservation_annulments to authenticated;
create policy annulments_read_admin on public.reservation_annulments for select to authenticated
  using (private.has_permission('users.manage'));

-- Reports remain immutable historical records after their reservation is archived.
alter table public.kitchen_reports drop constraint kitchen_reports_reservation_id_fkey;
create or replace function private.protect_kitchen_plan() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(7340101);
  if exists (select 1 from public.kitchen_reports where reservation_id = old.id) then
    if tg_op = 'DELETE' then
      if not private.has_permission('users.manage') or not exists (
        select 1 from public.reservation_annulments a where a.reservation_id = old.id
          and a.cancelled_by = auth.uid() and a.reservation_snapshot = to_jsonb(old)
      ) then
        raise exception 'El ADM debe anular el evento con un motivo para conservar su cierre.' using errcode = '22023';
      end if;
    elsif (to_jsonb(new) - 'prepared' - 'updated') is distinct from (to_jsonb(old) - 'prepared' - 'updated') then
      raise exception 'La reunión ya tiene datos reales. Corregí el cierre sin cambiar la planificación.' using errcode = '22023';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

-- Never allow an archived ID to be reused and reconnect an old report to a new event.
create function private.reject_archived_reservation() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(7340101);
  if exists (select 1 from public.reservation_annulments where reservation_id = new.id) then
    raise exception 'El identificador pertenece a una reserva anulada.' using errcode = '22023';
  end if;
  return new;
end $$;
revoke all on function private.reject_archived_reservation() from public, anon, authenticated;
create trigger reject_archived_reservation before insert or update of id on public.reservations
  for each row execute function private.reject_archived_reservation();

create function public.annul_reservation(p_id text, p_scope text, p_reason text) returns integer
language plpgsql security definer set search_path = '' as $$
declare r public.reservations; ids text[]; total integer;
begin
  if not private.has_permission('users.manage') then
    raise exception 'Solo el ADM puede anular eventos.' using errcode = '42501';
  end if;
  if p_scope is null or p_scope not in ('single','series') or p_reason is null or length(btrim(p_reason)) not between 1 and 1000 then
    raise exception 'Indicá el alcance y un motivo de hasta 1000 caracteres.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(7340101);
  select * into r from public.reservations where id = p_id for update;
  if not found then return 0; end if;
  if p_scope = 'series' and r.series_id is null then
    raise exception 'La reserva no pertenece a una serie.' using errcode = '22023';
  end if;
  select array_agg(id) into ids from public.reservations
    where id = p_id or (p_scope = 'series' and series_id = r.series_id);
  insert into public.reservation_annulments(reservation_id,cancelled_by,cancelled_by_name,reason,reservation_snapshot,report_snapshot,history_snapshot)
  select v.id,auth.uid(),(select full_name from public.profiles where id=auth.uid()),btrim(p_reason),to_jsonb(v),
    (select to_jsonb(k) from public.kitchen_reports k where k.reservation_id = v.id),
    coalesce((select jsonb_agg(to_jsonb(h) order by h.revision) from public.kitchen_report_history h where h.reservation_id = v.id),'[]'::jsonb)
  from public.reservations v where v.id = any(ids);
  delete from public.reservations where id = any(ids);
  get diagnostics total = row_count;
  return total;
end $$;
revoke all on function public.annul_reservation(text,text,text) from public, anon;
grant execute on function public.annul_reservation(text,text,text) to authenticated;

-- All application queries, including annual statistics, see only active closures.
drop policy kitchen_reports_read on public.kitchen_reports;
create policy kitchen_reports_read on public.kitchen_reports for select to authenticated
  using ((private.has_permission('kitchen.read') or private.has_permission('stats.read'))
    and exists (select 1 from public.reservations r where r.id = reservation_id));
drop policy kitchen_history_read on public.kitchen_report_history;
create policy kitchen_history_read on public.kitchen_report_history for select to authenticated
  using (private.has_permission('kitchen.read')
    and exists (select 1 from public.reservations r where r.id = reservation_id));
commit;
