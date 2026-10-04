begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

select has_table('public', 'profiles', 'Trusted profiles exist');
insert into auth.users (id) values
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222');
insert into public.profiles (id, role) values
  ('11111111-1111-4111-8111-111111111111', 'admin'),
  ('22222222-2222-4222-8222-222222222222', 'client');

select ok((select not active and must_change_password from public.profiles
  where id = '11111111-1111-4111-8111-111111111111'), 'Defaults deny operations');
select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'RLS enabled');
select throws_ok($$insert into public.profiles (id, role) values
  ('33333333-3333-4333-8333-333333333333', 'client')$$, '23503', null, 'Identity FK enforced');
select throws_ok($$update public.profiles set role = 'owner'$$, '23514', null, 'Unknown roles rejected');
select throws_ok($$update public.profiles set role = null$$, '23502', null, 'Null role rejected');
select lives_ok($$update public.profiles set role = 'staff' where role = 'client'$$, 'Staff is a valid trusted role');
update public.profiles set role = 'client' where role = 'staff';
select throws_ok($$update public.profiles set active = null$$, '23502', null, 'Null active rejected');
select throws_ok($$update public.profiles set must_change_password = null$$, '23502', null, 'Null rotation rejected');
select throws_ok($$update public.profiles set id = 'not-a-uuid'$$, '22P02', null, 'Malformed UUID rejected');
select throws_ok($$update public.profiles set id = null$$, '23502', null, 'Null identity rejected');
select throws_ok($$insert into public.profiles (id, role) values
  ('11111111-1111-4111-8111-111111111111', 'client')$$, '23505', null, 'Duplicate identity rejected');

-- Split profile names and phone are optional, but when present they must be nonblank and bounded.
select lives_ok($$update public.profiles set first_name = 'Ana', last_name = 'Cliente', phone = '+506 8888 8888'
  where role = 'client'$$, 'Valid trimmed names and phone accepted');
select lives_ok($$update public.profiles set first_name = null, last_name = null, phone = null where role = 'client'$$,
  'Null names and phone accepted');
select throws_ok($$update public.profiles set first_name = ''$$, '23514', null, 'Empty first_name rejected');
select throws_ok($$update public.profiles set first_name = repeat(' ', 5)$$, '23514', null,
  'Whitespace-only first_name rejected');
select throws_ok($$update public.profiles set first_name = repeat('a', 121)$$, '23514', null,
  'Over-long first_name rejected');
select lives_ok($$update public.profiles set first_name = repeat('a', 120)$$, 'Boundary-length first_name accepted');
select throws_ok($$update public.profiles set last_name = ''$$, '23514', null, 'Empty last_name rejected');
select throws_ok($$update public.profiles set last_name = repeat(' ', 5)$$, '23514', null,
  'Whitespace-only last_name rejected');
select throws_ok($$update public.profiles set last_name = repeat('a', 121)$$, '23514', null,
  'Over-long last_name rejected');
select lives_ok($$update public.profiles set last_name = repeat('a', 120)$$, 'Boundary-length last_name accepted');
select throws_ok($$update public.profiles set phone = ''$$, '23514', null, 'Empty phone rejected');
select throws_ok($$update public.profiles set phone = repeat(' ', 5)$$, '23514', null,
  'Whitespace-only phone rejected');
select throws_ok($$update public.profiles set phone = repeat('9', 33)$$, '23514', null,
  'Over-long phone rejected');
select lives_ok($$update public.profiles set phone = repeat('9', 32)$$, 'Boundary-length phone accepted');
update public.profiles set first_name = null, last_name = null, phone = null where role = 'client';

-- Every client-facing table/column write privilege must be absent, not merely blocked by RLS.
select ok(not has_table_privilege(r, 'public.profiles', p), r || ' lacks ' || p)
from unnest(array['anon', 'authenticated']) r
cross join unnest(array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) p;
select ok(not has_column_privilege(r, 'public.profiles', c, p), r || ' lacks ' || p || ' ' || c)
from unnest(array['anon', 'authenticated']) r
cross join unnest(array['id', 'role', 'active', 'must_change_password', 'first_name', 'last_name', 'phone']) c
cross join unnest(array['INSERT', 'UPDATE', 'REFERENCES']) p;
select ok(not exists (select 1 from pg_class, lateral aclexplode(relacl) acl
  where oid = 'public.profiles'::regclass and acl.grantee = 0), 'No PUBLIC table grants');
select ok(not exists (select 1 from pg_attribute, lateral aclexplode(attacl) acl
  where attrelid = 'public.profiles'::regclass and acl.grantee = 0), 'No PUBLIC column grants');

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claims', '{"aal":"aal1","app_metadata":{"role":"admin"}}', true);
select results_eq('select id::text from public.profiles',
  $$values ('11111111-1111-4111-8111-111111111111'::text)$$, 'Own pending admin profile readable before MFA');
select is((select count(*) from public.profiles where id = '22222222-2222-4222-8222-222222222222'),
  0::bigint, 'Foreign profile hidden despite admin metadata');
select throws_ok($$insert into public.profiles (id, role) values
  ('33333333-3333-4333-8333-333333333333', 'admin')$$, '42501', null, 'Client insert denied');
select throws_ok($$update public.profiles set role = 'admin', active = true, must_change_password = false$$,
  '42501', null, 'Client escalation and activation denied');
select throws_ok('delete from public.profiles', '42501', null, 'Client delete denied');
select throws_ok($$insert into public.profiles (id, role) values
  ('11111111-1111-4111-8111-111111111111', 'admin') on conflict (id) do update set active = true$$,
  '42501', null, 'Client upsert denied');
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select results_eq('select role from public.profiles', $$values ('client'::text)$$, 'Client sees only own role');
select set_config('request.jwt.claim.sub', '', true);
select is((select count(*) from public.profiles), 0::bigint, 'Null subject sees no profiles');
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
select is((select count(*) from public.profiles), 0::bigint, 'Unprovisioned subject sees no profiles');
reset role;

set local role anon;
select throws_ok('select * from public.profiles', '42501', null, 'Anonymous read denied');
select throws_ok($$insert into public.profiles (id, role) values
  ('33333333-3333-4333-8333-333333333333', 'client')$$, '42501', null, 'Anonymous insert denied');
select throws_ok('update public.profiles set active = true', '42501', null, 'Anonymous update denied');
select throws_ok('delete from public.profiles', '42501', null, 'Anonymous delete denied');
reset role;
select * from finish();
rollback;
