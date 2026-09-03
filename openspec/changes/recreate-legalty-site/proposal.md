# Proposal: Recreate legalty.net as a static site with Mercado Pago payments

## Intent

legalty.net runs on the Simbla builder ("Financial Advisor 1" template) and is full of placeholders: stock team ("John Smith/Jane Doe"), a Colombian leftover address, contradictory phones, a broken contact form, placeholder logos/socials, and a dead GA tag. Recreate it as a fast, self-hosted static site on Vercel that preserves the firm's real design and copy 1:1, replaces every placeholder, and lets clients pay for services online via Mercado Pago.

## Scope

### In Scope
- 4 static pages (Inicio, Acerca de nosotros, Servicios, Contáctenos) + shared shell (fixed dark header, logo, footer)
- Design tokens kept 1:1: navy `#003366`, gold `#EDDB8C`, charcoal `#2A2A2A`, fonts Open Sans / Oswald ExtraLight / Handlee (self-hosted)
- Self-host images (replace nccdn.net CDN) and fix the broken contact form
- Mercado Pago Checkout Pro: create payment preference + receive webhook/IPN (Vercel serverless, Node SDK, sandbox first)
- Services catalog → checkout flow

### Out of Scope
- Real team/testimonial/contact data — deferred, user will supply (pending, non-blocking)
- Exact service catalog + pricing — pending user supply
- Production Mercado Pago credentials / go-live
- CMS or admin backend

## Capabilities

### New Capabilities
- `site-pages`: static pages, shared shell, design tokens, self-hosted assets
- `contact-form`: working form with a real submission endpoint
- `mercadopago-payments`: preference creation, checkout redirect, webhook confirmation

### Modified Capabilities
None

## Approach

- Frontend: vanilla HTML/CSS/JS, no framework; self-host fonts and images under `assets/`.
- Backend: Vercel serverless `api/` functions — `create-preference.js` (POST) and `webhook.js` (IPN) using the Mercado Pago Node SDK.
- Layout: `index.html`, `about.html`, `services.html`, `contact.html` at root; `api/`, `assets/`, `vercel.json`.
- Payment flow: services catalog → select service → POST create-preference → redirect to Checkout Pro → webhook confirms → status page.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `/` | New | 4 static pages + shared shell |
| `assets/` | New | self-hosted fonts, images, css, js |
| `api/create-preference.js` | New | MP preference creation |
| `api/webhook.js` | New | MP IPN confirmation |
| `vercel.json` | New | routing + config |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Placeholders ship as real data | High | Block merge until real data supplied; mark PENDING |
| Sandbox vs prod credentials mixed | Med | Env vars only, never hardcode |
| CDN image licensing | Med | Self-host or replace with own/licensed assets |
| Webhook spoofing | Med | Validate MP signature + idempotency |

## Rollback Plan

Static site: redeploy previous commit (Vercel immutable deploys). Payments: disable `api/` functions via `vercel.json` or remove env credentials to stop checkout.

## Dependencies

- Mercado Pago sandbox credentials + Node SDK
- Real firm data (team, phones, address, socials, WhatsApp)
- Service list + pricing

## Success Criteria

- [ ] 4 pages render 1:1 with correct tokens and fonts
- [ ] Contact form submits successfully
- [ ] Sandbox checkout completes end-to-end (create → pay → webhook → confirm)

## Open Questions

- Exact service catalog + pricing for checkout
- Real contact/team/testimonial data
- Mercado Pago account credentials (sandbox)
