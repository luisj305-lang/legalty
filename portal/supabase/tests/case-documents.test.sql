begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();

select has_table('public','case_documents','Case document metadata table exists');
select has_function('public','begin_case_documents',array['uuid','text[]','bigint[]'],
  'Pending document registration RPC exists');
select has_function('public','get_case_document',array['uuid'],
  'Administrator document read RPC exists');
select has_function('public','finalize_case_document',array['uuid','boolean'],
  'Document finalization RPC exists');
select is((select relrowsecurity from pg_class where oid='public.case_documents'::regclass),true,
  'Document metadata has row level security');
select ok(not has_table_privilege('authenticated','public.case_documents','SELECT'),
  'Authenticated has no direct document read');
select ok(not has_table_privilege('authenticated','public.case_documents','INSERT'),
  'Authenticated has no direct document write');
select has_table('portal_private','document_audit','Document audit table exists');
select is((select count(*) from pg_trigger where tgrelid='portal_private.document_audit'::regclass
  and tgname='document_audit_immutable'),1::bigint,'Document audit is append-only');
select is((select count(*) from pg_policies where schemaname='portal_private'
  and tablename='document_audit' and policyname='document_audit_read'),1::bigint,
  'Document audit has scoped read policy');

select is((select count(*) from storage.buckets where id='case-documents' and name='case-documents'
  and public=false and file_size_limit=10485760 and allowed_mime_types=array['application/pdf']),
  1::bigint,'Private PDF-only bucket exists');
select is((select count(*) from pg_policies where schemaname='storage' and tablename='objects'
  and policyname in ('case_documents_insert','case_documents_select','case_documents_delete')
  and roles='{authenticated}'),3::bigint,'Storage bucket has three authenticated policies');
select ok(exists(select 1 from pg_policies where schemaname='storage' and tablename='objects'
  and policyname='case_documents_insert' and with_check like '%case-documents%' and with_check like '%admin%'),
  'Storage insert is administrator-only for the private bucket');
select ok(exists(select 1 from pg_policies where schemaname='storage' and tablename='objects'
  and policyname='case_documents_select' and qual like '%case-documents%' and qual like '%admin%'),
  'Storage select is administrator-only for the private bucket');
select ok(exists(select 1 from pg_policies where schemaname='storage' and tablename='objects'
  and policyname='case_documents_delete' and qual like '%case-documents%' and qual like '%admin%'),
  'Storage delete is administrator-only for the private bucket');
select ok((select relrowsecurity from pg_class where oid='storage.objects'::regclass),
  'Storage objects enforce row level security');
select ok(not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects'
  and policyname like 'case_documents_%' and ('anon' = any(roles) or 'public' = any(roles))),
  'Anon has no storage object policy for the private bucket');

insert into auth.users(id,email) select ('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  'synthetic'||n||'@example.invalid' from generate_series(1,3) n;
insert into public.profiles(id,role,active,must_change_password)
select id,case when email='synthetic1@example.invalid' then 'admin'
  when email='synthetic2@example.invalid' then 'client' else 'staff' end,true,false
from auth.users where email like 'synthetic%@example.invalid';

set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"aal":"aal2"}',true);
select lives_ok($$select public.create_case('DOC-A','Synthetic','Visible',
  array['20000000-0000-4000-8000-000000000002'::uuid],
  array['20000000-0000-4000-8000-000000000003'::uuid])$$,'Admin creates a case for documents');
select set_config('test.case_id',(select id::text from public.cases where reference='DOC-A'),true);
select lives_ok($$select * from public.begin_case_documents(
  current_setting('test.case_id')::uuid,array['contract.pdf'],array[1024]::bigint[])$$,
  'Admin registers one pending document');
reset role;

select is((select count(*) from public.case_documents),1::bigint,'One pending document row');
select is((select status from public.case_documents),'pending','Document starts pending');
select is((select visibility from public.case_documents),'internal','Document is internal by default');
select ok((select object_key ~ ('^'||current_setting('test.case_id')||'/[0-9a-f-]{36}\.pdf$')
  from public.case_documents),'Object key is derived server-side');
select is((select count(*) from portal_private.document_audit where action='pending'),1::bigint,
  'Pending document is audited once');
select set_config('test.document_id',(select id::text from public.case_documents),true);

set local role authenticated;
select ok((select object_key ~ ('^'||current_setting('test.case_id')||'/[0-9a-f-]{36}\.pdf$')
  from public.get_case_document(current_setting('test.document_id')::uuid)),
  'Admin reads the server-derived key via RPC');
select lives_ok($$select public.finalize_case_document(current_setting('test.document_id')::uuid,true)$$,
  'Admin finalizes the document as stored');
reset role;
select is((select status from public.case_documents where id=current_setting('test.document_id')::uuid),
  'stored','Verified document is marked stored');
select is((select count(*) from portal_private.document_audit where action='stored'),1::bigint,
  'Stored document is audited once');

set local role authenticated;
select lives_ok($$select * from public.begin_case_documents(
  current_setting('test.case_id')::uuid,array['broken.pdf'],array[10]::bigint[])$$,
  'Admin registers a second pending document');
