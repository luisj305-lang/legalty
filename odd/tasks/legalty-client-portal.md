# Legalty client portal and internal operations

Build connected client and staff experiences while preserving the current public website. This is the single ODD implementation and recovery document; architecture is prepared for review, not implemented or approved as complete.

## Status and next action

- ODD-01: prepared; parent structural readback passed; work-unit commit pending.
- ODD-02 through ODD-11: pending; no portal source implementation completed.
- Next: commit the foundation document on feature/portal-01-foundation, then implement the pure authorization policy on its child branch without touching the public website.
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

## Architecture draft: vendor-neutral boundaries

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

Framework, authentication provider, database vendor, storage vendor, hosting, and notification channel remain unresolved. Select them from repository evidence, operational needs, and explicit constraints before dependent source implementation; this document selects no stack.

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
| ODD-01 | Architecture, model, permissions, threats, and recovery plan. Parent reads this document; unresolved vendors and commercial values remain explicit. Finalize necessary choices and constraints before dependent implementation. | None | Delegated: design analysis and writing preparation. |
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

- [ ] ODD-01 — draft prepared; structural readback passed; commit: none.
- [ ] ODD-02 — pending; commit: none.
- [ ] ODD-03 — pending; commit: none.
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
- This passive documentation unit: functional tests and runtime harness N/A because it creates no executable behavior. Required check: parent structural readback. Browser checks remain pending for later UI work.
- RDD: command printed off but exited with an unsafe `.git` authority-ownership error; effective status is uncertain/unavailable. Do not repair ownership or enable review automatically; preserve the error and follow applicable verification rules.
- Forecast: several thousand authored additions plus deletions across the full feature. This is a planning estimate, not a measured diff. Running committed authored count: 0.
- Delivery strategy: `ask-on-risk`. Chain strategy: `feature-branch-chain`, explicitly accepted by the user. Tracker: `feature/legalty-client-portal`; slice 1: `feature/portal-01-foundation` targets tracker; slice 2: `feature/portal-02-access-policy` targets slice 1. No remote PR creation or merge is authorized.
- Approximately 400 authored lines per task is a planning heuristic, not a cap. Never omit tests, compress code, or split inseparable behavior to meet it. Keep PR delivery boundaries and any required exceptions explicit.
- Branch before work-unit commits on the default branch. Stage only owned paths after reviewing the diff; never sweep existing public-site changes or untracked assets/tests into a commit.
- Each completed work unit carries behavior, tests, and relevant docs together; use Conventional Commits with no `Co-Authored-By` or AI attribution.
- Record exact commands/results, runtime scenarios, commit IDs, authored counts, slice boundaries, and assessed review outcomes as they occur. No receipt or approval is claimed by this document.

## Recovery and rollback

Before resuming, retrieve project/feature memory and its full observation, read this file, and reconcile both with current requirements and repository evidence. Preserve conflicting edits and valid completed work; mirror the entire updated document after each task.

Current rollback boundary: only the newly created `odd/tasks/legalty-client-portal.md`; remove it only if reverting this documentation unit is authorized. No source, configuration, dependency, branch, or remote state was changed by this unit. Later units must name their own independently reversible scope.

Next unresolved decisions: implementation stack/providers before dependent source changes; payment prices/currency before checkout; authorized deployment destination/session before remote release.

## Bounded next work unit: ODD-03a access policy

- [ ] Implement and test a pure, deny-by-default case read policy for verified principals, current case links/assignments, and record visibility; no authentication endpoint or database access yet.
- Route: delegated writer (multiple non-trivial files); independent verification required if native assessment is unavailable.
- Scope: new portal/domain/access-policy.cjs, portal/tests/access-policy.test.cjs, portal/README.md, plus this progress document. No existing website files, package files, or payment APIs changed.
- Checks: observed RED then GREEN with node --test portal/tests/access-policy.test.cjs; existing regression suite npm.cmd test; parent spot check and independent read-only verification.
- Trust boundary: future server adapter must resolve identity/roles/links from trusted persistence on every request; the pure function does not authenticate browser data or secure any endpoint by itself.
- Rollback: remove only the new portal policy/tests/readme and corresponding progress entries; no runtime consumer exists yet.
- Vendor selection does not block this isolated policy contract; ODD-01 and ODD-03 as a whole remain incomplete.
