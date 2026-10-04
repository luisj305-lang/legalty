begin;

-- Optional contact fields on the trusted profile. Both are nullable and, when
-- present, must be nonblank after trimming and bounded in length. `phone` is
-- stored for future trusted administration but is never returned by any listing
-- RPC and never rendered in the portal UI.
alter table public.profiles add column name text;
alter table public.profiles add column phone text;

alter table public.profiles
  add constraint profiles_name_length_check
  check (name is null or char_length(btrim(name)) between 1 and 120);

alter table public.profiles
  add constraint profiles_phone_length_check
  check (phone is null or char_length(btrim(phone)) between 1 and 32);

-- Administrator-only directory of registered profiles eligible to be linked as
-- case participants. The display name now comes from the stored
-- public.profiles.name column instead of guessing from Auth user metadata.
-- `phone` is deliberately never returned. The authorization and validation
-- guards are unchanged from migration 009.
create or replace function public.list_case_candidates(expected_role text)
returns table(id uuid,email text,name text,active boolean)
language plpgsql stable security definer set search_path='' as $$
begin
  if portal_private.current_role() is distinct from 'admin' then
    raise exception 'Not permitted' using errcode='42501';
  end if;
  if expected_role is null or expected_role not in ('client','staff') then
    raise exception 'Invalid role' using errcode='22023';
  end if;
  return query
    select p.id,u.email::text,p.name,p.active
    from public.profiles p
    join auth.users u on u.id=p.id
    where p.role=expected_role
    order by name nulls last,u.email
    limit 1000;
end;
$$;

revoke all on function public.list_case_candidates(text) from public, anon, authenticated;
grant execute on function public.list_case_candidates(text) to authenticated;

commit;
