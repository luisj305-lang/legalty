begin;

create or replace function portal_private.current_role() returns text
language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p
  where p.id = (select auth.uid()) and p.active and not p.must_change_password
    and (select nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'aal') in ('aal1','aal2')
$$;
revoke all on function portal_private.current_role() from public, anon, authenticated;
grant execute on function portal_private.current_role() to authenticated;

commit;
