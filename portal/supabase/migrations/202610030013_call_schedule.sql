begin;

-- Weekly recurring call availability. Each row is one local-time window for a
-- Postgres day-of-week (0=Sunday..6=Saturday). Times are interpreted in
-- America/Bogota when the schedule is expanded into bookable instants.
create table public.call_weekly_hours (
  id uuid primary key default gen_random_uuid(),
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  check (start_time < end_time),
  unique (weekday, start_time)
);
comment on table public.call_weekly_hours is 'Recurring weekly call windows; times are local to America/Bogota.';

-- Exact local dates (holidays) removed from the computed availability.
create table public.call_blocked_dates (
  day date primary key,
  created_at timestamptz not null default now()
);

-- One-off slot model is replaced by computed availability: the appointment is
-- now keyed by the booked instant and is registered before payment.
alter table public.call_appointments drop column slot_id;
alter table public.call_appointments add column starts_at timestamptz not null;
alter table public.call_appointments add column status text not null default 'pending_payment'
  check (status in ('pending_payment','confirmed','cancelled'));
comment on column public.call_appointments.status is 'pending_payment on booking; confirmed after payment; cancelled releases the instant for rebooking.';
-- A booked instant is unique only among active (non-cancelled) appointments, so
-- cancelling an abandoned booking genuinely frees the slot for a new booking.
create unique index call_appointments_starts_at_active_key
  on public.call_appointments(starts_at) where status <> 'cancelled';

drop function if exists public.list_available_call_slots();
drop function if exists public.create_call_slot(timestamptz);
drop function if exists public.delete_call_slot(uuid);
drop table public.call_slots;

alter table public.call_weekly_hours enable row level security;
alter table public.call_blocked_dates enable row level security;
alter table public.call_appointments enable row level security;
revoke all on public.call_weekly_hours, public.call_blocked_dates, public.call_appointments
  from public, anon, authenticated;
grant select on public.call_weekly_hours, public.call_blocked_dates, public.call_appointments
  to authenticated;

drop policy if exists call_appointments_read on public.call_appointments;
create policy call_weekly_hours_read on public.call_weekly_hours for select to authenticated
  using (portal_private.current_role() in ('admin','staff'));
create policy call_blocked_dates_read on public.call_blocked_dates for select to authenticated
  using (portal_private.current_role() in ('admin','staff'));
create policy call_appointments_read on public.call_appointments for select to authenticated
  using (portal_private.current_role() in ('admin','staff'));

-- Private predicate shared by the public listing and the booking RPC so both
-- agree exactly on what a bookable instant is: a future, 30-minute-aligned
-- instant inside a weekly window, on a local date that is not blocked.
create function portal_private.call_slot_is_available(target timestamptz)
returns boolean
language sql stable security definer set search_path='' as $$
  select target > now()
    and not exists (
      select 1 from public.call_blocked_dates b
      where b.day = l.local_ts::date
    )
    and exists (
      select 1 from public.call_weekly_hours h
      where h.weekday = extract(dow from l.local_ts)::smallint
        and l.local_ts::time >= h.start_time
        and l.local_ts::time <= h.end_time - interval '30 minutes'
        and mod(extract(epoch from (l.local_ts::time - h.start_time))::int, 1800) = 0
    )
  from (select target at time zone 'America/Bogota' as local_ts) l;
$$;
revoke all on function portal_private.call_slot_is_available(timestamptz)
  from public, anon, authenticated;

