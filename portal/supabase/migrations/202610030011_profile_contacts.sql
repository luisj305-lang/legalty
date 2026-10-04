begin;

-- Administrator-only directory of every registered profile with its trusted
-- stored contact fields. `phone` is returned only by this administrator-only
-- RPC and is never part of the participant selector. The caller must be a fresh
-- trusted administrator; every other role receives `42501`.
create function public.list_profile_contacts()
returns table(id uuid,email text,name text,phone text,role text,active boolean)
language plpgsql stable security definer set search_path='' as $$
begin
  if portal_private.current_role() is distinct from 'admin' then
    raise exception 'Not permitted' using errcode='42501';
  end if;
  return query
    select p.id,u.email::text,p.name,p.phone,p.role,p.active
    from public.profiles p
    join auth.users u on u.id=p.id
    order by p.role,p.name nulls last,u.email
    limit 1000;
end;
$$;

-- Administrator-only contact editor. It can change only `name` and `phone`;
-- role, active and must_change_password are never touched. A blank value after
-- trimming clears that field to null, and an over-long value is rejected with
-- `22023`. A null or unknown target profile is also rejected with `22023`.
create function public.update_profile_contact(target_profile uuid,new_name text,new_phone text)
returns void
language plpgsql security definer set search_path='' as $$
declare
  trimmed_name text;
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

  trimmed_name := nullif(btrim(new_name),'');
  if trimmed_name is not null and char_length(trimmed_name) > 120 then
    raise exception 'Invalid name' using errcode='22023';
  end if;
  trimmed_phone := nullif(btrim(new_phone),'');
  if trimmed_phone is not null and char_length(trimmed_phone) > 32 then
    raise exception 'Invalid phone' using errcode='22023';
  end if;

  update public.profiles
    set name=trimmed_name,phone=trimmed_phone
    where id=target_profile;
end;
$$;

revoke all on function public.list_profile_contacts() from public, anon, authenticated;
revoke all on function public.update_profile_contact(uuid,text,text) from public, anon, authenticated;
grant execute on function public.list_profile_contacts() to authenticated;
grant execute on function public.update_profile_contact(uuid,text,text) to authenticated;

commit;
