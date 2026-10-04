import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseProfileContacts, submitProfileContact,
  type ProfileContact, type ProfileContactSource,
} from '../lib/cases/contacts.ts';
import type { Access } from '../lib/auth/access.ts';

const origin = 'https://portal.example';

function adminAccess(): Access {
  return { state: 'eligible', userId: '11111111-1111-4111-8111-111111111111', role: 'admin' };
}

function source(overrides: Partial<ProfileContactSource> = {}): ProfileContactSource {
  return {
    access: async () => adminAccess(),
    updateProfileContact: async () => undefined,
    ...overrides,
  };
}

function contactForm(fields: Record<string, string> = {}) {
  const data = new FormData();
  data.set('id', '22222222-2222-4222-8222-222222222222');
  data.set('first_name', 'Ana');
  data.set('last_name', 'Cliente');
  data.set('phone', '+57 300 000 0000');
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'client@example.com',
    first_name: 'Ana',
    last_name: 'Cliente',
    phone: '+57 300 000 0000',
    role: 'client',
    active: true,
    ...overrides,
  };
}

test('valid contact rows parse with every role, null fields and active flags', () => {
  const value = [
    row(),
    row({ id: '22222222-2222-4222-8222-222222222222', email: 'staff@example.com', role: 'staff', first_name: null, last_name: null, phone: null }),
    row({ id: '33333333-3333-4333-8333-333333333333', email: 'admin@example.com', role: 'admin', active: false }),
  ];
  const expected: ProfileContact[] = [
    { id: '11111111-1111-4111-8111-111111111111', email: 'client@example.com', first_name: 'Ana', last_name: 'Cliente', phone: '+57 300 000 0000', role: 'client', active: true },
    { id: '22222222-2222-4222-8222-222222222222', email: 'staff@example.com', first_name: null, last_name: null, phone: null, role: 'staff', active: true },
    { id: '33333333-3333-4333-8333-333333333333', email: 'admin@example.com', first_name: 'Ana', last_name: 'Cliente', phone: '+57 300 000 0000', role: 'admin', active: false },
  ];
  assert.deepEqual(parseProfileContacts(value), expected);
});

test('an empty contact list is a valid empty list', () => {
  assert.deepEqual(parseProfileContacts([]), []);
});

test('malformed contact rows are rejected as a whole', () => {
  const invalid: [string, unknown][] = [
    ['non-array', 'contacts'],
    ['null', null],
    ['array of null', [null]],
    ['missing id', [row({ id: undefined })]],
    ['non-uuid id', [row({ id: 'not-a-uuid' })]],
    ['missing email', [row({ email: undefined })]],
    ['malformed email', [row({ email: 'not-an-email' })]],
    ['untrimmed email', [row({ email: ' client@example.com ' })]],
    ['over-long email', [row({ email: `${'a'.repeat(250)}@example.com` })]],
    ['numeric first_name', [row({ first_name: 7 })]],
    ['empty first_name', [row({ first_name: '   ' })]],
    ['numeric last_name', [row({ last_name: 7 })]],
    ['empty last_name', [row({ last_name: '   ' })]],
    ['numeric phone', [row({ phone: 5551234 })]],
    ['empty phone', [row({ phone: '   ' })]],
    ['bad role', [row({ role: 'owner' })]],
    ['missing role', [row({ role: undefined })]],
    ['non-boolean active', [row({ active: 'true' })]],
    ['missing active', [row({ active: undefined })]],
    ['duplicate id', [row(), row({ email: 'other@example.com' })]],
  ];
  for (const [label, value] of invalid) assert.equal(parseProfileContacts(value), null, label);
});

test('over-cap contact lists are rejected', () => {
  const value = Array.from({ length: 1001 }, (_, index) => row({
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    email: `user${index}@example.com`,
  }));
  assert.equal(parseProfileContacts(value), null);
});

test('submit rejects a foreign origin without calling the provider', async () => {
  let calls = 0;
  const result = await submitProfileContact(contactForm(), 'https://evil.example', origin, source({
    updateProfileContact: async () => { calls++; },
  }));
  assert.equal(result, '/portal/cases/clients?error=1');
  assert.equal(calls, 0);
});

test('submit rejects non-admin access without calling the provider', async () => {
  for (const access of [
    { state: 'eligible', userId: '11111111-1111-4111-8111-111111111111', role: 'client' } as Access,
    { state: 'signed_out' } as Access,
    { state: 'setup_pending', userId: '11111111-1111-4111-8111-111111111111' } as Access,
  ]) {
    let calls = 0;
    const result = await submitProfileContact(contactForm(), origin, origin, source({
      access: async () => access,
      updateProfileContact: async () => { calls++; },
    }));
    assert.equal(result, '/portal/cases/clients?error=1');
    assert.equal(calls, 0);
  }
});

test('submit rejects a malformed id or over-long fields without calling the provider', async () => {
  const cases: [string, FormData][] = [
    ['bad UUID', contactForm({ id: 'not-a-uuid' })],
    ['over-long first_name', contactForm({ first_name: 'a'.repeat(121) })],
    ['over-long last_name', contactForm({ last_name: 'b'.repeat(121) })],
    ['over-long phone', contactForm({ phone: '9'.repeat(33) })],
  ];
  for (const [label, form] of cases) {
    let calls = 0;
    const result = await submitProfileContact(form, origin, origin, source({
      updateProfileContact: async () => { calls++; },
    }));
    assert.equal(result, '/portal/cases/clients?error=1', label);
    assert.equal(calls, 0, label);
  }
});

test('submit trims and forwards the contact, then reports success', async () => {
  const seen: [string, string | null, string | null, string | null][] = [];
  const result = await submitProfileContact(contactForm({
    id: '22222222-2222-4222-8222-222222222222',
    first_name: '  Ana Actualizada  ', last_name: '  Apellido  ', phone: '  +57 311 111 1111  ',
  }), origin, origin, source({
    updateProfileContact: async (id, first, last, phone) => { seen.push([id, first, last, phone]); },
  }));
  assert.equal(result, '/portal/cases/clients?saved=1');
  assert.deepEqual(seen, [['22222222-2222-4222-8222-222222222222', 'Ana Actualizada', 'Apellido', '+57 311 111 1111']]);
});

test('submit forwards blank fields as null so the provider clears them', async () => {
  const seen: (string | null)[][] = [];
  const result = await submitProfileContact(contactForm({ first_name: '   ', last_name: '', phone: '   ' }), origin, origin, source({
    updateProfileContact: async (_id, first, last, phone) => { seen.push([first, last, phone]); },
  }));
  assert.equal(result, '/portal/cases/clients?saved=1');
  assert.deepEqual(seen, [[null, null, null]]);
});

test('a thrown provider error degrades to the generic error destination', async () => {
  const result = await submitProfileContact(contactForm(), origin, origin, source({
    updateProfileContact: async () => { throw new Error('provider exploded'); },
  }));
  assert.equal(result, '/portal/cases/clients?error=1');
});

test('a thrown access error degrades to the generic error destination', async () => {
  const result = await submitProfileContact(contactForm(), origin, origin, source({
    access: async () => { throw new Error('session unavailable'); },
  }));
  assert.equal(result, '/portal/cases/clients?error=1');
});
