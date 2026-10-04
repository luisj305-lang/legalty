begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();

select has_function('public','list_case_candidates',array['text'],
  'Candidate directory RPC exists');
select ok(has_function_privilege('authenticated','public.list_case_candidates(text)','EXECUTE'),
  'Authenticated receives candidate directory execution');
select ok(not has_function_privilege('anon','public.list_case_candidates(text)','EXECUTE'),
  'Anonymous has no candidate directory execution');

-- Auth metadata names deliberately differ from the stored profile names so the
-- directory assertions prove the RPC composes public.profiles.first_name /
-- last_name, not metadata.
insert into auth.users(id,email,raw_user_meta_data) values
  ('20000000-0000-4000-8000-000000000001','directory-admin@example.invalid','{}'::jsonb),
  ('20000000-0000-4000-8000-000000000002','directory-client-named@example.invalid',
    '{"full_name":"Metadata Client"}'::jsonb),
  ('20000000-0000-4000-8000-000000000003','directory-client-noname@example.invalid',
    '{"full_name":"Metadata Only"}'::jsonb),
  ('20000000-0000-4000-8000-000000000004','directory-staff@example.invalid',
    '{"name":"Metadata Staff"}'::jsonb),
  ('20000000-0000-4000-8000-000000000005','directory-client-lastonly@example.invalid',
    '{"full_name":"Metadata Last"}'::jsonb);
insert into public.profiles(id,role,active,must_change_password,first_name,last_name) values
  ('20000000-0000-4000-8000-000000000001','admin',true,false,'Directory','Admin'),
  ('20000000-0000-4000-8000-000000000002','client',true,false,'Ana','Cliente'),
  ('20000000-0000-4000-8000-000000000003','client',false,false,null,null),
  ('20000000-0000-4000-8000-000000000004','staff',true,false,'Sofia','Staff'),
  ('20000000-0000-4000-8000-000000000005','client',true,false,null,'Soloapellido');

set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"aal":"aal2"}',true);

select is((select count(*) from public.list_case_candidates('client')),3::bigint,
  'Admin lists exactly the client candidates');
select is((select count(*) from public.list_case_candidates('staff')),1::bigint,
  'Admin lists exactly the staff candidates');
select is((select count(*) from public.list_case_candidates('client')
  where email='directory-staff@example.invalid'),0::bigint,
  'Client directory never returns staff profiles');
select set_config('test.client_named',
  (select id::text from public.list_case_candidates('client')
    where email='directory-client-named@example.invalid'),true);
select is((select name from public.list_case_candidates('client')
    where id=current_setting('test.client_named')::uuid),'Ana Cliente',
  'Composed first and last name is returned instead of auth metadata');
select is((select name from public.list_case_candidates('client')
    where email='directory-client-noname@example.invalid'),null::text,
  'Profile with null first and last name returns null despite auth metadata');
select is((select name from public.list_case_candidates('client')
    where email='directory-client-lastonly@example.invalid'),'Soloapellido',
  'Name composes from last_name alone when first_name is null');
select is((select active from public.list_case_candidates('client')
    where email='directory-client-noname@example.invalid'),false,
  'Inactive profile is reflected');
select is((select active from public.list_case_candidates('client')
    where id=current_setting('test.client_named')::uuid),true,
  'Active profile is reflected');

select throws_ok($$select * from public.list_case_candidates('admin')$$,'22023',null,
  'Administrator role is not a candidate role');
select throws_ok($$select * from public.list_case_candidates('nonsense')$$,'22023',null,
  'Unknown role is denied');
select throws_ok($$select * from public.list_case_candidates(null)$$,'22023',null,
  'Null role is denied');

select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
select throws_ok($$select * from public.list_case_candidates('client')$$,'42501',null,
  'Client cannot list candidates');

select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000004',true);
select throws_ok($$select * from public.list_case_candidates('staff')$$,'42501',null,
  'Staff cannot list candidates');
reset role;

set local role anon;
select throws_ok($$select * from public.list_case_candidates('client')$$,'42501',null,
  'Anonymous cannot list candidates');
reset role;

select * from finish();
rollback;
