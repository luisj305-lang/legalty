begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();

select has_function('public','list_profile_contacts',array[]::text[],
  'Profile contacts listing RPC exists');
select has_function('public','update_profile_contact',array['uuid','text','text','text'],
  'Profile contact update RPC exists');
select has_function('public','provision_client_profile',array['uuid','text','text','text'],
  'Client profile provisioning RPC exists');
select ok(has_function_privilege('authenticated','public.list_profile_contacts()','EXECUTE'),
  'Authenticated receives contact listing execution');
select ok(has_function_privilege('authenticated','public.update_profile_contact(uuid,text,text,text)','EXECUTE'),
  'Authenticated receives contact update execution');
select ok(has_function_privilege('authenticated','public.provision_client_profile(uuid,text,text,text)','EXECUTE'),
  'Authenticated receives profile provisioning execution');
select ok(not has_function_privilege('anon','public.list_profile_contacts()','EXECUTE'),
  'Anonymous has no contact listing execution');
select ok(not has_function_privilege('anon','public.update_profile_contact(uuid,text,text,text)','EXECUTE'),
  'Anonymous has no contact update execution');
select ok(not has_function_privilege('anon','public.provision_client_profile(uuid,text,text,text)','EXECUTE'),
  'Anonymous has no profile provisioning execution');

insert into auth.users(id,email) values
  ('20000000-0000-4000-8000-000000000001','contacts-admin@example.invalid'),
  ('20000000-0000-4000-8000-000000000002','contacts-client@example.invalid'),
  ('20000000-0000-4000-8000-000000000003','contacts-staff@example.invalid'),
  ('20000000-0000-4000-8000-000000000004','contacts-inactive@example.invalid'),
  ('20000000-0000-4000-8000-000000000005','contacts-invited@example.invalid');
insert into public.profiles(id,role,active,must_change_password,first_name,last_name,phone) values
  ('20000000-0000-4000-8000-000000000001','admin',true,false,'Admin','Contact','+57 300 000 0001'),
  ('20000000-0000-4000-8000-000000000002','client',true,false,'Ana','Client','+57 300 000 0002'),
  ('20000000-0000-4000-8000-000000000003','staff',true,false,'Sofia','Staff',null),
  ('20000000-0000-4000-8000-000000000004','client',false,false,null,null,null);

set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"aal":"aal2"}',true);

select is((select count(*) from public.list_profile_contacts()),4::bigint,
  'Admin lists every registered profile');
select is((select array_agg(role) from public.list_profile_contacts()),array['admin','client','client','staff'],
  'Contacts are ordered by role');
select is((select array_agg(email) from public.list_profile_contacts() where role='client'),
  array['contacts-client@example.invalid','contacts-inactive@example.invalid'],
  'Within a role, named contacts order before null names');
select is((select phone from public.list_profile_contacts()
    where id='20000000-0000-4000-8000-000000000002'),'+57 300 000 0002',
  'Listing returns the stored phone');
select is((select first_name from public.list_profile_contacts()
    where id='20000000-0000-4000-8000-000000000002'),'Ana',
  'Listing returns the stored first_name');
select is((select last_name from public.list_profile_contacts()
    where id='20000000-0000-4000-8000-000000000002'),'Client',
  'Listing returns the stored last_name');
select is((select role from public.list_profile_contacts()
    where id='20000000-0000-4000-8000-000000000003'),'staff',
  'Listing returns the stored role');
select is((select active from public.list_profile_contacts()
    where id='20000000-0000-4000-8000-000000000004'),false,
  'Listing returns the stored active flag');
select is((select first_name from public.list_profile_contacts()
    where id='20000000-0000-4000-8000-000000000004'),null::text,
  'Listing returns a null stored first_name');
select is((select last_name from public.list_profile_contacts()
    where id='20000000-0000-4000-8000-000000000004'),null::text,
  'Listing returns a null stored last_name');
select is((select email from public.list_profile_contacts()
    where id='20000000-0000-4000-8000-000000000004'),'contacts-inactive@example.invalid',
  'Listing returns the Auth email');

select lives_ok($$select public.update_profile_contact(
  '20000000-0000-4000-8000-000000000002','  Ana Actualizada  ','  Apellido  ','  +57 311 111 1111  ')$$,
  'Admin updates a profile contact');
reset role;
select is((select first_name from public.profiles where id='20000000-0000-4000-8000-000000000002'),
  'Ana Actualizada','First name is stored trimmed');
select is((select last_name from public.profiles where id='20000000-0000-4000-8000-000000000002'),
  'Apellido','Last name is stored trimmed');
select is((select phone from public.profiles where id='20000000-0000-4000-8000-000000000002'),
  '+57 311 111 1111','Phone is stored trimmed');
select is((select role from public.profiles where id='20000000-0000-4000-8000-000000000002'),
  'client','Update never changes the role');
select is((select active from public.profiles where id='20000000-0000-4000-8000-000000000002'),
  true,'Update never changes active');
select is((select must_change_password from public.profiles where id='20000000-0000-4000-8000-000000000002'),
  false,'Update never changes must_change_password');

set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
select lives_ok($$select public.update_profile_contact(
  '20000000-0000-4000-8000-000000000002','   ','   ','   ')$$,'Blank input clears all contact fields');
reset role;
select is((select first_name from public.profiles where id='20000000-0000-4000-8000-000000000002'),null::text,
  'Blank first_name clears the stored value');
select is((select last_name from public.profiles where id='20000000-0000-4000-8000-000000000002'),null::text,
  'Blank last_name clears the stored value');
select is((select phone from public.profiles where id='20000000-0000-4000-8000-000000000002'),null::text,
  'Blank phone clears the stored phone');

