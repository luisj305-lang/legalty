# Portal foundations

This folder contains a pure case-read policy and an isolated Next.js application. Existing invited accounts can sign in and sign out locally. Eligible users can open the authenticated case summary and case-detail routes, which read only their session-scoped, RLS-authorized case rows; users who have not met the security prerequisites remain setup-pending. Freshly authorized administrators can also create cases by choosing participants from an administrator-only directory of registered profiles; the selected exact emails are still resolved through the existing atomic RPC, and private PDFs can be attached optionally (see "Case documents" and "Case participant directory"). Initial password change remains mandatory, while authenticator enrollment is temporarily optional for every role. Payment modules are not enabled, and there is no document list, download, or visibility-toggle UI.

## Application quick start

Use Node.js 24 or newer. Dependencies and generated output stay under `portal/web`; the root website package is unchanged.

Exact direct dependency versions and the generated npm lockfile are included with the application source. Use `ci` rather than reconstructing dependencies from an interrupted installation. Local tests, typecheck, production build, and the HTTP smoke harness passed; visual/browser verification remains pending.

```sh
npm.cmd --prefix portal/web ci
npm.cmd --prefix portal/web run test
npm.cmd --prefix portal/web run typecheck
npm.cmd --prefix portal/web run build
npm.cmd --prefix portal/web run start
```

Set `NEXT_TELEMETRY_DISABLED=1` for local checks. `dev` and `start` bind to loopback. For production builds run locally, explicitly set `PORTAL_ORIGIN` to the exact intended origin, such as `http://127.0.0.1:3000`. Production mutations without a configured origin are denied; only HTTPS or explicitly configured loopback HTTP origins are accepted. Development defaults to `http://127.0.0.1:3000`. Never derive this setting from request Host headers.

Sign-in uses the ignored public Supabase URL/publishable-key configuration. The pure parser still validates syntax only; the server factory consumes it and uses no privileged keys. Missing configuration denies sign-in. Keep `.env*` untracked and never introduce service-role credentials into the application.

After building, `node portal/web/tests/smoke.mjs` starts/stops a scoped ephemeral loopback server with explicit origin and empty provider settings. It checks logged-out redirects for protected routes, native multipart form submission, generic sign-in failure, foreign-origin rejection, and the absence of legacy operational routes without provider calls. Parent live verification confirmed both requested accounts reach setup-pending and lose protected access after local logout; future live checks still require separately supplied transient credentials. Browser visual QA is unavailable.

### Session and profile prerequisites (ODD-03d.1)

`web/lib/supabase/server.ts` constructs a fresh SSR client per request. The Next.js proxy refreshes cookies, propagates every cookie/cache header, and prevents caching auth responses. Login/account use native server-action forms, fixed local redirects, generic errors, and exact-origin validation. Logout uses local session scope, not other devices. Cookies are HTTP-only and SameSite=Lax, with Secure enabled for the configured HTTPS origin. Provider requests disable caching and have a ten-second deadline.

`accountAccess` validates identity through `getUser`, then freshly selects only that identity's `profiles` row with the session client. Proposed profile columns are `id`, `role`, `active`, and `must_change_password`; migrations/RLS are not installed by this slice. Missing/error/malformed profiles, inactive users, required rotation, or assurance other than AAL1/AAL2 remain setup-pending. A temporary global policy accepts AAL1 or AAL2 for client, staff, and admin roles; provider metadata never grants roles. `eligible` means prerequisites passed, not blanket case access or operational authorization. The case list and detail routes additionally rely on session-scoped RLS; other operational modules remain absent.

## Run the checks

```sh
node --test portal/tests/access-policy.test.cjs
npm.cmd test
```

The first command checks this policy. The existing root test script does not discover the portal tests; run both commands until a later authorized integration changes the runner.

## Contract

Import `canReadCase(principal, caseFile)` and `canReadRecord(principal, caseFile, record)` from `domain/access-policy.cjs`. Both return a boolean without changing inputs. Missing or invalid required fields deny access, including for administrators.

