import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { refreshSession } from '../lib/supabase/proxy.ts';

test('refresh forwards every cookie, deletion and cache header across multiple writes', async () => {
  const request = new NextRequest('http://127.0.0.1:3000/account');
  const response = await refreshSession(request, (_env, cookies) => ({ auth: {
    getUser: async () => {
      await cookies.setAll([{ name: 'chunk-1', value: 'synthetic', options: {} }],
        { 'Cache-Control': 'private, no-store', Expires: '0', Pragma: 'no-cache' });
      await cookies.setAll([{ name: 'chunk-2', value: '', options: { maxAge: 0 } }], {});
      return { data: { user: null }, error: null };
    },
  } } as unknown as SupabaseClient));
  assert.equal(request.cookies.get('chunk-1')?.value, 'synthetic');
  assert.equal(response.cookies.getAll().length, 2);
  assert.equal(response.cookies.get('chunk-2')?.maxAge, 0);
  assert.equal(response.cookies.get('chunk-1')?.httpOnly, true);
  assert.equal(response.cookies.get('chunk-1')?.sameSite, 'lax');
  for (const [key, value] of [['cache-control', 'private, no-store'], ['expires', '0'], ['pragma', 'no-cache']]) {
    assert.equal(response.headers.get(key), value);
  }
});

test('foreign or absent POST origins reject before any session/provider work', async () => {
  for (const origin of ['', 'https://foreign.example']) {
    const response = await refreshSession(new NextRequest('http://127.0.0.1:3000/account', {
      method: 'POST', headers: origin ? { origin } : {},
    }), () => assert.fail());
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
});
