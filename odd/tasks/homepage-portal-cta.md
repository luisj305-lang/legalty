# Homepage portal CTA

## Objective and authorized scope
Replace the homepage header's Hablemos CTA with Portal privado linking to /portal,
remove the duplicate plain portal link, and deploy only that change to
legalty-portal.vercel.app using the existing Vercel session authorized by the user.
Preserve the logo, assets, CSS, remaining content, and private portal behavior.

## Plan
- [ ] CTA-01: Apply the minimal homepage change, verify preservation, deploy an
  isolated production-source candidate, and check the public homepage/login.

## Routing and constraints
- Route: delegated mapping and bounded writer for homepage plus regression test
  (preparation/mapping/writer triggers); parent owns release isolation and checks.
- Existing branch: feature/portal-20-case-detail-design; heavily dirty baseline.
- TDD: strict enabled in odd/tasks/legalty-client-portal.md. Runner:
  node --test tests/homepage-portal-cta.test.ts from portal/web.
  Observed RED: 1 pass/1 fail; GREEN: 2 passes.
- Delivery: ask-on-risk; forecast under 100 authored lines, no PR/push requested.
- RDD: disabled/unmanaged; mode status reported off, but returned a Git ownership
  validation error in the sandbox. No review enabled or authority changed.
- Original production: dpl_Ckpd8h7bSMMB6kNiEMGaCKhRoUqB.
- Do not deploy the dirty worktree wholesale; compare the production source tree.

## Acceptance and verification
- Exactly one homepage navigation link to /portal, with nav-cta styling.
- No Hablemos header CTA; existing logo and non-header bytes unchanged.
- New deployment source differs only in public/index.html.
- Production / responds 200; /portal leads to the existing login.
- Record checks, release identity, rollback boundary, and commit evidence below.

## Progress
- Deployment/project identity verified through the authorized Vercel CLI session.
- Engram mirror pending: MCP previously rejected ambiguous active sessions.
- Next: isolate production sources and apply the minimal change.
- All 107 published source files matched local SHA1 before edits. Isolated copy
  contains exactly those 107 files; only public/index.html differs after edits.
- Non-header homepage bytes unchanged; logo/assets/CSS preserved by source hashes.
- Focused homepage/runtime/SEO checks: 10 passed. Scoped git diff --check passed.
- Candidate: dpl_4AqNLZjvmgW5182f9WhKg7AJbAtM, production build with domain assignment
  deferred. URL: https://legalty-portal-aoomk4cn3-susotech.vercel.app.
- Rollback boundary: header-only hunk and new homepage-portal-cta.test.ts; release
  can return to the original production deployment without unrelated edits.
- Source commit pending; pre-existing hero CTA href change must remain unstaged.
