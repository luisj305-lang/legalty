# Design: Recreate legalty.net as a static site with Mercado Pago payments

## Technical Approach

Recreate legalty.net as a zero-build static site (vanilla HTML/CSS/JS) on Vercel, plus three serverless `api/` functions for the contact form and Mercado Pago checkout. No framework, no bundler, no frontend runtime deps; server-side deps are the MP Node SDK and `@vercel/kv` (webhook dedupe). Maps to capabilities `site-pages`, `contact-form`, `mercadopago-payments`.

```
/
├── index.html, about.html, services.html, contact.html
├── success.html, failure.html
├── assets/{css,js,fonts,img}/
├── api/{create-preference,webhook,contact}.js
├── package.json, vercel.json, .env.example
```

## Architecture Decisions

### Shared shell (header/footer)
| Option | Tradeoff | Decision |
|---|---|---|
| Duplicate markup per page | ~6 files, static active-nav | **Chosen** |
| Runtime JS include | FOUC, crawler-blind, breaks one-H1 audit | Rejected |
| Tiny build (handlebars) | Adds toolchain | Rejected |

**Rationale**: no build step → a JS include injects nav at runtime (flash, SEO loss, complicates one-H1-per-page). Six pages make duplication cheap; active nav set statically. JS is progressive-enhancement only (nav toggle, carousel, checkout, form).

### Checkout backend
**Choice**: `Preference.create → init_point` (Checkout Pro), sandbox first. **Rejected**: Order API (`checkout_url`) — unnecessary migration path.

### Webhook dedupe
**Choice**: Vercel KV key `payment:{data.id}`, set-if-not-exists, TTL 7d; if KV unconfigured, return **503 fail-closed** (never risk a duplicate). **Rejected**: in-memory `Set` (does not survive cold starts).

## Data Flow

```
services.html ─pay─▶ checkout.js ─POST /api/create-preference─▶ MP SDK ─▶ {init_point}
                                                                    │
user ─redirect─▶ Checkout Pro ─▶ MP ─webhook─▶ /api/webhook ─▶ sig ─▶ dedupe ─▶ log
                                                                    │
back_urls ─▶ success.html | failure.html
contact.html ─POST /api/contact─▶ CONTACT_ENDPOINT
```

## File Changes

| File | Action | Description |
|---|---|---|
| `index.html`, `about.html`, `services.html`, `contact.html` | Create | 4 pages, duplicated shell |
| `success.html`, `failure.html` | Create | payment status pages |
| `assets/css/tokens.css` | Create | CSS custom properties (navy `#003366`, gold `#EDDB8C`, charcoal `#2A2A2A`, overlay `rgba(21,40,74,0.95)`, light `#F7F7F7`) |
| `assets/css/main.css` | Create | `@font-face` self-hosted; H1 80/H2 50/H3 30 Oswald ExtraLight, body 14 Open Sans, testimonials 20 Handlee; breakpoints 1024/810/600 |
| `assets/js/nav.js`, `carousel.js`, `catalog.js`, `checkout.js`, `contact.js` | Create | mobile toggle; carousel; services data; checkout; form |
| `assets/fonts/`, `assets/img/` | Create | self-hosted Open Sans/Oswald/Handlee + logo/hero/sections/icons/team |
| `api/create-preference.js` | Create | MP preference creation |
| `api/webhook.js` | Create | MP IPN: signature + idempotent dedupe |
| `api/contact.js` | Create | form forward to CONTACT_ENDPOINT |
| `package.json` | Create | deps: `mercadopago`, `@vercel/kv` |
| `vercel.json` | Create | `cleanUrls`, security/cache headers |
| `.env.example` | Create | `MP_ACCESS_TOKEN`, `MP_PUBLIC_KEY`, `MP_WEBHOOK_SECRET`, `CONTACT_ENDPOINT` |

## Page Anatomy (PENDING = replace later)

- **Inicio**: hero → 4 service cards (Invertir, Planificación financiera, Patrimonio, Jubilación) → Quiénes somos → Por qué elegir → asociados (**PENDING** logos) → testimonials carousel (**PENDING** quotes) → footer.
- **Acerca**: intro → firm story → team (**PENDING**).
- **Servicios**: catalog + 8-item checklist → pay actions (pricing **PENDING**).
- **Contáctenos**: form → address/phones/socials (**PENDING**) → hours (L-V 08–18, Sáb 09–12) → `info@legalty.net`.
- Real copy kept 1:1: services names, checklist, hours, email.

## Interfaces / Contracts

```js
// assets/js/catalog.js
const SERVICES = [{ id:"invertir", title:"Invertir", price:null /* PENDING */, payable:true }];
```

- `POST /api/create-preference` req `{"serviceId":"invertir"}` → 200 `{"init_point":"https://..."}` | 400 `{"error":"invalid_service"|"pricing_pending"}`
- MP webhook `POST /api/webhook` headers `x-signature: ts=...,v1=...`, `x-request-id`; body `{"type":"payment","action":"payment.updated","data":{"id":"123"}}` → 200 `{"ok":true}` | 401 forged | 503 KV-down | 200 replay (idempotent)
- `POST /api/contact` req `{"name","email","message"}` → 200 `{"ok":true}` | 400 `{"error":"validation"}` | 502 upstream

Webhook validate: `WebhookSignatureValidator.validate({xSignature,xRequestId,dataId,secret,toleranceSeconds})` (HMAC-SHA256, constant-time).

## Testing Strategy (no framework)

| Layer | What | Approach |
|---|---|---|
| Function | create-preference / webhook / contact | `vercel dev` + curl: valid, invalid, duplicate, forged |
| Page | tokens, one H1, alt text, no `nccdn.net` | browser smoke + HTML validation |
| E2E | sandbox checkout | manual pay → webhook → status page |

## Threat Matrix

N/A — no routing/shell/subprocess/VCS/PR/executable boundary. Sole external integration (MP webhook) covered by spec's HMAC-SHA256 signature + idempotency requirement.

## Migration / Rollout

Greenfield; no migration. Rollback = redeploy prior commit; disable `api/` by removing env credentials.

## Open Questions

- Real team/testimonials/address/phones/socials/partner logos (PENDING placeholders)
- Service catalog pricing
- Confirm `@vercel/kv` dependency for dedupe (vs. accept in-memory limitation)
