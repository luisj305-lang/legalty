# Portal access policy foundation

This folder contains a pure read-authorization policy, not a functioning portal or login system. No route, UI, storage adapter, or runtime consumer uses it yet.

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

No deployment is authorized. The repository currently serves a static root; do not place private documents, credentials, or real client data here. Establish and verify a separate private runtime and deployment exclusions before release. Ignore rules alone are not access control.

Rollback this unconsumed unit by reverting only `portal/domain/access-policy.cjs`, `portal/tests/access-policy.test.cjs`, this README, and its progress entries in `odd/tasks/legalty-client-portal.md`. No public-site change or dependency is needed. The next step is independent verification and the local work-unit commit; full authentication and provider decisions remain pending.