-- Public catalogue for unauthenticated visitors. Availability is computed for
-- every 30-minute instant from the weekly windows over the next p_weeks weeks,
-- excluding past instants, blocked dates, and non-cancelled appointments.
create function public.list_available_call_slots(p_weeks integer default 8)
returns table(starts_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
declare
  first_day date := (now() at time zone 'America/Bogota')::date;
begin
  if p_weeks is null or p_weeks < 0 or p_weeks > 52 then
    raise exception 'Invalid range' using errcode='22023';
  end if;
  return query
    select distinct candidate.slot_start
    from generate_series(
        first_day::timestamp,
        (first_day + (p_weeks * 7))::timestamp,
        interval '1 day'
      ) as d(day_ts)
    join public.call_weekly_hours h
      on h.weekday = extract(dow from d.day_ts)::smallint
    cross join lateral generate_series(
        d.day_ts::date + h.start_time,
        d.day_ts::date + h.end_time - interval '30 minutes',
        interval '30 minutes'
      ) as gs(slot_ts)
    cross join lateral (
      select gs.slot_ts at time zone 'America/Bogota' as slot_start
    ) candidate
    where portal_private.call_slot_is_available(candidate.slot_start)
      and not exists (
        select 1 from public.call_appointments a
        where a.starts_at = candidate.slot_start and a.status <> 'cancelled'
      )
    order by candidate.slot_start;
end;
$$;

-- Registers the booking BEFORE payment. The appointment is inserted as
-- pending_payment; the starts_at unique constraint makes a concurrent booking
-- of the same instant fail with 23505.
create function public.create_call_booking(
  p_starts_at timestamptz,
  p_service_id text,
  p_client_name text,
  p_client_email text,
  p_client_phone text
) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  clean_name text := btrim(coalesce(p_client_name, ''));
  clean_email text := btrim(coalesce(p_client_email, ''));
  clean_phone text := btrim(coalesce(p_client_phone, ''));
  new_id uuid;
begin
  if p_starts_at is null
    or p_service_id is null
    or p_service_id not in ('llamada-30min','llamada-45min')
    or length(clean_name) not between 1 and 200
    or length(clean_email) not between 3 and 254
    or clean_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    or length(clean_phone) not between 1 and 32 then
    raise exception 'Invalid booking' using errcode='22023';
  end if;
  if not portal_private.call_slot_is_available(p_starts_at) then
    raise exception 'Slot unavailable' using errcode='22023';
  end if;
  insert into public.call_appointments(
      starts_at, service_id, client_name, client_email, client_phone, status)
    values(p_starts_at, p_service_id, clean_name, clean_email, clean_phone, 'pending_payment')
    returning id into new_id;
  return new_id;
exception
  when unique_violation then
    raise exception 'Slot is already booked' using errcode='23505';
end;
$$;

-- Replaces the whole weekly schedule atomically. Parallel arrays describe each
-- window; empty arrays clear the schedule. Only admin/staff may call it.
create function public.set_call_weekly_hours(
  p_weekdays smallint[], p_start_times time[], p_end_times time[]
) returns void
language plpgsql security definer set search_path='' as $$
declare
  actor uuid := auth.uid();
  item integer;
  total integer;
begin
  perform 1 from public.profiles where id=actor for share;
  if coalesce(portal_private.current_role() not in ('admin','staff'), true) then
    raise exception 'Not permitted' using errcode='42501';
  end if;
  if p_weekdays is null or p_start_times is null or p_end_times is null then
    raise exception 'Invalid schedule' using errcode='22023';
  end if;
  total := cardinality(p_weekdays);
  if total > 100
    or cardinality(p_start_times) <> total
    or cardinality(p_end_times) <> total
    or array_position(p_weekdays, null) is not null
    or array_position(p_start_times, null) is not null
    or array_position(p_end_times, null) is not null then
    raise exception 'Invalid schedule' using errcode='22023';
  end if;
  if total > 0 then
    for item in 1..total loop
      if p_weekdays[item] not between 0 and 6
        or p_start_times[item] >= p_end_times[item] then
        raise exception 'Invalid schedule' using errcode='22023';
      end if;
    end loop;
  end if;
  if exists (
    select 1 from generate_series(1, total) as i(item)
    group by p_weekdays[i.item], p_start_times[i.item]
    having count(*) > 1
  ) then
    raise exception 'Invalid schedule' using errcode='22023';
  end if;
  delete from public.call_weekly_hours where weekday between 0 and 6;
  if total > 0 then
    for item in 1..total loop
      insert into public.call_weekly_hours(weekday, start_time, end_time)
        values(p_weekdays[item], p_start_times[item], p_end_times[item]);
    end loop;
  end if;
end;
$$;

-- Adds a blocked local date (idempotent). Only admin/staff may call it.
create function public.add_call_blocked_date(p_day date) returns void
language plpgsql security definer set search_path='' as $$
declare
  actor uuid := auth.uid();
begin
  perform 1 from public.profiles where id=actor for share;
  if coalesce(portal_private.current_role() not in ('admin','staff'), true) then
    raise exception 'Not permitted' using errcode='42501';
  end if;
  if p_day is null then
    raise exception 'Invalid date' using errcode='22023';
  end if;
  insert into public.call_blocked_dates(day) values(p_day)
    on conflict (day) do nothing;
end;
$$;

-- Removes a blocked local date (idempotent). Only admin/staff may call it.
create function public.remove_call_blocked_date(p_day date) returns void
language plpgsql security definer set search_path='' as $$
declare
  actor uuid := auth.uid();
begin
  perform 1 from public.profiles where id=actor for share;
  if coalesce(portal_private.current_role() not in ('admin','staff'), true) then
    raise exception 'Not permitted' using errcode='42501';
  end if;
  if p_day is null then
    raise exception 'Invalid date' using errcode='22023';
  end if;
  delete from public.call_blocked_dates where day=p_day;
end;
$$;

-- Cancels a booking and releases its instant. The partial unique index ignores
-- cancelled rows, so the freed instant becomes bookable again. Only admin/staff.
create function public.cancel_call_booking(p_appointment_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare
  actor uuid := auth.uid();
begin
  perform 1 from public.profiles where id=actor for share;
  if coalesce(portal_private.current_role() not in ('admin','staff'), true) then
    raise exception 'Not permitted' using errcode='42501';
  end if;
  if p_appointment_id is null then
    raise exception 'Invalid appointment' using errcode='22023';
  end if;
  update public.call_appointments set status='cancelled'
    where id=p_appointment_id and status <> 'cancelled';
  if not found then
    raise exception 'Appointment not found' using errcode='P0002';
  end if;
end;
$$;

-- Admin/staff calendar reads. RLS also grants direct select, but these keep the
-- client data behind one validated entry point.
create function public.list_call_appointments()
returns table(id uuid, starts_at timestamptz, service_id text, status text,
  client_name text, client_email text, client_phone text, payment_id text, created_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if coalesce(portal_private.current_role() not in ('admin','staff'), true) then
    raise exception 'Not permitted' using errcode='42501';
  end if;
  return query
    select a.id, a.starts_at, a.service_id, a.status, a.client_name,
      a.client_email, a.client_phone, a.payment_id, a.created_at
    from public.call_appointments a
    order by a.starts_at;
end;
$$;

create function public.list_call_blocked_dates()
returns table(day date)
language plpgsql stable security definer set search_path='' as $$
begin
  if coalesce(portal_private.current_role() not in ('admin','staff'), true) then
    raise exception 'Not permitted' using errcode='42501';
  end if;
  return query select b.day from public.call_blocked_dates b order by b.day;
end;
$$;

revoke all on function public.list_available_call_slots(integer),
  public.create_call_booking(timestamptz,text,text,text,text),
  public.set_call_weekly_hours(smallint[],time[],time[]),
  public.add_call_blocked_date(date),
  public.remove_call_blocked_date(date),
  public.cancel_call_booking(uuid),
  public.list_call_appointments(),
  public.list_call_blocked_dates()
  from public, anon, authenticated;
grant execute on function public.list_available_call_slots(integer),
  public.create_call_booking(timestamptz,text,text,text,text) to anon, authenticated;
grant execute on function public.set_call_weekly_hours(smallint[],time[],time[]),
  public.add_call_blocked_date(date),
  public.remove_call_blocked_date(date),
  public.cancel_call_booking(uuid),
  public.list_call_appointments(),
  public.list_call_blocked_dates() to authenticated;

commit;
