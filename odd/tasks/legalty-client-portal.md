# Legalty client portal and internal operations

Build connected client and staff experiences while preserving the current public website. This is the single ODD implementation and recovery document; the application stack is user-approved, while schema, operating constraints, and full architecture remain incomplete.

## Status and next action

Current implementation and proof are recorded in the cumulative task sections below. Historical foundation boundaries remain completed; unfinished checklist items remain pending. Engram mirrors this full document under odd/legalty-client-portal/tasks.

## Objective, problem, and scope

Clients need secure access to their cases, documents, activity, appointments, messages, services, and one-time payments. Staff need the corresponding operational tools, not a disconnected administrative mockup. A static public website cannot itself enforce these access boundaries.

The first release includes client and internal dashboards, identity and access, clients and professionals, cases and assignments, stages and next actions, private documents, communications, appointments, service requests, payment reconciliation, and audit history. Existing visual concepts guide presentation, not business rules or permissions.

Out of initial scope: subscriptions, native mobile apps, advanced electronic signatures, integrated video calls, legal AI automation, and full accounting.

### Authorization and preservation

- User authorized beginning local ODD implementation of both portal and internal panel; initial documentation is followed by a bounded pure-domain authorization work unit; login and provider integration remain pending.
- Local feature work and Conventional Commits are in scope. User additionally authorized the separate Free Supabase project `tzgqcwnachuvzikxrozi` in `us-east-1`, organization LEGALTY, and the two test Auth identities specified in ODD-03c. Use only its authorized official CLI session and transient project key for that operation. No paid changes or unrelated-project operations are authorized.
- User now authorizes LEGALTY remote database/Auth/Storage configuration through its existing CLI session and deployment to the separate Vercel legalty-portal project. The parent owns all cloud operations; this worker remains local-only. Push, PR creation, merge, paid changes, and unrelated projects remain out of scope.
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

Before production: resolve database schema and lifecycle constraints, production budget, retention, independent document backups and restore drills, notification channel, and deployment exclusions. Supabase database backups do not include Storage objects. The later narrow remote authorization above supersedes the original local-only scope; the latest release authorization permits the separate portal deployment, not unimplemented operational access.

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

- Official Auth OpenAPI/auth-js REST verified, no SDK dependency. RED bootstrap runner exit1 ERR_MODULE_NOT_FOUND before source; GREEN7 then9/9 expanded pagination/readback. Policy9/9,app4/4,root5/5 regressions exit0. Synthetic tests only; worker did not provision remotely.
- Pinned HTTPS host/no redirects;15s request/CLI limits,100pages of100. Duplicate/repeated/malformed/conflicting identities or missing credentials fail closed before writes. No creation retry after uncertain outcome. Password env-only, withheld from CLI child; transient key stdout, sanitized fixed identities/states only. Staging flags confer no operational authorization. Parent provisioning proof follows.
### ODD-03c parent verification and provisioning

- Independent and parent9/9 bootstrap passed, plus duplicate/malformed cases. Authorized preflight missingboth, one create/directreadback, subsequentinspect existing expectedflags, all0. Only LEGALTY; no email/reset/paid/deploy/SUSOTECH/secret persistence. Commit85165fd319authored; nativeassessment unavailable(untrackedinventory), no receipt. Stagedidentities alone granted no operations.
## Bounded next work unit: ODD-03d real sign-in with setup-pending access

- [ ] ODD-03d: working Supabase SSR sign-in/logout locally, with an honest setup-pending account page and no operational dashboards. Plan prepared; source, checks, native review, and commit pending.
- Approved slice boundary: ODD-03d.1 implements request-scoped SSR/cookie adapters and verified-identity/fresh-profile access checks with unit tests only; no reachable login/proxy/UI yet. ODD-03d.2 will add login/account/actions/proxy/logout and HTTP tests on a child branch after parent review/commit. Security tests remain with the behavior they verify; ODD-03d stays incomplete until the complete runtime flow is proven.
- [x] ODD-03d.1: committed `c1354b9` (279 authored changes plus 128 generated lock changes); parent independent verification passed 15 tests and typecheck. Native risk high; user explicitly declined this candidate only, exact target-scoped decline returned exit 0. Global RDD remains on for later candidates.
- [x] ODD-03d.2: committed `829bd7e` with bookkeeping `5f3903e`; 313 net authored changes. Parent live-account checks and independent 21-test/typecheck verification passed. User explicitly declined this candidate's native review; global RDD remains on. No review approval, business routes, migrations, or deployment.
- ODD-03d.2 writer state: committed after 21/21 spot check and scoped `git diff --check`, both exit 0; candidate review explicitly declined. Visual browser QA is unavailable. Explicit `PORTAL_ORIGIN` accepts canonical HTTPS or configured HTTP 127.0.0.1 for isolated local testing; production without it denies mutations. Development alone defaults to port 3000.
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

