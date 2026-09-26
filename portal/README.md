# Portal foundations

This folder contains a pure read-authorization policy and an isolated Next.js application foundation. The application currently shows an invitation-only, access-unavailable landing, not a working login or dashboard. No runtime consumer uses the policy yet.

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

Set `NEXT_TELEMETRY_DISABLED=1` in the command environment for local checks. `dev` and `start` bind to loopback. After building, `node portal/web/tests/smoke.mjs` starts its own loopback server, checks the landing and an absent private route, and stops that process.

No environment configuration is needed for this landing. The pure `parsePublicConfiguration` helper accepts only an HTTPS origin and a modern `sb_publishable_` key; it returns null on missing or malformed settings. Legacy JWT keys are intentionally unsupported. This is syntax validation, not verification of a project/key, identity, or authorization. It is not wired to the page, reads no environment by itself, and never connects to Supabase. Even valid settings do not enable login. Keep local `.env*` files untracked and never put service-role keys in public settings.

Next: implement trusted session adapters, invitations, staff MFA, schema/RLS policies, and private storage after resolving their operating constraints. The static-root exclusion blocker still prevents release. This app has no payment or document access capabilities.

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

New users have confirmed email without an invitation send, with `desired_role`, `active: false`, and `must_change_password: true` in app metadata. These are staging intent, **not enforced account disablement, authorization, or password-change enforcement**. The portal still has no working sign-in. Trusted profiles, sessions, application authorization, and staff MFA remain required before operational access.

API contracts: [official Admin implementation](https://github.com/supabase/auth-js/blob/master/src/GoTrueAdminApi.ts) and [Auth REST specification](https://github.com/supabase/auth/blob/master/openapi.yaml). This script uses POST `/admin/users`, paginated GET `/admin/users`, and direct GET readback; it never calls invite, recovery, update, or delete endpoints. Remote provisioning is not proven by mocked tests and is pending parent execution.

No deployment is authorized. The repository currently serves a static root; do not place private documents, credentials, or real client data here. Establish and verify a separate private runtime and deployment exclusions before release. Ignore rules alone are not access control.

Rollback the application foundation independently by reverting `portal/web/` and its README/task entries. Preserve the policy. Rollback the earlier policy unit independently through its policy/test files and related documentation. Neither unit changes the public website. Full authentication and provider integration remain pending.