| Input | Required fields |
|---|---|
| Principal | `id`: identifier; `role`: exactly `admin`, `staff`, or `client`; `active`: exactly `true` |
| Case | `id`: identifier; `staffIds` and `clientIds`: identifier arrays, possibly empty |
| Record | `id`: identifier; `caseId`: exact case identifier; `visibility`: exactly `internal` or `client`; `clientIds`: explicit audience |

Use plain data objects with their own required fields. Identifiers are nonempty strings with no leading/trailing whitespace; comparisons are exact and never coerced or case-folded. Arrays must contain only valid identifiers, including no sparse entries. Supply trusted serialized data, not executable getters or proxies.

| Role | Case access | Record access |
|---|---|---|
| Admin | Any valid case | Any valid record belonging to that case |
| Staff | Listed in `staffIds` | Any valid record in their assigned case |
| Client | Listed in `clientIds` | Only `client` records explicitly listing their ID in the record audience |

An `internal` record requires an empty audience. A `client` record requires at least one audience member, and every audience ID must currently belong to the case. An inconsistent or obsolete audience denies the entire record even for staff/admin; repair it through separately authorized maintenance rather than relaxing read checks. Sharing a case does not share another client's private record. Unknown visibility never becomes public.

## Required server integration, still pending

The policy does not authenticate identities or make browser-provided roles trustworthy. Future server adapters must authenticate the session and fetch fresh active status, roles, assignments, client links, and record metadata from trusted persistence for each protected request. Do not accept these fields from request bodies or authorize from stale cached relationships. Revocation is reflected only when callers supply the current state.

Apply authorization before exposing list results, details, exports, or document bytes. Write permissions, audit trails, session lifecycle, storage privacy, and concurrency/transaction handling are not implemented here. Tests of this isolated function do not prove endpoint security.

## Deployment and rollback

### Staged test identities (operator-only)

`scripts/bootstrap-test-users.mjs` is restricted to project `tzgqcwnachuvzikxrozi` and the two approved identities. It is not an application endpoint. Set `SUPABASE_CLI_PATH` to the authorized official CLI executable; create mode additionally requires `LEGALTY_BOOTSTRAP_PASSWORD` injected into the process environment. Never put passwords in commands, files, screenshots, or logs.

```sh
node --test portal/tests/bootstrap-test-users.test.mjs
node portal/scripts/bootstrap-test-users.mjs inspect tzgqcwnachuvzikxrozi
```

Inspection uses the authorized CLI session to obtain a transient service-role key, reads all bounded pages, and prints only the two requested emails, desired roles, and safe states. It never writes. After independent review and operator authorization, replace `inspect` with `create` to create only missing identities. Existing conflicting identities block all creation; no password reset or metadata update is performed. Any uncertain creation/readback stops immediately: inspect read-only before deciding what to do, never blindly rerun create. Partial accounts are not automatically deleted.

New users have confirmed email without an invitation send, with `desired_role`, `active: false`, and `must_change_password: true` in app metadata. These are staging intent, **not enforced account disablement, authorization, or password-change enforcement**. Sign-in reaches setup-pending only. Trusted profiles, password rotation, and application authorization remain required before operational access; authenticator enrollment is temporarily optional for every role.