reset role;
select set_config('test.document_id2',
  (select id::text from public.case_documents where file_name='broken.pdf'),true);
set local role authenticated;
select lives_ok($$select public.finalize_case_document(current_setting('test.document_id2')::uuid,false)$$,
  'Admin finalizes the document as failed');
reset role;
select is((select status from public.case_documents where id=current_setting('test.document_id2')::uuid),
  'failed','Invalid document is marked failed');
select is((select count(*) from portal_private.document_audit where action='failed'),1::bigint,
  'Failed document is audited once');

set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
select throws_ok($$select * from public.begin_case_documents(current_setting('test.case_id')::uuid,
  array['a.pdf','b.pdf','c.pdf','d.pdf','e.pdf','f.pdf'],array[1,1,1,1,1,1]::bigint[])$$,
  '22023',null,'More than five documents denied');
select throws_ok($$select * from public.begin_case_documents(current_setting('test.case_id')::uuid,
  array['a.pdf'],array[10485761]::bigint[])$$,'22023',null,'Over 10 MB denied');
select throws_ok($$select * from public.begin_case_documents(current_setting('test.case_id')::uuid,
  array['a.pdf','b.pdf','c.pdf'],array[10485760,10485760,10485760]::bigint[])$$,
  '22023',null,'Over 25 MB aggregate denied');
select throws_ok($$select * from public.begin_case_documents(current_setting('test.case_id')::uuid,
  array['   '],array[10]::bigint[])$$,'22023',null,'Empty name denied');
select throws_ok($$select * from public.begin_case_documents(current_setting('test.case_id')::uuid,
  array['a.pdf','b.pdf'],array[10]::bigint[])$$,'22023',null,'Mismatched array lengths denied');
select throws_ok($$select * from public.begin_case_documents(current_setting('test.case_id')::uuid,
  null,null)$$,'22023',null,'Null arrays denied');
select throws_ok($$select * from public.begin_case_documents(current_setting('test.case_id')::uuid,
  array['a.pdf',null],array[10,10]::bigint[])$$,'22023',null,'Null name element denied');
select throws_ok($$select * from public.begin_case_documents(
  '99999999-0000-4000-8000-000000000001',array['a.pdf'],array[10]::bigint[])$$,
  '42501',null,'Unknown case denied');

select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
select throws_ok($$select * from public.begin_case_documents(current_setting('test.case_id')::uuid,
  array['a.pdf'],array[10]::bigint[])$$,'42501',null,'Client cannot begin documents');
select throws_ok($$select public.finalize_case_document(current_setting('test.document_id')::uuid,true)$$,
  '42501',null,'Client cannot finalize documents');
select throws_ok($$select * from public.get_case_document(current_setting('test.document_id')::uuid)$$,
  '42501',null,'Client cannot read a document');

select throws_ok($$insert into public.case_documents(case_id,file_name,object_key,byte_size,created_by)
  values(current_setting('test.case_id')::uuid,'x.pdf','x/y.pdf',10,
    '20000000-0000-4000-8000-000000000001'::uuid)$$,'42501',null,'Direct document insert denied');
select throws_ok('update public.case_documents set file_name=''tamper''','42501',null,
  'Direct document update denied');
select throws_ok('delete from public.case_documents','42501',null,'Direct document delete denied');
select throws_ok($$insert into portal_private.document_audit(case_id,document_id,actor_id,action)
  values(current_setting('test.case_id')::uuid,current_setting('test.document_id')::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,'pending')$$,'42501',null,
  'Direct audit insertion denied');
reset role;
select throws_ok('update portal_private.document_audit set action=''stored''','42501',null,
  'Owner update rejected by immutable trigger');
select throws_ok('delete from portal_private.document_audit','42501',null,
  'Owner delete rejected by immutable trigger');

set local role anon;
select throws_ok($$select * from public.begin_case_documents(
  '99999999-0000-4000-8000-000000000001',array['a.pdf'],array[10]::bigint[])$$,
  '42501',null,'Anonymous cannot begin documents');
select throws_ok($$select public.finalize_case_document(
  '99999999-0000-4000-8000-000000000001',true)$$,'42501',null,'Anonymous cannot finalize documents');
reset role;

select ok(has_function_privilege('authenticated','public.begin_case_documents(uuid,text[],bigint[])','EXECUTE')
  and has_function_privilege('authenticated','public.get_case_document(uuid)','EXECUTE')
  and has_function_privilege('authenticated','public.finalize_case_document(uuid,boolean)','EXECUTE'),
  'Authenticated receives document RPC execution');
select ok(not has_function_privilege('anon','public.begin_case_documents(uuid,text[],bigint[])','EXECUTE')
  and not has_function_privilege('anon','public.get_case_document(uuid)','EXECUTE')
  and not has_function_privilege('anon','public.finalize_case_document(uuid,boolean)','EXECUTE'),
  'Anonymous has no document RPC execution');
select * from finish();
rollback;
