/* ==========================================================================
   LEGALTY — Mercado Pago Checkout Pro preference (Vercel serverless function)
   --------------------------------------------------------------------------
   POST /api/create-preference
     body: { serviceId: string }

   Behavior:
     - Non-POST methods → 405 (Allow: POST).
     - MP_ACCESS_TOKEN unset → 503 { error: "Mercado Pago not configured" }
       (fail closed — checkout cannot start without credentials).
     - Missing/invalid serviceId → 400 { error: "invalid_service" }.
     - Unknown serviceId → 404 { error: "service_not_found" }.
     - Service price null/PENDING → 400 { error: "Pricing pending for this service" }.
     - Otherwise → creates a Checkout Pro Preference via the MP SDK and returns
       200 { init_point } (the hosted checkout URL the buyer is redirected to).

   The server-side catalog below mirrors assets/js/catalog.js (client display
   catalog). Keep ids and titles identical. `price` is null until the firm
   supplies real pricing (PENDING) — every service currently short-circuits
   with a 400 before the SDK is ever reached.

   Credentials are read from the environment only. The access token is never
   logged and never echoed in any response body. No secrets hardcoded.
   ========================================================================== */

'use strict';

var { MercadoPagoConfig, Preference } = require('mercadopago');

// Server-side service catalog (single source of truth for this API). Mirrors
// assets/js/catalog.js — keep ids/titles in sync. price: null = PENDING.
var SERVICES = [
  { id: 'invertir', title: 'Invertir', price: null },
  { id: 'planificacion-financiera', title: 'Planificación financiera', price: null },
  { id: 'patrimonio', title: 'Patrimonio', price: null },
  { id: 'jubilacion', title: 'Jubilación', price: null }
];

function send(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

// Build an absolute URL on the current host. Trusts `x-forwarded-proto`
// (Vercel sets it); falls back to https. Returns null if no host is available.
function absoluteUrl(req, path) {
  var host = req.headers && req.headers.host;
  if (!host) return null;
  var proto = req.headers['x-forwarded-proto'];
  proto = proto ? String(proto).split(',')[0].trim() : 'https';
  return proto + '://' + host + path;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    send(res, 405, { error: 'method_not_allowed' });
    return;
  }

  var accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken || typeof accessToken !== 'string' || accessToken.trim() === '') {
    // Fail closed — no credentials means no checkout.
    send(res, 503, { error: 'Mercado Pago not configured' });
    return;
  }

  // Vercel auto-parses JSON bodies into `req.body`; tolerate a raw string body
  // too (e.g. direct/local invocation).
  var raw = req.body;
  var body;
  if (raw && typeof raw === 'object') {
    body = raw;
  } else {
    try {
      body = JSON.parse(typeof raw === 'string' && raw ? raw : 'null');
    } catch (err) {
      body = null;
    }
  }

  if (!body || typeof body !== 'object') {
    send(res, 400, { error: 'invalid_service' });
    return;
  }

  var serviceId = body.serviceId;
  if (!serviceId || typeof serviceId !== 'string' || serviceId.trim() === '') {
    send(res, 400, { error: 'invalid_service' });
    return;
  }

  var service = SERVICES.find(function (item) {
    return item.id === serviceId;
  });
  if (!service) {
    send(res, 404, { error: 'service_not_found' });
    return;
  }

  if (service.price === null || service.price === undefined) {
    // Pricing not yet supplied by the firm — refuse to create a preference.
    send(res, 400, { error: 'Pricing pending for this service' });
    return;
  }

  // Optional override for the notification URL (e.g. a public URL behind a
  // proxy); otherwise derive it from the request host.
  var notificationUrl = process.env.MP_NOTIFICATION_URL || absoluteUrl(req, '/api/webhook');
  var successUrl = absoluteUrl(req, '/success');
  var failureUrl = absoluteUrl(req, '/failure');

  try {
    var client = new MercadoPagoConfig({ accessToken: accessToken });
    var preferenceClient = new Preference(client);
    var result = await preferenceClient.create({
      body: {
        items: [{
          id: service.id,
          title: service.title,
          quantity: 1,
          unit_price: service.price
        }],
        notification_url: notificationUrl,
        back_urls: {
          success: successUrl,
          failure: failureUrl
        }
      }
    });

    if (result && result.init_point) {
      send(res, 200, { init_point: result.init_point });
      return;
    }

    send(res, 500, { error: 'preference_creation_failed' });
  } catch (err) {
    // Never log `err` directly — SDK errors may embed the access token. Never
    // echo the token in the response either.
    send(res, 500, { error: 'preference_creation_failed' });
  }
};
