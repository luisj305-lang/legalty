/* ==========================================================================
   LEGALTY — Mercado Pago Checkout Pro preference (Vercel serverless function)
   --------------------------------------------------------------------------
   POST /api/create-preference
     body: { serviceId: string,
             slotId?: string, clientName?: string,
             clientEmail?: string, clientPhone?: string }

   Behavior:
     - Non-POST methods → 405 (Allow: POST).
     - MP_ACCESS_TOKEN unset → 503 { error: "Mercado Pago not configured" }
       (fail closed — checkout cannot start without credentials).
     - Missing/invalid serviceId → 400 { error: "invalid_service" }.
     - Unknown serviceId → 404 { error: "service_not_found" }.
     - Service price null/PENDING → 400 { error: "Pricing pending for this service" }.
     - Otherwise → creates a Checkout Pro Preference via the MP SDK and returns
       200 { init_point } (the hosted checkout URL the buyer is redirected to).

   Appointment/contact data (optional, only for bookable calls):
     - Accepted ONLY for the bookable calls `llamada-30min` / `llamada-45min`.
       If any of these fields is sent for any other service → 400
       { error: "booking_not_applicable" }.
     - `slotId` must be a UUID; name/email/phone must be single, bounded, trimmed
       strings (arrays, objects, numbers, null, blanks or over-long values →
       400 { error: "invalid_booking" }).
     - When present they are attached to the preference `metadata`, and `slotId`
       also becomes the preference `external_reference`.
     - Sending only `serviceId` keeps the original behavior for every service.

   The server-side catalog below mirrors assets/js/catalog.js (client display
   catalog). Keep ids, titles and prices identical. `price` is an integer in
   Colombian pesos (COP); a null price means the service is quoted by
   complexity ("a convenir") and short-circuits with a 400 before the SDK is
   ever reached.

   Credentials are read from the environment only. The access token is never
   logged and never echoed in any response body. No secrets hardcoded.
   ========================================================================== */

'use strict';

var { MercadoPagoConfig, Preference } = require('mercadopago');

// Server-side service catalog (single source of truth for this API). Mirrors
// assets/js/catalog.js — keep ids/titles/prices in sync. price: null = a convenir.
var SERVICES = [
  { id: 'llamada-30min', title: 'Llamada telefónica 30 min', price: 50000 },
  { id: 'llamada-45min', title: 'Llamada telefónica 45 min', price: 100000 },
  { id: 'concepto-1hora', title: 'Concepto / consulta 1 hora', price: 150000 },
  { id: 'derecho-peticion', title: 'Derecho de petición', price: 250000 },
  { id: 'tutela', title: 'Tutela', price: 1000000 },
  { id: 'llamada-test', title: 'Llamada test', price: 5000 },
  { id: 'concepto-complejidad', title: 'Concepto jurídico (según complejidad)', price: null },
  { id: 'contrato', title: 'Contrato (según complejidad)', price: null }
];

// Booking data is only meaningful for the bookable calls below; all other
// services (including the `llamada-test` direct flow) must not send it.
var BOOKABLE_CALLS = ['llamada-30min', 'llamada-45min'];
var BOOKING_FIELDS = ['slotId', 'clientName', 'clientEmail', 'clientPhone'];
var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
var PHONE = /^[+0-9()\s.-]+$/;
var LIMITS = { slotId: 36, clientName: 120, clientEmail: 254, clientPhone: 40 };

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

// Reads an optional field as a single, non-empty, trimmed string within its
// bound. Absent → { present: false }. Any other shape (array, object, number,
// null, over-long or blank string) → { ok: false }.
function optionalString(body, key) {
  if (!Object.prototype.hasOwnProperty.call(body, key)) return { present: false };
  var value = body[key];
  if (typeof value !== 'string') return { ok: false };
  var trimmed = value.trim();
  if (trimmed === '' || [...trimmed].length > LIMITS[key]) return { ok: false };
  return { ok: true, value: trimmed };
}

// Validates the whole optional booking block. Returns { present, values } on
// success, or { error: true } when any provided field has an unknown/multi-value
// shape or fails its format check.
function readBooking(body) {
  var present = false;
  var values = {};

  for (var i = 0; i < BOOKING_FIELDS.length; i += 1) {
    var read = optionalString(body, BOOKING_FIELDS[i]);
    if (read.present === false) continue;
    present = true;
    if (!read.ok) return { error: true };
    values[BOOKING_FIELDS[i]] = read.value;
  }

  if (values.slotId && !UUID.test(values.slotId)) return { error: true };
  if (values.clientEmail && !EMAIL.test(values.clientEmail)) return { error: true };
  if (values.clientPhone && !PHONE.test(values.clientPhone)) return { error: true };

  return { present: present, values: values };
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

  var bookable = BOOKABLE_CALLS.indexOf(service.id) !== -1;
  var booking = readBooking(body);
  if (booking.error) {
    send(res, 400, { error: 'invalid_booking' });
    return;
  }
  if (booking.present && !bookable) {
    // Booking data belongs only to the bookable calls.
    send(res, 400, { error: 'booking_not_applicable' });
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

  var preference = {
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
  };
  if (booking.present) {
    // The appointment reference and contact data travel with the preference so
    // the webhook can later confirm which slot the payment belongs to.
    preference.metadata = booking.values;
    if (booking.values.slotId) preference.external_reference = booking.values.slotId;
  }

  try {
    var client = new MercadoPagoConfig({ accessToken: accessToken });
    var preferenceClient = new Preference(client);
    var result = await preferenceClient.create({ body: preference });

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
