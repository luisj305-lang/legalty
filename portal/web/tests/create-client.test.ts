import test from 'node:test';
import assert from 'node:assert/strict';
import { submitCreateClient, type CreateClientSource } from '../lib/cases/create-client.ts';
import type { Access } from '../lib/auth/access.ts';

const origin = 'https://portal.example';
const invitedId = '44444444-4444-4444-8444-444444444444';

function adminAccess(): Access {
  return { state: 'eligible', userId: '11111111-1111-4111-8111-111111111111', role: 'admin' };
}

function source(overrides: Partial<CreateClientSource> = {}): CreateClientSource {
  return {
    access: async () => adminAccess(),
    invite: async () => ({ id: invitedId }),
    provisionProfile: async () => undefined,
    ...overrides,
  };
}

function clientForm(fields: Record<string, string> = {}) {
  const data = new FormData();
  data.set('email', 'nuevo@example.com');
  data.set('first_name', 'Nuevo');
  data.set('last_name', 'Cliente');
  data.set('phone', '+57 300 000 0000');
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

test('create rejects a foreign origin without calling the provider', async () => {
  let invites = 0;
  const result = await submitCreateClient(clientForm(), 'https://evil.example', origin, source({
    invite: async () => { invites++; return { id: invitedId }; },
  }));
  assert.equal(result, '/portal/cases/clients?error=create');
  assert.equal(invites, 0);
});

test('create rejects non-admin access without inviting anyone', async () => {
  for (const access of [
    { state: 'eligible', userId: '11111111-1111-4111-8111-111111111111', role: 'client' } as Access,
    { state: 'eligible', userId: '11111111-1111-4111-8111-111111111111', role: 'staff' } as Access,
  ]) {
    let invites = 0;
    const result = await submitCreateClient(clientForm(), origin, origin, source({
      access: async () => access,
      invite: async () => { invites++; return { id: invitedId }; },
    }));
    assert.equal(result, '/portal/cases/clients?error=create');
    assert.equal(invites, 0);
  }
});

test('create sends signed-out and setup-pending sessions back to their fixed routes', async () => {
  const signedOut = await submitCreateClient(clientForm(), origin, origin, source({
    access: async () => ({ state: 'signed_out' } as Access),
  }));
  assert.equal(signedOut, '/portal/login');
  const pending = await submitCreateClient(clientForm(), origin, origin, source({
    access: async () => ({ state: 'setup_pending', userId: invitedId } as Access),
  }));
  assert.equal(pending, '/portal/account');
});

test('create rejects a malformed email or unknown field without inviting anyone', async () => {
  const cases: [string, FormData][] = [
    ['malformed email', clientForm({ email: 'not-an-email' })],
    ['empty email', clientForm({ email: '   ' })],
    ['unknown field', clientForm({ role: 'admin' })],
  ];
  for (const [label, form] of cases) {
    let invites = 0;
    const result = await submitCreateClient(form, origin, origin, source({
      invite: async () => { invites++; return { id: invitedId }; },
    }));
    assert.equal(result, '/portal/cases/clients?error=create', label);
    assert.equal(invites, 0, label);
  }
});

test('create rejects a missing first name, over-long names, over-long phone without inviting', async () => {
  const cases: [string, FormData][] = [
    ['missing first_name', clientForm({ first_name: '   ' })],
    ['over-long first_name', clientForm({ first_name: 'a'.repeat(121) })],
    ['over-long last_name', clientForm({ last_name: 'b'.repeat(121) })],
    ['over-long phone', clientForm({ phone: '9'.repeat(33) })],
  ];
  for (const [label, form] of cases) {
    let invites = 0;
    const result = await submitCreateClient(form, origin, origin, source({
      invite: async () => { invites++; return { id: invitedId }; },
    }));
    assert.equal(result, '/portal/cases/clients?error=create', label);
    assert.equal(invites, 0, label);
  }
});

test('create fails safely when the invite provider returns null', async () => {
  let provisions = 0;
  const result = await submitCreateClient(clientForm(), origin, origin, source({
    invite: async () => null,
    provisionProfile: async () => { provisions++; },
  }));
  assert.equal(result, '/portal/cases/clients?error=create');
  assert.equal(provisions, 0);
});

test('create reports success only after the invited user is provisioned with trimmed values', async () => {
  const seen: { email: string; userId: string; first: string; last: string | null; phone: string | null }[] = [];
  const result = await submitCreateClient(clientForm({
    email: '  nuevo@example.com  ', first_name: '  Nuevo  ', last_name: '  Cliente  ', phone: '  +57 311 111 1111  ',
  }), origin, origin, source({
    invite: async (email) => { seen.push({ email, userId: '', first: '', last: null, phone: null }); return { id: invitedId }; },
    provisionProfile: async (userId, first, last, phone) => {
      const lastSeen = seen[seen.length - 1];
      lastSeen.userId = userId; lastSeen.first = first; lastSeen.last = last; lastSeen.phone = phone;
    },
  }));
  assert.equal(result, '/portal/cases/clients?created=1');
  assert.deepEqual(seen, [{ email: 'nuevo@example.com', userId: invitedId, first: 'Nuevo', last: 'Cliente', phone: '+57 311 111 1111' }]);
});

test('create forwards blank optional last name and phone as null', async () => {
  const seen: (string | null)[][] = [];
  const result = await submitCreateClient(clientForm({ last_name: '   ', phone: '' }), origin, origin, source({
    provisionProfile: async (_userId, _first, last, phone) => { seen.push([last, phone]); },
  }));
  assert.equal(result, '/portal/cases/clients?created=1');
  assert.deepEqual(seen, [[null, null]]);
});

test('create reports a distinct pending outcome when provisioning fails after a successful invite', async () => {
  const result = await submitCreateClient(clientForm(), origin, origin, source({
    invite: async () => ({ id: invitedId }),
    provisionProfile: async () => { throw new Error('provision exploded'); },
  }));
  assert.equal(result, '/portal/cases/clients?pending=profile');
});

test('create degrades a thrown invite provider error to the generic error destination', async () => {
  const result = await submitCreateClient(clientForm(), origin, origin, source({
    invite: async () => { throw new Error('invite exploded'); },
  }));
  assert.equal(result, '/portal/cases/clients?error=create');
});