- Exact SSR0.12.7/js2.117.2 installed (16s,39 packages,0 audit vulnerabilities). SSR setAll forwards cookies and cache headers; request HTTP uses no-store/10s timeout. No UI/proxy yet in this slice.
- RED twice before modules existed: 4pass/1fail then9pass/1fail; module-load failures. Final15/15, typecheck/build/landing HTTP smoke, policy/bootstrap18/18, root5/5 all exit0. No real credentials/provider calls. Account verification uses getUser then fresh own profile, not metadata; absent/invalid/inactive/rotation pending, staff/admin requireAAL2; eligibility grants no business access. Runtime auth/UI proof deferred to03d.2.
### ODD-03d.2 writer evidence

- Native Spanish login/logout actions, dynamic pending account, exact-origin validation, fixed generic redirects, local logout and proxy cookie/cache propagation. HTTP-only SameSiteLax cookies, Secure on HTTPS; no operational routes.
- RED15pass/1fail missing mutation module, then20pass/1fail origin assertion. GREEN21/21, typecheck/build/HTTP smoke, policy/bootstrap18/18,root5/5 exit0. Fixed test mock cast; preserved occupied3000 service by ephemeral port; used multipart native server-action forms. HTTP proved loggedout307/no-store, invalidlogin303 generic/unreflected, foreignPOST403, business404. No provider calls in automated smoke; server stopped.
- Parent transient real-account proof: both requested accounts login303/account200pending/no-store, logout303/login then account307. Fixed encoding-sensitive harness marker only. No operational access/data/provider mutation/deploy/secrets persisted; visual browser QA unavailable. Candidate review declined; independent21tests/typecheck passed; globalRDD remains on.
## Bounded next work unit: ODD-03e trusted profiles and local SQL proof

- [x] ODD-03e.0: establish an isolated local Supabase database harness under `portal/supabase/`; branch `feature/portal-07-trusted-profiles` from `5f3903e`, targeting slice 6. Current continuation authorizes the local profile migration after SQL RED.
- [x] ODD-03e.1: write failing role-scoped SQL tests before trusted-profile schema/RLS implementation; authorized next in this local continuation.
- [x] ODD-03e.2: run scoped SQL isolation and regression verification; preserve exact SQL outcomes, not mocked authorization claims.
### ODD-03e local SQL verification

- Distinct `legalty-profiles-sql-test` container uses downloaded Postgres17.6.1.167: network none, PortBindings{}, actual auth.users/auth.uid/anon/authenticated roles and pgTAP. SELECT returned postgres/postgres. Old unsafe container remains stopped. No production data or cloud operation.
- SQL RED: test-local.ps1 exit1, missing public.profiles before migration. GREEN: -ApplyMigration exit0, 61 TAP assertions; expanded constraints and reran 63/63 exit0. Fixtures roll back. Node portal suites18/18, app21/21, typecheck all exit0. Build/live HTTP not rerun for SQL-only scope. Commit `9410b9e`: 228 authored changes, 7 scoped files; native review declined by user option 2 for this exact candidate; global RDD stays on.
- Release blocker: parent dry upload included ignored DPAPI file, no upload occurred (memory1395). Next deployment slice must add portal/web/.vercelignore exclusions for .env*, nested .env*, and *.dpapi and assert actual dry-upload inventory excludes them. SQL scope unchanged.
### ODD-03e.0 initial harness evidence

- Docker29.8.0/CLI2.117.0 ready without OS changes. CLI db-start timed out240s then600s; downloaded Postgres17.6.1.167 but exposed0.0.0.0/[::]:55422 despite bridge loopback default. Stopped only supabase_db_legalty-portal-sql, exit0, Exited(0), no ports; preserved image/volume/network. Superseded by verified network-none Docker-exec harness above. No SQL/data/secret operations during initial attempts; root.gitignore untouched. Config/temp ignored. Source: https://supabase.com/docs/reference/cli/supabase-db-start .
## Bounded next work unit: ODD-03a access policy

