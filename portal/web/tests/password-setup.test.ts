import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setupPassword, type PasswordSource } from '../lib/auth/password-setup.ts';
import { completeRotation } from '../lib/auth/complete-rotation.ts';

const id = '11111111-1111-4111-8111-111111111111';
const origin = 'https://portal.example';
function fixture() {
  const calls: string[] = [];
  const form = new FormData();
  form.set('password', 'Synthetic-new-password-42');
  form.set('confirmation', 'Synthetic-new-password-42');
  const source: PasswordSource = {
    verifyIdentity: async () => { calls.push('identity'); return id; },
    prepareCompletion: async userId => {
      assert.equal(userId, id); calls.push('prepare');
      return async () => { calls.push('complete'); return true; };
    },
    updatePassword: async password => { assert.equal(password, form.get('password')); calls.push('password'); return true; },
    readRotation: async userId => { assert.equal(userId, id); calls.push('read'); return false; },
  };
  return { calls, form, source };
}

test('origin and input deny before provider work, never accept identity or privilege fields', async () => {
  for (const mutate of [
    (f: FormData) => f.set('password', 'short'),
    (f: FormData) => f.set('confirmation', 'different'),
    (f: FormData) => f.set('id', id),
    (f: FormData) => f.set('role', 'admin'),
    (f: FormData) => f.set('active', 'true'),
    (f: FormData) => f.append('password', 'duplicate'),
    (f: FormData) => { f.set('password', 'a'.repeat(73)); f.set('confirmation', 'a'.repeat(73)); },
  ]) {
    const { form, source, calls } = fixture(); mutate(form);
    assert.equal(await setupPassword(form, origin, origin, source), '/setup/password?error=update');
    assert.deepEqual(calls, []);
  }
  for (const invalid of [null, 'https://foreign.example', 'http://portal.example']) {
    const { form, source, calls } = fixture();
    await setupPassword(form, invalid, origin, source); assert.deepEqual(calls, []);
  }
});

test('only verified provider success permits own-profile completion and fresh read', async () => {
  const { form, source, calls } = fixture();
  assert.equal(await setupPassword(form, origin, origin, source), '/setup/password?status=updated');
  assert.deepEqual(calls, ['identity', 'prepare', 'password', 'complete', 'read']);
});

test('missing identity or server configuration cannot change password', async () => {
  for (const stage of ['identity', 'configuration']) {
    const { form, source, calls } = fixture();
    if (stage === 'identity') source.verifyIdentity = async () => null;
    else source.prepareCompletion = async () => null;
    const result = await setupPassword(form, origin, origin, source);
    assert.ok(result === '/login' || result === '/setup/password?error=update');
    assert.ok(!calls.includes('password'));
  }
});

test('provider/MFA failure never completes; partial completion stays pending without retries', async () => {
  for (const stage of ['provider', 'completion', 'read', 'throw']) {
    const { form, source, calls } = fixture();
    if (stage === 'provider') source.updatePassword = async () => false;
    if (stage === 'completion') source.prepareCompletion = async () => async () => false;
    if (stage === 'read') source.readRotation = async () => true;
    if (stage === 'throw') source.updatePassword = async () => { throw new Error('SYNTHETIC_PRIVATE_ERROR'); };
    assert.equal(await setupPassword(form, origin, origin, source), '/setup/password?error=update');
    if (stage === 'provider' || stage === 'throw') assert.ok(!calls.includes('complete'));
    assert.ok(calls.filter(x => x === 'password').length <= 1);
  }
});

test('privileged adapter is server-only with no public-secret name or activation payload', () => {
  const source = readFileSync(new URL('../lib/supabase/password-completion.ts', import.meta.url), 'utf8');
  assert.match(source, /import 'server-only'/);
  assert.match(source, /SUPABASE_SECRET_KEY/);
  assert.doesNotMatch(source, /NEXT_PUBLIC_.*SECRET|active:|role:/);
  assert.match(source, /persistSession: false/);
  assert.match(source, /autoRefreshToken: false/);
});

test('completion capability scopes exact payload and identity and rejects missing/error/foreign rows', async () => {
  for (const result of [
    { data: { id, must_change_password: false }, error: null },
    { data: null, error: null },
    { data: { id: 'foreign', must_change_password: false }, error: null },
    { data: { id, must_change_password: true }, error: null },
    { data: { id, must_change_password: false }, error: 'synthetic-error' },
  ]) {
    const client = { from: (table: string) => {
      assert.equal(table, 'profiles');
      return { update: (payload: unknown) => {
        assert.deepEqual(payload, { must_change_password: false });
        return { eq: (column: string, identity: string) => {
          assert.equal(column, 'id'); assert.equal(identity, id);
          return { select: (columns: string) => {
            assert.equal(columns, 'id,must_change_password');
            return { maybeSingle: async () => result };
          } };
        } };
      } };
    } };
    assert.equal(await completeRotation(client, id), result.data?.id === id &&
      result.data?.must_change_password === false && !result.error);
  }
});
