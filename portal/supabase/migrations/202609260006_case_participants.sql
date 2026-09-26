begin;

create function public.get_case_participants(target_case uuid)
returns table(id uuid,email text,role text)
language plpgsql stable security definer set search_path='' as $$
begin
  if portal_private.current_role() is distinct from 'admin' then
    raise exception 'Not permitted' using errcode='42501';
  end if;
  return query
    select p.id,u.email::text,p.role from (
      select cc.client_id as profile_id from public.case_clients cc where cc.case_id=target_case
      union all
      select cs.staff_id from public.case_staff cs where cs.case_id=target_case
    ) linked
    join public.profiles p on p.id=linked.profile_id
    join auth.users u on u.id=p.id
    order by p.role,p.id;
end;
$$;

create function public.replace_case_participants(target_case uuid,
  expected_client_ids uuid[], expected_staff_ids uuid[], client_ids uuid[], staff_ids uuid[])
returns boolean
language plpgsql security definer set search_path='' as $$
declare
  actor uuid := auth.uid();
  expected_clients uuid[];
  expected_staff uuid[];
  desired_clients uuid[];
  desired_staff uuid[];
  current_clients uuid[];
  current_staff uuid[];
  clients_changed boolean;
  staff_changed boolean;
begin
  perform 1 from public.profiles where id=actor for share;
  if portal_private.current_role() is distinct from 'admin' then
    raise exception 'Not permitted' using errcode='42501';
  end if;
  if target_case is null or expected_client_ids is null or expected_staff_ids is null
    or client_ids is null or staff_ids is null
    or cardinality(expected_client_ids) not between 1 and 100
    or cardinality(client_ids) not between 1 and 100
    or cardinality(expected_staff_ids) not between 0 and 100
    or cardinality(staff_ids) not between 0 and 100
    or array_position(expected_client_ids,null) is not null
    or array_position(expected_staff_ids,null) is not null
    or array_position(client_ids,null) is not null
    or array_position(staff_ids,null) is not null
    or (select count(distinct x) from unnest(expected_client_ids) x)<>cardinality(expected_client_ids)
    or (select count(distinct x) from unnest(expected_staff_ids) x)<>cardinality(expected_staff_ids)
    or (select count(distinct x) from unnest(client_ids) x)<>cardinality(client_ids)
    or (select count(distinct x) from unnest(staff_ids) x)<>cardinality(staff_ids)
    or expected_client_ids && expected_staff_ids or client_ids && staff_ids then
    raise exception 'Invalid participants' using errcode='22023';
  end if;

  select array_agg(x order by x) into expected_clients from unnest(expected_client_ids) x;
  select coalesce(array_agg(x order by x),'{}'::uuid[]) into expected_staff from unnest(expected_staff_ids) x;
  select array_agg(x order by x) into desired_clients from unnest(client_ids) x;
  select coalesce(array_agg(x order by x),'{}'::uuid[]) into desired_staff from unnest(staff_ids) x;

  perform 1 from public.cases where id=target_case for update;
  if not found then raise exception 'Not permitted' using errcode='42501'; end if;
  if portal_private.current_role() is distinct from 'admin' then
    raise exception 'Not permitted' using errcode='42501';
  end if;

  perform p.id from public.profiles p
    where p.id=any(expected_clients||expected_staff||desired_clients||desired_staff)
    order by p.id for share;
  if (select count(*) from public.profiles where id=any(expected_clients) and role='client')<>cardinality(expected_clients)
    or (select count(*) from public.profiles where id=any(expected_staff) and role='staff')<>cardinality(expected_staff)
    or (select count(*) from public.profiles where id=any(desired_clients) and role='client')<>cardinality(desired_clients)
    or (select count(*) from public.profiles where id=any(desired_staff) and role='staff')<>cardinality(desired_staff) then
    raise exception 'Invalid participants' using errcode='22023';
  end if;

  select coalesce(array_agg(client_id order by client_id),'{}'::uuid[]) into current_clients
    from public.case_clients where case_id=target_case;
  select coalesce(array_agg(staff_id order by staff_id),'{}'::uuid[]) into current_staff
    from public.case_staff where case_id=target_case;
  if current_clients is distinct from expected_clients or current_staff is distinct from expected_staff then
    raise exception 'Participant set changed' using errcode='40001';
  end if;

  clients_changed := current_clients is distinct from desired_clients;
  staff_changed := current_staff is distinct from desired_staff;
  if not clients_changed and not staff_changed then return false; end if;
  if clients_changed then
    delete from public.case_clients where case_id=target_case;
    insert into public.case_clients select target_case,x from unnest(desired_clients) x;
  end if;
  if staff_changed then
    delete from public.case_staff where case_id=target_case;
    insert into public.case_staff select target_case,x from unnest(desired_staff) x;
  end if;
  update public.cases set updated_at=clock_timestamp() where id=target_case;
  insert into portal_private.case_audit(case_id,actor_id,action,changed_fields) values(
    target_case,actor,'updated',
    (case when clients_changed then array['clients']::text[] else '{}'::text[] end)||
    (case when staff_changed then array['staff']::text[] else '{}'::text[] end));
  return true;
end;
$$;

revoke all on function public.get_case_participants(uuid),
  public.replace_case_participants(uuid,uuid[],uuid[],uuid[],uuid[]) from public,anon,authenticated;
grant execute on function public.get_case_participants(uuid),
  public.replace_case_participants(uuid,uuid[],uuid[],uuid[],uuid[]) to authenticated;

commit;
