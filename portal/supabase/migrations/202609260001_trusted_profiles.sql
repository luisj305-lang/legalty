begin;

-- Provisioned only through separately authorized trusted administration.
-- No Auth metadata trigger, automatic activation, or client write path.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('client', 'staff', 'admin')),
  active boolean not null default false,
  must_change_password boolean not null default true
);

alter table public.profiles enable row level security;
revoke all privileges on table public.profiles from public, anon, authenticated;
revoke all privileges (id, role, active, must_change_password)
  on table public.profiles from public, anon, authenticated;
grant select on table public.profiles to authenticated;

-- Setup can read its own flags before MFA/rotation; this grants no business access.
create policy profiles_read_own on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

commit;
