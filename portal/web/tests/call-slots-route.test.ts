import test from 'node:test';
import assert from 'node:assert/strict';

import { readCallSlots, publicCallSlotsClient, GET, type SlotsReader } from '../app/api/call-slots/route.ts';

const reader = (impl: () => Promise<{ data: unknown; error: unknown }>): SlotsReader => ({ rpc: impl });
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

test('returns 200 and keeps only the starts_at instant per slot', async () => {
  const rows = [
    {
      starts_at: '2026-10-05T19:30:00+00:00',
      created_by: 'internal-profile-id',
      client_email: 'leak@example.test',
    },
    { starts_at: '2026-10-06T14:00:00+00:00', id: 'no-longer-exposed' },
  ];
  const response = await readCallSlots(reader(async () => ({ data: rows, error: null })));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    slots: [
      { starts_at: '2026-10-05T19:30:00+00:00' },
      { starts_at: '2026-10-06T14:00:00+00:00' },
    ],
  });
});

test('fails closed with a generic non-200 when the provider returns an error', async () => {
  const response = await readCallSlots(reader(async () => ({
    data: null,
    error: { message: 'SYNTHETIC_DATABASE_SECRET' },
  })));
  assert.notEqual(response.status, 200);
  const body = await response.text();
  assert.deepEqual(JSON.parse(body), { error: 'slots_unavailable' });
  assert.doesNotMatch(body, /secret|database|supabase/i);
});

test('fails closed and never leaks internals when the provider throws', async () => {
  const response = await readCallSlots(reader(async () => {
    throw new Error('LEAK sb_publishable_internal_marker');
  }));
  assert.notEqual(response.status, 200);
  const body = await response.text();
  assert.deepEqual(JSON.parse(body), { error: 'slots_unavailable' });
  assert.doesNotMatch(body, /sb_publishable|leak|marker/i);
});

test('rejects malformed payloads instead of fabricating slots', async () => {
  const payloads: unknown[] = [
    null,
    { slots: [] },
    [{ id: '11111111-1111-4111-8111-111111111111' }],
    [{ starts_at: 1234 }],
    [null],
  ];
  for (const data of payloads) {
    const response = await readCallSlots(reader(async () => ({ data, error: null })));
    assert.notEqual(response.status, 200, json(data));
    assert.deepEqual(await response.json(), { error: 'slots_unavailable' }, json(data));
  }
});

test('an empty result list is a valid 200 with no slots', async () => {
  const response = await readCallSlots(reader(async () => ({ data: [], error: null })));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { slots: [] });
});

test('validates public configuration and never accepts a secret key', () => {
  assert.equal(publicCallSlotsClient({}), null);
  assert.equal(publicCallSlotsClient({
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_never-accepted',
  }), null);

  const client = publicCallSlotsClient({
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic',
  });
  assert.equal(typeof client?.rpc, 'function');
});

test('GET fails closed when the environment is not configured', async () => {
  await withoutEnvironment(async () => {
    const response = await GET();
    assert.notEqual(response.status, 200);
    assert.deepEqual(await response.json(), { error: 'slots_unavailable' });
  });
});
