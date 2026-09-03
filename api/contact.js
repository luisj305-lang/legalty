/* ==========================================================================
   LEGALTY — Contact form forwarder (Vercel serverless function)
   --------------------------------------------------------------------------
   POST /api/contact
     body: { name: string, email: string, message: string }

   Behavior:
     - Non-POST methods  → 405 (Allow: POST).
     - Missing/invalid JSON body or malformed email → 400 { error: "validation" }.
     - CONTACT_ENDPOINT unset/empty → 503 { error: "Contact endpoint not configured" }
       (fail closed — never report success when no delivery target exists).
     - Upstream fetch failure or non-2xx → 502 { error: "upstream_error" }.
     - Upstream success → 200 { ok: true }.

   CONTACT_ENDPOINT is read from the environment only; its value is never
   echoed in any response body or message. No secrets hardcoded.
   ========================================================================== */

'use strict';

var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidEmail(value) {
  return typeof value === 'string' && EMAIL_RE.test(value.trim());
}

function send(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    send(res, 405, { error: 'method_not_allowed' });
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
    send(res, 400, { error: 'validation' });
    return;
  }

  var name = body.name;
  var email = body.email;
  var message = body.message;

  if (!isNonEmptyString(name) || !isNonEmptyString(message) || !isValidEmail(email)) {
    send(res, 400, { error: 'validation' });
    return;
  }

  var endpoint = process.env.CONTACT_ENDPOINT;
  if (!endpoint || typeof endpoint !== 'string' || endpoint.trim() === '') {
    // Fail closed — no delivery target configured, never report success.
    send(res, 503, { error: 'Contact endpoint not configured' });
    return;
  }

  try {
    var upstream = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, email: email, message: message })
    });

    if (!upstream.ok) {
      send(res, 502, { error: 'upstream_error' });
      return;
    }

    send(res, 200, { ok: true });
  } catch (err) {
    send(res, 502, { error: 'upstream_error' });
  }
};
