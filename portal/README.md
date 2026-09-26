# Portal foundations

This folder contains a pure case-read policy and an isolated Next.js application. Existing invited accounts can sign in and sign out locally. Eligible users can open the authenticated case summary and case-detail routes, which read only their session-scoped, RLS-authorized case rows; users who have not met the security prerequisites remain setup-pending. Freshly authorized administrators can also create cases through exact-email participant lookup and the existing atomic RPC. Initial password change remains mandatory, while authenticator enrollment is temporarily optional for every role. Document and payment modules are not enabled.

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

`/setup/password` verifies the session and exact origin, validates matching passwords (12 characters minimum, 72 UTF-8 bytes maximum), and calls session-scoped `auth.updateUser`. Only a confirmed response for the verified identity permits the isolated server completion capability to clear that same profile's rotation flag. It never changes role or active status. The page freshly reads completion and never grants operational access.

This unit introduces a server-only `SUPABASE_SECRET_KEY` capability, unlike the public-key-only sign-in unit. It is not provided by this change. Missing configuration fails before password mutation. Only a modern secret key and the fixed LEGALTY Supabase URL are accepted; no persisted session, auto-refresh, browser import, public env name, generic admin RPC, or credential logging. The privileged key bypasses RLS: deployment must inject it solely into the server runtime and tightly restrict access. Never put it in an environment file uploaded to Vercel or in frontend build configuration.

Provider update and profile completion are not atomic. If completion fails, the password may already have changed; generic guidance asks the user to sign in again and use a different new password or contact staff. There is no automatic retry, account activation, role change, reset email, or SQL trigger. MFA/reauthentication restrictions can deny the provider update. Real password changes and hosted completion remain untested; all new tests use synthetic boundaries.

## Authenticator setup

`/setup/mfa` remains available as an optional security feature and lists only the verified session's TOTP factors. Explicit POST enrollment returns a QR image to that account; GET never enrolls. The QR stays in browser component memory, not storage or logs, and is rendered as an encoded SVG image, never inline HTML. Verification rechecks factor ownership, calls challengeAndVerify, then verifies identity and AAL2 before redirecting to the account.

Existing verified factors can be challenged from AAL1, including before password changes. No factor removal, automatic retries, admin bypass, profile activation, or business access is introduced. An abandoned unverified factor blocks duplicate enrollment; users who lost its QR need operator assistance (no automatic deletion). Real authenticator enrollment requires the human account owner's device; automated proof uses synthetic providers and logged-out HTTP only. Reference: https://supabase.com/docs/guides/auth/auth-mfa/totp .

## Case read foundation

The second migration adds cases and separate client/staff links. Case description and next action are client-visible; never store internal notes there. Migration 004 temporarily changes the shared role helper to accept AAL1 or AAL2 for every valid role while retaining fresh trusted-profile, activation, and password-rotation checks. Admins see all; staff remain limited to assigned cases; clients remain limited to linked cases and only their own membership, not other participants. Private SECURITY DEFINER helpers use an empty search_path and have no PUBLIC/anon execution or arbitrary user-ID argument, avoiding recursive membership policies.

Apply once to the local isolated fixture with `test-local.ps1 -ApplyCases`; repeat all SQL tests with `test-local.ps1`. The local image has auth.uid but no auth.jwt helper, so assurance reads the same trusted request.jwt.claims PostgreSQL setting directly. This assumes the API establishes verified JWT context; do not expose arbitrary SQL/session-setting RPCs.

No case writes are granted by migration 002. Validated create/update RPCs, participant-role validation, immutable audit and transaction tests arrive in migration 003. No real case data or hosted migration was used. Revert only this local schema/test unit; never drop populated remote tables without a reviewed data-preservation plan.

## Case writes and audit

Migration 003 grants authenticated execution of `create_case` (active admin), `update_case` (active assigned staff/admin), and `find_case_participant` (admin exact-email and trusted client/staff role, at most one row). Migration 004 temporarily permits those existing role boundaries at AAL1 or AAL2. Migration 005 preserves the update signature and permissions while checking the trusted role and assignment scope before acquiring the target case row lock, then revalidates scope after locking. Actor IDs come only from Auth context. Create validates unique nonempty client links, bounded arrays and actual participant roles; inactive participants may be linked but cannot read until separately activated. Profile row locks stabilize authorization during writes. No direct table writes or reassignment endpoint.

Each successful write appends an atomic internal audit entry with actor, operation, timestamp and field names, not sensitive content snapshots. Audit SELECT is scoped to assigned staff/admin, and direct insertion/update/delete are denied; a trigger also rejects update/delete. The private schema is not exposed through PostgREST, so future audit UI needs a separately scoped read RPC. Database owners remain able to administer the database; this is application-level immutability, not tamper-proof external storage.

`/cases/new` is an administrator-only native form. Its server action rejects foreign origins, unknown or duplicate fields, malformed and over-limit inputs, and non-admin sessions before writes. It resolves each newline-separated client or optional staff email through `find_case_participant`, validates the returned UUID/email/role, and calls `create_case` only after every participant resolves.

`/cases/[id]/edit` is available only to an administrator or staff member whose session-scoped RLS query can read that case. The case UUID is bound from the server-rendered route, never a submitted identity field. The action freshly rechecks trusted access and case visibility before calling `update_case`; it accepts only title, client-visible description, the four database statuses, and next action. Failures use fixed local redirects and generic copy. Reassignment, participant changes, role changes, internal notes, and audit UI remain out of scope.

Apply migration 005 once to the isolated fixture with `test-local.ps1 -ApplyUpdateLockOrder`, then use `test-local.ps1` for all suites. Tests force an audit insert failure and prove the case update rolls back. The lock-order tests deterministically inspect the installed function definition; they prove authorization statement order but not live concurrent wait timing. Remote application, reassignment, concurrency stress and external audit retention remain separate work.

After migrations 001-003 already exist, apply the temporary policy and lock correction with their explicit switches in order. For a separately provisioned fresh, networkless, no-port local container, pass `-Container <name> -ApplyMigration -ApplyCases -ApplyWrites -ApplyMfaPolicy -ApplyUpdateLockOrder` to exercise 001→005; the same container safety checks still apply. Migrations 004 and 005 are forward-only. Restoring staff/admin AAL2 or changing the update function again requires new forward migrations; never edit or delete applied migration history.