- [x] ODD-03a: pure deny-by-default case and record read policy independently verified; commit 0cdf01c. No authentication endpoint or database access yet.
- Route: delegated writer (multiple non-trivial files); independent verification required if native assessment is unavailable.
- Scope: new portal/domain/access-policy.cjs, portal/tests/access-policy.test.cjs, portal/README.md, plus this progress document. No existing website files, package files, or payment APIs changed.
- Checks: observed RED then GREEN with node --test portal/tests/access-policy.test.cjs; existing regression suite npm.cmd test; parent spot check and independent read-only verification.
- Trust boundary: future server adapter must resolve identity/roles/links from trusted persistence on every request; the pure function does not authenticate browser data or secure any endpoint by itself.
- Rollback: remove only the new portal policy/tests/readme and corresponding progress entries; no runtime consumer exists yet.
- Vendor selection does not block this isolated policy contract; ODD-01 and ODD-03 as a whole remain incomplete.

### ODD-03a evidence and handoff

- Commit0cdf01c on feature/portal-02-access-policy fromf59cbbd, trackerb198daa;222authored. Deny-default active-role case/record reads, client audience isolation, removed/stale links deny, exact identifiers, malformed/nullprototype safety. REDmissingmodule thenGREEN9/9/refactor9/9;root5/5. Independent9/9+5/5,2048matrix+31malformed, parent9/9,15existingfilehashes unchanged. Pure runtime, no auth/database endpoints. Nativeassessment unavailable(untracked inventory), no receipt. Later units supply actual runtime evidence; root/static release isolation required.
## ODD-11a portal upload boundary

- [x] ODD-11a: delegated isolated upload protection on feature/portal-08-deploy-boundary from f83445d. Before source edits, observe dry inventory RED for the ignored DPAPI file. Add portal/web/.vercelignore and synthetic contract tests outside deployed app; exclude all env/DPAPI/tests/dependency/build-cache files while retaining application source and lockfile.
- Only authorized Vercel dry inventory against legalty-portal project prj_lZmMHPq6OCsfnzXES2FIwywt3geL/susotech, using existing session; no upload, deploy, project mutation, or native review. Never read secret contents. Root website remains outside app cwd.
- Strict TDD; checks: focused Node test, portal regressions, app tests/typecheck, real CLI dry manifest. Rollback only new exclusion/test/docs; removing protection reopens release blocker. Commit and mirror exact proof; parent owns subsequent release.
- Evidence: dry RED included ignored DPAPI envelope; focused test exit1 before exclusions. First fix excluded contents but retained empty tests directory; explicit directory exclusions fixed it. Actual dry GREEN: 19 files, source/lock retained, no env/DPAPI/root website; no upload. Portal21/21 including manifest, app21/21 and typecheck exit0. Commit `84bdc65` (100 authored changes); native review pending parent. Manifest test skips without LEGALTY_DRY_MANIFEST; live proof requires a fresh authorized dry run.
## ODD-03f password setup

- [x] ODD-03f local slice: delegated child feature/portal-09-password-setup from b588840; local password form/action and trusted completion only. No SQL trigger: Auth can rehash/re-encrypt on login, so hash mutation is not rotation evidence. Parent applied profiles migration once (memory1400): four columns, safe defaults, own SELECT, zero rows.
- Architecture change authorized: isolated server-only SUPABASE_SECRET_KEY adapter (missing fails closed), never public env/browser/session client. Verified getUser identity and exact origin precede password+confirmation validation (minimum12). Successful session updateUser must precede privileged update of ONLY matching profile.must_change_password=false, followed by fresh read. No role/active change, submitted identity, generic admin endpoint, key retrieval, actual password reset, remote operation, or automatic activation.
- Completion failure keeps pending with generic guidance; retry may require another different password. UI cannot claim operational access; existing MFA/provider reauthentication errors fail closed. This server attestation adds narrowly encapsulated service privilege because public clients must not write trusted flags; it replaces the unsafe hash-trigger proposal, not public configuration validation.
- Strict TDD: app RED before source, then test/typecheck/build/no-provider HTTP smoke and portal regressions. Forecast300-400 authored; no paid deps. Root/other secrets preserved. Rollback only new setup modules/tests/docs; native review parent-owned, remote rollout separate.
- Local evidence: RED21pass/1fail missing module before source; GREEN27/27. Typecheck/build/no-provider HTTP smoke exit0, including setup logged-out307/no-store and foreignPOST403; scoped server stopped. Portal regressions20pass/1manifest-skip (no fresh remote dry run this unit). Secret not supplied; no real password/key retrieval, remote change, SQL trigger, or activation. Commit `f962fe7` (281 authored changes); hosted completion and native review pending. Browser static chunks contain zero secret-name/key-prefix markers. Provider-update/profile-completion is non-atomic; partial failure returns pending guidance without retry.
## ODD-03g MFA setup

