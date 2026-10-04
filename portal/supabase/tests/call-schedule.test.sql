begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();

-- ---------------------------------------------------------------------------
-- Structure and privileges
-- ---------------------------------------------------------------------------
select has_table('public','call_weekly_hours','Weekly hours exist');
select has_table('public','call_blocked_dates','Blocked dates exist');
select has_table('public','call_appointments','Call appointments exist');
select hasnt_table('public','call_slots','Obsolete one-off slots are gone');
select has_column('public','call_appointments','starts_at','Appointments key on the booked instant');
select has_column('public','call_appointments','status','Appointments store a status');
select hasnt_column('public','call_appointments','slot_id','Appointments no longer reference a slot');

select has_function('public','list_available_call_slots',array['integer'],'Computed listing RPC exists');
select has_function('public','create_call_booking',
  array['timestamp with time zone','text','text','text','text'],'Booking RPC exists');
select has_function('public','set_call_weekly_hours',
  array['smallint[]','time without time zone[]','time without time zone[]'],'Weekly hours RPC exists');
select has_function('public','add_call_blocked_date',array['date'],'Block-date RPC exists');
select has_function('public','remove_call_blocked_date',array['date'],'Unblock-date RPC exists');
select has_function('public','list_call_appointments',array[]::text[],'Appointment listing RPC exists');
select has_function('public','list_call_blocked_dates',array[]::text[],'Blocked-date listing RPC exists');
select has_function('public','cancel_call_booking',array['uuid'],'Cancel-booking RPC exists');
select hasnt_function('public','create_call_slot',array['timestamp with time zone'],'Obsolete slot creation is gone');
select hasnt_function('public','delete_call_slot',array['uuid'],'Obsolete slot deletion is gone');

select is((select relrowsecurity from pg_class where oid='public.call_weekly_hours'::regclass),true,
  'Weekly hours enforce row level security');
select is((select relrowsecurity from pg_class where oid='public.call_blocked_dates'::regclass),true,
  'Blocked dates enforce row level security');
select is((select relrowsecurity from pg_class where oid='public.call_appointments'::regclass),true,
  'Call appointments enforce row level security');

-- The public catalogue exposes only the booked instant, never an internal id.
select is((select pg_get_function_result(p.oid) from pg_proc p
  where p.oid='public.list_available_call_slots(integer)'::regprocedure),
  'TABLE(starts_at timestamp with time zone)','Public listing exposes only starts_at');

-- Cancelling frees the instant: uniqueness applies only to active bookings.
select ok((select indexdef from pg_indexes
    where schemaname='public' and indexname='call_appointments_starts_at_active_key')
    ilike '%unique%cancelled%',
  'Booked instants are unique only among non-cancelled appointments');

select ok(has_table_privilege('authenticated','public.call_weekly_hours','SELECT')
  and has_table_privilege('authenticated','public.call_blocked_dates','SELECT')
  and has_table_privilege('authenticated','public.call_appointments','SELECT'),
  'Authenticated receives scoped read grants');
select ok(not has_table_privilege('anon','public.call_weekly_hours','SELECT')
  and not has_table_privilege('anon','public.call_blocked_dates','SELECT')
  and not has_table_privilege('anon','public.call_appointments','SELECT'),
  'Anon has no direct table read');
