begin;
-- Identity numbers are recovery secrets: never readable through a user's JWT.
create table public.user_password_recovery (
  user_id uuid primary key references auth.users(id) on delete cascade,
  dni text not null check (dni ~ '^[0-9]{7,8}$'),
  updated_at timestamptz not null default now()
);
alter table public.user_password_recovery enable row level security;
revoke all on public.user_password_recovery from public, anon, authenticated;
grant select, insert, update, delete on public.user_password_recovery to service_role;
create table public.user_password_reset_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id),
  actor_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.user_password_reset_history enable row level security;
revoke all on public.user_password_reset_history from public, anon, authenticated;
grant select, insert on public.user_password_reset_history to service_role;
grant usage, select on sequence public.user_password_reset_history_id_seq to service_role;
commit;
