begin;

-- Bookable availability defined by admin/staff. start times are stored as UTC
-- instants and rendered in America/Bogota by the application layer.
create table public.call_slots (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null unique,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
comment on column public.call_slots.starts_at is 'Slot start instant; displayed in America/Bogota.';

-- A call appointment is recorded only after payment approval. Capacity is one
-- appointment per slot, so a slot that is booked can no longer be removed.
create table public.call_appointments (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null unique references public.call_slots(id),
  service_id text not null check (service_id in ('llamada-30min','llamada-45min')),
  client_name text not null,
  client_email text not null,
  client_phone text not null,
  payment_id text,
  created_at timestamptz not null default now()
);

alter table public.call_slots enable row level security;
alter table public.call_appointments enable row level security;
revoke all on public.call_slots, public.call_appointments from public, anon, authenticated;
grant select on public.call_slots, public.call_appointments to authenticated;

create policy call_slots_read on public.call_slots for select to authenticated
  using (portal_private.current_role() in ('admin','staff'));
create policy call_appointments_read on public.call_appointments for select to authenticated
  using (portal_private.current_role() in ('admin','staff'));

-- Creates availability and returns the new slot id. Writes stay admin/staff only.
create function public.create_call_slot(slot_starts_at timestamptz) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  actor uuid := auth.uid();
  result uuid;
begin
  perform 1 from public.profiles where id=actor for share;
  if coalesce(portal_private.current_role() not in ('admin','staff'),true) then
    raise exception 'Not permitted' using errcode='42501';
  end if;
  if slot_starts_at is null then
    raise exception 'Invalid slot' using errcode='22023';
  end if;
  insert into public.call_slots(starts_at,created_by) values(slot_starts_at,actor)
    returning id into result;
  return result;
end;
$$;

-- Removes availability. A slot that already has an appointment is immutable.
create function public.delete_call_slot(target_slot uuid) returns void
language plpgsql security definer set search_path='' as $$
declare
  actor uuid := auth.uid();
begin
  perform 1 from public.profiles where id=actor for share;
  if coalesce(portal_private.current_role() not in ('admin','staff'),true) then
    raise exception 'Not permitted' using errcode='42501';
  end if;
  if target_slot is null then
    raise exception 'Invalid slot' using errcode='22023';
  end if;
  perform 1 from public.call_slots where id=target_slot for update;
  if not found then
    raise exception 'Not permitted' using errcode='42501';
  end if;
  if exists (select 1 from public.call_appointments where slot_id=target_slot) then
    raise exception 'Slot is already booked' using errcode='23514';
  end if;
  delete from public.call_slots where id=target_slot;
end;
$$;

-- Public catalogue for unauthenticated visitors: future, unbooked slots only.
-- Only the slot id and start instant are exposed; no client data is readable.
create function public.list_available_call_slots()
returns table(id uuid, starts_at timestamptz)
language sql stable security definer set search_path='' as $$
  select s.id, s.starts_at
  from public.call_slots s
  where s.starts_at > now()
    and not exists (select 1 from public.call_appointments a where a.slot_id = s.id)
  order by s.starts_at, s.id;
$$;

revoke all on function public.create_call_slot(timestamptz),
  public.delete_call_slot(uuid), public.list_available_call_slots()
  from public, anon, authenticated;
grant execute on function public.create_call_slot(timestamptz),
  public.delete_call_slot(uuid) to authenticated;
grant execute on function public.list_available_call_slots() to anon, authenticated;

commit;
