begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
select has_function('public','get_case_participants',array['uuid'],
  'Case-scoped participant read RPC exists');
select has_function('public','replace_case_participants',array['uuid','uuid[]','uuid[]','uuid[]','uuid[]'],
  'Atomic participant replacement RPC exists');
insert into auth.users(id,email) select ('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  'synthetic'||n||'@example.invalid' from generate_series(1,6) n;
insert into public.profiles(id,role,active,must_change_password)
select id,case when email='synthetic1@example.invalid' then 'admin'
  when email in ('synthetic2@example.invalid','synthetic3@example.invalid','synthetic6@example.invalid') then 'staff' else 'client' end,true,false
from auth.users where email like 'synthetic%@example.invalid';

set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"aal":"aal2"}',true);
select lives_ok($$select public.create_case('WRITE-A','Synthetic','Visible',
  array['20000000-0000-4000-8000-000000000004'::uuid],
  array['20000000-0000-4000-8000-000000000002'::uuid])$$,'Admin creates atomic case');
select set_config('test.case_id',(select id::text from public.cases where reference='WRITE-A'),true);
select is((select count(*) from public.cases where reference='WRITE-A'),1::bigint,'Case created');
select is((select count(*) from public.case_clients),1::bigint,'Client linked');
select is((select count(*) from portal_private.case_audit),1::bigint,'Creation audited');
select is((select actor_id::text from portal_private.case_audit),'20000000-0000-4000-8000-000000000001','Audit actor resolved from JWT');
select results_eq($$select id::text,email,role from public.get_case_participants(
  (select id from public.cases where reference='WRITE-A')) order by role,id$$,
  $$values ('20000000-0000-4000-8000-000000000004','synthetic4@example.invalid','client'),
    ('20000000-0000-4000-8000-000000000002','synthetic2@example.invalid','staff')$$,
  'Admin reads only the requested case current participants');
select is((select count(*) from public.get_case_participants(
  '99999999-0000-4000-8000-000000000001')),0::bigint,'Unknown case yields no participant rows');
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
select throws_ok($$select public.replace_case_participants((select id from public.cases where reference='WRITE-A'),
  array['20000000-0000-4000-8000-000000000004'::uuid],array['20000000-0000-4000-8000-000000000002'::uuid],
  null,array[]::uuid[])$$,'22023',null,'Null participant array denied');
select throws_ok($$select public.replace_case_participants((select id from public.cases where reference='WRITE-A'),
  array['20000000-0000-4000-8000-000000000004'::uuid],array['20000000-0000-4000-8000-000000000002'::uuid],
  array['20000000-0000-4000-8000-000000000004'::uuid,null],array[]::uuid[])$$,'22023',null,'Null participant ID denied');
select throws_ok($$select public.replace_case_participants((select id from public.cases where reference='WRITE-A'),
  array['20000000-0000-4000-8000-000000000004'::uuid],array['20000000-0000-4000-8000-000000000002'::uuid],
  array['20000000-0000-4000-8000-000000000004'::uuid,'20000000-0000-4000-8000-000000000004'::uuid],array[]::uuid[])$$,
  '22023',null,'Duplicate participant IDs denied');
select throws_ok($$select public.replace_case_participants((select id from public.cases where reference='WRITE-A'),
  array['20000000-0000-4000-8000-000000000004'::uuid],array['20000000-0000-4000-8000-000000000002'::uuid],
  array['20000000-0000-4000-8000-000000000004'::uuid],array['20000000-0000-4000-8000-000000000004'::uuid])$$,
  '22023',null,'Cross-role participant reuse denied');
select throws_ok($$select public.replace_case_participants((select id from public.cases where reference='WRITE-A'),
  array['20000000-0000-4000-8000-000000000004'::uuid],array['20000000-0000-4000-8000-000000000002'::uuid],
  array['20000000-0000-4000-8000-000000000002'::uuid],array[]::uuid[])$$,
  '22023',null,'Wrong participant role denied');
select throws_ok($$select public.replace_case_participants((select id from public.cases where reference='WRITE-A'),
  array['20000000-0000-4000-8000-000000000004'::uuid],array['20000000-0000-4000-8000-000000000002'::uuid],
  array['99999999-0000-4000-8000-000000000001'::uuid],array[]::uuid[])$$,
  '22023',null,'Missing participant profile denied');
select throws_ok($$select public.replace_case_participants((select id from public.cases where reference='WRITE-A'),
  array['20000000-0000-4000-8000-000000000004'::uuid],array['20000000-0000-4000-8000-000000000002'::uuid],
  array[]::uuid[],array[]::uuid[])$$,'22023',null,'Empty replacement client set denied');
