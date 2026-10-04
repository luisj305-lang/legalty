begin;

-- Administrator-only directory of registered profiles eligible to be linked as
-- case participants. It never enumerates profiles to non-administrators and
-- returns only the requested role, ordered by display name then email.
create function public.list_case_candidates(expected_role text)
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
      nullif(btrim(coalesce(u.raw_user_meta_data->>'full_name',u.raw_user_meta_data->>'name')),'') as name,
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

commit;
