import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createRequestClient, accountAccess } from '../lib/supabase/server.ts';

const environment = { NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic' };

test('request clients are independent and require validated public configuration', () => {
  const cookies = { getAll: () => [], setAll: () => {} };
  assert.notEqual(createRequestClient(environment, cookies), createRequestClient(environment, cookies));
  assert.throws(() => createRequestClient({}, cookies), /Unavailable configuration/);
  assert.throws(() => createRequestClient({ ...environment,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_never-accepted' }, cookies), /Unavailable configuration/);
});

test('SSR passes the complete request cookie contract, including cache headers', () => {
  const applied: unknown[] = [];
  const cookies = { getAll: () => [{ name: 'test-cookie', value: 'synthetic' }],
    setAll: (...args: unknown[]) => { applied.push(...args); } };
  createRequestClient(environment, cookies, (_url, _key, options) => {
    assert.equal(options.cookies, cookies);
    options.cookies.setAll!([{ name: 'chunk-1', value: 'new', options: { httpOnly: true } },
      { name: 'chunk-2', value: '', options: { maxAge: 0 } }], { 'Cache-Control': 'private, no-store' });
    assert.equal(options.auth.debug, false);
    return {} as SupabaseClient;
  });
  assert.equal((applied[0] as unknown[]).length, 2);
  assert.deepEqual(applied[1], { 'Cache-Control': 'private, no-store' });
});

test('adapter calls getUser then fresh own-profile selection, never getSession/metadata', async () => {
  const calls: unknown[] = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'verified' } }, error: null }),
      mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: 'aal1' }, error: null }) } },
    from: (table: string) => { calls.push(table); return {
      select: (fields: string) => { calls.push(fields); return {
        eq: (field: string, id: string) => { calls.push([field, id]); return {
          maybeSingle: async () => ({ data: { id, role: 'admin', active: true, must_change_password: false }, error: null }),
        }; },
      }; },
    }; },
  } as unknown as SupabaseClient;
  assert.deepEqual(await accountAccess(client), { state: 'eligible', userId: 'verified', role: 'admin' });
  assert.deepEqual(calls, ['profiles', 'id,role,active,must_change_password', ['id', 'verified']]);
});

test('adapter identity errors deny without profile queries or private errors in output', async () => {
  const client = { auth: { getUser: async () => ({ data: { user: { id: 'spoofed' } }, error: new Error('private') }) },
    from: () => assert.fail() } as unknown as SupabaseClient;
  assert.deepEqual(await accountAccess(client), { state: 'signed_out' });
});

test('profile errors cannot authorize even when the provider also supplies a row', async () => {
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'verified' } }, error: null }),
      mfa: { getAuthenticatorAssuranceLevel: () => assert.fail() } },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({
      data: { id: 'verified', role: 'admin', active: true, must_change_password: false },
      error: new Error('private'),
    }) }) }) }),
  } as unknown as SupabaseClient;
  assert.deepEqual(await accountAccess(client), { state: 'setup_pending', userId: 'verified' });
});

test('provider HTTP calls disable caching and preserve caller cancellation', async () => {
  const originalFetch = globalThis.fetch;
  const controller = new AbortController();
  const calls: RequestInit[] = [];
  globalThis.fetch = async (_input, init) => { calls.push(init!); return new Response('{}'); };
  try {
    let request: typeof fetch | undefined;
    createRequestClient(environment, { getAll: () => [], setAll: () => {} }, (_url, _key, options) => {
      request = options.global.fetch;
      return {} as SupabaseClient;
    });
    await request!('https://example.invalid', { cache: 'force-cache', signal: controller.signal });
    assert.equal(calls[0].cache, 'no-store');
    controller.abort();
    assert.equal(calls[0].signal?.aborted, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
