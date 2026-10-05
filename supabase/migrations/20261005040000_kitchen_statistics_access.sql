begin;
drop policy kitchen_reports_read on public.kitchen_reports;
create policy kitchen_reports_read on public.kitchen_reports for select to authenticated
  using (private.has_permission('kitchen.read') or private.has_permission('stats.read'));
commit;
