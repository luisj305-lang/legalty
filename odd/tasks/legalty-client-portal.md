# Legalty client portal and internal operations

Build connected client and staff experiences while preserving the current public website. This is the single ODD implementation and recovery document; the application stack is user-approved, while schema, operating constraints, and full architecture remain incomplete.

## Status and next action

- ODD-01: draft prepared; parent structural readback passed; foundation commit `f59cbbd` (141 additions); architecture remains incomplete.
- ODD-03a: isolated read policy implemented, independently verified, and committed as 0cdf01c. ODD-03 and the remaining main tasks remain incomplete.
- ODD-03b: application foundation independently verified and committed as `8a99a4a`; visual browser QA remains pending, non-blocking for this scoped foundation.
- ODD-03c: requested Auth identities staged and independently verified; commit `85165fd`. Next: ODD-03d real SSR sign-in/logout with setup-pending access only; trusted profiles, MFA, password rotation, and operational dashboards remain pending.
- Engram mirror: maintained by parent persistence under `odd/legalty-client-portal/tasks`, including this full document and repository-relative locator.

## Objective, problem, and scope

Clients need secure access to their cases, documents, activity, appointments, messages, services, and one-time payments. Staff need the corresponding operational tools, not a disconnected administrative mockup. A static public website cannot itself enforce these access boundaries.

The first release includes client and internal dashboards, identity and access, clients and professionals, cases and assignments, stages and next actions, private documents, communications, appointments, service requests, payment reconciliation, and audit history. Existing visual concepts guide presentation, not business rules or permissions.

Out of initial scope: subscriptions, native mobile apps, advanced electronic signatures, integrated video calls, legal AI automation, and full accounting.

### Authorization and preservation

- User authorized beginning local ODD implementation of both portal and internal panel; initial documentation is followed by a bounded pure-domain authorization work unit; login and provider integration remain pending.
- Local feature work and Conventional Commits are in scope. User additionally authorized the separate Free Supabase project `tzgqcwnachuvzikxrozi` in `us-east-1`, organization LEGALTY, and the two test Auth identities specified in ODD-03c. Use only its authorized official CLI session and transient project key for that operation. No paid changes or unrelated-project operations are authorized.
- A separate empty Vercel project exists; no deployment occurred. Push, PR creation, merge, deployment, and any broader remote or credential use remain outside current authorization.
- ODD-03d continuation authorizes local sign-in development, read-only retrieval of this project's public URL/publishable key through the existing authorized CLI session, and an ignored `portal/web/.env.local` containing only those public values. Real sign-in tests may use the two existing requested accounts with transient test credentials; no resets, provider configuration, migrations, privileged admin operations, or general release. Preserve the existing DPAPI-protected secret unread.
- Preserve the root static site. Do not bundle its existing uncommitted changes or untracked tests/assets into portal commits.
- Recorded base: `master` at `b198daa6e0e19c52cbf799bfa947443bc0fe4d50`; recheck current state before branching or staging.
- Never store actual private client documents, secrets, or production data under the static root or in this task document.
- Technical artifacts use English; product copy follows the existing site language unless explicitly changed.

## Approved stack and implementation boundaries

Use an authenticated application with client and internal interfaces, a server-side application layer, relational persistence, private document storage, and isolated payment/notification adapters. Keep authorization and business rules independent of presentation and provider callbacks.

| Boundary | Responsibility and acceptance |
|---|---|
| Public website | Existing pages remain unaffected; link to the portal only after an authorized release. |
| Client interface | Display only linked cases and explicitly client-visible information; responsive and keyboard-accessible. |
| Internal interface | Operate cases, assignments, clients, documents, stages, communications, appointments, services, and payments within role scope. |
| Application server | Validate identity, authorization, input, and state transitions on every request; never trust hidden UI controls. |
| Relational store | Maintain relationships, constraints, durable reconciliation state, and transactional changes. |
| Private storage | Deny public access; authorize every upload/download and use bounded access where supported. |
| External adapters | Separate provider-specific payment and delivery protocols from domain rules. |

The user approved Next.js with TypeScript, Supabase Auth, Supabase PostgreSQL with row-level security, private Supabase Storage, and a separate Vercel project. One application supplies distinct client and staff interfaces. Clients enter by invitation; staff accounts require MFA. These are approved requirements, not implemented authentication or database controls.

