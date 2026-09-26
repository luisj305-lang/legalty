begin;

create table public.cases (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique check (length(btrim(reference)) between 1 and 80),
  title text not null check (length(btrim(title)) between 1 and 200),
  description text not null default '' check (length(description) <= 10000),
  status text not null default 'open' check (status in ('open','in_progress','waiting','closed')),
  next_action text not null default '' check (length(next_action) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id)
);
comment on column public.cases.description is 'Client-visible content only; never internal notes.';

create table public.case_clients (
  case_id uuid not null references public.cases(id) on delete cascade,
  client_id uuid not null references public.profiles(id),
  primary key (case_id, client_id)
);
create table public.case_staff (
  case_id uuid not null references public.cases(id) on delete cascade,
  staff_id uuid not null references public.profiles(id),
  primary key (case_id, staff_id)
);
create index case_clients_by_client on public.case_clients(client_id, case_id);
create index case_staff_by_staff on public.case_staff(staff_id, case_id);

-- Not exposed through PostgREST. Definer helpers bypass link-table RLS without recursion.
create schema if not exists portal_private;
revoke all on schema portal_private from public, anon, authenticated;
grant usage on schema portal_private to authenticated;

create function portal_private.current_role() returns text
language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p
  where p.id = (select auth.uid()) and p.active and not p.must_change_password
    and ((p.role in ('admin','staff') and
      (select nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'aal') = 'aal2')
      or (p.role = 'client' and
      (select nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'aal') in ('aal1','aal2')))
$$;

create function portal_private.can_read_case(target_case uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(case portal_private.current_role()
    when 'admin' then true
    when 'staff' then exists (select 1 from public.case_staff
      where case_id = target_case and staff_id = (select auth.uid()))
    when 'client' then exists (select 1 from public.case_clients
      where case_id = target_case and client_id = (select auth.uid()))
    else false end, false)
$$;
revoke all on function portal_private.current_role() from public, anon, authenticated;
revoke all on function portal_private.can_read_case(uuid) from public, anon, authenticated;
grant execute on function portal_private.current_role(), portal_private.can_read_case(uuid) to authenticated;

alter table public.cases enable row level security;
alter table public.case_clients enable row level security;
alter table public.case_staff enable row level security;
revoke all on public.cases, public.case_clients, public.case_staff from public, anon, authenticated;
grant select on public.cases, public.case_clients, public.case_staff to authenticated;

create policy cases_read on public.cases for select to authenticated
  using (portal_private.can_read_case(id));
create policy case_clients_read on public.case_clients for select to authenticated
  using (portal_private.can_read_case(case_id) and
    (portal_private.current_role() in ('admin','staff') or client_id = (select auth.uid())));
create policy case_staff_read on public.case_staff for select to authenticated
  using (portal_private.can_read_case(case_id) and portal_private.current_role() in ('admin','staff'));

-- No writes are granted here. The next slice owns validated RPCs and atomic audit.
commit;