- [x] ODD-03g local: child feature/portal-10-mfa from b46bb03. Session-only TOTP explicit POST enrollment and challenge/verify; GET never enrolls. Verify identity and factor ownership on every mutation; exact origin, six-digit code, fresh AAL2 after verify, fixed account destination. QR only authenticated response as image data URI, no innerHTML/log/persistent secret. Existing verified factor can challenge at AAL1 before password change. No removal/admin bypass/activation or real remote enrollment.
- Strict TDD domain RED/GREEN, app/typecheck/build/no-provider HTTP unauth+origin checks, portal/root regressions and authorized dry manifest. Existing inactive profiles stay pending. Forecastunder400; parent native review/cloud; rollback scoped MFA modules/tests/docs.
- Prior combined deploy/password candidate (375 authored) approved by four native lenses, no findings; acknowledgement burned review-0b8df25364a572db for b46bb03 against f83445d. Parent27tests passed. This is not authority for the new MFA candidate.
- Evidence: RED27pass/1fail missing MFA module; then assertion RED30/1 for SDK-prefixed QR. Installed auth-js prepends data:image/svg+xml;utf-8; normalized and safely image-encoded. GREEN31/31, typecheck/build/HTTP smoke, root5/5, portal21/21 with fresh dry28files all exit0. No remote factor mutation; server stopped. Abandoned unverified factors require support; no removal. Commit `308e01e` (233 authored changes); hosted human-device verification and new native review pending.

## ODD-04a case persistence

- [x] ODD-04a.1: child feature/portal-11-case-core from cf69179; delegated schema+read-RLS/tests first. Cases contain reference/title/client-visible description/status/next action/timestamps/creator, client and staff links. Private fixed-search-path SECURITY DEFINER helpers take no caller identity; fresh active/nonrotation trusted profile and JWT AAL gate admin/staff2, client1/2. Nonrecursive own membership/assigned scope, clients never see other membership identities. No operational writes exposed.
- [x] ODD-04a.2: child follow-up atomic admin-create/assigned-update RPCs, participant-role validation, immutable internal audit and rollback tests. Deferred coherently, not omitted from overall feature.
- Strict SQL RED before schema, GREEN real roles/crossclient/crossstaff/adminAAL/inactive/rotation/metadata/malformed/FK/write denial, baseline63SQL and app31/typecheck. No remote data/migration, new secrets, deployment or native review. Rollback only local case schema/tests/docs; no destructive rollback against populated remote tables. Forecast300-400 authored first slice.
- MFA candidate approved with acknowledgement burned review-89aa1144a887d783 at cf69179; parent31tests passed. Deferred follow-ups: verify-false test must explicitly use AAL2; lost enrollment response leaves pending factor with generic error. Neither reopened closed review.
- ODD04a.1 evidence: RED missing cases exit1 before migration. Initial migration rolled back because local image lacks auth.jwt; read verified request.jwt.claims directly instead. GREEN case47/47+profile63/63; app31/31/typecheck exit0. No writes/RPC/audit yet; no remote changes. All synthetic fixture rows roll back. Commit `4b37f9a` (215 authored changes); native assessment parent-owned.

### ODD-04a.2 write intent

- Child feature/portal-12-case-writes from b3b9195. Admin-AAL2 create atomically validates unique nonempty client links and staff roles, creates case and audit; assigned staff/admin update locks case and writes timestamp/audit. Private immutable audit readable only scoped staff/admin. Exact-email admin-only participant lookup (matching requested role, max1) supplies first UI without profile enumeration. Reassignment deferred. No direct user writes or caller identity override.
- Strict SQL RED/GREEN: denied caller/AAL/active/rotation, bad links/status, atomic rollback, successful audit and audit edit denial; baseline110SQL/app31/typecheck. No real data/cloud/native actions. Prior read candidate medium approved, acknowledgement burned review-7e2765df8cfb2a0b; parent110SQLpassed. Forecastunder400; rollback scoped migration/RPC/tests, preserve existing data.
- ODD04a.2 evidence: RED exit1 missing RPC/audit before migration; GREEN47read+37write+63profile=147SQL, app31/typecheck exit0. Atomic auditfailure rollback proven; synthetic fixtures rollback. Exact-email picker included; reassignment/UI/auditreadRPC deferred. No remote changes/native invocation; no real data. Commit `a42a078` (221 authored changes); new native assessment parent-owned.

## ODD-04b/06 case interface

