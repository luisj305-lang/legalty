import test from 'node:test';
import assert from 'node:assert/strict';
import { mutateMfa, type MfaSource } from '../lib/auth/mfa.ts';

const origin = 'https://portal.example';
function fixture() {
  const calls: string[] = [];
  const source: MfaSource = {
    identity: async () => 'own-user',
    factors: async () => [{ id: 'own-factor', factor_type: 'totp', status: 'verified' }],
    enroll: async () => { calls.push('enroll'); return { id: 'new-factor', svg: '<svg></svg>' }; },
    verify: async (id, code) => { assert.equal(id, 'own-factor'); assert.equal(code, '123456'); calls.push('verify'); return true; },
    assurance: async () => 'aal2',
  };
  const form = new FormData(); form.set('intent', 'verify'); form.set('factorId', 'own-factor'); form.set('code', '123456');
  return { source, calls, form };
}

test('MFA denies absent/foreign origins and unverified identity without mutation', async () => {
  for (const bad of [null, 'https://foreign.example']) {
    const { source, form, calls } = fixture();
    assert.equal((await mutateMfa(form, bad, origin, source)).state, 'error');
    assert.deepEqual(calls, []);
  }
  const { source, form, calls } = fixture(); source.identity = async () => null;
  assert.equal((await mutateMfa(form, origin, origin, source)).state, 'error');
  assert.deepEqual(calls, []);
});

test('MFA factor ownership and six-digit code are verified before challenge', async () => {
  for (const [field, value] of [['factorId', 'foreign'], ['code', '12'], ['intent', 'remove'], ['userId', 'attacker']]) {
    const { source, form, calls } = fixture(); form.set(field, value);
    assert.equal((await mutateMfa(form, origin, origin, source)).state, 'error');
    assert.deepEqual(calls, []);
  }
});

test('owned verified and unverified factors require provider success AND fresh AAL2', async () => {
  for (const status of ['verified', 'unverified']) {
    const { source, form } = fixture(); source.factors = async () => [{ id: 'own-factor', factor_type: 'totp', status }];
    assert.equal((await mutateMfa(form, origin, origin, source)).state, 'verified');
    source.assurance = async () => 'aal1';
    assert.equal((await mutateMfa(form, origin, origin, source)).state, 'error');
    source.verify = async () => false;
    assert.equal((await mutateMfa(form, origin, origin, source)).state, 'error');
  }
});

test('enrollment is explicit, blocks duplicates, and returns only image-encoded QR', async () => {
  const { source, calls } = fixture(); const form = new FormData(); form.set('intent', 'enroll');
  assert.equal((await mutateMfa(form, origin, origin, source)).state, 'error');
  assert.deepEqual(calls, []);
  source.factors = async () => [];
  const result = await mutateMfa(form, origin, origin, source);
  assert.equal(result.state, 'enrolled');
  if (result.state === 'enrolled') assert.match(result.qr, /^data:image\/svg\+xml;charset=utf-8,%3Csvg/);
  assert.deepEqual(calls, ['enroll']);
  source.enroll = async () => ({ id: 'new-factor', svg: 'data:image/svg+xml;utf-8,<svg></svg>' });
  assert.equal((await mutateMfa(form, origin, origin, source)).state, 'enrolled');
  source.enroll = async () => { throw new Error('SYNTHETIC_PROVIDER_SECRET'); };
  assert.deepEqual(await mutateMfa(form, origin, origin, source), { state: 'error' });
});
