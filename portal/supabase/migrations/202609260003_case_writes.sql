begin;

create table portal_private.case_audit (
  id bigint generated always as identity primary key,
  case_id uuid not null references public.cases(id),
  actor_id uuid not null references public.profiles(id),
  action text not null check (action in ('created','updated')),
  occurred_at timestamptz not null default clock_timestamp(),
  changed_fields text[] not null
);
alter table portal_private.case_audit enable row level security;
revoke all on portal_private.case_audit from public, anon, authenticated, service_role;
grant select on portal_private.case_audit to authenticated;
create policy case_audit_read on portal_private.case_audit for select to authenticated
  using (portal_private.current_role() in ('admin','staff') and portal_private.can_read_case(case_id));

create function portal_private.reject_audit_change() returns trigger
language plpgsql set search_path='' as $$
begin
  raise exception 'Audit is append-only' using errcode='42501';
end;
$$;
revoke all on function portal_private.reject_audit_change() from public, anon, authenticated;
create trigger case_audit_immutable before update or delete on portal_private.case_audit
  for each row execute function portal_private.reject_audit_change();

create function public.create_case(case_reference text, case_title text, case_description text,
  client_ids uuid[], staff_ids uuid[]) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  actor uuid := auth.uid();
  result uuid;
begin
  perform 1 from public.profiles where id=actor for share;
  if portal_private.current_role() is distinct from 'admin' then
    raise exception 'Not permitted' using errcode='42501';
  end if;
  if client_ids is null or staff_ids is null or cardinality(client_ids) not between 1 and 100
    or cardinality(staff_ids)>100
    or (select count(distinct x) from unnest(client_ids) x)<>cardinality(client_ids)
    or (select count(distinct x) from unnest(staff_ids) x)<>cardinality(staff_ids) then
    raise exception 'Invalid participants' using errcode='22023';
  end if;
  perform 1 from public.profiles where id=any(client_ids||staff_ids) order by id for share;
  if (select count(*) from public.profiles where id=any(client_ids) and role='client')<>cardinality(client_ids)
    or (select count(*) from public.profiles where id=any(staff_ids) and role='staff')<>cardinality(staff_ids) then
    raise exception 'Invalid participants' using errcode='22023';
  end if;
  insert into public.cases(reference,title,description,created_by)
    values(case_reference,case_title,case_description,actor) returning id into result;
  insert into public.case_clients select result,x from unnest(client_ids) x;
  insert into public.case_staff select result,x from unnest(staff_ids) x;
  insert into portal_private.case_audit(case_id,actor_id,action,changed_fields)
    values(result,actor,'created',array['reference','title','description','participants']);
  return result;
end;
$$;

create function public.update_case(target_case uuid, case_title text, case_description text,
  case_status text, case_next_action text) returns void
language plpgsql security definer set search_path='' as $$
declare
  actor uuid := auth.uid();
begin
  perform 1 from public.cases where id=target_case for update;
  if not found then raise exception 'Not permitted' using errcode='42501'; end if;
  perform 1 from public.profiles where id=actor for share;
  if coalesce(portal_private.current_role() not in ('admin','staff'),true)
    or not portal_private.can_read_case(target_case) then
    raise exception 'Not permitted' using errcode='42501';
  end if;
  update public.cases set title=case_title,description=case_description,status=case_status,
    next_action=case_next_action,updated_at=clock_timestamp() where id=target_case;
  insert into portal_private.case_audit(case_id,actor_id,action,changed_fields)
    values(target_case,actor,'updated',array['title','description','status','next_action']);
end;
$$;

create function public.find_case_participant(exact_email text, expected_role text)
returns table(id uuid,email text,role text)
language plpgsql stable security definer set search_path='' as $$
begin
  if portal_private.current_role() is distinct from 'admin' then
    raise exception 'Not permitted' using errcode='42501';
  end if;
  if expected_role not in ('client','staff') or exact_email is null or length(exact_email)>254 then
    raise exception 'Invalid lookup' using errcode='22023';
  end if;
  return query select p.id,u.email::text,p.role from public.profiles p
    join auth.users u on u.id=p.id
    where lower(u.email)=lower(btrim(exact_email)) and p.role=expected_role limit 1;
end;
$$;

revoke all on function public.create_case(text,text,text,uuid[],uuid[]),
  public.update_case(uuid,text,text,text,text),public.find_case_participant(text,text)
  from public, anon, authenticated;
grant execute on function public.create_case(text,text,text,uuid[],uuid[]),
  public.update_case(uuid,text,text,text,text),public.find_case_participant(text,text) to authenticated;

commit;
