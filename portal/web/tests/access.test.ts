import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAccess, type AccessSource } from '../lib/auth/access.ts';

const profile = { id: 'user-1', role: 'client', active: true, must_change_password: false };
const source = (overrides: Partial<AccessSource> = {}): AccessSource => ({
  verifyIdentity: async () => ({ id: 'user-1' }),
  readOwnProfile: async () => profile,
  readAssurance: async () => 'aal1',
  ...overrides,
});

test('unverified or malformed identity denies before reading profile', async () => {
  for (const identity of [null, {}, { id: '' }, { id: 12 }]) {
    assert.equal((await resolveAccess(source({ verifyIdentity: async () => identity,
      readOwnProfile: () => assert.fail() }))).state, 'signed_out');
  }
  assert.equal((await resolveAccess(source({ verifyIdentity: async () => { throw new Error('private'); } }))).state, 'signed_out');
});

test('missing, inactive, foreign or malformed profiles stay setup-pending', async () => {
  for (const value of [null, {}, { ...profile, id: 'other' }, { ...profile, active: false },
    { ...profile, active: 'true' }, { ...profile, role: 'owner' },
    { ...profile, must_change_password: true }, { ...profile, must_change_password: undefined }]) {
    assert.equal((await resolveAccess(source({ readOwnProfile: async () => value }))).state, 'setup_pending');
  }
  const result = await resolveAccess(source({ readOwnProfile: async () => { throw new Error('private'); } }));
  assert.equal(result.state, 'setup_pending');
  assert.ok(!JSON.stringify(result).includes('private'));
});

test('provider role metadata never substitutes for the trusted profile', async () => {
  const result = await resolveAccess(source({ verifyIdentity: async () => ({ id: 'user-1',
    app_metadata: { role: 'admin', active: true }, user_metadata: { role: 'admin' } }),
    readOwnProfile: async () => null }));
  assert.equal(result.state, 'setup_pending');
});

test('staff/admin need AAL2; clients need valid assurance and active profile', async () => {
  for (const role of ['client', 'staff', 'admin']) {
    for (const assurance of ['aal1', 'aal2', null, 'unknown']) {
      const result = await resolveAccess(source({ readOwnProfile: async () => ({ ...profile, role }),
        readAssurance: async () => assurance }));
      const allowed = assurance === 'aal2' || role === 'client' && assurance === 'aal1';
      assert.equal(result.state, allowed ? 'eligible' : 'setup_pending');
    }
  }
  assert.equal((await resolveAccess(source({ readAssurance: async () => { throw new Error(); } }))).state, 'setup_pending');
});

test('reads fresh profile on every request using only verified identity id', async () => {
  let reads = 0;
  const client = source({ readOwnProfile: async id => {
    assert.equal(id, 'user-1');
    return { ...profile, active: ++reads === 1 };
  } });
  assert.equal((await resolveAccess(client)).state, 'eligible');
  assert.equal((await resolveAccess(client)).state, 'setup_pending');
  assert.equal(reads, 2);
});