select throws_ok($$select public.replace_case_participants((select id from public.cases where reference='WRITE-A'),
  array['20000000-0000-4000-8000-000000000004'::uuid],array['20000000-0000-4000-8000-000000000002'::uuid],
  array(select ('30000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid from generate_series(1,101)n),array[]::uuid[])$$,
  '22023',null,'More than 100 replacement clients denied');
select throws_ok($$select public.replace_case_participants((select id from public.cases where reference='WRITE-A'),
  array['20000000-0000-4000-8000-000000000004'::uuid],array['20000000-0000-4000-8000-000000000002'::uuid],
  array['20000000-0000-4000-8000-000000000004'::uuid],
  array(select ('30000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid from generate_series(1,101)n))$$,
  '22023',null,'More than 100 replacement staff denied');
select is((select count(*) from public.cases),1::bigint,'Failed create left no case');
select is((select count(*) from portal_private.case_audit),1::bigint,'Failed create left no audit');
select set_config('test.case_updated',(select updated_at::text from public.cases where reference='WRITE-A'),true);
select set_config('test.audit_count',(select count(*)::text from portal_private.case_audit),true);
select is(public.replace_case_participants((select id from public.cases where reference='WRITE-A'),
  array['20000000-0000-4000-8000-000000000004'::uuid],array['20000000-0000-4000-8000-000000000002'::uuid],
  array['20000000-0000-4000-8000-000000000004'::uuid],array['20000000-0000-4000-8000-000000000002'::uuid]),false,
  'Unchanged participant sets are a no-op');
select is((select updated_at::text from public.cases where reference='WRITE-A'),current_setting('test.case_updated'),
  'No-op preserves case timestamp');
select is((select count(*)::text from portal_private.case_audit),current_setting('test.audit_count'),
  'No-op writes no audit row');
reset role;
update public.profiles set active=false where id='20000000-0000-4000-8000-000000000005';
set local role authenticated;
select is(public.replace_case_participants((select id from public.cases where reference='WRITE-A'),
  array['20000000-0000-4000-8000-000000000004'::uuid],array['20000000-0000-4000-8000-000000000002'::uuid],
  array['20000000-0000-4000-8000-000000000005'::uuid,'20000000-0000-4000-8000-000000000004'::uuid],
  array['20000000-0000-4000-8000-000000000003'::uuid,'20000000-0000-4000-8000-000000000002'::uuid]),true,
  'Admin atomically replaces both participant sets, including an inactive participant');
select results_eq($$select id::text,email,role from public.get_case_participants(
  (select id from public.cases where reference='WRITE-A')) order by role,id$$,
  $$values ('20000000-0000-4000-8000-000000000004','synthetic4@example.invalid','client'),
    ('20000000-0000-4000-8000-000000000005','synthetic5@example.invalid','client'),
    ('20000000-0000-4000-8000-000000000002','synthetic2@example.invalid','staff'),
    ('20000000-0000-4000-8000-000000000003','synthetic3@example.invalid','staff')$$,
  'Participant read reflects only current links');
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000005',true);
select is((select count(*) from public.cases),0::bigint,'Inactive linked participant remains unable to read case');
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
select is((select changed_fields from portal_private.case_audit order by id desc limit 1),array['clients','staff']::text[],
  'Replacement audit names only changed participant sides in order');
select is((select count(*)::int from portal_private.case_audit),current_setting('test.audit_count')::int+1,
  'Replacement writes exactly one audit row');
select is(public.replace_case_participants((select id from public.cases where reference='WRITE-A'),
  array['20000000-0000-4000-8000-000000000005'::uuid,'20000000-0000-4000-8000-000000000004'::uuid],
  array['20000000-0000-4000-8000-000000000003'::uuid,'20000000-0000-4000-8000-000000000002'::uuid],
  array['20000000-0000-4000-8000-000000000004'::uuid,'20000000-0000-4000-8000-000000000005'::uuid],
  array['20000000-0000-4000-8000-000000000002'::uuid,'20000000-0000-4000-8000-000000000003'::uuid]),false,
  'Expected and desired participant sets compare canonically');
select throws_ok($$select public.replace_case_participants((select id from public.cases where reference='WRITE-A'),
  array['20000000-0000-4000-8000-000000000004'::uuid],array['20000000-0000-4000-8000-000000000002'::uuid],
  array['20000000-0000-4000-8000-000000000004'::uuid],array['20000000-0000-4000-8000-000000000002'::uuid])$$,
  '40001',null,'Stale expected sets cannot overwrite current participants');
select results_eq($$select id::text from public.get_case_participants(
  (select id from public.cases where reference='WRITE-A')) order by id$$,
  $$values ('20000000-0000-4000-8000-000000000002'),('20000000-0000-4000-8000-000000000003'),
    ('20000000-0000-4000-8000-000000000004'),('20000000-0000-4000-8000-000000000005')$$,
  'Stale replacement leaves current links unchanged');
select cmp_ok(strpos(pg_get_functiondef('public.replace_case_participants(uuid,uuid[],uuid[],uuid[],uuid[])'::regprocedure),
  'portal_private.current_role()'),'<',strpos(pg_get_functiondef(
  'public.replace_case_participants(uuid,uuid[],uuid[],uuid[],uuid[])'::regprocedure),'for update'),
  'Replacement authorizes administrator before target case lock');
select ok(strpos(substring(pg_get_functiondef('public.replace_case_participants(uuid,uuid[],uuid[],uuid[],uuid[])'::regprocedure)
  from strpos(pg_get_functiondef('public.replace_case_participants(uuid,uuid[],uuid[],uuid[],uuid[])'::regprocedure),'for update')+1),
  'portal_private.current_role()')>0,'Replacement revalidates administrator after target case lock');
select set_config('request.jwt.claims','{"aal":"aal1"}',true);
select is((select count(*) from public.find_case_participant('synthetic4@example.invalid','client')),1::bigint,'Admin AAL1 reaches administrator lookup scope');
select throws_ok($$select public.create_case('DENIED','Synthetic','',array[]::uuid[],array[]::uuid[])$$,'22023',null,'Admin AAL1 reaches participant validation');
select cmp_ok(strpos(pg_get_functiondef('public.update_case(uuid,text,text,text,text)'::regprocedure),'portal_private.current_role()'),'<',
  strpos(pg_get_functiondef('public.update_case(uuid,text,text,text,text)'::regprocedure),'for update'),
  'Update checks trusted role before target case row lock');
select cmp_ok(strpos(pg_get_functiondef('public.update_case(uuid,text,text,text,text)'::regprocedure),'portal_private.can_read_case(target_case)'),'<',
  strpos(pg_get_functiondef('public.update_case(uuid,text,text,text,text)'::regprocedure),'for update'),
  'Update checks assignment scope before target case row lock');
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000003',true);
select lives_ok($$select public.update_case((select id from public.cases where reference='WRITE-A'),
  'Updated','Visible update','in_progress','Next step')$$,'Assigned staff AAL1 updates');
select is((select count(*) from portal_private.case_audit),3::bigint,'Update audited');
select throws_ok($$select public.update_case((select id from public.cases where reference='WRITE-A'),
  'Bad','Visible','invalid','')$$,'23514',null,'Invalid status fails');
select is((select title from public.cases where reference='WRITE-A'),'Updated','Failed update rolled back');
select is((select count(*) from portal_private.case_audit),3::bigint,'Failed update adds no audit');
select throws_ok($$insert into portal_private.case_audit(case_id,actor_id,action,changed_fields)
  values((select id from public.cases limit 1),auth.uid(),'created',array[]::text[])$$,'42501',null,'Direct audit insertion denied');
select throws_ok('update portal_private.case_audit set action=''tamper''','42501',null,'Audit update denied');
select throws_ok('delete from portal_private.case_audit','42501',null,'Audit delete denied');
select throws_ok($$select public.find_case_participant('synthetic4@example.invalid','client')$$,'42501',null,'Staff lookup denied');
select throws_ok($$select public.get_case_participants(current_setting('test.case_id')::uuid)$$,'42501',null,'Staff participant read denied');
select throws_ok($$select public.replace_case_participants(current_setting('test.case_id')::uuid,
  array['20000000-0000-4000-8000-000000000005'::uuid],array['20000000-0000-4000-8000-000000000003'::uuid],
  array['20000000-0000-4000-8000-000000000004'::uuid],array[]::uuid[])$$,'42501',null,'Staff replacement denied');
reset role;
select throws_ok('update portal_private.case_audit set action=''created''','42501',null,'Owner update rejected by immutable trigger');
alter table portal_private.case_audit add constraint simulate_audit_failure check (action<>'updated') not valid;
set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
select throws_ok($$select public.replace_case_participants(current_setting('test.case_id')::uuid,
  array['20000000-0000-4000-8000-000000000004'::uuid,'20000000-0000-4000-8000-000000000005'::uuid],
  array['20000000-0000-4000-8000-000000000002'::uuid,'20000000-0000-4000-8000-000000000003'::uuid],
  array['20000000-0000-4000-8000-000000000004'::uuid],array['20000000-0000-4000-8000-000000000002'::uuid])$$,
  '23514',null,'Audit failure aborts whole participant replacement');
select results_eq($$select id::text from public.get_case_participants(current_setting('test.case_id')::uuid) order by id$$,
  $$values ('20000000-0000-4000-8000-000000000002'),('20000000-0000-4000-8000-000000000003'),
    ('20000000-0000-4000-8000-000000000004'),('20000000-0000-4000-8000-000000000005')$$,
  'Audit failure rolls both participant sets back');
select throws_ok($$select public.update_case(current_setting('test.case_id')::uuid,'Must rollback','','open','')$$,
  '23514',null,'Audit failure aborts whole update');
select is((select title from public.cases),'Updated','Audit failure rolled case change back');
reset role;
alter table portal_private.case_audit drop constraint simulate_audit_failure;
set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000006',true);
select throws_ok($$select public.update_case(current_setting('test.case_id')::uuid,'Bad','','open','')$$,'42501',null,'Unassigned staff denied');
select is((select count(*) from portal_private.case_audit),0::bigint,'Unassigned audit hidden');
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000004',true);
select throws_ok($$select public.update_case(current_setting('test.case_id')::uuid,'Bad','','open','')$$,'42501',null,'Client update denied');
select throws_ok($$select public.create_case('DENIED','Synthetic','',array[]::uuid[],array[]::uuid[])$$,'42501',null,'Client create denied');
select throws_ok($$select public.get_case_participants(current_setting('test.case_id')::uuid)$$,'42501',null,'Client participant read denied');
select throws_ok($$select public.replace_case_participants(current_setting('test.case_id')::uuid,
  array['20000000-0000-4000-8000-000000000005'::uuid],array['20000000-0000-4000-8000-000000000003'::uuid],
  array['20000000-0000-4000-8000-000000000004'::uuid],array[]::uuid[])$$,'42501',null,'Client replacement denied');
select is((select count(*) from portal_private.case_audit),0::bigint,'Client audit hidden');
select set_config('request.jwt.claim.sub','',true);
select throws_ok($$select public.create_case('DENIED','Synthetic','',array[]::uuid[],array[]::uuid[])$$,'42501',null,'Null identity denied');
reset role;
update public.profiles set active=false where role='admin';
set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
select throws_ok($$select public.create_case('DENIED','Synthetic','',array[]::uuid[],array[]::uuid[])$$,'42501',null,'Inactive admin denied');
select throws_ok($$select public.get_case_participants(current_setting('test.case_id')::uuid)$$,'42501',null,'Inactive admin participant read denied');
select throws_ok($$select public.replace_case_participants(current_setting('test.case_id')::uuid,
  array['20000000-0000-4000-8000-000000000005'::uuid],array['20000000-0000-4000-8000-000000000003'::uuid],
  array['20000000-0000-4000-8000-000000000004'::uuid],array[]::uuid[])$$,'42501',null,'Inactive admin replacement denied');
reset role;
update public.profiles set active=true,must_change_password=true where role='admin';
set local role authenticated;
select throws_ok($$select public.create_case('DENIED','Synthetic','',array[]::uuid[],array[]::uuid[])$$,'42501',null,'Rotation admin denied');
select throws_ok($$select public.get_case_participants(current_setting('test.case_id')::uuid)$$,'42501',null,'Rotation-pending admin read denied');
select throws_ok($$select public.replace_case_participants(current_setting('test.case_id')::uuid,
  array['20000000-0000-4000-8000-000000000005'::uuid],array['20000000-0000-4000-8000-000000000003'::uuid],
  array['20000000-0000-4000-8000-000000000004'::uuid],array[]::uuid[])$$,'42501',null,'Rotation-pending admin replacement denied');
reset role;
set local role anon;
select throws_ok($$select public.find_case_participant('synthetic4@example.invalid','client')$$,'42501',null,'Anonymous lookup denied');
select throws_ok($$select public.get_case_participants(current_setting('test.case_id')::uuid)$$,'42501',null,'Anonymous participant read denied');
select throws_ok($$select public.replace_case_participants(current_setting('test.case_id')::uuid,
  array['20000000-0000-4000-8000-000000000005'::uuid],array['20000000-0000-4000-8000-000000000003'::uuid],
  array['20000000-0000-4000-8000-000000000004'::uuid],array[]::uuid[])$$,'42501',null,'Anonymous replacement denied');
reset role;
select ok(has_function_privilege('authenticated','public.get_case_participants(uuid)','EXECUTE') and
  has_function_privilege('authenticated','public.replace_case_participants(uuid,uuid[],uuid[],uuid[],uuid[])','EXECUTE'),
  'Only authenticated receives participant RPC execution');
select ok(not has_function_privilege('anon','public.get_case_participants(uuid)','EXECUTE') and
  not has_function_privilege('anon','public.replace_case_participants(uuid,uuid[],uuid[],uuid[],uuid[])','EXECUTE'),
  'Anon has no participant RPC execution');
select ok(not exists(select 1 from pg_proc,lateral aclexplode(proacl) a where oid in (
  'public.get_case_participants(uuid)'::regprocedure,
  'public.replace_case_participants(uuid,uuid[],uuid[],uuid[],uuid[])'::regprocedure) and a.grantee=0),
  'Participant RPCs have no PUBLIC execution');
select * from finish();
rollback;
