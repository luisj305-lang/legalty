begin;

-- Private document metadata for cases. Bytes never live in Postgres and are
-- never granted to API roles: all access goes through definer RPCs.
create table public.case_documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  file_name text not null,
  object_key text not null,
  byte_size bigint not null check (byte_size between 1 and 10485760),
  status text not null default 'pending' check (status in ('pending','stored','failed')),
  visibility text not null default 'internal' check (visibility in ('internal','client_visible')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (case_id, object_key)
);
create index case_documents_by_case on public.case_documents(case_id);
comment on column public.case_documents.visibility is 'Internal by default; only an administrator may make a stored document client-visible.';

alter table public.case_documents enable row level security;
revoke all on public.case_documents from public, anon, authenticated;

create table portal_private.document_audit (
  id bigint generated always as identity primary key,
  case_id uuid not null references public.cases(id),
  document_id uuid not null,
  actor_id uuid not null references public.profiles(id),
  action text not null check (action in ('pending','stored','failed')),
  occurred_at timestamptz not null default clock_timestamp()
);
alter table portal_private.document_audit enable row level security;
revoke all on portal_private.document_audit from public, anon, authenticated, service_role;
grant select on portal_private.document_audit to authenticated;
create policy document_audit_read on portal_private.document_audit for select to authenticated
  using (portal_private.current_role() in ('admin','staff') and portal_private.can_read_case(case_id));
create trigger document_audit_immutable before update or delete on portal_private.document_audit
  for each row execute function portal_private.reject_audit_change();

-- Fixed private bucket: PDF only, 10 MB per object.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values ('case-documents','case-documents',false,10485760,array['application/pdf'])
  on conflict (id) do nothing;

-- Defense in depth: even the Storage API stays administrator-only for this bucket.
create policy case_documents_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'case-documents' and portal_private.current_role() = 'admin');
create policy case_documents_select on storage.objects for select to authenticated
  using (bucket_id = 'case-documents' and portal_private.current_role() = 'admin');
create policy case_documents_delete on storage.objects for delete to authenticated
  using (bucket_id = 'case-documents' and portal_private.current_role() = 'admin');

-- Registers pending metadata only. Object keys are always derived server-side.
create function public.begin_case_documents(target_case uuid, document_names text[], document_sizes bigint[])
returns table(document_id uuid, object_key text)
language plpgsql security definer set search_path='' as $$
declare
  actor uuid := auth.uid();
  item integer;
  total bigint := 0;
  new_id uuid;
  new_key text;
begin
  perform 1 from public.profiles where id=actor for share;
  if portal_private.current_role() is distinct from 'admin' then
    raise exception 'Not permitted' using errcode='42501';
  end if;
  if target_case is null or document_names is null or document_sizes is null
    or cardinality(document_names) not between 1 and 5
    or cardinality(document_names) <> cardinality(document_sizes)
    or array_position(document_names, null) is not null
    or array_position(document_sizes, null) is not null then
    raise exception 'Invalid documents' using errcode='22023';
  end if;
  for item in 1..cardinality(document_names) loop
    if length(btrim(document_names[item])) not between 1 and 255
      or document_sizes[item] not between 1 and 10485760 then
      raise exception 'Invalid documents' using errcode='22023';
    end if;
    total := total + document_sizes[item];
  end loop;
  if total > 26214400 then
    raise exception 'Invalid documents' using errcode='22023';
  end if;
  perform 1 from public.cases where id=target_case for update;
  if not found then raise exception 'Not permitted' using errcode='42501'; end if;
  for item in 1..cardinality(document_names) loop
    new_id := gen_random_uuid();
    new_key := target_case::text || '/' || gen_random_uuid()::text || '.pdf';
    insert into public.case_documents(id,case_id,file_name,object_key,byte_size,status,visibility,created_by)
      values(new_id,target_case,btrim(document_names[item]),new_key,document_sizes[item],'pending','internal',actor);
    insert into portal_private.document_audit(case_id,document_id,actor_id,action)
      values(target_case,new_id,actor,'pending');
    document_id := new_id;
    object_key := new_key;
    return next;
  end loop;
end;
$$;

-- Administrator-only read of the server-derived object key used for finalization.
create function public.get_case_document(target_document uuid)
returns table(id uuid, case_id uuid, object_key text, file_name text, byte_size bigint, status text)
language plpgsql stable security definer set search_path='' as $$
begin
  if portal_private.current_role() is distinct from 'admin' then
    raise exception 'Not permitted' using errcode='42501';
  end if;
  if target_document is null then
    raise exception 'Invalid document' using errcode='22023';
  end if;
  return query select d.id,d.case_id,d.object_key,d.file_name,d.byte_size,d.status
    from public.case_documents d where d.id=target_document;
end;
$$;

-- Records the verified storage outcome. Cleanup happens before this call.
create function public.finalize_case_document(document_id uuid, stored boolean)
returns void
language plpgsql security definer set search_path='' as $$
declare
  actor uuid := auth.uid();
  owner_case uuid;
begin
  perform 1 from public.profiles where id=actor for share;
  if portal_private.current_role() is distinct from 'admin' then
    raise exception 'Not permitted' using errcode='42501';
  end if;
  if document_id is null or stored is null then
    raise exception 'Invalid document' using errcode='22023';
  end if;
  select d.case_id into owner_case from public.case_documents d where d.id=document_id for update;
  if not found then raise exception 'Not permitted' using errcode='42501'; end if;
  update public.case_documents
    set status=case when stored then 'stored' else 'failed' end, updated_at=clock_timestamp()
    where id=document_id;
  insert into portal_private.document_audit(case_id,document_id,actor_id,action)
    values(owner_case,document_id,actor,case when stored then 'stored' else 'failed' end);
end;
$$;

revoke all on function public.begin_case_documents(uuid,text[],bigint[]),
  public.get_case_document(uuid), public.finalize_case_document(uuid,boolean)
  from public, anon, authenticated;
grant execute on function public.begin_case_documents(uuid,text[],bigint[]),
  public.get_case_document(uuid), public.finalize_case_document(uuid,boolean) to authenticated;

commit;
