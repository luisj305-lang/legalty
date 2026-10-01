/* ==========================================================================
   LEGALTY — Mercado Pago webhook / IPN receiver (Vercel serverless function)
   --------------------------------------------------------------------------
   POST /api/webhook
     headers: x-signature: ts=<ts>,v1=<hmac>   (format "ts=...,v1=...")
              x-request-id: <request-id>
     body:    { type, action, data: { id: "<payment-id>" } }

   Behavior:
     - Non-POST methods → 405 (Allow: POST).
     - MP_WEBHOOK_SECRET unset → 503 fail-closed (cannot verify authenticity).
     - Signature invalid/forged → 401 (never process an untrusted notification).
     - Valid + already-seen payment id → 200 idempotent (no duplicate processing).
     - Valid + new → record/log the payment status → 200 { ok: true }.

   Signature scheme (Mercado Pago official — verified against the installed
   SDK's WebhookSignatureValidator):
       manifest = "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
       hash     = HMAC-SHA256(secret, manifest)  (hex)
   The x-signature header carries "ts=<ts>,v1=<hash>". We recompute the v1 hash
   and compare it in constant time (crypto.timingSafeEqual), then enforce a
   timestamp tolerance to reject stale replays.

   NOTE: an earlier internal note described the manifest as a naive
   concatenation "<data.id><x-request-id><ts>". That is INCORRECT — Mercado
   Pago uses the labeled `id:`/`request-id:`/`ts:` segments joined by `;` with
   a trailing `;`. The naive form would reject every real notification.

   Idempotency: best-effort in-memory Map keyed by data.id with a 1-hour TTL.
   This is NOT durable — a serverless cold start resets it, so a duplicate
   delivered to a fresh instance is not detected (documented limitation).
   Signature validation is the hard gate (forged requests are always rejected);
   the Map only suppresses re-processing of genuine replays within a warm
   instance. Replace this Map with a durable store (DB) when payment
   persistence lands.

   MP_WEBHOOK_SECRET is read from the environment only and never echoed.
   ========================================================================== */

'use strict';

var crypto = require('crypto');

// Best-effort in-memory dedupe: payment id → epoch ms when first seen.
// TTL 1 hour. Not durable across cold starts (see header comment).
var seenPayments = new Map();
var DEDUPE_TTL_MS = 60 * 60 * 1000; // 1 hour
var SIGNATURE_TOLERANCE_SECONDS = 300; // 5 min — reject stale/replayed timestamps

function send(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

// Normalise a header value (may be string, array, null, undefined) into a
// trimmed non-empty string, or undefined. Mirrors the SDK's normalise() so the
// manifest is built identically when a part is missing.
function normalise(value) {
  if (value === undefined || value === null) return undefined;
  var raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined || raw === null) return undefined;
  var trimmed = String(raw).trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

// Build the signed manifest exactly as Mercado Pago does. Missing parts are
// omitted (matching the SDK); `ts` is always present for a valid signature.
function buildManifest(dataId, requestId, ts) {
  var parts = [];
  if (dataId) parts.push('id:' + dataId);
  if (requestId) parts.push('request-id:' + requestId);
  parts.push('ts:' + ts);
  return parts.join(';') + ';';
}

// Parse "ts=<ts>,v1=<hash>" into { ts, v1 }. Returns null on malformed input.
function parseSignatureHeader(header) {
  if (!header || typeof header !== 'string') return null;
  var ts = null;
  var v1 = null;
  var parts = header.split(',');
  for (var i = 0; i < parts.length; i++) {
    var eq = parts[i].indexOf('=');
    if (eq === -1) continue;
    var key = parts[i].slice(0, eq).trim().toLowerCase();
    var value = parts[i].slice(eq + 1).trim();
    if (key === 'ts') ts = value;
    else if (key === 'v1') v1 = value;
  }
  if (!ts || !v1) return null;
  return { ts: ts, v1: v1 };
}

// Constant-time hex-string comparison (mitigates timing side-channels).
function timingSafeEqualHex(a, b) {
  if (Buffer.byteLength(a) !== Buffer.byteLength(b)) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// Verify the Mercado Pago webhook signature. Returns true only when the header
// is well-formed AND the recomputed HMAC matches in constant time AND the
// timestamp is within tolerance.
function verifySignature(secret, dataId, xRequestId, xSignature) {
  var parsed = parseSignatureHeader(xSignature);
  if (!parsed) return false;
  if (!/^\d+$/.test(parsed.ts)) return false;

  var manifest = buildManifest(normalise(dataId), normalise(xRequestId), parsed.ts);
  var computed = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  if (!timingSafeEqualHex(computed, parsed.v1)) return false;

  var nowSeconds = Math.floor(Date.now() / 1000);
  var tsSeconds = Number(parsed.ts);
  if (Math.abs(nowSeconds - tsSeconds) > SIGNATURE_TOLERANCE_SECONDS) return false;

  return true;
}

function pruneSeenPayments(now) {
  seenPayments.forEach(function (seenAt, id) {
    if (now - seenAt > DEDUPE_TTL_MS) seenPayments.delete(id);
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    send(res, 405, { error: 'method_not_allowed' });
    return;
  }

  var secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret || typeof secret !== 'string' || secret.trim() === '') {
    // Fail closed — without the shared secret we cannot authenticate MP.
    send(res, 503, { error: 'Webhook not configured' });
    return;
  }

  // Vercel auto-parses JSON bodies; tolerate a raw string body too.
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

  var data = body && typeof body === 'object' ? body.data : null;
  var dataId = data && data.id;

  // A signed notification MUST carry data.id; without it we cannot verify (or
  // dedupe) it. The signature check below would reject it anyway (the manifest
  // would omit the id segment), but fail explicitly for clarity.
  if (!dataId) {
    send(res, 401, { error: 'invalid_signature' });
    return;
  }

  var xSignature = req.headers['x-signature'];
  var xRequestId = req.headers['x-request-id'];

  if (!verifySignature(secret, String(dataId), String(xRequestId || ''), xSignature)) {
    send(res, 401, { error: 'invalid_signature' });
    return;
  }

  var paymentId = String(dataId);

  // Idempotency — best-effort dedupe within a warm instance.
  var now = Date.now();
  pruneSeenPayments(now);
  if (seenPayments.has(paymentId)) {
    send(res, 200, { ok: true, duplicate: true });
    return;
  }
  seenPayments.set(paymentId, now);

  // PENDING: persist payment status to durable storage (DB) here. For now we
  // only log the confirmed notification for manual reconciliation.
  console.log('[webhook] confirmed Mercado Pago notification', {
    id: paymentId,
    type: body && body.type,
    action: body && body.action
  });

  send(res, 200, { ok: true });
};
