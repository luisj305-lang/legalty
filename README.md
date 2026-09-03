# LEGALTY — Servicios Jurídicos Integrales

Static marketing site for **legalty.net**, rebuilt as a zero-build vanilla
HTML/CSS/JS site deployed on Vercel, with Mercado Pago Checkout Pro for the
firm's services and a serverless contact-form forwarder.

No framework, no bundler, no frontend runtime dependencies. Server-side code is
three Vercel serverless functions under `api/` (CommonJS, Node built-ins + the
official `mercadopago` SDK only).

## Project layout

```
/
├── index.html, about.html, services.html, contact.html   # static pages
├── success.html, failure.html                            # payment status pages
├── assets/{css,js,fonts,img}/                            # design system + progressive JS
├── api/
│   ├── create-preference.js                              # MP Checkout Pro preference
│   ├── webhook.js                                        # MP IPN/webhook receiver
│   └── contact.js                                        # contact form forwarder
├── package.json, vercel.json, .env.example
```

## Local development

```bash
npm install

# Static serve (no API functions):
npm run serve

# Full local environment (static pages + api/ functions):
vercel dev
```

`vercel dev` wires up the `api/` functions and `.env` locally; `npm run serve`
only serves the static pages.

## Environment variables

Copy `.env.example` to `.env` (and `.env.local` for local `vercel dev`) and fill
in sandbox values. **Never commit real credentials.**

| Variable | Required | Purpose |
|---|---|---|
| `MP_ACCESS_TOKEN` | For checkout | Mercado Pago **secret** access token (server-side only). Used by `api/create-preference.js`. |
| `MP_WEBHOOK_SECRET` | For webhook | Shared HMAC secret used to verify `api/webhook.js` notifications (set in the MP dashboard, *Tus Integraciones*). |
| `MP_PUBLIC_KEY` | Optional (future) | Mercado Pago **public** key. Client-facing only — reserved for a future MP Checkout SDK integration. See note below. |
| `CONTACT_ENDPOINT` | For contact form | URL that receives `{ name, email, message }` from `api/contact.js`. |
| `MP_NOTIFICATION_URL` | Optional | Override for the webhook notification URL. If unset, it is derived from the request host (`https://<host>/api/webhook`). |

> **Important — don't confuse the two MP keys.** `MP_ACCESS_TOKEN` is a *secret*
> (server-side only, prefix `TEST-…` in sandbox / `APP_USR-…` in production).
> `MP_PUBLIC_KEY` is *public by design* (prefix `TEST-…` in sandbox / `APP_USR-…`
> is NOT the public key — the public key is the shorter one shown in
> "Credenciales" alongside the access token). Only the access token and the
> webhook secret may ever touch server code; the public key is meant to be
> shipped to the browser if/when the MP Checkout SDK is adopted.

## Mercado Pago sandbox flow

1. Create a Mercado Pago account and enable sandbox mode.
2. In **Credenciales** → *Credenciales de prueba*, copy the sandbox access token
   (`TEST-…`), public key, and — under *Notificaciones* / *Tus Integraciones* —
   the webhook signature secret.
3. Set `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, and `MP_PUBLIC_KEY` in your
   environment.
4. Configure the webhook URL to `https://<your-domain>/api/webhook` (or rely on
   `notification_url` auto-derivation from the request host).
5. Exercise checkout → Checkout Pro → pay with a sandbox test card → verify the
   webhook logs a confirmed notification and the buyer lands on
   `success.html` / `failure.html`.

**Note: service pricing is PENDING.** All four services (`invertir`,
`planificacion-financiera`, `patrimonio`, `jubilacion`) currently have
`price: null`. Until real prices are supplied (server catalog in
`api/create-preference.js` and the mirrored client catalog in
`assets/js/catalog.js`), checkout intentionally returns
`400 {"error":"Pricing pending for this service"}` and the pay buttons show a
"price pending" message.

## Deployment

1. Push the repo to GitHub/GitLab and import it into Vercel.
2. Add the environment variables above under **Project → Settings → Environment Variables**.
3. Deploy. Vercel auto-routes `api/*` to the serverless functions and serves the
   static pages from the repo root (`.html` clean URLs via `vercel.json`).

`vercel.json` supplies `cleanUrls` plus security/cache headers
(`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
`Permissions-Policy`, immutable asset caching). No rewrites are required —
Vercel auto-detects the `api/` directory.

## Architecture notes

- **Checkout**: `api/create-preference.js` creates a Checkout Pro `Preference`
  via the official SDK and returns the `init_point` URL; `assets/js/checkout.js`
  redirects the buyer there.
- **Webhook**: `api/webhook.js` validates the MP `x-signature` header
  (HMAC-SHA256, constant-time, with timestamp tolerance) before recording
  anything, then applies a best-effort in-memory idempotency map (1 h TTL) to
  suppress duplicate processing. **Limitation:** the dedupe map is in-memory and
  does not survive serverless cold starts — signature validation remains the
  hard gate, and durable persistence is a known follow-up.