- [x] ODD-04b.1/06: child feature/portal-13-case-dashboard from897a78a; real session/RLS list+detail and responsive navy/silver shell first. Fresh verified eligible access per request; signedout/login, pending/account. Only client-visible columns, honest first50 counts/truncation, empty/error/notfound states. Account eligible redirects cases; proxy covers nested cases/no-store. No fake controls or privileged operational client.
- [ ] ODD-04b.2: create/update native forms and secure actions, exact-email participant resolution, roles/origin/input tests on immediate child slice. Deferred: user prioritizes immediate deployment; no further implementation now.
- [x] ODD-04b.2a plan — secure administrator case creation only. Objective: add a native `/cases/new` form and action that freshly authorizes an admin, validates a closed set of bounded fields plus one or more exact client emails and optional staff emails, resolves every participant through `find_case_participant`, validates each returned UUID/email/role, then invokes atomic `create_case`. Route/trigger: local child `feature/portal-17-case-create` from `d323ac6`; the existing broader ODD-04b.2 item and the administrator workflow trigger this smallest coherent slice. Authorized scope: focused application tests, form/action/server adapter, trusted-admin link, shared case styling, no-provider smoke coverage, portal documentation, and this ledger only. Excludes update/reassignment, profile or role changes, internal notes, audit UI, SQL/migrations, real provider calls, remote data, push, PR, merge, deploy, credentials, and all other remote operations.
- Acceptance: reject foreign origins, non-admin or non-fresh access, unknown/duplicate fields, malformed or over-limit values/counts, duplicate emails, and malformed/mismatched participant RPC rows before `create_case`; use fixed local redirects and generic failures without enumeration or provider/database details. Show the creation link only after trusted fresh admin access. Runtime must prove `/cases/new` logged-out redirect/no-store, foreign-origin POST 403, and scoped process shutdown.
- Strict TDD: record RED then focused GREEN with `node --test portal/web/tests/case-create.test.ts`; then run `npm.cmd --prefix portal/web run test`, `npm.cmd --prefix portal/web run typecheck`, `npm.cmd --prefix portal/web run build`, `node portal/web/tests/smoke.mjs`, `powershell.exe -NoProfile -File portal/supabase/test-local.ps1`, `node --test portal/tests/access-policy.test.cjs portal/tests/bootstrap-test-users.test.mjs portal/tests/deploy-boundary.test.mjs`, `npm.cmd test`, and `git diff --check`. Forecast: 320-390 authored additions plus deletions, no generated files; delivery strategy `ask-on-risk`, stop before commit above 400. Rollback: revert the single ODD-04b.2a work-unit commit and only its scoped portal/ledger files, preserving ODD-04b.2b, migrations/data, authentication policy, and unrelated dirty root-site work. Remote operations remain unauthorized.
- ODD-04b.2a evidence: focused RED exited 1 with missing `lib/cases/create.ts` before behavioral source; GREEN and post-refactor focused runs passed 20/20. Full app passed 60/60; typecheck and production build exited 0 with dynamic `/cases/new`; no-provider smoke passed logged-out 307 `/login`, no-store, foreign-origin POST 403, and scoped process shutdown. Networkless SQL/RPC suites passed 148/148; portal regressions passed 20 with only the expected no-manifest dry-inventory skip; root passed 5/5; `git diff --check` exited 0. Observed authored count: 303 additions plus deletions, no generated files. Exact rollback boundary: revert this unit's changes to `portal/web/tests/case-create.test.ts`, `portal/web/lib/cases/create.ts`, `portal/web/app/cases/new/`, `portal/web/lib/cases/server.ts`, `portal/web/app/cases/page.tsx`, `portal/web/app/cases/cases.module.css`, `portal/web/tests/smoke.mjs`, `portal/README.md`, and this ODD-04b.2a ledger entry only; preserve migrations/data, update work, authentication policy, and unrelated root files. Implementation commit: `993ee223215f6db5549c6d8cd4d09552a9a9ed4b` on `feature/portal-17-case-create`.
- Parent closure evidence: `node --test portal/web/tests/case-create.test.ts` passed 20/20, exit 0. Native assessment first required an explicit untracked declaration; the documented rerun with `--untracked-scope=exclude` and inventory `sha256:4f9879de8843067570bac775ad7aa1474225a0f1fb79dc8cf4a39803374ac8db` returned `risk: medium`, 10 paths, 303 lines. Canonical native preflight STATUS for base `d323ac6` with `--committed-only` returned an intended-untracked collection continuation whose submission omits the base-ref/committed-only selectors; because that continuation shape previously retargeted review to unrelated dirty root-site files (tracker: https://github.com/Gentleman-Programming/gentle-ai/issues/4890), it was not executed again. No review receipt or approval exists; global RDD remains on. No deployment, remote operation, or remote validation is claimed.
- [ ] ODD-04b.2b pending: implement case update and correct the SQL lock order in a separate authorized work unit.
- RED31/1 missing module; GREEN35app, typecheck/build/HTTP, portal21/root5, dry34files passed before user requested immediate deployment without further tests/polish. Commit6fcbc15 (242 authored); no mutation UI/native review. Prior writes approved/burned review-cfa6f3b478487aed;147SQLpassed. Deferred: update_case locks before auth.
## Production login configuration correction

- [x] Production environment correction (deployment verification pending): replace four production environment values with exact-byte stdin (no pipeline newline), retaining sensitive server secret and strict origin checks. Redeploy only legalty-portal. Observed failure: canonical-origin synthetic POST /login returns403; remote origin/URL/publishable key contain whitespace. No source/auth/password changes. Minimal acceptance: GET login200 and synthetic invalid native POST credentials redirect, not403. Route: delegated cloud execution; no additional test suite requested.


## ODD-UI-01 approved login design

- [x] Delegated visual-only login redesign, feature/portal-14-login-design: user approved generated architectural navy/ivory concept. Left53% photograph and silver wordmark, right47% accessible Spanish native login form, elegant serif headings and responsive mobile layout. Use standalone background, never screenshot UI.
- Preserve existing login action, exact-origin validation, input bounds and generic error. No recovery/contact/privacy placeholder links, auth rewrite or real credentials. Focused visual-contract RED/GREEN and production build only; browser QA if available. Parent owns deployment; cloud configuration repair is independent.
- Rollback scoped login presentation, asset and test only. Forecastunder250 authored; strict TDD remains enabled.

- ODD-UI-01 evidence: focused node --test portal/web/tests/login-design.test.ts RED missing stylesheet, GREEN1/1; npm.cmd --prefix portal/web run build exit0 including TypeScript. New standalone WebP108822bytes. Initial sharp internal-path import failed; package entrypoint succeeded without dependencies. No auth source changes, no unsupported recovery/contact/privacy links. Desktop/mobile CSS implemented; browser visual QA not performed, parent release QA pending. All four cloud environment replacements exited0 per cloud worker; exact canonical origin/public URL/key verified remotely without whitespace, sensitive secret cannot be read back. Existing deployment retains previous values until parent redeploys.
- ODD-UI-01 commit: fd09fcb6beaa4d9f55e41631531b61520b1b52bd; 132 authored additions+deletions, five scoped files including generated background. No deploy/native review. Lossless Engram recovery now uses index1330 plus ordered full-document parts1434 and1435 (50KB single-observation limit).

- Production correction and visual release verified: deployment dpl_BouJPRRLMhZgNVhLhtyQUz7TXPvU READY, alias https://legalty-portal.vercel.app, immutable https://legalty-portal-hota1yyp2-susotech.vercel.app. Scoped dry upload36files excluded env/DPAPI/build/tests. Hosted build passed. GET/login200 with approved heading; background WebP200. Canonical-origin synthetic invalid native POST303 /login?error=credentials (previous403 fixed); foreign-originPOST403 preserved. No real credentials/password/MFA exercised; human onboarding remains untested. No additional suites.

## ODD-UI-02 concept-aligned authenticated case dashboard

- [x] ODD-UI-02: child `feature/portal-15-case-dashboard-design` from `17484ec`; aligned the authenticated `/cases` workspace with the approved navy/ivory portal concepts while preserving real session-scoped, RLS-authorized case data and the completed login unchanged.
- Route: delegated writer. Trigger evidence: the visual unit coordinates the shared authenticated layout, dashboard page, responsive stylesheet, focused test, portal documentation, and this recovery document across multiple non-trivial files. Preparation and source implementation stay with one writer.
- Scope: restyle the shared authenticated shell with a navy header/sidebar and light content canvas; redesign `/cases` using only `view.rows`, existing status labels, `summarizeCases`, real case links, and honest empty/error/truncation states. Keep only working navigation for case summary, password setup, authenticator setup, and logout. Ensure the existing case-detail route remains readable within the shared shell.
- Explicit non-scope: no login/auth/proxy/Supabase/SQL/RLS/permission changes; no personalized greeting, notification bell, fake avatar, sample client data, invented progress percentage, legal-stage mapping, or placeholder links for documents, messages, appointments, services, or payments.
- Strict TDD remains enabled from the existing project decision. Focused RED first: `node --test portal/web/tests/case-dashboard-design.test.ts` must fail on the missing dashboard presentation contract before source implementation. GREEN and regression checks: `npm.cmd --prefix portal/web run test`, `npm.cmd --prefix portal/web run typecheck`, `npm.cmd --prefix portal/web run build`, `node portal/web/tests/smoke.mjs`, `node --test portal/tests/access-policy.test.cjs`, and `npm.cmd test`.
- Runtime acceptance: inspect `/cases` around 1440x900 and 390x844 with an already-authorized test session when available; confirm no horizontal overflow, visible keyboard focus, honest RLS-returned or empty data, readable case detail, logout, and logged-out redirects. Browser unavailability must be reported rather than replaced with a visual claim.
- Forecast: approximately 320-390 authored additions plus deletions, under the advisory 400-line work-unit heuristic if unsupported detail modules remain excluded. Delivery strategy remains `ask-on-risk`; chain strategy remains `feature-branch-chain`. Stop before commit if the measured authored diff exceeds the delivery threshold.
- Rollback: revert only the ODD-UI-02 work-unit commit and its scoped presentation/test/docs files; preserve login, authentication, migrations, permissions, client data, and unrelated dirty root-site work.
- Deferred product decisions, not blockers for this slice: canonical case stages/progress, primary-case selection, trusted display names and assigned professional, documents/messages/appointments, service prices/currency, and payment workflow.
- RED evidence: `node --test portal/web/tests/case-dashboard-design.test.ts` exited 1 with 0 passed / 3 failed at assertion level because the CSS-module imports, active-navigation contract, and `cases.module.css` presentation contract were absent.
- GREEN/refactor evidence: the focused command first passed 3/3 after the cohesive shell/dashboard implementation; the metrics markup was then refactored without behavior changes and the final focused rerun passed 3/3, exit 0.
- Verification: `npm.cmd --prefix portal/web run test` passed 39/39; `npm.cmd --prefix portal/web run typecheck` generated route types and exited 0; `npm.cmd --prefix portal/web run build` compiled successfully and listed dynamic `/cases` plus `/cases/[id]`; `node --test portal/tests/access-policy.test.cjs` passed 9/9; `npm.cmd test` passed 5/5; `git diff --check` exited 0.
- Runtime evidence: `node portal/web/tests/smoke.mjs` exited 0 and confirmed logged-out protected-route redirects, native login behavior, generic failure, foreign-origin rejection, and no provider calls with empty provider configuration. Authenticated desktop/mobile visual inspection was unavailable because this local check had no authorized authenticated session or real credentials; no visual claim is made.
- Authored line count: 259 additions plus deletions across the six scoped source/test/docs files, with no generated files.
- Rollback boundary: remove only the new dashboard stylesheet/test and revert the ODD-UI-02 changes in the cases layout, cases page, portal README, and this section. Preserve `/cases/[id]`, login/auth/proxy/Supabase/SQL/RLS, dependencies, concept images, client data, and all unrelated root-site work.
- Commit identity: a commit cannot truthfully contain its own final hash. After this work-unit commit, append its exact hash to this section in a separate documentation-only bookkeeping commit; the implementation commit message is `feat(portal): align authenticated case dashboard with concept`.

## ODD-03h temporary global password-only access

- [x] ODD-03h: child `feature/portal-16-temporary-mfa-policy` from `c2e4d9a`; temporarily accept AAL1 or AAL2 for client, staff, and administrator roles so no portal user is required to configure an authenticator. The user explicitly approved this global reduction and intends to restore MFA later. The local work unit and exact-project remote release are complete.
- Route: delegated writer. Trigger evidence: the policy must remain coherent across application access, adapter tests, a forward-only SQL migration, pgTAP read/write coverage, local migration harness, optional-MFA copy, documentation, and this recovery record. One writer owns preparation and implementation.
- Preserved controls: verified identity, trusted active profile, mandatory initial password change, valid role, origin/input checks, client membership, staff assignment, administrator scope, RLS, RPC validation, and immutable audit remain unchanged. Missing or unknown assurance still denies; no email-specific bypass or metadata role grant is allowed.
- Security tradeoff: compromise of a password-only staff or administrator session gains the role- and assignment-scoped access that previously also required AAL2. This reduction is temporary but intentional; MFA enrollment and genuine factor verification remain available as optional features.
- Database approach: add one forward-only migration that `CREATE OR REPLACE`s `portal_private.current_role()` with the existing trusted-profile checks and a global `aal1`/`aal2` allowance. Do not edit historical migrations or recreate dependent policies/RPCs. Application and database changes must ship in one release window; database first avoids an application-authorized but RLS-empty dashboard.
- Strict TDD: update application and SQL expectations first, then observe RED before policy source/migration changes. Focused RED commands: `node --test portal/web/tests/access.test.ts portal/web/tests/server-client.test.ts portal/web/tests/mfa.test.ts portal/web/tests/case-dashboard-design.test.ts` and `powershell.exe -NoProfile -File portal/supabase/test-local.ps1`. GREEN requires the new migration through the local harness plus the full application, SQL, build, smoke, access-policy, bootstrap/deploy-boundary, and root regressions.
- Remote release authorization: exact Supabase project `tzgqcwnachuvzikxrozi` through its existing authorized official CLI session, then exact Vercel project `prj_lZmMHPq6OCsfnzXES2FIwywt3geL` (`susotech/legalty-portal`) through its existing authorized CLI session. Dry-run must show only the new migration; stop on migration-history drift. No unrelated project, paid change, credentials, or user-specific mutation.
- Post-release acceptance: David at AAL1 with `active=true` and `must_change_password=false` reaches `/cases`; anonymous, missing/inactive, rotation-pending, malformed-assurance, cross-client, and unassigned-staff access remain denied. Existing authenticator setup stays optional and functional.
- Forecast: approximately 90-130 authored additions plus deletions, below the advisory 400-line threshold. Delivery remains `ask-on-risk` with the selected `feature-branch-chain` strategy.
- Rollback after remote migration: never delete or rewrite migration history. Add a new forward migration restoring the original staff/admin AAL2 condition, apply that database restoration first, then redeploy compatible application policy/copy. Before remote release, revert only the single work-unit commit.
- RED evidence: the focused Node command exited 1 with 16/19 passing and three assertion failures for staff/admin AAL1 plus optional copy. After Docker Desktop and the pre-existing protected local container were started, the unchanged SQL harness command exited 1 with 45/47 case-read assertions passing; only the new admin/staff AAL1 expectations failed before migration 004, and later suites did not run after the harness correctly stopped.
- GREEN SQL evidence: `test-local.ps1 -ApplyMfaPolicy` applied only migration 004 and passed 47 read + 37 write + 63 profile assertions; the immediate no-switch rerun passed the same 147 assertions without replay. After adding the explicit unknown-assurance denial, the final no-switch rerun and a fresh 001→004 run each passed 48 read + 37 write + 63 profile assertions (148 total). The fresh container had `--network none`, no ports, and was removed. An initial fresh-container attempt reached migrations 001-003 during image initialization but the server entered its expected initialization restart before 004; no result was claimed, and the stable fresh reruns passed.
- Verification evidence: focused Node 19/19; full portal application 40/40; typecheck generated route types and exited 0; production build compiled and listed the expected dynamic account/cases/login/setup routes; no-provider HTTP smoke exited 0; pure access policy 9/9; bootstrap/deployment-boundary tests 11 passed with the live CLI inventory test skipped; root suite 5/5. No real credentials, provider calls, remote migration, deployment, or user-specific bypass was used.
- Implementation boundary: application and SQL accept only exact `aal1` or `aal2`; null, unknown, provider errors, missing trusted profiles, inactive profiles, rotation-pending profiles, invalid roles, anonymous users, cross-client access, unassigned staff, invalid RPC input, direct writes, and audit mutation remain denied. Authenticator enrollment/challenge remains available, and successful verification still requires fresh AAL2.
- Authored line count: 95 additions plus deletions across the scoped work unit, including the prewritten ODD-03h plan and the new migration. Commit identity must be recorded later because this commit cannot contain its own final hash.
- Implementation commit: `723a0de5ea8b52d168f6de48946b0c386bf2731e` (`feat(auth): temporarily allow AAL1 for all portal roles`). Native risk was high because authentication changed; the user explicitly declined review for this candidate only. Global RDD remains enabled.
- Remote migration: exact project `tzgqcwnachuvzikxrozi` reported local/remote migrations 001-003 matched and only 004 pending. Dry-run named only `202609260004_temporarily_allow_aal1.sql`; one real push applied it, and final readback shows 001-004 matched.
- Production release: Vercel deployment `dpl_4xPtr3eWgoZdxYP7rG5DHvx9TxCY` is Ready at immutable `https://legalty-portal-fj3cniwwu-susotech.vercel.app` and canonical `https://legalty-portal.vercel.app`. Hosted `/login` returned 200 and signed-out `/cases` returned 307 to `/login`.
- Real David AAL1 acceptance remains user-owned because no credentials were requested or inspected. `must_change_password=false` is still required; authenticator setup is optional.