API contracts: [official Admin implementation](https://github.com/supabase/auth-js/blob/master/src/GoTrueAdminApi.ts) and [Auth REST specification](https://github.com/supabase/auth/blob/master/openapi.yaml). This script uses POST `/admin/users`, paginated GET `/admin/users`, and direct GET readback; it never calls invite, recovery, update, or delete endpoints. Remote provisioning is not proven by mocked tests and is pending parent execution.

Deployment to the separate legalty-portal project is now authorized; the parent owns remote operations. Release is blocked until a dry-run proves that `.env*` and `*.dpapi` files are excluded. The repository currently serves a static root; do not place private documents, credentials, or real client data here. Establish and verify a separate private runtime and deployment exclusions before release. Ignore rules alone are not access control.

Rollback the application foundation independently by reverting `portal/web/` and its README/task entries. Preserve the policy. Rollback the earlier policy unit independently through its policy/test files and related documentation. Neither unit changes the public website. Full authentication and provider integration remain pending.

## Trusted profiles SQL

`supabase/migrations/202609260001_trusted_profiles.sql` creates only trusted profiles: explicit client/staff/admin role, inactive/rotation-required defaults, Auth-user FK, and authenticated own-row SELECT. Clients and anonymous users cannot write any table or column. Reading setup flags before MFA does not grant operational access. There is no metadata trigger, automatic provisioning, activation, or business schema.

Local proof uses the downloaded Supabase Postgres 17.6.1.167 image, including its real Auth schema/roles, in `legalty-profiles-sql-test` with `--network none` and **no published ports**. Use Docker exec, not a connection URL. The prior CLI-created container remains stopped: CLI startup overrode the bridge default and exposed all interfaces. Do not restart it.

```powershell
# First application to the dedicated fresh local fixture only:
powershell.exe -NoProfile -File portal/supabase/test-local.ps1 -ApplyMigration
# Repeat tests without replaying the one-time migration:
powershell.exe -NoProfile -File portal/supabase/test-local.ps1
```

The runner refuses networked/port-published containers and executes pgTAP through psql with ON_ERROR_STOP. It rejects SQL errors, failed TAP assertions, or a missing final plan. Synthetic identities and profile fixtures roll back. This proves SQL-role/RLS behavior, not hosted Auth, API exposure, MFA, or password-rotation enforcement. The worker does not run remote migrations. Rollback requires a separately reviewed migration; never drop a populated profile table automatically.
## Password setup boundary

`/portal/setup/password` verifies the session and exact origin, validates matching passwords (12 characters minimum, 72 UTF-8 bytes maximum), and calls session-scoped `auth.updateUser`. Only a confirmed response for the verified identity permits the isolated server completion capability to clear that same profile's rotation flag. It never changes role or active status. The page freshly reads completion and never grants operational access.

This unit introduces a server-only `SUPABASE_SECRET_KEY` capability, unlike the public-key-only sign-in unit. It is not provided by this change. Missing configuration fails before password mutation. Only a modern secret key and the fixed LEGALTY Supabase URL are accepted; no persisted session, auto-refresh, browser import, public env name, generic admin RPC, or credential logging. The privileged key bypasses RLS: deployment must inject it solely into the server runtime and tightly restrict access. Never put it in an environment file uploaded to Vercel or in frontend build configuration.

Provider update and profile completion are not atomic. If completion fails, the password may already have changed; generic guidance asks the user to sign in again and use a different new password or contact staff. There is no automatic retry, account activation, role change, reset email, or SQL trigger. MFA/reauthentication restrictions can deny the provider update. Real password changes and hosted completion remain untested; all new tests use synthetic boundaries.

## Authenticator setup

`/portal/setup/mfa` remains available as an optional security feature and lists only the verified session's TOTP factors. Explicit POST enrollment returns a QR image to that account; GET never enrolls. The QR stays in browser component memory, not storage or logs, and is rendered as an encoded SVG image, never inline HTML. Verification rechecks factor ownership, calls challengeAndVerify, then verifies identity and AAL2 before redirecting to the account.

Existing verified factors can be challenged from AAL1, including before password changes. No factor removal, automatic retries, admin bypass, profile activation, or business access is introduced. An abandoned unverified factor blocks duplicate enrollment; users who lost its QR need operator assistance (no automatic deletion). Real authenticator enrollment requires the human account owner's device; automated proof uses synthetic providers and logged-out HTTP only. Reference: https://supabase.com/docs/guides/auth/auth-mfa/totp .

## Case read foundation

The second migration adds cases and separate client/staff links. Case description and next action are client-visible; never store internal notes there. Migration 004 temporarily changes the shared role helper to accept AAL1 or AAL2 for every valid role while retaining fresh trusted-profile, activation, and password-rotation checks. Admins see all; staff remain limited to assigned cases; clients remain limited to linked cases and only their own membership, not other participants. Private SECURITY DEFINER helpers use an empty search_path and have no PUBLIC/anon execution or arbitrary user-ID argument, avoiding recursive membership policies.

Apply once to the local isolated fixture with `test-local.ps1 -ApplyCases`; repeat all SQL tests with `test-local.ps1`. The local image has auth.uid but no auth.jwt helper, so assurance reads the same trusted request.jwt.claims PostgreSQL setting directly. This assumes the API establishes verified JWT context; do not expose arbitrary SQL/session-setting RPCs.

No case writes are granted by migration 002. Validated create/update RPCs, participant-role validation, immutable audit and transaction tests arrive in migration 003. No real case data or hosted migration was used. Revert only this local schema/test unit; never drop populated remote tables without a reviewed data-preservation plan.

## Case writes and audit

Migration 003 grants authenticated execution of `create_case` (active admin), `update_case` (active assigned staff/admin), and `find_case_participant` (admin exact-email and trusted client/staff role, at most one row). Migration 004 temporarily permits those existing role boundaries at AAL1 or AAL2. Migration 005 preserves the update signature and permissions while checking the trusted role and assignment scope before acquiring the target case row lock, then revalidates scope after locking. Actor IDs come only from Auth context. Create validates unique nonempty client links, bounded arrays and actual participant roles; inactive participants may be linked but cannot read until separately activated. Profile row locks stabilize authorization during writes. Direct table writes remain denied.

Migration 006 adds administrator-only participant management without profile browsing: `get_case_participants` returns only the IDs, emails, and trusted roles currently linked to one exact case, while `replace_case_participants` atomically replaces canonical client/staff sets after deterministic profile locks and stale expected-set validation. Replacement accepts 1–100 unique clients and 0–100 unique staff, preserves inactive-participant linking behavior, returns `false` without timestamp or audit changes for a no-op, and otherwise appends one safe `updated` audit row naming only `clients` and/or `staff`. PUBLIC and anonymous execution remain revoked; only authenticated sessions may invoke the RPCs, and fresh trusted administrator authorization is still enforced inside each function.

Each successful write appends an atomic internal audit entry with actor, operation, timestamp and field names, not sensitive content snapshots. Audit SELECT is scoped to assigned staff/admin, and direct insertion/update/delete are denied; a trigger also rejects update/delete. The private schema is not exposed through PostgREST, so future audit UI needs a separately scoped read RPC. Database owners remain able to administer the database; this is application-level immutability, not tamper-proof external storage.

`/portal/cases/new` is an administrator-only native form. Its server action rejects foreign origins, unknown or duplicate fields, malformed and over-limit inputs, and non-admin sessions before writes. It resolves each selected client or optional staff email through `find_case_participant`, validates the returned UUID/email/role, and calls `create_case` only after every participant resolves. The client and staff fields are multi-selects populated from the administrator-only candidate directory (see below), not free-text entry; the submitted payload is still the same newline-separated exact-email contract.

`/portal/cases/[id]/edit` is available only to an administrator or staff member whose session-scoped RLS query can read that case. The case UUID is bound from the server-rendered route, never a submitted identity field. The operational action freshly rechecks trusted access and case visibility before calling `update_case`; it accepts only title, client-visible description, the four database statuses, and next action.

Fresh administrators additionally receive a separate participant form populated only through `get_case_participants`. Returned rows and every exact-email lookup are validated before one `replace_case_participants` call with canonical expected IDs bound from the rendered state. The form has no profile search or autocomplete and submits no case ID, role, or expected IDs. Assigned staff retain the operational form but never receive participant emails or assignment controls. No-op replacement is successful; stale sets and provider/database failures share generic guidance. Role changes, internal notes, audit UI, and remote validation remain out of scope.

Apply migration 006 once to the existing isolated fixture with `test-local.ps1 -ApplyParticipantManagement`, then use `test-local.ps1` for all suites. Tests force audit insert failures and prove case updates and participant replacements roll back. Lock-order tests deterministically inspect installed function definitions; they prove authorization statement order but not live concurrent wait timing. No remote application was performed for migration 006.

After migrations 001-003 already exist, apply migrations 004–006 with their explicit switches in order. For a separately provisioned fresh, networkless, no-port local container, pass `-Container <name> -ApplyMigration -ApplyCases -ApplyWrites -ApplyMfaPolicy -ApplyUpdateLockOrder -ApplyParticipantManagement` to exercise 001→006; the same container safety checks still apply. Migrations 004–006 are forward-only. Restoring staff/admin AAL2 or replacing either participant RPC requires a new forward migration; never edit or delete applied migration history.

## Case documents (ODD-07a)

`/portal/cases/new` lets an eligible administrator attach **1–5 private PDFs** while creating a case. PDFs are internal by default; there is no list, download, or client-visibility UI in this unit.

**Why direct-to-storage.** Vercel Functions cap the request body at 4.5 MB, so file bytes must never travel through a Next.js Server Action or route handler. Only small JSON metadata crosses the server boundary. The browser uploads directly to Supabase Storage.

**Signed-upload flow.**

1. `beginCaseUpload(payload)` Server Action (no bytes) validates the exact origin, admin access, case fields, participant emails (via `find_case_participant`), and document metadata (1–5 files, 1–10 MB each, ≤25 MB total, non-empty names ≤255 chars). It calls `create_case`, then `begin_case_documents` to insert one `pending` row per document, then `storage.from('case-documents').createSignedUploadUrl(objectKey)` for each server-derived key.
2. The browser uploads each file directly to its signed URL with the public Supabase URL and publishable key only (`uploadToSignedUrl`). No service key is ever exposed.
3. `finalizeCaseDocument(documentId)` Server Action rechecks admin access, downloads the object with the session client, and validates the real bytes (`%PDF-` signature, size 1–10 MB, exact recorded size). Success marks `stored`; failure removes the object and marks `failed`.

If any storage step fails after the case is created, the case stays created and the affected document remains `pending`/`failed` until a safe retry; the UI never reports success for a failed upload.

**Storage and schema.** Migration `202609260007_case_documents.sql` creates the fixed private bucket `case-documents` (`public=false`, `file_size_limit=10485760`, `allowed_mime_types=array['application/pdf']`) with administrator-only `insert`/`select`/`delete` policies on `storage.objects`. Metadata lives in `public.case_documents` with RLS enabled and **no direct grants** to `public`/`anon`/`authenticated`; access is only through the SECURITY DEFINER RPCs `begin_case_documents`, `get_case_document`, and `finalize_case_document`. Every RPC requires an active administrator, derives object keys server-side, and appends exactly one row to the append-only `portal_private.document_audit`.

Apply migration 007 forward-only to the authorized project. The pgTAP Storage/RLS proof in `portal/supabase/tests/case-documents.test.sql` is **deferred to that authorized remote project**: the local SQL harness has no genuine `storage` schema, so it is never run or represented as local Storage proof.

## Case participant directory (migration 009)

`/portal/cases/new` no longer asks administrators to type exact participant emails. The page calls `participantDirectory()` (`portal/web/lib/cases/server.ts`), which is administrator-only, gates through `caseAdminAccess`, and degrades to empty lists on any provider or parse failure so the page never throws. The form renders the client and staff candidates as accessible multi-selects: each option value is the exact email and the label is `Name — email` when the profile has a display name, otherwise the email, with `(inactivo)` appended for inactive profiles. At least one client selection is required client-side, the server action remains authoritative, and the exact-email payload contract (`find_case_participant` -> `create_case`) is unchanged.

Migration `202610030009_case_participant_directory.sql` adds `public.list_case_candidates(expected_role text)`, a `stable security definer` function with an empty `search_path`. It requires a fresh trusted administrator (`42501` otherwise), accepts only `client` or `staff` (`22023` otherwise, including `null`), and returns `id`, `email`, a nullable display name, and `active`, ordered by name with nulls last then email, capped at 1000 rows. PUBLIC, anon, and authenticated direct access is revoked with explicit `revoke all`, and only `authenticated` receives `execute`. This is a new admin-only read surface and is forward-only.

Migration `202610030010_profile_name_phone.sql` adds the two optional `public.profiles` columns the directory now uses. `name` is text with a `profiles_name_length_check` constraint (`null`, or 1-120 characters after `btrim`); `phone` is text with a `profiles_phone_length_check` constraint (`null`, or 1-32 characters after `btrim`). The table-level `SELECT` grant to `authenticated` already covers the new columns, `profiles_read_own` RLS still returns only the caller's own row, and no `INSERT`/`UPDATE`/`REFERENCES` column privilege is granted to `anon`/`authenticated`. **`phone` is stored but is never returned by any listing RPC and is never rendered in the portal UI.**

Migration `202610030010_profile_name_phone.sql` also `create or replace`s `list_case_candidates` so the display name is the stored `public.profiles.name` verbatim (a `null`/blank name stays `null`) instead of a guess from Auth user metadata, and it never selects `phone`. The admin-only `42501` guard, the `client`/`staff` `22023` guard, the nulls-last then email ordering, the 1000-row cap, and the function `revoke all`/`grant execute` to `authenticated` are unchanged from migration 009. The function still returns the same `table(id uuid, email text, name text, active boolean)` signature, so the `find_case_participant` -> `create_case` exact-email contract is untouched.

`portal/web/lib/cases/directory.ts` is the pure `parseCandidates` validator (UUID id, valid exact email, `string | null` name, boolean active, no duplicate ids or emails, 1000-row cap) and `portal/web/tests/case-directory.test.ts` covers it. The migration pgTAP proof in `portal/supabase/tests/case-participant-directory.test.sql` now asserts stored-name behavior with Auth metadata deliberately set to a different value (function existence, grants, admin access, client/staff/anon denials, invalid role, requested-role filtering, stored name, null stored name despite metadata, active flag) and passed `1..16`. `portal/supabase/tests/profiles.test.sql` also asserts the new columns reject `anon`/`authenticated` writes, reject empty/whitespace-only/over-long values, and accept null, trimmed, and boundary-length values; it passed `1..85`. Both suites ran green with `docker exec ... psql -v ON_ERROR_STOP=1` against the running local `supabase_db_legalty-portal-sql` fixture after applying only `202610030010_profile_name_phone.sql`. Migration 010 was not applied to any remote project and nothing was deployed.

## Participant multi-select (search, chips, accessible listbox)

`/portal/cases/new` renders the client and staff candidate lists with a reusable, dependency-free `MultiSelect` (`portal/web/app/portal/cases/new/multi-select.tsx`, `'use client'`) instead of a plain native `<select multiple>`. It shows the current selection as removable chips (`Name — email`, plus `(inactivo)` for inactive profiles), filters candidates from an in-control search box, and presents results in an accessible listbox (`role="combobox"` plus `role="listbox"`/`role="option"` with `aria-selected` and `aria-activedescendant`, ArrowUp/ArrowDown/Enter/Escape/Backspace keyboard support, and outside-click dismissal). The pure filtering and toggle logic lives in `portal/web/lib/cases/selection.ts` and is covered by `portal/web/tests/case-selection.test.ts`. The submission contract is unchanged: the component renders one hidden `<input name="clientEmails" | "staffEmails" value={email}>` per selected candidate, so the form still posts the same exact-email payload (`find_case_participant` -> `create_case`) and the client-side zero-client pre-check is preserved. No server action, SQL, RPC, validation rule, or dependency changed. There is no browser/visual proof of the new control; it is proven by focused tests, typecheck, and build only.

## Profile contacts (migration 011)

> **Superseded for names by migration 012.** The single `name` field described in this section is split into `first_name`/`last_name`, and the two RPC signatures change; see "Profile names and client provisioning (migration 012)" below. The migration-011 records remain accurate for that migration.

`/portal/cases/clients` is an administrator-only screen ("Clientes y equipo") that lists every registered profile with its Auth email, stored name, phone, role and active flag, and lets an administrator set the `name` and `phone` of one profile at a time. It is reached from the `Clientes` link in the case sidebar, which is now rendered only for administrators through `navItems(role)` in `portal/web/lib/cases/nav.ts` (the page itself was already admin-gated by `caseAdminAccess()`); non-administrators are redirected by `caseAdminAccess()`. The screen edits **only** `name` and `phone` — role, active and `must_change_password` are never editable here — and it renders a simple saved/error banner from `searchParams`.

Migration `202610030011_profile_contacts.sql` adds two administrator-only, `security definer`, empty-`search_path` RPCs. `public.list_profile_contacts()` requires a fresh trusted administrator (`42501` otherwise) and returns `id`, `email`, `name`, `phone`, `role`, `active` for every profile joined to `auth.users`, ordered by role, then name with nulls last, then email, capped at 1000 rows. `public.update_profile_contact(target_profile uuid, new_name text, new_phone text)` also requires an active administrator (`42501`), rejects a null or unknown target with `22023`, rejects a name over 120 characters or a phone over 32 characters after `btrim` with `22023`, and stores the trimmed values (a blank value clears the field to `null`). It updates only `name` and `phone`. Both functions `revoke all` from `public, anon, authenticated` and `grant execute` only to `authenticated`; anonymous users have no execution.

**`phone` stays administrator-only.** It is returned by `list_profile_contacts()` (admin-only) but is never returned by `list_case_candidates` and is never rendered in the case-creation participant selector, which still shows only `Name — email` (or the email when the name is null). The exact-email participant payload contract, RLS, auth, storage, and the documents flow are unchanged.

`portal/web/lib/cases/contacts.ts` is the pure/server-safe module: `parseProfileContacts` validates the RPC rows (UUID id, exact valid email, `string | null` name/phone, role in `client`/`staff`/`admin`, boolean active, unique ids, 1000-row cap) and `submitProfileContact` validates the exact origin, a single UUID `id`, a name of at most 120 code points and a phone of at most 32 (blank becomes `null`), requires admin access, calls the provider `updateProfileContact`, and always returns one fixed local destination (`/portal/cases/clients?saved=1` or `?error=1`). `profileContacts()` in `lib/cases/server.ts` degrades to an empty list on any provider or parse failure. `portal/web/tests/case-contacts.test.ts` covers both functions.

**Local proof only.** Migration 011 was applied forward-only to the running local `supabase_db_legalty-portal-sql` fixture with `docker exec ... psql -v ON_ERROR_STOP=1`, and `portal/supabase/tests/case-profile-contacts.test.sql` passed `1..38` (function existence and grants, admin list/update, trimmed storage, role/active/`must_change_password` untouched, blank and null clearing, over-long and unknown-target `22023`, client/staff/anon `42501`, anon no execute). From `portal/web`: focused `node --test tests/case-contacts.test.ts` 11/11, `npm test` 170/170, `npm run typecheck` exit 0, `npm run build` exit 0 (dynamic `/portal/cases/clients`). From the repository root: `node --test tests/*.test.cjs` 5/5 and `git diff --check` exit 0 (pre-existing CRLF warnings only). No remote project was migrated, nothing was deployed, and no end-to-end authenticated UI proof is claimed.

## Profile names and client provisioning (migration 012)

`portal/supabase/migrations/202610030012_profile_names_and_client_provision.sql` is forward-only and supersedes the single `profiles.name` column added by migration 010:

- Adds `first_name` and `last_name` (nullable `text`, each with a `profiles_first_name_length_check` / `profiles_last_name_length_check` of `null` or 1-120 characters after `btrim`), copies any existing `profiles.name` into `first_name`, then drops `name`.
- `create or replace`s `list_case_candidates(text)` with the **same signature** `table(id uuid,email text,name text,active boolean)`, the same admin-only `42501` and role `22023` guards and the same ordering/cap, but composes the display name from `nullif(btrim(coalesce(first_name,'') || ' ' || coalesce(last_name,'')),'')` and still never returns `phone`.
- Drops and recreates `list_profile_contacts()` as `table(id uuid,email text,first_name text,last_name text,phone text,role text,active boolean)` (admin-only, ordered by `role`, then `last_name nulls last`, then `first_name nulls last`, then `email`, cap 1000) and `update_profile_contact(target_profile uuid,new_first_name text,new_last_name text,new_phone text)` (admin-only `42501`, target must exist `22023`, first/last/phone each `null` or bounded after trim `22023`, stores trimmed-or-null, updates only those three columns).
- Adds `provision_client_profile(target_user uuid,client_first_name text,client_last_name text,client_phone text)`, `security definer set search_path=''`, admin-only (`42501`), null target rejected (`22023`), names/phone length-validated (`22023`), target must **not** already have a profile (`23505`), and inserts `(id=target_user, role='client', active=true, must_change_password=true, first_name, last_name, phone)`. The `auth.users` FK requires the invited user to exist first, so the RPC runs after the invitation.
- Every created or replaced function `revoke all` from `public, anon, authenticated` and `grant execute` only to `authenticated`.

`portal/web/lib/cases/contacts.ts` now models `ProfileContact` as `{ id; email; first_name; last_name; phone; role; active }`; `parseProfileContacts` validates the split nullable fields and `submitProfileContact` validates and forwards `first_name` (<=120), `last_name` (<=120) and `phone` (<=32). The contacts screen edits **only** those three fields; role, active and `must_change_password` are never editable from the UI.

### Create a client and send an invitation

`/portal/cases/clients` gains a "Crear cliente" form (email, Nombres, Apellidos, Telefono). Its server action builds a `CreateClientSource` and calls `submitCreateClient` (`portal/web/lib/cases/create-client.ts`), the pure server-safe orchestration module:

1. `portal/web/lib/supabase/admin-users.ts` (`inviteClient`) is the **only** new server-only `SUPABASE_SECRET_KEY` capability. It validates the modern secret-key syntax and the fixed LEGALTY URL exactly like `password-completion.ts`, builds a non-persisting client, and calls `client.auth.admin.inviteUserByEmail(email, { redirectTo: `${PORTAL_ORIGIN}/portal/invite` })`. It returns the created user id only for a valid UUID and never exposes or logs the key.
2. After the invite succeeds, the administrator's **session** client calls `provision_client_profile`, so the database's trusted-admin guard applies; the secret key is never used for the RPC.
3. Outcomes are fixed local destinations: `?created=1` only after both steps succeed; `?error=create` for origin/input/access/invite failures; `?pending=profile` when the invite succeeded but provisioning failed. The invited user is **never** auto-deleted and the UI never claims full success for a pending profile.

Validation: exact origin, admin only, a single exact email (<=254), required `first_name` and optional `last_name` (<=120 each), optional `phone` (<=32, matching the `profiles_phone_length_check` column bound), and unknown or duplicate keys rejected before any provider call. **Note:** the task brief mentioned `phone <=160` for the create module; the implementation uses **32**, because `public.profiles.phone` is constrained to 1-32 and `provision_client_profile` rejects anything longer with `22023`, so a wider client-side bound would guarantee a provisioning failure. This is a deliberate, reported deviation.

### Invitation acceptance

`/portal/invite` (`app/portal/invite/page.tsx` plus the `InviteAccept` client component) reads the Supabase invite tokens from the URL (`#access_token`/`refresh_token`, or PKCE `?code=`), calls the `establishInviteSession` server action, and on success routes to `/portal/setup/password`. The action uses the request-scoped `serverClient(true)`: `auth.setSession({ access_token, refresh_token })` for implicit tokens or `auth.exchangeCodeForSession(code)` for PKCE, accepts only bounded opaque values, never logs them, and fails closed with an honest message when they are missing or invalid. The existing login flow is unchanged.

**Email dependency.** The invitation is sent by Supabase Auth, so end-to-end proof needs real mail delivery, a reachable `/portal/invite` redirect URL and hosted Auth configuration. None of that runs locally, and the adapter is proven only by unit tests with a synthetic `invite` source. The real email invite and the real invited-session establishment are **not** verified end to end.

**Local proof only.** Migration 012 was applied forward-only to the running local `supabase_db_legalty-portal-sql` fixture with `docker exec ... psql -v ON_ERROR_STOP=1` (exit 0). The affected pgTAP suites then passed: `case-profile-contacts.test.sql` `1..64`, `case-participant-directory.test.sql` `1..17`, `profiles.test.sql` `1..95` (all updated for the split columns and `provision_client_profile`), plus unchanged `case-reads.test.sql` `1..48` and `case-writes.test.sql` `1..80`, all exit 0 with zero `not ok`. From `portal/web`: focused `node --test tests/create-client.test.ts` 10/10 and `tests/case-contacts.test.ts` 11/11, `npm test` 181/181, `npm run typecheck` exit 0, `npm run build` exit 0 with the dynamic `/portal/invite` route present. From the repository root: `node --test tests/*.test.cjs` 6/6 and `git diff --check` exit 0 (pre-existing CRLF warnings only). No remote project was migrated, nothing was deployed, and no end-to-end authenticated email/UI proof is claimed.
