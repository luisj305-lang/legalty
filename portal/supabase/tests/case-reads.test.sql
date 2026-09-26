begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();
select has_table('public', 'cases', 'Cases exist');

insert into auth.users(id) select ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid
from generate_series(1,6) n;
insert into public.profiles(id, role, active, must_change_password)
select ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  case when n=1 then 'admin' when n in (2,3) then 'staff' else 'client' end, true, false
from generate_series(1,6) n;
insert into public.cases(id, reference, title, created_by) values
  ('10000000-0000-4000-8000-000000000001', 'TEST-A', 'Synthetic case A', '00000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000002', 'TEST-B', 'Synthetic case B', '00000000-0000-4000-8000-000000000001');
insert into public.case_clients values
  ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000004'),
  ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000005'),
  ('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000006');
insert into public.case_staff values
  ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002'),
  ('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003');

select throws_ok($$update public.cases set status='invented'$$, '23514', null, 'Unknown status rejected');
select throws_ok($$update public.cases set title=' '$$, '23514', null, 'Blank title rejected');
select throws_ok($$update public.cases set reference=null$$, '23502', null, 'Reference required');
select throws_ok($$insert into public.case_clients values
  ('10000000-0000-4000-8000-000000000001','99999999-0000-4000-8000-000000000001')$$,
  '23503', null, 'Missing participant FK rejected');
select throws_ok($$insert into public.case_staff values
  ('99999999-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002')$$,
  '23503', null, 'Missing case FK rejected');
select ok(not has_table_privilege(r, t, p), r || ' lacks ' || p || ' on ' || t)
from unnest(array['anon','authenticated']) r
cross join unnest(array['cases','case_clients','case_staff']) t
cross join unnest(array['INSERT','UPDATE','DELETE']) p;
select ok(not has_function_privilege('anon', 'portal_private.can_read_case(uuid)', 'EXECUTE'), 'Anon cannot execute helper');
select ok(not exists(select 1 from pg_proc, lateral aclexplode(proacl) a
  where oid='portal_private.can_read_case(uuid)'::regprocedure and a.grantee=0), 'No PUBLIC helper execution');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"aal":"aal1"}',true);
select is((select count(*) from public.cases),2::bigint,'Admin AAL1 reaches administrator scope');
select set_config('request.jwt.claims','{"aal":"aal2"}',true);
select is((select count(*) from public.cases),2::bigint,'Admin AAL2 sees all');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
select results_eq('select reference from public.cases', $$values ('TEST-A'::text)$$,'Staff sees assigned case only');
select is((select count(*) from public.case_clients),2::bigint,'Assigned staff sees case participants');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
select results_eq('select reference from public.cases', $$values ('TEST-B'::text)$$,'Other staff sees only other assignment');
select set_config('request.jwt.claims','{"aal":"aal1"}',true);
select results_eq('select reference from public.cases', $$values ('TEST-B'::text)$$,'Staff AAL1 remains assignment-scoped');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',true);
select results_eq('select reference from public.cases', $$values ('TEST-A'::text)$$,'Client sees linked case only');
select is((select count(*) from public.case_clients),1::bigint,'Client sees only own membership');
select is((select count(*) from public.case_staff),0::bigint,'Client cannot list staff identities');
select set_config('request.jwt.claims','{"aal":"aal2","app_metadata":{"role":"admin"}}',true);
select is((select count(*) from public.cases),1::bigint,'Metadata cannot elevate scope');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000006',true);
select results_eq('select reference from public.cases', $$values ('TEST-B'::text)$$,'Other client sees only own case');
select set_config('request.jwt.claims','{}',true);
select is((select count(*) from public.cases),0::bigint,'Missing AAL denied');
select set_config('request.jwt.claims','{"aal":"unknown"}',true);
select is((select count(*) from public.cases),0::bigint,'Unknown AAL denied');
select set_config('request.jwt.claims','{"aal":"aal2"}',true);
select throws_ok('update public.cases set title=''Escalation''','42501',null,'Direct case update denied');
select throws_ok('delete from public.case_clients','42501',null,'Direct membership removal denied');
select set_config('request.jwt.claim.sub','',true);
select is((select count(*) from public.cases),0::bigint,'Missing subject denied');
select set_config('request.jwt.claim.sub','99999999-0000-4000-8000-000000000001',true);
select is((select count(*) from public.cases),0::bigint,'Missing trusted profile denied');
reset role;

-- Revocation applies to administrators and staff too, without refreshing JWT role metadata.
update public.profiles set active=false where role='admin';
update public.profiles set must_change_password=true where role='staff';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select is((select count(*) from public.cases),0::bigint,'Inactive admin denied at AAL2');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
select is((select count(*) from public.cases),0::bigint,'Staff rotation denies assigned case');
reset role;

update public.profiles set active=false where role='client';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',true);
select is((select count(*) from public.cases),0::bigint,'Fresh inactive state denies');
reset role;
update public.profiles set active=true, must_change_password=true where role='client';
set local role authenticated;
select is((select count(*) from public.cases),0::bigint,'Fresh rotation flag denies');
reset role;
set local role anon;
select throws_ok('select * from public.cases','42501',null,'Anonymous read denied');
reset role;
select * from finish();
rollback;