Application-server authorization must be backed by matching RLS policies; existing pure-domain tests are not evidence of database enforcement. Provider adapters remain separate from domain rules. Managed providers reduce operational work but introduce provider dependencies. Infrastructure still has costs despite one-time client billing.

Before production: resolve database schema and lifecycle constraints, production budget, retention, independent document backups and restore drills, notification channel, and deployment exclusions. Supabase database backups do not include Storage objects. The later narrow remote authorization above supersedes the original local-only scope; it does not authorize deployment or operational access.

Verified reference sources supplied by the parent:
- [Next.js authentication](https://nextjs.org/docs/app/guides/authentication): server-side authentication and authorization boundaries.
- [Supabase server clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client): later server/browser integration.
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security): database enforcement.
- [Supabase backups](https://supabase.com/docs/guides/platform/backups): database and file backup boundaries.
- [Vercel monorepos](https://vercel.com/docs/monorepos): independent application projects.

### Proposed domain model

| Entity or relationship | Purpose |
|---|---|
| Account, role, client profile, staff profile | Separate login identity from business participants and privileges. |
| Case, case-client link, staff assignment | Support multiple clients per case and explicit staff ownership; no single-client shortcut. |
| Stage history, next action, activity | Track progress, responsibility, dates, and client-visible versus internal-only information. |
| Document metadata and access scope | Reference private objects with case ownership, visibility, and upload/access history. |
| Message thread and appointment | Associate participants and case context; keep internal communications separate. |
| Service, request, order, payment attempt | Separate requested work, agreed amount/currency, and provider payment lifecycle. |
| Provider event, reconciliation record | Persist authenticated event handling, deduplication, processing status, and recovery. |
| Audit event | Record actor, action, target, time, and safe change context for sensitive operations. |

These are draft concepts, not a completed schema. Define lifecycle transitions and database constraints during ODD-01 follow-through before migrations.

### Permission contract

| Actor | Allowed scope |
|---|---|
| Administrator | Manage identities, assignments, and operational records; sensitive actions remain audited. |
| Professional/staff | Access explicitly assigned cases and needed linked client information; no global access by default. |
| Client | Access explicitly linked cases and only their permitted client-visible records; no staff notes or other clients' private data. |
| Provider callback | No interactive user privileges; authenticated, narrowly scoped payment processing only. |

Use deny-by-default server enforcement for lists, detail reads, search, writes, exports, and document access. Case membership does not automatically expose every participant's private information. Role changes, revoked assignments, and removed client links must take effect on subsequent protected requests.

### Payment and privacy invariants

- Payments are one-time service payments, not subscriptions. A browser redirect is never proof of payment.
- Authenticate provider events, retrieve authoritative payment state as required, validate order/amount/currency, and reconcile durably and idempotently. Test duplicates, out-of-order events, timeouts, retries, failures, refunds, and interrupted processing.
- Existing service IDs: `invertir`, `planificacion-financiera`, `patrimonio`, `jubilacion`. Prices are currently null and currency is unconfirmed; no payable order until commercial values are established.
- COP amounts and personal names in mockups are illustrative, not pricing, currency, or customer-data authority.
- Audit sensitive changes without logging secrets or unnecessary document/message contents. Define retention, deletion, backup access, and recovery requirements before production use.
- `.vercelignore` currently does not exclude `odd/`, `portal-conceptos/`, or future portal folders. Fix and verify the deployment boundary before any deployment; private materials must never rely solely on ignore rules.

## Work units and acceptance

Every task remains unchecked until its outcome, applicable checks, and work-unit commit are recorded. Each delegated writer owns its bounded preparation and implementation; tasks may be subdivided into coherent work units without losing these stable IDs.

| ID | Deliverable and acceptance checks | Dependencies | Route and trigger |
|---|---|---|---|
| ODD-01 | Architecture, model, permissions, threats, and recovery plan. Stack approved; schema, operating constraints, and commercial values remain unresolved. Finalize necessary choices before dependent implementation. | None | Delegated: design analysis and writing preparation. |
| ODD-02 | Internal overview, clients, cases, documents, and payments designs, aligned with client concepts. Validate role-specific empty/error/loading states, mobile layout, and keyboard flows. | 01 | Delegated: coordinated multi-screen design. |
| ODD-03 | Login, recovery, session handling, and roles. Prove unauthorized access, privilege escalation, revoked access, and cross-client requests fail server-side. | 01 | Delegated: multiple non-trivial files and security logic. |
| ODD-04 | Internal clients, professionals, cases, client links, and assignments. Prove multiple-client cases and assignment-scoped CRUD without data leaks. | 02, 03 | Delegated: related domain, persistence, and UI changes. |
| ODD-05 | Case stages, responsibility, activity, and next actions. Test valid/invalid transitions and separation of internal and client-visible history. | 04 | Delegated: state transitions across server and UI. |
| ODD-06 | Client dashboard and case tracking. Verify displayed state matches authorized internal updates and unrelated cases remain inaccessible. | 02, 05 | Delegated: integrated client views and authorization tests. |
| ODD-07 | Private document upload/download and traceability. Test ownership, visibility, revoked access, unsafe uploads, and non-public object access. | 04, 06 | Delegated: storage, authorization, and UI integration. |
| ODD-08 | Messages, notifications, and appointments. Verify participant scope, delivery failures/retries, timezone handling, and internal-only content isolation. | 04, 06 | Delegated: multi-feature domain and adapter work. |
| ODD-09 | Catalog, requests, one-time payments, and receipts. Confirm prices/currency first; exercise reconciliation invariants and client/staff payment views. | 03, 04, 06 | Delegated: external-payment boundary and durable state. |
| ODD-10 | Audit, security, accessibility, monitoring, and recovery hardening. Run access matrix, mobile/keyboard, privacy/logging, backup/restore, and deployment-exclusion checks. | 03–09 | Delegated: cross-cutting verification and corrections. |
| ODD-11 | Initial data preparation and controlled release validation. Use approved data only; require migration rollback, end-to-end acceptance, and separate remote/deployment authorization. | 10 | Delegated: coordinated migration and release checks. |

### Completion ledger

- [ ] ODD-01 — draft prepared; structural readback passed; foundation commit: `f59cbbd`; final architecture decisions pending.
- [ ] ODD-02 — pending; commit: none.
- [ ] ODD-03 — ODD-03a pure policy writer-verified; policy commit 0cdf01c; independent verification passed; authentication remains pending.
- [ ] ODD-04 — pending; commit: none.
- [ ] ODD-05 — pending; commit: none.
- [ ] ODD-06 — pending; commit: none.
- [ ] ODD-07 — pending; commit: none.
- [ ] ODD-08 — pending; commit: none.
- [ ] ODD-09 — pending; commit: none.
- [ ] ODD-10 — pending; commit: none.
- [ ] ODD-11 — pending; commit: none.

## Verification and delivery policy

- Strict TDD: enabled by current user instructions, overriding obsolete OpenSpec configuration. For behavior changes, record observed RED, then GREEN, then REFACTOR; never infer a failing test or substitute mockups for proof.
- Known runner: `npm.cmd test`; parent-supplied baseline: 5 tests passed. `npm test` failed under PowerShell execution policy; use the explicit `.cmd` runner. Baseline tests do not prove a future portal implementation.
- Foundation documentation: parent structural readback passed. ODD-03a functional checks are recorded below; runtime harness N/A because no runtime boundary or consumer exists. Browser checks remain pending for later UI work.
- Current RDD authority: parent elevated `gentle-ai review mode status --cwd C:\projects\legalty` returned `on` from global configuration, exit 0, before ODD-03d. Earlier sandbox off/error output is historical, not current authority. Do not change the switch; use native assessment, candidate consent, and provider-issued continuations for the next applicable candidate. No review approval is implied by enabled mode.
- Forecast: several thousand authored additions plus deletions across the full feature. Known work-unit authored subtotal: 697, excluding intervening progress-bookkeeping commits: foundation `f59cbbd` (141), access policy `0cdf01c` (222), application foundation `8a99a4a` (334). The last commit additionally contains 1,400 generated lockfile lines, excluded from authored count. Reconcile bookkeeping before reporting the complete branch total.
- Delivery strategy: `ask-on-risk`. Chain strategy: `feature-branch-chain`, explicitly accepted by the user. Tracker: `feature/legalty-client-portal`; slice 1: `feature/portal-01-foundation` targets tracker; slice 2: `feature/portal-02-access-policy` targets slice 1; slice 3: `feature/portal-03-app-foundation` targets slice 2, starting at `24a41db`. No remote PR creation or merge is authorized.
- Slice 4: `feature/portal-04-test-identities`, based on `8a99a4a`, targets `feature/portal-03-app-foundation`. ODD-03c commit `85165fd`: 319 authored changes, plus subsequent progress bookkeeping.
- Slice 5: `feature/portal-05-sign-in`, based on `bb1516c`, targets `feature/portal-04-test-identities`. ODD-03d forecast: 350–400 authored changes, generated lockfile changes counted separately. Preserve the feature-branch chain; remote PR creation remains unauthorized.
- Approximately 400 authored lines per task is a planning heuristic, not a cap. Never omit tests, compress code, or split inseparable behavior to meet it. Keep PR delivery boundaries and any required exceptions explicit.
- Branch before work-unit commits on the default branch. Stage only owned paths after reviewing the diff; never sweep existing public-site changes or untracked assets/tests into a commit.
- Each completed work unit carries behavior, tests, and relevant docs together; use Conventional Commits with no `Co-Authored-By` or AI attribution.
- Record exact commands/results, runtime scenarios, commit IDs, authored counts, slice boundaries, and assessed review outcomes as they occur. No receipt or approval is claimed by this document.

## Recovery and rollback

Before resuming, retrieve project/feature memory and its full observation, read this file, and reconcile both with current requirements and repository evidence. Preserve conflicting edits and valid completed work; mirror the entire updated document after each task.

Foundation rollback: revert only its task-document changes if authorized. Access-policy rollback: revert only the three new portal files named below and their progress entries; no runtime consumer, public-site change, configuration, dependency, or remote operation belongs to this unit.

Next unresolved decisions: schema and operating constraints before persistence/authentication integration; payment prices/currency before checkout; authorized deployment destination/session before remote release.

## Bounded next work unit: ODD-03b application foundation

- [x] ODD-03b: isolated Next.js App Router application with strict TypeScript, its own package and generated lock under `portal/web/`; commit `8a99a4a`. No login capability is claimed.
- Route: delegated writer, because app configuration, behavior, tests, and UI span multiple non-trivial files. Strict TDD comes from current user instructions.
- Scope: `portal/web/`, a scoped README update, and this document. Root package, static site, existing policy, dirty/untracked files, and preexisting `.vercelignore` remain untouched.
- UI acceptance: honest Spanish invitation/access-unavailable landing in navy and silver; no fake login form, invented records, private data, or implied authenticated access.
- Configuration acceptance: if a Supabase configuration parser is introduced, missing or malformed configuration fails closed; tests precede implementation. No SDK calls, remote provisioning, or external authentication in this slice.
- Local hygiene: scoped `.gitignore` excludes build output, dependencies, and local environment files. No secrets or real client data enter the repository.
- Planned checks: observed RED then GREEN for configuration behavior with Node tests; `npm.cmd --prefix portal/web run test`, `npm.cmd --prefix portal/web run typecheck`, `npm.cmd --prefix portal/web run build`, `node --test portal/tests/access-policy.test.cjs`, and `npm.cmd test`.
- Runtime proof: start the built app on loopback, smoke-check HTTP and unavailable-access content, then stop only the scoped process. Browser verification remains pending until available. No external authentication requests.
- Delivery forecast: approximately 250–380 authored changes for this slice, excluding the generated lockfile; record the actual count and report heavier scope rather than compressing code or omitting tests.
- Rollback: remove only this slice's new `portal/web/` files and related README/task entries; retain the existing access policy and public site.
- Release blocker: root static deployment exclusions remain unverified; do not deploy or modify the preexisting `.vercelignore` in this unit.
- Status: closed as a bounded foundation after recovery, independent verification, parent spot check, and commit `8a99a4a`. Visual/browser QA remains pending and non-blocking for this scoped unit; it remains required for later UI acceptance.

### ODD-03b historical partial evidence (superseded by recovery below)

- Recovery authorized: resume only the existing application foundation; diagnose registry/package availability, perform one bounded installation, pin dependencies and generate the lock, then run all local checks. No account provisioning, authentication implementation, credentials, or deployment in this slice. Preserve previous RED evidence and partial files.

- Created an isolated App Router landing, strict TypeScript configuration, public-configuration syntax parser, four Node tests, and a scoped loopback smoke harness. No SDK, authentication, environment access, or provider calls were added.
- Verified npm registry versions: Next.js 16.3.6, React 19.3.0, TypeScript 7.0.2. Exact lockfile and type-package pins remain pending because installation did not complete; compatibility is not yet build-proven.
- RED: initial test harness lacked module mode, corrected with package `type: module`; then `npm.cmd --prefix portal/web run test` failed with `ERR_MODULE_NOT_FOUND` before parser implementation. Later assertion-level RED: embedded newline URL was silently normalized, 3 passed / 1 failed. Parser now rejects whitespace; GREEN 4/4, zero failures.
- Regression: `node --test portal/tests/access-policy.test.cjs` passed 9/9; `npm.cmd test` passed 5/5. No website/policy source changes.
- Install: sandbox registry access failed EACCES; approved escalated install fetched metadata and small tarballs but stalled over ten minutes on remaining downloads. Scoped shell PID 3092 and descendants 3580/17292 were terminated with confirmed success. No fallback version or blind retry. Partial ignored dependency directories may remain.
- `npm.cmd --prefix portal/web run typecheck` and `npm.cmd --prefix portal/web run build`: both failed because `next` is not installed/recognized. Runtime blocked by incomplete installation. Browser verification pending. The smoke harness is authored but unexecuted; no screenshots or UI correctness claimed.
- Next: complete isolated installation and lockfile, run all planned checks and independent verification, then parent review/commit. Root static release-exclusion blocker remains unchanged.

### ODD-03b recovery verification

- Resolved exact direct versions from the registry: Next 16.3.6, React/React DOM 19.3.0, TypeScript 7.0.2, Node types 24.19.0, React/React DOM types 19.3.0. Added `portal/web/package-lock.json` (generated, excluded from authored count).
- Bounded install completed in 10 seconds, but first build failed with invalid Win32 SWC error 193. One clean `npm.cmd ci --prefix portal/web --no-fund --fetch-retries=0 --fetch-timeout=30000` completed in approximately two minutes, with 28 packages and zero reported vulnerabilities. Native compiler then loaded and the unchanged Turbopack build passed. No downgraded packages or bundler workaround.
- Final checks, all exit 0: `npm.cmd --prefix portal/web run test` 4/4; `npm.cmd --prefix portal/web run typecheck`; `npm.cmd --prefix portal/web run build` (production static `/` and not-found routes); `node portal/web/tests/smoke.mjs` (HTTP 200, Spanish unavailable/invitation notice, no forms, absent private route 404, scoped process stopped); `node --test portal/tests/access-policy.test.cjs` 9/9; `npm.cmd test` 5/5.
- Next.js normalized TypeScript configuration before final verification, adding JavaScript allowance and development-generated type inclusion; strict mode remains enabled. All checks disabled framework telemetry through process environment.
- No new application behavior changed during recovery. Earlier RED/GREEN evidence remains applicable. Root packages, website files, access policy, credentials, and provider accounts were not modified or inspected.
- Parent-reported independent verification passed: `npm.cmd --prefix portal/web run test` 4/4, `npm.cmd --prefix portal/web run typecheck`, and `node portal/web/tests/smoke.mjs`. Parent spot check passed 4/4 application tests. Commit: `8a99a4a`, 334 authored changes plus 1,400 generated lockfile lines.
- Native assessment unavailable because untracked inventory declaration was required; RDD status printed off but returned an authority-ownership error. No native review or receipt claimed; independent verification supplied the separate check.
- Remaining: browser visual QA (non-blocking for scoped foundation); authentication/accounts and cloud connection are separate work. Static-root release exclusion remains a deployment blocker.

## Bounded next work unit: ODD-03c staged test identities

- [x] ODD-03c: bootstrap independently verified and parent-provisioned identities read back successfully; commit `85165fd`. Staged identities do not yet grant operational portal access.
- Route: delegated writer; bootstrap behavior, tests, and documentation span multiple non-trivial files. Dependencies: completed ODD-03b and the explicit narrow remote authorization above.
- Implemented files: `portal/scripts/bootstrap-test-users.mjs`, `portal/tests/bootstrap-test-users.test.mjs`, scoped `portal/README.md` updates, and this document. No application source or dependencies changed.
- Destination: only Free Supabase project `tzgqcwnachuvzikxrozi`, `us-east-1`, organization LEGALTY. No SUSOTECH or other-project mutation; no paid changes, deployment, or email sends.
- Requested identities: `david@legalty.com` with desired administrator role and `goofypet@gmail.com` with desired client role. Create missing identities only; do not reset existing passwords or silently change existing metadata.
- Use official supported admin APIs; obtain the project key through the authorized official CLI session, retain it transiently in process, and never print or persist credentials or the supplied password in files, tests, logs, or memory.
- New identities receive `app_metadata.desired_role` and `active: false` as explicit staging intent only. Metadata is not an authorization source; it does not itself disable provider authentication or enforce administrator permissions.
- No working portal sign-in or operational access is claimed before trusted profiles, session validation, and required staff MFA are implemented. Missing trusted profiles must fail closed in the eventual application.
- Strict TDD: observe RED with `node --test portal/tests/bootstrap-test-users.test.mjs` before source implementation, then GREEN and REFACTOR. Use synthetic credentials only in tests; no live provisioning during automated tests.
- Acceptance tests cover exact-project restriction, duplicate-safe lookup, missing-user creation, preservation of existing identities, inactive staging metadata, sanitized output/errors, and partial failures. Never serialize raw provider errors or credential-bearing requests.
- Exact remote smoke sequence: sanitized duplicate read, create each missing requested user, then sanitized direct readback of exact email and staging metadata. Report existing-user conflicts or partial outcomes without resets or blind retries.
- Record each observed result without keys, passwords, access tokens, or raw response bodies. Provisioning proof is actual sanitized remote readback, not a mocked test or successful process exit alone.
- Local regression checks: `node --test portal/tests/access-policy.test.cjs`, `npm.cmd --prefix portal/web run test`, and `npm.cmd test`; independent verification and parent spot check remain required as applicable.
- Forecast: 200–350 authored additions plus deletions; slice 4 uses the already selected feature-branch chain. Browser checks N/A for this non-UI bootstrap; existing foundation visual QA remains pending.
- Rollback: revert only new bootstrap code/tests and scoped documentation changes. Preserve existing accounts; deleting any newly created remote identity requires explicit authorization. Do not remove a partially created account automatically.

### ODD-03c writer evidence

- REST contract verified against official Supabase Auth OpenAPI and `auth-js/GoTrueAdminApi.ts`: paginated list and direct user readback; POST admin creation confirmed in the official client source. No SDK dependency added.
- RED: `node --test portal/tests/bootstrap-test-users.test.mjs` exited 1 with `ERR_MODULE_NOT_FOUND` before bootstrap source existed (module-load RED, not assertion-level RED).
- GREEN: initial suite passed 7/7; bounded-pagination and uncertain-readback coverage expanded final suite to 9/9, exit 0. Synthetic mock credentials only; no real network or CLI session in tests.
- Final regressions all exit 0: `node --test portal/tests/access-policy.test.cjs` 9/9; `npm.cmd --prefix portal/web run test` 4/4; `npm.cmd test` 5/5.
- Bootstrap pins the HTTPS project host, rejects redirects, bounds each request/CLI call to 15 seconds and listing to 100 pages of 100. Duplicate/repeated pages, existing metadata conflicts, malformed results, and missing credentials fail closed before mutation. Creation attempts are never retried; uncertain POST or direct readback stops with safe partial states.
- Password accepted only through the operator process environment in CLI use, omitted from the child CLI environment; key retrieval stdout stays transient. Results contain only fixed requested identities, desired roles, and safe state/reason strings. No raw exceptions, provider bodies, passwords, or keys are printed/persisted.
- Remote execution and provisioning proof remain pending parent review. No live inspect/create invocation was run. Staging flags do not enforce provider account disablement or operational privileges; real sign-in, profile authorization, MFA, and password-change enforcement remain unimplemented.

### ODD-03c parent verification and provisioning

- Independent verifier passed 9/9 bootstrap tests plus synthetic cross-page duplicate, malformed identity, and malformed credential-loader checks. Parent repeated the 9/9 test suite successfully.
- Authorized read-only preflight returned both requested identities missing. A single create invocation returned both created, with direct provider readback for each. A separate subsequent inspect returned both existing with the expected staging flags; all three commands exited 0.
- Only LEGALTY project `tzgqcwnachuvzikxrozi` was touched. No email, password reset, paid change, deployment, or SUSOTECH mutation occurred. Temporary password and project key were not written to repository files.
- Native assessment remains unavailable due to untracked inventory; no native review or receipt claimed. Independent verification supplied the separate check. Commit `85165fd` contains 319 authored changes; operational login and actual role enforcement remain future work.

## Bounded next work unit: ODD-03d real sign-in with setup-pending access

- [ ] ODD-03d: working Supabase SSR sign-in/logout locally, with an honest setup-pending account page and no operational dashboards. Plan prepared; source, checks, native review, and commit pending.
- Approved slice boundary: ODD-03d.1 implements request-scoped SSR/cookie adapters and verified-identity/fresh-profile access checks with unit tests only; no reachable login/proxy/UI yet. ODD-03d.2 will add login/account/actions/proxy/logout and HTTP tests on a child branch after parent review/commit. Security tests remain with the behavior they verify; ODD-03d stays incomplete until the complete runtime flow is proven.
- [ ] ODD-03d.1: writer-verified adapters and access prerequisites; parent assessment/review/commit pending. ODD-03d.2 not started.
- Route: delegated writer; session handling, server actions, adapters, UI, and tests span multiple non-trivial files. Dependencies: ODD-03b application foundation and ODD-03c existing identities. No user selection widget or public signup.
- Planned scope under `portal/web/`: `lib/supabase/server.ts`, `lib/supabase/proxy.ts`, root `proxy.ts`, `lib/auth/access.ts`, login/account routes and actions, focused tests, package dependencies/lock, and scoped README; update this recovery document. Preserve public-site files, bootstrap accounts, and unrelated changes.
- Verify current official `@supabase/ssr` cookie refresh and server-client patterns before implementation. Validate identity with `getUser`; do not authorize from unverified session payloads or `app_metadata`/`user_metadata` roles.
- Read the authenticated user's trusted profile freshly with the session-scoped client. Missing table/profile, read error, inactive account, required password change, or insufficient required assurance must deny operational access. Require AAL2 for staff/administrator access; no operational routes are introduced in this unit even when checks pass.
- Keep the existing strict `sb_publishable` public configuration parser. Verify available public keys; never introduce a service-role/secret key into the application, environment file, build, browser, or logs. A missing supported public key blocks dependent live checks rather than relaxing validation.
- Preserve secure SSR cookie propagation and logout clearing. Use fixed local redirects, server-action origin checks, generic invalid-sign-in messages, and no cookie/session/credential logging or raw provider error output. No email sends or password-reset flow.
- UI: existing Spanish navy/silver presentation, labeled email/password fields, accessible errors, and clear setup-pending explanation after verified sign-in. Distinguish successful authentication from operational authorization.
- Strict TDD from user instructions: `npm.cmd --prefix portal/web run test` must show observed RED before behavioral source changes, then GREEN and REFACTOR. Cover identity failure, missing/error/inactive profiles, required password change, required AAL2, metadata spoofing, fixed redirects, origin rejection, and sanitized failures.
- Required local checks: `npm.cmd --prefix portal/web run test`, `npm.cmd --prefix portal/web run typecheck`, `npm.cmd --prefix portal/web run build`, and the scoped loopback smoke harness. Run existing access-policy and root regression suites; record exact outcomes, never infer success.
- Runtime acceptance: logged-out account route denies access/redirects locally; invalid sign-in has a generic error; both authorized real test accounts can authenticate only into setup-pending state; logout removes protected access. Credentials stay transient, with no resets or privileged API use. Stop only the scoped local server.
- Browser checks: verify keyboard submission, readable labels/errors, mobile layout, and no exposed credentials; disclose unavailable visual checks rather than claim screenshots or completed QA.
- Forecast: 350–400 authored additions plus deletions, advisory for task planning. If scope grows, make one coherent slicing pass with tests/docs alongside behavior before commit; never omit checks or compress code to hit the budget. PR exceptions require explicit approval.
- Rollback: revert only this slice's application/dependency/docs changes and, if authorized, remove its ignored public-config file. Preserve existing remote identities, the DPAPI secret, prior portal foundations, and the public website.
- Follow-ups only, not authorized for remote application in this unit: ODD-03e trusted profiles SQL/RLS; ODD-03f enforced password change; ODD-03g staff MFA. No migration or provider configuration changes now. Operational access remains blocked until applicable follow-up controls are implemented and verified.

### ODD-03d.1 writer evidence

- Verified registry versions and installed exact `@supabase/ssr` 0.12.7 and `@supabase/supabase-js` 2.117.2 in the isolated application; generated lock updated. Bounded install completed in 16 seconds, 39 packages audited, zero reported vulnerabilities.
- Official SSR documentation and installed types confirm `setAll` receives both cookie mutations and response cache headers. The request factory preserves the complete bridge; actual Next.js response/proxy wiring is deliberately deferred to 03d.2. Provider requests use no-store and a ten-second timeout.
- RED observed twice through `npm.cmd --prefix portal/web run test`: missing access module (4 pass/1 fail), then missing SSR adapter module (9 pass/1 fail), before each implementation. These are module-load failures, not assertion-level RED. GREEN grew to 15/15 after implementation and coverage expansion.
- Final checks all exit 0: application tests 15/15; typecheck; production build; current landing HTTP smoke (200, no forms, private route 404, scoped server stopped); combined policy/bootstrap tests 18/18; root tests 5/5. No real credentials, live authentication, or remote data/profile request was used.
- `accountAccess` calls verified `getUser`, freshly reads only `profiles.id` matching that identity, and never uses provider role metadata. Profile shape/active/rotation failures stay setup-pending; staff/admin require AAL2. An eligible result is not case authorization and no operational routes exist.
- Existing landing/smoke expectations remain correct for 03d.1 because no login/UI/proxy is reachable yet. Real-account sign-in/logout, invalid-login HTTP behavior, cookie refresh response integration, origin checks, and browser QA remain acceptance work for 03d.2. No source/dependency changes outside the portal or credential/DPAPI access.

## Bounded next work unit: ODD-03a access policy

- [x] ODD-03a: pure deny-by-default case and record read policy independently verified; commit 0cdf01c. No authentication endpoint or database access yet.
- Route: delegated writer (multiple non-trivial files); independent verification required if native assessment is unavailable.
- Scope: new portal/domain/access-policy.cjs, portal/tests/access-policy.test.cjs, portal/README.md, plus this progress document. No existing website files, package files, or payment APIs changed.
- Checks: observed RED then GREEN with node --test portal/tests/access-policy.test.cjs; existing regression suite npm.cmd test; parent spot check and independent read-only verification.
- Trust boundary: future server adapter must resolve identity/roles/links from trusted persistence on every request; the pure function does not authenticate browser data or secure any endpoint by itself.
- Rollback: remove only the new portal policy/tests/readme and corresponding progress entries; no runtime consumer exists yet.
- Vendor selection does not block this isolated policy contract; ODD-01 and ODD-03 as a whole remain incomplete.

### ODD-03a evidence and handoff

- Branch: `feature/portal-02-access-policy`, based on foundation `f59cbbd`; tracker `feature/legalty-client-portal` at `b198daa`. Parent supplied branch/commit facts; writer performed no Git mutation.
- Implemented `canReadCase` and `canReadRecord`: active recognized principals, assigned staff, linked clients, matching cases, explicit record audiences, internal-only isolation, and fail-closed malformed inputs. No input coercion or mutation.
- An audience containing a removed or unrelated client invalidates the whole record, including admin/staff reads. Future maintenance must repair stale metadata with separate write authorization.
- RED: `node --test portal/tests/access-policy.test.cjs` exited 1 before source existed: `MODULE_NOT_FOUND`, 0 passed / 1 failed. This is module-load RED, not assertion-level RED.
- GREEN: same command passed 9/9 after implementation, with 0 failures.
- REFACTOR: clarified malformed-visibility test construction and added inherited-principal denial coverage; same command passed 9/9 again, with 0 failures.
- Regression: `npm.cmd test` passed 5/5 with 0 failures both after implementation and after test cleanup. Root test discovery does not include portal tests; run both commands.
- Runtime harness: N/A, isolated pure function with no routes or runtime consumer. UI/browser checks: pending and outside this unit. Identity/session security is not established by these tests.
- Independent verification passed: 9/9 portal tests, 5/5 existing tests, 2,048 independent matrix combinations plus 31 malformed/null-prototype checks. Parent spot check passed 9/9; hashes of 15 existing files were unchanged. Native assessment unavailable (untracked inventory declaration required); no native review/receipt claimed. Implementation commit: 0cdf01c, 213 additions + 9 deletions = 222 authored changes. Final progress bookkeeping is a separate documentation commit in the same slice.
- No deployment authorized; static-root exclusion and private runtime must be verified before release, and no real client data may be added here.
