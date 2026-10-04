import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

import { adaptLegacy, loadLegacyHandler, type LegacyHandler, type LegacyHandlerName } from '../lib/api/adapt-legacy.ts';

const handlers: Record<LegacyHandlerName, LegacyHandler> = {
  contact: await loadLegacyHandler('contact'),
  'create-preference': await loadLegacyHandler('create-preference'),
  webhook: await loadLegacyHandler('webhook'),
};

const base = 'http://127.0.0.1:3000';
const route = (name: LegacyHandlerName, request: Request) => adaptLegacy(handlers[name], request);
const get = (path: string) => new Request(`${base}${path}`);
const post = (path: string, body?: string, headers: Record<string, string> = {}) =>
  new Request(`${base}${path}`, { method: 'POST', body, headers });
const json = (value: unknown) => JSON.stringify(value);

function withEnv(name: string, value: string | undefined, run: () => Promise<void>) {
  const original = process.env[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
  return run().finally(() => {
    if (original === undefined) delete process.env[name];
    else process.env[name] = original;
  });
}

test('real route handlers reject non-POST with 405 and Allow: POST', async () => {
  const cases: LegacyHandlerName[] = ['contact', 'create-preference', 'webhook'];
  for (const name of cases) {
    const res = await route(name, get(`/api/${name}`));
    assert.equal(res.status, 405, name);
    assert.equal(res.headers.get('allow'), 'POST', name);
    assert.equal(await res.text(), json({ error: 'method_not_allowed' }), name);
  }
});

test('contact validates the body and fails closed without an endpoint', async () => {
  const malformed = await route('contact', post('/api/contact', 'not-json', { 'content-type': 'application/json' }));
  assert.equal(malformed.status, 400);
  assert.deepEqual(await malformed.json(), { error: 'validation' });

  const valid = json({ name: 'Ana', email: 'ana@example.co', message: 'hola' });
  const missingEnv = await route('contact', post('/api/contact', valid, { 'content-type': 'application/json' }));
  assert.equal(missingEnv.status, 503);
  assert.deepEqual(await missingEnv.json(), { error: 'Contact endpoint not configured' });
});

test('contact forwards success and upstream failure without echoing the endpoint', async () => {
  const originalFetch = globalThis.fetch;
  const endpoint = 'https://hooks.example.test/contact';
  await withEnv('CONTACT_ENDPOINT', endpoint, async () => {
    const valid = json({ name: 'Ana', email: 'ana@example.co', message: 'hola' });
    globalThis.fetch = (async () => new Response('', { status: 200 })) as typeof fetch;
    const ok = await route('contact', post('/api/contact', valid, { 'content-type': 'application/json' }));
    assert.equal(ok.status, 200);
    const okBody = await ok.text();
    assert.deepEqual(JSON.parse(okBody), { ok: true });
    assert.doesNotMatch(okBody, /hooks\.example/);

    globalThis.fetch = (async () => new Response('', { status: 500 })) as typeof fetch;
    const upstream = await route('contact', post('/api/contact', valid, { 'content-type': 'application/json' }));
    assert.equal(upstream.status, 502);
    assert.deepEqual(await upstream.json(), { error: 'upstream_error' });
  });
  globalThis.fetch = originalFetch;
});

test('create-preference fails closed without credentials and validates the service', async () => {
  const missingEnv = await route('create-preference', post('/api/create-preference', json({ serviceId: 'concepto-complejidad' }), { 'content-type': 'application/json' }));
  assert.equal(missingEnv.status, 503);
  assert.deepEqual(await missingEnv.json(), { error: 'Mercado Pago not configured' });

  await withEnv('MP_ACCESS_TOKEN', 'test-token-not-real', async () => {
    const malformed = await route('create-preference', post('/api/create-preference', 'not-json', { 'content-type': 'application/json' }));
    assert.equal(malformed.status, 400);
    assert.deepEqual(await malformed.json(), { error: 'invalid_service' });

    const unknown = await route('create-preference', post('/api/create-preference', json({ serviceId: 'nope' }), { 'content-type': 'application/json' }));
    assert.equal(unknown.status, 404);
    assert.deepEqual(await unknown.json(), { error: 'service_not_found' });

    const pending = await route('create-preference', post('/api/create-preference', json({ serviceId: 'concepto-complejidad' }), { 'content-type': 'application/json' }));
    assert.equal(pending.status, 400);
    assert.deepEqual(await pending.json(), { error: 'Pricing pending for this service' });
  });
});

test('create-preference validates booking data and rejects it for non-call services', async () => {
  await withEnv('MP_ACCESS_TOKEN', 'test-token-not-real', async () => {
    // The contract is unchanged: the legacy `slotId` field now carries the
    // appointment id returned by /api/call-booking, so it must remain a UUID.
    const appointmentId = '11111111-1111-4111-8111-111111111111';
    const invalid = [
      { serviceId: 'llamada-30min', slotId: 'not-a-uuid' },
      { serviceId: 'llamada-30min', slotId: [appointmentId] },
      { serviceId: 'llamada-30min', clientName: 7 },
      { serviceId: 'llamada-30min', clientEmail: 'not-an-email' },
      { serviceId: 'llamada-30min', clientPhone: '!!!' },
      { serviceId: 'llamada-30min', clientName: '   ' },
    ];
    for (const payload of invalid) {
      const res = await route('create-preference', post('/api/create-preference', json(payload), { 'content-type': 'application/json' }));
      assert.equal(res.status, 400, json(payload));
      assert.deepEqual(await res.json(), { error: 'invalid_booking' }, json(payload));
    }

    for (const serviceId of ['llamada-test', 'concepto-1hora', 'tutela', 'derecho-peticion']) {
      const res = await route('create-preference', post('/api/create-preference', json({ serviceId, slotId: appointmentId }), { 'content-type': 'application/json' }));
      assert.equal(res.status, 400, serviceId);
      assert.deepEqual(await res.json(), { error: 'booking_not_applicable' }, serviceId);
    }
  });
});

test('webhook fails closed without a secret and rejects unsigned notifications', async () => {
  const missingEnv = await route('webhook', post('/api/webhook', json({ data: { id: 'pay-1' } }), { 'content-type': 'application/json' }));
  assert.equal(missingEnv.status, 503);
  assert.deepEqual(await missingEnv.json(), { error: 'Webhook not configured' });

  await withEnv('MP_WEBHOOK_SECRET', 'test-secret', async () => {
    const unsigned = await route('webhook', post('/api/webhook', json({ type: 'payment', action: 'payment.created', data: { id: 'pay-1' } }), { 'content-type': 'application/json' }));
    assert.equal(unsigned.status, 401);
    assert.deepEqual(await unsigned.json(), { error: 'invalid_signature' });
  });
});

test('webhook accepts a correctly signed notification', async () => {
  const secret = 'test-secret';
  await withEnv('MP_WEBHOOK_SECRET', secret, async () => {
    const dataId = 'pay-1';
    const requestId = 'req-2';
    const ts = String(Math.floor(Date.now() / 1000));
    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const v1 = createHmac('sha256', secret).update(manifest).digest('hex');
    const res = await route('webhook', post('/api/webhook', json({ type: 'payment', action: 'payment.created', data: { id: dataId } }), {
      'content-type': 'application/json',
      'x-signature': `ts=${ts},v1=${v1}`,
      'x-request-id': requestId,
    }));
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
  });
});