select ok(not has_table_privilege(r,t,p),r||' lacks '||p||' on '||t)
from unnest(array['anon','authenticated']) r
cross join unnest(array['call_weekly_hours','call_blocked_dates','call_appointments']) t
cross join unnest(array['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p;
select ok(not exists(select 1 from pg_class,lateral aclexplode(relacl) acl
  where oid in ('public.call_weekly_hours'::regclass,'public.call_blocked_dates'::regclass,
    'public.call_appointments'::regclass) and acl.grantee=0),
  'No PUBLIC table grants');

select ok(has_function_privilege('anon','public.list_available_call_slots(integer)','EXECUTE')
  and has_function_privilege('anon','public.create_call_booking(timestamptz,text,text,text,text)','EXECUTE'),
  'Anon may list computed slots and book');
select ok(not has_function_privilege('anon','public.set_call_weekly_hours(smallint[],time[],time[])','EXECUTE')
  and not has_function_privilege('anon','public.add_call_blocked_date(date)','EXECUTE')
  and not has_function_privilege('anon','public.cancel_call_booking(uuid)','EXECUTE')
  and not has_function_privilege('anon','public.list_call_appointments()','EXECUTE'),
  'Anon cannot administer the schedule');
select ok(has_function_privilege('authenticated','public.set_call_weekly_hours(smallint[],time[],time[])','EXECUTE')
  and has_function_privilege('authenticated','public.create_call_booking(timestamptz,text,text,text,text)','EXECUTE')
  and has_function_privilege('authenticated','public.cancel_call_booking(uuid)','EXECUTE')
  and has_function_privilege('authenticated','public.list_call_appointments()','EXECUTE'),
  'Authenticated receives schedule execution');
select ok(not exists(select 1 from pg_proc,lateral aclexplode(proacl) a where oid in (
  'public.list_available_call_slots(integer)'::regprocedure,
  'public.create_call_booking(timestamptz,text,text,text,text)'::regprocedure,
  'public.set_call_weekly_hours(smallint[],time[],time[])'::regprocedure,
  'public.add_call_blocked_date(date)'::regprocedure,
  'public.remove_call_blocked_date(date)'::regprocedure,
  'public.cancel_call_booking(uuid)'::regprocedure,
  'public.list_call_appointments()'::regprocedure,
  'public.list_call_blocked_dates()'::regprocedure) and a.grantee=0),
  'Schedule RPCs have no PUBLIC execution');

-- ---------------------------------------------------------------------------
-- Seed actors
-- ---------------------------------------------------------------------------
insert into auth.users(id,email) values
  ('60000000-0000-4000-8000-000000000001','schedule-admin@example.invalid'),
  ('60000000-0000-4000-8000-000000000002','schedule-staff@example.invalid'),
  ('60000000-0000-4000-8000-000000000003','schedule-client@example.invalid');
insert into public.profiles(id,role,active,must_change_password) values
  ('60000000-0000-4000-8000-000000000001','admin',true,false),
  ('60000000-0000-4000-8000-000000000002','staff',true,false),
  ('60000000-0000-4000-8000-000000000003','client',true,false);

-- ---------------------------------------------------------------------------
-- Anon sees nothing before the schedule is defined and cannot touch the tables
-- ---------------------------------------------------------------------------
set local role anon;
select is((select count(*) from public.list_available_call_slots(8)),0::bigint,
  'No slots exist before weekly hours are set');
select throws_ok('select * from public.call_weekly_hours','42501',null,
  'Anon cannot read weekly hours directly');
select throws_ok('select * from public.call_blocked_dates','42501',null,
  'Anon cannot read blocked dates directly');
select throws_ok('select * from public.call_appointments','42501',null,
  'Anon cannot read appointments directly');
select throws_ok($$insert into public.call_appointments(starts_at,service_id,client_name,client_email,client_phone)
  values(now()+interval '1 day','llamada-30min','X','x@example.invalid','+570000000000')$$,
  '42501',null,'Anon cannot insert appointments directly');
select throws_ok($$select public.set_call_weekly_hours(array[1]::smallint[],array['09:00'::time],array['12:00'::time])$$,
  '42501',null,'Anon cannot set weekly hours');
select throws_ok($$select public.add_call_blocked_date((now() at time zone 'America/Bogota')::date + 1)$$,
  '42501',null,'Anon cannot block a date');
select throws_ok($$select public.cancel_call_booking(gen_random_uuid())$$,
  '42501',null,'Anon cannot cancel a booking');
reset role;

-- ---------------------------------------------------------------------------
-- Admin defines the weekly schedule and blocks a date
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"aal":"aal2"}',true);
select lives_ok($$select public.set_call_weekly_hours(
  array[0,1,2,3,4,5,6]::smallint[],
  array_fill(time '09:00', array[7]),
  array_fill(time '12:00', array[7]))$$,
  'Admin sets weekly hours');
select is((select count(*) from public.call_weekly_hours),7::bigint,'Seven weekly windows are stored');
select throws_ok($$select public.set_call_weekly_hours(
  array[7]::smallint[],array['09:00'::time],array['12:00'::time])$$,
  '22023',null,'An out-of-range weekday is rejected');
select throws_ok($$select public.set_call_weekly_hours(
  array[1]::smallint[],array['12:00'::time],array['09:00'::time])$$,
  '22023',null,'A reversed window is rejected');
select throws_ok($$select public.set_call_weekly_hours(
  array[1,1]::smallint[],array['09:00','09:00']::time[],array['10:00','11:00']::time[])$$,
  '22023',null,'A duplicate weekday/start is rejected');
select ok((select count(*) from public.list_available_call_slots(8)) > 0,
  'Computed future slots appear inside the weekly hours');
select ok((select bool_and(starts_at > now()
    and (starts_at at time zone 'America/Bogota')::time >= time '09:00'
    and (starts_at at time zone 'America/Bogota')::time < time '12:00')
  from public.list_available_call_slots(8)),
  'Every listed slot is future and inside the weekly hours');
select ok((select count(*) from public.list_available_call_slots(8)
  where (starts_at at time zone 'America/Bogota')::date = (now() at time zone 'America/Bogota')::date + 1) > 0,
  'Tomorrow has slots before blocking');
select lives_ok($$select public.add_call_blocked_date((now() at time zone 'America/Bogota')::date + 1)$$,
  'Admin blocks tomorrow');
select is((select count(*) from public.list_available_call_slots(8)
  where (starts_at at time zone 'America/Bogota')::date = (now() at time zone 'America/Bogota')::date + 1),
  0::bigint,'Blocked date yields no slots');
select lives_ok($$select public.remove_call_blocked_date((now() at time zone 'America/Bogota')::date + 1)$$,
  'Admin unblocks tomorrow');
select ok((select count(*) from public.list_available_call_slots(8)
  where (starts_at at time zone 'America/Bogota')::date = (now() at time zone 'America/Bogota')::date + 1) > 0,
  'Unblocked date yields slots again');
reset role;

-- ---------------------------------------------------------------------------
-- Booking is registered before payment; a taken instant fails with 23505
-- ---------------------------------------------------------------------------
set local role anon;
select set_config('test.slot_instant', (select starts_at::text from public.list_available_call_slots(8)
  where starts_at > now() + interval '1 hour' order by starts_at limit 1), true);
select set_config('test.booking_id', (select public.create_call_booking(
    current_setting('test.slot_instant')::timestamptz, 'llamada-30min',
    'Ana Cliente','ana.cliente@example.invalid','+573001112233'))::text, true);
select is((select count(*) from public.list_available_call_slots(8)
  where starts_at = current_setting('test.slot_instant')::timestamptz),0::bigint,
  'Booked instant disappears from the public listing');
select throws_ok($$select public.create_call_booking(current_setting('test.slot_instant')::timestamptz,
  'llamada-45min','Otro','otro@example.invalid','+573004445566')$$,
  '23505',null,'A second booking of the same instant fails with 23505');
select throws_ok($$select public.create_call_booking(now()+interval '1 day','llamada-60min','X','x@example.invalid','+570000000000')$$,
  '22023',null,'Unknown service is rejected');
select throws_ok($$select public.create_call_booking(now()-interval '1 day','llamada-30min','X','x@example.invalid','+570000000000')$$,
  '22023',null,'Past instant is rejected');
select throws_ok($$select public.create_call_booking(
  (((now() at time zone 'America/Bogota')::date + 1) + time '03:00') at time zone 'America/Bogota',
  'llamada-30min','X','x@example.invalid','+570000000000')$$,
  '22023',null,'Instant outside the weekly hours is rejected');
select throws_ok($$select public.create_call_booking(
  (((now() at time zone 'America/Bogota')::date + 1) + time '09:15') at time zone 'America/Bogota',
  'llamada-30min','X','x@example.invalid','+570000000000')$$,
  '22023',null,'Off-grid instant is rejected');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"aal":"aal2"}',true);
