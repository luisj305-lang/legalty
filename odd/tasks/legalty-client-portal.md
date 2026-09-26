# Legalty client portal and internal operations

Build connected client and staff experiences while preserving the current public website. This is the single ODD implementation and recovery document; the application stack is user-approved, while schema, operating constraints, and full architecture remain incomplete.

## Status and next action

- ODD-01: draft prepared; parent structural readback passed; foundation commit `f59cbbd` (141 additions); architecture remains incomplete.
- ODD-03a: isolated read policy implemented, independently verified, and committed as 0cdf01c. ODD-03 and the remaining main tasks remain incomplete.
- Next: ODD-03b isolated application foundation using the approved stack; internal screen design, schema, and full login remain pending.
- Engram mirror: maintained by parent persistence under `odd/legalty-client-portal/tasks`, including this full document and repository-relative locator.

## Objective, problem, and scope

Clients need secure access to their cases, documents, activity, appointments, messages, services, and one-time payments. Staff need the corresponding operational tools, not a disconnected administrative mockup. A static public website cannot itself enforce these access boundaries.

The first release includes client and internal dashboards, identity and access, clients and professionals, cases and assignments, stages and next actions, private documents, communications, appointments, service requests, payment reconciliation, and audit history. Existing visual concepts guide presentation, not business rules or permissions.

Out of initial scope: subscriptions, native mobile apps, advanced electronic signatures, integrated video calls, legal AI automation, and full accounting.

### Authorization and preservation

- User authorized beginning local ODD implementation of both portal and internal panel; initial documentation is followed by a bounded pure-domain authorization work unit; login and provider integration remain pending.
- Local feature work and eventual Conventional Commits are in scope; push, PR creation, merge, deployment, remote provisioning, and credential/session use require separate authorization.
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

Before production: resolve database schema and lifecycle constraints, hosting region and budget, retention, independent document backups and restore drills, notification channel, and deployment exclusions. Supabase database backups do not include Storage objects. No remote project, account, credential use, or deployment is authorized by this approval.

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
- RDD: command printed off but exited with an unsafe `.git` authority-ownership error; effective status is uncertain/unavailable. Do not repair ownership or enable review automatically; preserve the error and follow applicable verification rules.
- Forecast: several thousand authored additions plus deletions across the full feature. This is a planning estimate, not a measured diff. Running committed authored count: 363 before final progress bookkeeping: foundation f59cbbd (141) plus access policy 0cdf01c (222). Slice 2 base: f59cbbd; only portal files and task updates belong to it.
- Delivery strategy: `ask-on-risk`. Chain strategy: `feature-branch-chain`, explicitly accepted by the user. Tracker: `feature/legalty-client-portal`; slice 1: `feature/portal-01-foundation` targets tracker; slice 2: `feature/portal-02-access-policy` targets slice 1; slice 3: `feature/portal-03-app-foundation` targets slice 2, starting at `24a41db`. No remote PR creation or merge is authorized.
- Approximately 400 authored lines per task is a planning heuristic, not a cap. Never omit tests, compress code, or split inseparable behavior to meet it. Keep PR delivery boundaries and any required exceptions explicit.
- Branch before work-unit commits on the default branch. Stage only owned paths after reviewing the diff; never sweep existing public-site changes or untracked assets/tests into a commit.
- Each completed work unit carries behavior, tests, and relevant docs together; use Conventional Commits with no `Co-Authored-By` or AI attribution.
- Record exact commands/results, runtime scenarios, commit IDs, authored counts, slice boundaries, and assessed review outcomes as they occur. No receipt or approval is claimed by this document.

## Recovery and rollback

Before resuming, retrieve project/feature memory and its full observation, read this file, and reconcile both with current requirements and repository evidence. Preserve conflicting edits and valid completed work; mirror the entire updated document after each task.

Foundation rollback: revert only its task-document changes if authorized. Access-policy rollback: revert only the three new portal files named below and their progress entries; no runtime consumer, public-site change, configuration, dependency, or remote operation belongs to this unit.

Next unresolved decisions: schema and operating constraints before persistence/authentication integration; payment prices/currency before checkout; authorized deployment destination/session before remote release.

## Bounded next work unit: ODD-03b application foundation

- [ ] ODD-03b: isolated Next.js App Router application with strict TypeScript, its own package and generated lock under `portal/web/`. No login capability is claimed.
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
- Status: writer verification passed after bounded installation recovery. Independent verification, visual/browser check, risk assessment, and parent commit remain pending. Keep unchecked until parent closes this unit.

### ODD-03b partial evidence

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
- Remaining: parent independent verification/commit and browser visual QA; authentication/accounts and cloud connection are separate future work. Static-root release exclusion remains a deployment blocker.

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
