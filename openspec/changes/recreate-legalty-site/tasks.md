# Tasks: Recreate legalty.net (static site + Mercado Pago payments)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~2,250 authored (binary assets excluded) |
| Effective review budget | 800 lines (session override; default 400) |
| Budget risk | High |
| Chained PRs recommended | Yes |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |
| Decision needed before apply | No |

### Suggested Work Units (chained/stacked PR slices)

| Unit | Goal | PR | Focused test | Runtime harness | Rollback boundary |
|------|------|----|--------------|-----------------|-------------------|
| 1 | Foundation + design system (T1–T2) | 1 | page renders tokens/fonts; grep no `nccdn.net` | `npx serve .` + computed-style check | revert T1–T2 files |
| 2 | Shell + Inicio/Acerca/Servicios (T3–T4) | 2 | one H1/page; grep no placeholder strings | browser smoke @375px/1024px | revert T3–T4 |
| 3 | Contáctenos + status pages (T5–T6) | 3 | form fields present; status pages render | browser smoke | revert T5–T6 |
| 4 | Progressive JS (T7–T8) | 4 | nav toggles @375px; carousel advances | browser @375px | remove JS files |
| 5 | Contact form E2E (T9) | 5 | invalid blocked; valid → /api/contact 200 | Node invoke api/contact.js + mock endpoint | revert T9 |
| 6 | Payments + deploy (T10–T12) | 6 | create-preference 200/400; webhook forged→401, replay→200 idempotent | Node + MP sandbox env | remove api/ or env creds |

## Phase 1: Foundation

- [x] **T1 — Scaffold project + git init** — Files: `package.json`, `vercel.json` (initial), `.env.example`, `.gitignore`, git init. Deps: —. Acceptance: `npm install` resolves `mercadopago` + `@vercel/kv`; git repo initialized; `.env.example` lists MP_ACCESS_TOKEN, MP_PUBLIC_KEY, MP_WEBHOOK_SECRET, CONTACT_ENDPOINT. ~80 lines.
- [x] **T2 — Design system + self-hosted fonts** — Files: `assets/css/tokens.css`, `assets/css/main.css`, `assets/fonts/`. Deps: T1. Acceptance: tokens expose navy `#003366`, gold `#EDDB8C`, charcoal `#2A2A2A`, overlay `rgba(21,40,74,0.95)`, light `#F7F7F7`; `@font-face` self-hosts Open Sans/Oswald ExtraLight/Handlee; H1 80/H2 50/H3 30 Oswald, body 14 Open Sans, testimonials 20 Handlee; breakpoints 1024/810/600. ~490 lines.

## Phase 2: Pages

- [x] **T3 — Shared shell + Inicio** — Files: `index.html`. Deps: T2. Acceptance: fixed dark header + logo→Inicio + 4 nav items + footer + skip-to-content first in tab order; Inicio order: hero→4 service cards→Quiénes somos→Por qué elegir→asociados(PENDING)→carousel(PENDING)→footer; exactly one H1; no `nccdn.net` refs. ~300 lines.
- [x] **T4 — Acerca + Servicios** — Files: `about.html`, `services.html`. Deps: T3. Acceptance: Acerca: intro+story+team(PENDING); Servicios: catalog + 8-item checklist + pay actions (pricing PENDING); one H1 each; active nav set statically. ~300 lines.
- [x] **T5 — Contáctenos** — Files: `contact.html`. Deps: T3. Acceptance: form fields name/email/message + submit; address/phones/socials(PENDING); hours L-V 08–18 Sáb 09–12; `info@legalty.net`; no Colombian address / contradictory phones. ~250 lines.
- [x] **T6 — Status pages** — Files: `success.html`, `failure.html`. Deps: T3. Acceptance: both render shared shell; success shows approval copy, failure shows rejection/error copy. ~160 lines.

## Phase 3: Progressive JS

- [x] **T7 — Nav toggle + carousel** — Files: `assets/js/nav.js`, `assets/js/carousel.js`. Deps: T3. Acceptance: nav toggles <600px; carousel advances between testimonials. ~130 lines.
- [x] **T8 — Services catalog + checkout** — Files: `assets/js/catalog.js`, `assets/js/checkout.js`. Deps: T4. Acceptance: `SERVICES` ids match Servicios page; pay action POSTs `{serviceId}` to /api/create-preference and redirects to `init_point`. ~120 lines.

## Phase 4: Contact form

- [x] **T9 — Form validation + endpoint** — Files: `contact.html` (script), `assets/js/contact-form.js`, `api/contact.js`. Deps: T5. Acceptance: empty name / malformed email blocked with inline error; valid POSTs /api/contact → CONTACT_ENDPOINT; success resets form, failure preserves data. ~160 lines.

## Phase 5: Payments

- [x] **T10 — create-preference endpoint** — Files: `api/create-preference.js`. Deps: T8. Acceptance: POST `{serviceId}` → `Preference.create` → 200 `{init_point}`; missing/invalid → 400; pricing PENDING → 400; creds from env only. ~70 lines.
- [x] **T11 — webhook/IPN endpoint** — Files: `api/webhook.js`. Deps: T10. Acceptance: `x-signature` HMAC-SHA256 validated (forged → 401); in-memory Map dedupe (replay → 200 idempotent); secret unconfigured → 503 fail-closed. ~90 lines.

## Phase 6: Deployment

- [x] **T12 — Deploy config + docs** — Files: `vercel.json` (verified), `README.md`. Deps: T11. Acceptance: 4 static pages from root; `/api/*` routes to functions (Vercel auto-route, no rewrites added); security/cache headers; docs cover env vars + sandbox flow. ~100 lines.
