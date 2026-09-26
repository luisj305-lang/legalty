import test from 'node:test';
import assert from 'node:assert/strict';
import { mutateSession, trustedOrigin } from '../lib/auth/mutations.ts';

const origin = 'http://127.0.0.1:3000';
const form = () => new FormData();
test('only explicit canonical origins allow mutations, without trusting host headers', () => {
  for (const value of [null, 'null', 'https://127.0.0.1:3000', 'http://localhost:3000',
    'https://attacker.example', `${origin}/`, `${origin}.evil`]) assert.equal(trustedOrigin(value), false);
  assert.equal(trustedOrigin(origin), true);
  assert.equal(trustedOrigin('https://portal.example', 'https://portal.example'), true);
  assert.equal(trustedOrigin(origin, 'https://portal.example'), false);
  assert.equal(trustedOrigin(origin, 'invalid'), false);
  assert.equal(trustedOrigin(origin, undefined, 'production'), false);
  assert.equal(trustedOrigin('http://127.0.0.1:4567', 'http://127.0.0.1:4567', 'production'), true);
  assert.equal(trustedOrigin('http://portal.example', 'http://portal.example'), false);
});

test('bad origin stops login and logout before constructing a provider client', async () => {
  for (const action of ['login', 'logout'] as const) {
    assert.equal(await mutateSession(action, form(), 'https://foreign.example', undefined,
      () => assert.fail()), '/login?error=credentials');
  }
});

test('empty input, provider errors and throws share the generic fixed redirect', async () => {
  assert.equal(await mutateSession('login', form(), origin, undefined, () => assert.fail()), '/login?error=credentials');
  for (const failure of ['return', 'throw']) {
    const data = form(); data.set('email', 'synthetic@example.invalid'); data.set('password', 'synthetic-only');
    data.set('next', 'https://attacker.example');
    const result = await mutateSession('login', data, origin, undefined, async () => ({
      signIn: async () => { if (failure === 'throw') throw new Error('private'); return false; },
      signOut: async () => true,
    }));
    assert.equal(result, '/login?error=credentials');
  }
});

test('successful login and local logout use only fixed destinations', async () => {
  const data = form(); data.set('email', 'synthetic@example.invalid'); data.set('password', 'synthetic-only');
  const client = async () => ({ signIn: async (email: string, password: string) => {
    assert.equal(email, 'synthetic@example.invalid'); assert.equal(password, 'synthetic-only'); return true;
  }, signOut: async () => true });
  assert.equal(await mutateSession('login', data, origin, undefined, client), '/account');
  assert.equal(await mutateSession('logout', data, origin, undefined, client), '/login');
  assert.equal(await mutateSession('logout', data, origin, undefined, async () => ({
    signIn: async () => true, signOut: async () => false,
  })), '/account?error=logout');
});