select is((select status from public.list_call_appointments()
  where id = current_setting('test.booking_id')::uuid),'pending_payment',
  'Booking is registered as pending_payment');
select is((select starts_at from public.list_call_appointments()
  where id = current_setting('test.booking_id')::uuid), current_setting('test.slot_instant')::timestamptz,
  'Booking stores the requested instant');
select is((select count(*) from public.call_appointments),1::bigint,
  'Admin reads exactly the booked appointment');

-- Cancelling releases the instant for rebooking: the unique index only applies
-- to active (non-cancelled) appointments.
select throws_ok($$select public.cancel_call_booking(null)$$,
  '22023',null,'A null appointment id is rejected');
select throws_ok($$select public.cancel_call_booking('70000000-0000-4000-8000-000000000009')$$,
  'P0002',null,'An unknown appointment is rejected');
select lives_ok($$select public.cancel_call_booking(current_setting('test.booking_id')::uuid)$$,
  'Admin cancels the pending booking');
select is((select status from public.list_call_appointments()
  where id = current_setting('test.booking_id')::uuid),'cancelled',
  'Cancelled booking keeps its cancelled status');
select is((select count(*) from public.list_available_call_slots(8)
  where starts_at = current_setting('test.slot_instant')::timestamptz),1::bigint,
  'Cancelled booking releases the instant back to the listing');
