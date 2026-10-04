import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createCallBooking, publicCallBookingClient, POST, type BookingWriter,
} from '../app/api/call-booking/route.ts';

const appointmentId = '22222222-2222-4222-8222-222222222222';
const valid = {
  startsAt: '2026-10-05T14:30:00-05:00',
  serviceId: 'llamada-30min',
  clientName: 'Ana Cliente',
  clientEmail: 'ana@example.test',
  clientPhone: '+573001112233',
};

const writer = (impl: () => Promise<{ data: unknown; error: unknown }>): BookingWriter => ({ rpc: impl });
const json = (value: unknown) => JSON.stringify(value);

// Temporarily removes the public Supabase variables so the route fails closed.
async function withoutEnvironment(run: () => Promise<void>) {
  const names = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'] as const;
  const saved = names.map((name) => [name, process.env[name]] as const);
  for (const name of names) delete process.env[name];
  try {
    await run();
  } finally {
    for (const [name, value] of saved) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

test('registers a valid booking and forwards the trimmed payload', async () => {
  let received: unknown;
  const response = await createCallBooking({
    rpc: async (_name, args) => {
      received = args;
      return { data: appointmentId, error: null };
    },
  }, { ...valid, startsAt: `  ${valid.startsAt}  `, clientName: `  ${valid.clientName}  ` });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, appointmentId });
  assert.deepEqual(received, {
    p_starts_at: valid.startsAt,
    p_service_id: valid.serviceId,
    p_client_name: valid.clientName,
    p_client_email: valid.clientEmail,
    p_client_phone: valid.clientPhone,
  });
});

test('maps the unique violation 23505 to 409 slot_taken', async () => {
  const response = await createCallBooking(writer(async () => ({
    data: null,
    error: { code: '23505', message: 'SYNTHETIC_DATABASE_SECRET' },
  })), valid);
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: 'slot_taken' });
});

test('other provider failures are generic and never leak internals', async () => {
  const response = await createCallBooking(writer(async () => ({
    data: null,
    error: { code: '22023', message: 'SYNTHETIC_DATABASE_SECRET' },
  })), valid);
  assert.equal(response.status, 503);
  const body = await response.text();
  assert.deepEqual(JSON.parse(body), { error: 'booking_unavailable' });
  assert.doesNotMatch(body, /secret|database|supabase/i);
});

test('fails closed and never leaks internals when the writer throws', async () => {
  const response = await createCallBooking(writer(async () => {
    throw new Error('LEAK sb_publishable_internal_marker');
  }), valid);
  assert.equal(response.status, 503);
  const body = await response.text();
  assert.deepEqual(JSON.parse(body), { error: 'booking_unavailable' });
  assert.doesNotMatch(body, /sb_publishable|leak|marker/i);
});

test('rejects malformed payloads without reaching the provider', async () => {
  const payloads: unknown[] = [
    null, undefined, [], 'x', 7,
    { ...valid, startsAt: 'not-a-date' },
    { ...valid, startsAt: '' },
    { ...valid, startsAt: 1234 },
    { ...valid, serviceId: 'llamada-60min' },
    { ...valid, serviceId: '' },
    { ...valid, clientName: '   ' },
    { ...valid, clientName: 7 },
    { ...valid, clientEmail: 'not-an-email' },
    { ...valid, clientPhone: '' },
  ];
  for (const payload of payloads) {
    let called = false;
    const response = await createCallBooking({ rpc: async () => { called = true; return { data: appointmentId, error: null }; } }, payload);
    assert.equal(response.status, 400, json(payload));
    assert.deepEqual(await response.json(), { error: 'invalid_booking' }, json(payload));
    assert.equal(called, false, json(payload));
  }
});

test('rejects a non-uuid appointment id returned by the provider', async () => {
  const response = await createCallBooking(writer(async () => ({ data: 'not-a-uuid', error: null })), valid);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'booking_unavailable' });
});

test('validates public configuration and never accepts a secret key', () => {
  assert.equal(publicCallBookingClient({}), null);
  assert.equal(publicCallBookingClient({
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_never-accepted',
  }), null);

  const client = publicCallBookingClient({
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic',
  });
  assert.equal(typeof client?.rpc, 'function');
});

test('POST rejects malformed JSON and fails closed without configuration', async () => {
  const malformed = await POST(new Request('http://127.0.0.1:3000/api/call-booking', {
    method: 'POST', body: 'not-json', headers: { 'content-type': 'application/json' },
  }));
  assert.equal(malformed.status, 400);
  assert.deepEqual(await malformed.json(), { error: 'invalid_booking' });

  await withoutEnvironment(async () => {
    const response = await POST(new Request('http://127.0.0.1:3000/api/call-booking', {
      method: 'POST', body: JSON.stringify(valid), headers: { 'content-type': 'application/json' },
    }));
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'booking_unavailable' });
  });
});
