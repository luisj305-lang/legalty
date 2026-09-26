begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
insert into auth.users(id,email) select ('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  'synthetic'||n||'@example.invalid' from generate_series(1,5) n;
insert into public.profiles(id,role,active,must_change_password)
select id,case when email='synthetic1@example.invalid' then 'admin'
  when email in ('synthetic2@example.invalid','synthetic3@example.invalid') then 'staff' else 'client' end,true,false
from auth.users where email like 'synthetic%@example.invalid';

set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"aal":"aal2"}',true);
select lives_ok($$select public.create_case('WRITE-A','Synthetic','Visible',
  array['20000000-0000-4000-8000-000000000004'::uuid],
  array['20000000-0000-4000-8000-000000000002'::uuid])$$,'Admin creates atomic case');
select is((select count(*) from public.cases where reference='WRITE-A'),1::bigint,'Case created');
select is((select count(*) from public.case_clients),1::bigint,'Client linked');
select is((select count(*) from portal_private.case_audit),1::bigint,'Creation audited');
select is((select actor_id::text from portal_private.case_audit),'20000000-0000-4000-8000-000000000001','Audit actor resolved from JWT');
select is((select count(*) from public.find_case_participant('synthetic4@example.invalid','client')),1::bigint,'Exact client lookup');
select is((select count(*) from public.find_case_participant('synthetic4@example.invalid','staff')),0::bigint,'Lookup checks trusted role');
select is((select count(*) from public.find_case_participant('%@example.invalid','client')),0::bigint,'No wildcard lookup');
select throws_ok($$select public.create_case('BAD','Synthetic','',array[]::uuid[],array[]::uuid[])$$,
  '22023',null,'Empty client set denied');
select throws_ok($$select public.create_case('BAD','Synthetic','',
  array['20000000-0000-4000-8000-000000000004'::uuid,'20000000-0000-4000-8000-000000000004'::uuid],array[]::uuid[])$$,
  '22023',null,'Duplicate links denied');
select throws_ok($$select public.create_case('BAD','Synthetic','',
  array['20000000-0000-4000-8000-000000000002'::uuid],array[]::uuid[])$$,
  '22023',null,'Wrong client role denied');
select throws_ok($$select public.create_case('BAD','Synthetic','',
  array['20000000-0000-4000-8000-000000000004'::uuid],array['99999999-0000-4000-8000-000000000001'::uuid])$$,
  '22023',null,'Missing staff denied atomically');
select is((select count(*) from public.cases),1::bigint,'Failed create left no case');
select is((select count(*) from portal_private.case_audit),1::bigint,'Failed create left no audit');
select set_config('request.jwt.claims','{"aal":"aal1"}',true);
select is((select count(*) from public.find_case_participant('synthetic4@example.invalid','client')),1::bigint,'Admin AAL1 reaches administrator lookup scope');
select throws_ok($$select public.create_case('DENIED','Synthetic','',array[]::uuid[],array[]::uuid[])$$,'22023',null,'Admin AAL1 reaches participant validation');
select cmp_ok(strpos(pg_get_functiondef('public.update_case(uuid,text,text,text,text)'::regprocedure),'portal_private.current_role()'),'<',
  strpos(pg_get_functiondef('public.update_case(uuid,text,text,text,text)'::regprocedure),'for update'),
  'Update checks trusted role before target case row lock');
select cmp_ok(strpos(pg_get_functiondef('public.update_case(uuid,text,text,text,text)'::regprocedure),'portal_private.can_read_case(target_case)'),'<',
  strpos(pg_get_functiondef('public.update_case(uuid,text,text,text,text)'::regprocedure),'for update'),
  'Update checks assignment scope before target case row lock');
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
select lives_ok($$select public.update_case((select id from public.cases where reference='WRITE-A'),
  'Updated','Visible update','in_progress','Next step')$$,'Assigned staff AAL1 updates');
select is((select count(*) from portal_private.case_audit),2::bigint,'Update audited');
select throws_ok($$select public.update_case((select id from public.cases where reference='WRITE-A'),
  'Bad','Visible','invalid','')$$,'23514',null,'Invalid status fails');
select is((select title from public.cases where reference='WRITE-A'),'Updated','Failed update rolled back');
select is((select count(*) from portal_private.case_audit),2::bigint,'Failed update adds no audit');
select throws_ok($$insert into portal_private.case_audit(case_id,actor_id,action,changed_fields)
  values((select id from public.cases limit 1),auth.uid(),'created',array[]::text[])$$,'42501',null,'Direct audit insertion denied');
select throws_ok('update portal_private.case_audit set action=''tamper''','42501',null,'Audit update denied');
select throws_ok('delete from portal_private.case_audit','42501',null,'Audit delete denied');
select throws_ok($$select public.find_case_participant('synthetic4@example.invalid','client')$$,'42501',null,'Staff lookup denied');
reset role;
select set_config('test.case_id',(select id::text from public.cases where reference='WRITE-A'),true);
select throws_ok('update portal_private.case_audit set action=''created''','42501',null,'Owner update rejected by immutable trigger');
alter table portal_private.case_audit add constraint simulate_audit_failure check (action<>'updated') not valid;
set local role authenticated;
select throws_ok($$select public.update_case(current_setting('test.case_id')::uuid,'Must rollback','','open','')$$,
  '23514',null,'Audit failure aborts whole update');
select is((select title from public.cases),'Updated','Audit failure rolled case change back');
reset role;
alter table portal_private.case_audit drop constraint simulate_audit_failure;
set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000003',true);
select throws_ok($$select public.update_case(current_setting('test.case_id')::uuid,'Bad','','open','')$$,'42501',null,'Unassigned staff denied');
select is((select count(*) from portal_private.case_audit),0::bigint,'Unassigned audit hidden');
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000004',true);
select throws_ok($$select public.update_case(current_setting('test.case_id')::uuid,'Bad','','open','')$$,'42501',null,'Client update denied');
select throws_ok($$select public.create_case('DENIED','Synthetic','',array[]::uuid[],array[]::uuid[])$$,'42501',null,'Client create denied');
select is((select count(*) from portal_private.case_audit),0::bigint,'Client audit hidden');
select set_config('request.jwt.claim.sub','',true);
select throws_ok($$select public.create_case('DENIED','Synthetic','',array[]::uuid[],array[]::uuid[])$$,'42501',null,'Null identity denied');
reset role;
update public.profiles set active=false where role='admin';
set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
select throws_ok($$select public.create_case('DENIED','Synthetic','',array[]::uuid[],array[]::uuid[])$$,'42501',null,'Inactive admin denied');
reset role;
update public.profiles set active=true,must_change_password=true where role='admin';
set local role authenticated;
select throws_ok($$select public.create_case('DENIED','Synthetic','',array[]::uuid[],array[]::uuid[])$$,'42501',null,'Rotation admin denied');
reset role;
set local role anon;
select throws_ok($$select public.find_case_participant('synthetic4@example.invalid','client')$$,'42501',null,'Anonymous lookup denied');
reset role;
select * from finish();
rollback;