select lives_ok($$select public.create_call_booking(current_setting('test.slot_instant')::timestamptz,
  'llamada-45min','Bruno Rebook','bruno.rebook@example.invalid','+573009998877')$$,
  'A released instant can be booked again');
select is((select count(*) from public.call_appointments where status <> 'cancelled'),1::bigint,
  'Only the active booking remains');

-- A client can neither read the schedule tables nor administer the calendar.
select set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claims','{"aal":"aal1"}',true);
select is((select count(*) from public.call_weekly_hours),0::bigint,'Client cannot read weekly hours');
select is((select count(*) from public.call_blocked_dates),0::bigint,'Client cannot read blocked dates');
select is((select count(*) from public.call_appointments),0::bigint,'Client cannot read appointments');
select throws_ok($$insert into public.call_appointments(starts_at,service_id,client_name,client_email,client_phone)
  values(now()+interval '3 days','llamada-30min','X','x@example.invalid','+570000000000')$$,
  '42501',null,'Client cannot insert appointments directly');
select throws_ok($$select public.set_call_weekly_hours(array[1]::smallint[],array['09:00'::time],array['12:00'::time])$$,
  '42501',null,'Client cannot set weekly hours');
select throws_ok('select * from public.list_call_appointments()','42501',null,
  'Client cannot list appointments');
select throws_ok('select public.cancel_call_booking(gen_random_uuid())','42501',null,
  'Client cannot cancel bookings');
select ok((select count(*) from public.list_available_call_slots(8)) > 0,
  'Client can still read the computed listing');

-- Staff shares the administration surface with the admin.
select set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"aal":"aal2"}',true);
select lives_ok($$select public.set_call_weekly_hours(
  array[0,1,2,3,4,5,6]::smallint[],
  array_fill(time '08:00', array[7]),
  array_fill(time '11:00', array[7]))$$,
  'Staff replaces the weekly hours');
select is((select count(*) from public.call_weekly_hours),7::bigint,'Staff replacement is stored');
select lives_ok($$select public.add_call_blocked_date((now() at time zone 'America/Bogota')::date + 2)$$,
  'Staff blocks a date');
select is((select count(*) from public.call_blocked_dates
  where day=(now() at time zone 'America/Bogota')::date + 2),1::bigint,'Staff block is stored');
select lives_ok($$select public.remove_call_blocked_date((now() at time zone 'America/Bogota')::date + 2)$$,
  'Staff unblocks a date');
select lives_ok($$select public.cancel_call_booking((select id from public.list_call_appointments()
  where status <> 'cancelled' order by starts_at limit 1))$$,
  'Staff cancels an active booking');
select is((select count(*) from public.call_appointments where status <> 'cancelled'),0::bigint,
  'No active booking remains after staff cancellation');
reset role;

select * from finish();
rollback;
