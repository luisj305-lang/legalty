begin;

create or replace function public.update_case(target_case uuid, case_title text, case_description text,
  case_status text, case_next_action text) returns void
language plpgsql security definer set search_path='' as $$
declare
  actor uuid := auth.uid();
begin
  perform 1 from public.profiles where id=actor for share;
  if coalesce(portal_private.current_role() not in ('admin','staff'),true)
    or not portal_private.can_read_case(target_case) then
    raise exception 'Not permitted' using errcode='42501';
  end if;
  perform 1 from public.cases where id=target_case for update;
  if not found then raise exception 'Not permitted' using errcode='42501'; end if;
  if not portal_private.can_read_case(target_case) then
    raise exception 'Not permitted' using errcode='42501';
  end if;
  update public.cases set title=case_title,description=case_description,status=case_status,
    next_action=case_next_action,updated_at=clock_timestamp() where id=target_case;
  insert into portal_private.case_audit(case_id,actor_id,action,changed_fields)
    values(target_case,actor,'updated',array['title','description','status','next_action']);
end;
$$;

revoke all on function public.update_case(uuid,text,text,text,text) from public, anon, authenticated;
grant execute on function public.update_case(uuid,text,text,text,text) to authenticated;

commit;