set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
select lives_ok($$select public.update_profile_contact(
  '20000000-0000-4000-8000-000000000002','Ana Null','Apellido Null','+57 300 000 0009')$$,
  'Admin re-sets all contact fields');
select lives_ok($$select public.update_profile_contact(
  '20000000-0000-4000-8000-000000000002',null,null,null)$$,'Admin clears all contact fields with null');
reset role;
select is((select first_name from public.profiles where id='20000000-0000-4000-8000-000000000002'),null::text,
  'Null first_name clears the stored value');
select is((select last_name from public.profiles where id='20000000-0000-4000-8000-000000000002'),null::text,
  'Null last_name clears the stored value');
select is((select phone from public.profiles where id='20000000-0000-4000-8000-000000000002'),null::text,
  'Null phone clears the stored phone');

set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
select lives_ok($$select public.update_profile_contact(
  '20000000-0000-4000-8000-000000000002',repeat('a',120),repeat('b',120),repeat('9',32))$$,
  'Boundary-length first_name, last_name and phone are accepted');
select throws_ok($$select public.update_profile_contact(
  '20000000-0000-4000-8000-000000000002',repeat('a',121),null,null)$$,
  '22023',null,'Over-long first_name denied');
select throws_ok($$select public.update_profile_contact(
  '20000000-0000-4000-8000-000000000002',null,repeat('b',121),null)$$,
  '22023',null,'Over-long last_name denied');
select throws_ok($$select public.update_profile_contact(
  '20000000-0000-4000-8000-000000000002',null,null,repeat('9',33))$$,
  '22023',null,'Over-long phone denied');
select throws_ok($$select public.update_profile_contact(
  null,'Valid',null,null)$$,'22023',null,'Null target denied');
select throws_ok($$select public.update_profile_contact(
  '99999999-0000-4000-8000-000000000001','Valid',null,null)$$,
  '22023',null,'Unknown target denied');

-- Provisioning: admin creates the trusted client profile of an already-invited
-- auth user. It always sets role=client, active=true and must_change_password=true.
select lives_ok($$select public.provision_client_profile(
  '20000000-0000-4000-8000-000000000005','  Nuevo  ','  Cliente  ','  +57 322 222 2222  ')$$,
  'Admin provisions the invited client profile');
reset role;
select is((select role from public.profiles where id='20000000-0000-4000-8000-000000000005'),
  'client','Provisioned profile is a client');
select is((select active from public.profiles where id='20000000-0000-4000-8000-000000000005'),
  true,'Provisioned profile is active');
select is((select must_change_password from public.profiles where id='20000000-0000-4000-8000-000000000005'),
  true,'Provisioned profile must change password');
select is((select first_name from public.profiles where id='20000000-0000-4000-8000-000000000005'),
  'Nuevo','Provisioned first_name is stored trimmed');
select is((select last_name from public.profiles where id='20000000-0000-4000-8000-000000000005'),
  'Cliente','Provisioned last_name is stored trimmed');
select is((select phone from public.profiles where id='20000000-0000-4000-8000-000000000005'),
  '+57 322 222 2222','Provisioned phone is stored trimmed');

set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
select throws_ok($$select public.provision_client_profile(
  '20000000-0000-4000-8000-000000000005','Duplicado',null,null)$$,
  '23505',null,'Provisioning an existing profile denied');
select throws_ok($$select public.provision_client_profile(
  null,'Sin',null,null)$$,'22023',null,'Null provision target denied');
select throws_ok($$select public.provision_client_profile(
  '20000000-0000-4000-8000-000000000005',repeat('a',121),null,null)$$,
  '22023',null,'Over-long provision first_name denied');
select throws_ok($$select public.provision_client_profile(
  '20000000-0000-4000-8000-000000000005',null,repeat('b',121),null)$$,
  '22023',null,'Over-long provision last_name denied');
select throws_ok($$select public.provision_client_profile(
  '20000000-0000-4000-8000-000000000005',null,null,repeat('9',33))$$,
  '22023',null,'Over-long provision phone denied');
select throws_ok($$select public.provision_client_profile(
  '99999999-0000-4000-8000-000000000009','Sin','Cuenta',null)$$,
  '23503',null,'Provision target must be an existing auth user');

select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
select throws_ok($$select * from public.list_profile_contacts()$$,
  '42501',null,'Client cannot list contacts');
select throws_ok($$select public.update_profile_contact(
  '20000000-0000-4000-8000-000000000002','Blocked',null,null)$$,
  '42501',null,'Client cannot update contacts');
select throws_ok($$select public.provision_client_profile(
  '20000000-0000-4000-8000-000000000005','Blocked',null,null)$$,
  '42501',null,'Client cannot provision profiles');

select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000003',true);
select throws_ok($$select * from public.list_profile_contacts()$$,
  '42501',null,'Staff cannot list contacts');
select throws_ok($$select public.update_profile_contact(
  '20000000-0000-4000-8000-000000000002','Blocked',null,null)$$,
  '42501',null,'Staff cannot update contacts');
select throws_ok($$select public.provision_client_profile(
  '20000000-0000-4000-8000-000000000005','Blocked',null,null)$$,
  '42501',null,'Staff cannot provision profiles');
reset role;

set local role anon;
select throws_ok($$select * from public.list_profile_contacts()$$,
  '42501',null,'Anonymous cannot list contacts');
select throws_ok($$select public.update_profile_contact(
  '20000000-0000-4000-8000-000000000002','Blocked',null,null)$$,
  '42501',null,'Anonymous cannot update contacts');
select throws_ok($$select public.provision_client_profile(
  '20000000-0000-4000-8000-000000000005','Blocked',null,null)$$,
  '42501',null,'Anonymous cannot provision profiles');
reset role;

select * from finish();
rollback;
