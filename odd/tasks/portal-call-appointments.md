# Feature — Public call-appointment booking + admin availability

ODD recovery document. Scope: the client portal (`portal/`) and the public site mirror it serves (`portal/web/public/**`). Not the repo-root legacy site.

## Objective
Let anyone (no account) book a "llamada" appointment by picking an available day + time slot, and give admin/staff a panel to define the available slots. The appointment is recorded **only once the payment is approved** (MercadoPago integration deferred to a later work unit).

## Problem / why
The firm takes calls but has no way to offer bookable time slots or to control which days/times are open. Payment must be settled first, so a booking becomes a real appointment only after payment approval.

## Decisions (user-confirmed)
- Public, no-registration booking.
- Appointment recorded only on payment approval.
- Admin defines DAYS + concrete TIME SLOTS.
- Bookable services: `llamada-30min`, `llamada-45min` (from the site catalog).
- Capacity: 1 appointment per slot.
- Timezone: `America/Bogota`.
- Collected client data: name, email, phone.
- Payment integration deferred.

## Patterns to reuse (from exploration)
- Migrations: `portal/supabase/migrations/YYYYMMDDNNNN_snake.sql`, wrapped `begin; ... commit;`.
- RLS style: `enable row level security` + `revoke all ... from public, anon, authenticated` + explicit `grant` + `security definer` helpers in `portal_private` with `set search_path = ''` + RPC-only writes.
- App: `serverClient(true)` + `accountAccess`; `trustedOrigin(origin, process.env.PORTAL_ORIGIN)` on every mutation.
- Admin gate mirrors `caseAdminAccess` (`portal/web/lib/cases/server.ts`); pure `lib/**` orchestration returning redirect destinations with `?error=`.
- Public mirror pages POST same-origin to thin route handlers under `portal/web/app/api/**`.
- Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `PORTAL_ORIGIN`, `SUPABASE_SECRET_KEY` (server-only).

## Work units
1. **WU1 — Database**: migration `202610030008_call_appointments.sql` — `call_slots` + `call_appointments`, RLS, helpers, RPCs (create/delete slot, public list), SQL tests.
2. **WU2 — Admin panel**: `/portal/calls/availability` (admin/staff) to create/delete slots + `portal/web/lib/calls/availability.ts`.
3. **WU3 — Public booking**: public page listing available slots + `GET /api/call-slots` handler; client selects service + slot.
4. **WU3b — Date/time BEFORE payment**: route the `llamada-30min`/`llamada-45min` purchase through `/citas` (choose slot + contact data) and pass them to `/api/create-preference` (preference `metadata`) so the appointment can be recorded on approval.
5. **WU4 — Payment (deferred)**: record the appointment on payment approval; hold/collision strategy.

## Acceptance
- Migration applies cleanly; RLS proven: anon can read only future unbooked slots (no PII); only admin/staff can create/delete; a booked slot cannot be deleted.
- Admin can create/delete slots.
- Public page lists available slots and lets the client choose one.

## Rollback
Per work unit: revert that unit's files. The migration is forward-only once applied.

## Progress
- [x] WU1 — Database migration + tests. `portal/supabase/migrations/202610030008_call_appointments.sql` + `portal/supabase/tests/call-appointments.test.sql`. Applied locally, **61/61** pgTAP assertions pass. Added `-ApplyCaseDocuments`/`-ApplyCallAppointments` switches to `portal/supabase/test-local.ps1` so the harness applies these migrations on a clean DB. No commit.
- [x] WU2 — Admin availability panel. `portal/web/lib/calls/availability.ts` (pure validation, Bogota UTC-5 conversion), `portal/web/app/portal/calls/availability/{page.tsx,actions.ts}`, `portal/web/tests/call-availability.test.ts`. Portal tests **148/148** pass, typecheck OK. No commit.
- [x] WU3 — Public booking page + endpoint. `portal/web/public/citas.html` + `portal/web/public/assets/js/booking.js`; `GET /api/call-slots` (`portal/web/app/api/call-slots/route.ts`) whitelists `{id, starts_at}`, fails closed, uses only the publishable/anon key; `/citas` rewrite added + `root-runtime.test.ts` updated; entry link added in `portal/web/public/services.html`. Portal tests **159/159**, typecheck OK. Honest: nothing is booked (payment deferred). **Portal copy only** — the repo-root site copy was not touched. No commit.
- [x] WU3b — Date/time BEFORE payment. On `/services`, `llamada-30min`/`llamada-45min` now link to `/citas?servicio=<id>` ("Agendar"); `/citas` collects the slot + contact data (name/email/phone) and POSTs `{serviceId, slotId, clientName, clientEmail, clientPhone}` to `/api/create-preference`, which validates them (only for bookable calls) and attaches them to the MP preference `metadata` + `external_reference`. Non-call services and `llamada-test` keep the direct flow. Root **6/6**, portal **171/171**, typecheck OK; `api/create-preference.js` and the portal mirror stay byte-identical. Deployed 2026-10-03.
- [ ] WU4 — Payment recording (deferred)
- Deploy (2026-10-03): production `legalty-portal` (alias `legalty-portal.vercel.app`) now serves the public site and `/citas` (200) after removing `cleanUrls` from `portal/web/vercel.json` (it conflicted with the Next rewrites → public 404) and updating `root-runtime.test.ts`. `/api/call-slots` returns 503 until migration 008 is applied to the production Supabase; `/portal/calls/availability` redirects to login.
