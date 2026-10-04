begin;

-- Split the single trusted display name into first_name / last_name. The old
-- `name` value is preserved into first_name so no stored data is lost; the
-- legacy column is then dropped (its length check is dropped with it).
alter table public.profiles add column first_name text;
alter table public.profiles add column last_name text;
update public.profiles set first_name = name where name is not null and first_name is null;
alter table public.profiles drop column name;

alter table public.profiles
  add constraint profiles_first_name_length_check
  check (first_name is null or char_length(btrim(first_name)) between 1 and 120);

alter table public.profiles
  add constraint profiles_last_name_length_check
  check (last_name is null or char_length(btrim(last_name)) between 1 and 120);

-- Administrator-only directory of registered profiles eligible to be linked as
-- case participants. The display name is composed from the stored split names
-- (a blank composition stays null). `phone` is deliberately never returned. The
-- authorization and validation guards are unchanged from migration 009/010.
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
    select p.id,u.email::text,
      nullif(btrim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')),'') as name,
      p.active
    from public.profiles p
    join auth.users u on u.id=p.id
    where p.role=expected_role
    order by name nulls last,u.email
    limit 1000;
end;
$$;

revoke all on function public.list_case_candidates(text) from public, anon, authenticated;
grant execute on function public.list_case_candidates(text) to authenticated;

-- Administrator-only directory of every registered profile with its trusted
-- stored contact fields. The signature changes to the split names, so the old
-- single-name function is dropped first.
drop function public.list_profile_contacts();
create function public.list_profile_contacts()
returns table(id uuid,email text,first_name text,last_name text,phone text,role text,active boolean)
language plpgsql stable security definer set search_path='' as $$
begin
  if portal_private.current_role() is distinct from 'admin' then
    raise exception 'Not permitted' using errcode='42501';
  end if;
  return query
    select p.id,u.email::text,p.first_name,p.last_name,p.phone,p.role,p.active
    from public.profiles p
    join auth.users u on u.id=p.id
    order by p.role,p.last_name nulls last,p.first_name nulls last,u.email
    limit 1000;
end;
$$;

-- Administrator-only contact editor. It can change only first_name, last_name
-- and phone; role, active and must_change_password are never touched. A blank
-- value after trimming clears that field to null, and an over-long value is
-- rejected with `22023`. A null or unknown target profile is also rejected with
-- `22023`. The old single-name signature is dropped first.
drop function public.update_profile_contact(uuid,text,text);
create function public.update_profile_contact(target_profile uuid,new_first_name text,new_last_name text,new_phone text)
returns void
language plpgsql security definer set search_path='' as $$
declare
  trimmed_first_name text;
  trimmed_last_name text;
  trimmed_phone text;
begin
  if portal_private.current_role() is distinct from 'admin' then
    raise exception 'Not permitted' using errcode='42501';
  end if;
  if target_profile is null then
    raise exception 'Invalid target profile' using errcode='22023';
  end if;
  if not exists (select 1 from public.profiles p where p.id=target_profile) then
    raise exception 'Invalid target profile' using errcode='22023';
  end if;

  trimmed_first_name := nullif(btrim(new_first_name),'');
  if trimmed_first_name is not null and char_length(trimmed_first_name) > 120 then
    raise exception 'Invalid first name' using errcode='22023';
  end if;
  trimmed_last_name := nullif(btrim(new_last_name),'');
  if trimmed_last_name is not null and char_length(trimmed_last_name) > 120 then
    raise exception 'Invalid last name' using errcode='22023';
  end if;
  trimmed_phone := nullif(btrim(new_phone),'');
  if trimmed_phone is not null and char_length(trimmed_phone) > 32 then
    raise exception 'Invalid phone' using errcode='22023';
  end if;

  update public.profiles
    set first_name=trimmed_first_name,last_name=trimmed_last_name,phone=trimmed_phone
    where id=target_profile;
end;
$$;

-- Administrator-only provisioning of a trusted client profile for an Auth user
-- that was just invited. The FK on auth.users(id) requires the invited user to
-- exist first, so this runs after the invitation. It always creates an active
-- client that must still change its own password; role/active are not caller
-- controlled. Length validation runs before the duplicate check so invalid
-- input is reported as `22023` regardless of existing state.
create function public.provision_client_profile(target_user uuid,client_first_name text,client_last_name text,client_phone text)
returns void
language plpgsql security definer set search_path='' as $$
declare
  trimmed_first_name text;
  trimmed_last_name text;
  trimmed_phone text;
begin
  if portal_private.current_role() is distinct from 'admin' then
    raise exception 'Not permitted' using errcode='42501';
  end if;
  if target_user is null then
    raise exception 'Invalid target user' using errcode='22023';
  end if;
  trimmed_first_name := nullif(btrim(client_first_name),'');
  if trimmed_first_name is not null and char_length(trimmed_first_name) > 120 then
    raise exception 'Invalid first name' using errcode='22023';
  end if;
  trimmed_last_name := nullif(btrim(client_last_name),'');
  if trimmed_last_name is not null and char_length(trimmed_last_name) > 120 then
    raise exception 'Invalid last name' using errcode='22023';
  end if;
  trimmed_phone := nullif(btrim(client_phone),'');
  if trimmed_phone is not null and char_length(trimmed_phone) > 32 then
    raise exception 'Invalid phone' using errcode='22023';
  end if;
  if exists (select 1 from public.profiles p where p.id=target_user) then
    raise exception 'Profile already exists' using errcode='23505';
  end if;

  insert into public.profiles(id,role,active,must_change_password,first_name,last_name,phone)
    values (target_user,'client',true,true,trimmed_first_name,trimmed_last_name,trimmed_phone);
end;
$$;

revoke all on function public.list_profile_contacts() from public, anon, authenticated;
revoke all on function public.update_profile_contact(uuid,text,text,text) from public, anon, authenticated;
revoke all on function public.provision_client_profile(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.list_profile_contacts() to authenticated;
grant execute on function public.update_profile_contact(uuid,text,text,text) to authenticated;
grant execute on function public.provision_client_profile(uuid,text,text,text) to authenticated;

commit;
