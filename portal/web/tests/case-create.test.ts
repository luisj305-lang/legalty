import test from 'node:test';
import assert from 'node:assert/strict';
import { submitCase, type CaseCreateSource } from '../lib/cases/create.ts';

const origin = 'https://portal.example';
const caseId = '11111111-1111-4111-8111-111111111111';

function form(values: Partial<Record<'reference' | 'title' | 'description' | 'clientEmails' | 'staffEmails', string>> = {}) {
  const data = new FormData();
  for (const [name, value] of Object.entries({
    reference: 'CASE-2026-001', title: 'Contract review', description: 'Visible summary',
    clientEmails: 'client@example.com', staffEmails: '', ...values,
  })) data.set(name, value);
  return data;
}

function fixture() {
  const calls: unknown[] = [];
  let participant = 0;
  const source: CaseCreateSource = {
    access: async () => ({ state: 'eligible', userId: 'admin-id', role: 'admin' }),
    findParticipant: async (email, role) => {
      calls.push(['find', email, role]);
      participant++;
      return [{ id: `00000000-0000-4000-8000-${String(participant).padStart(12, '0')}`, email, role }];
    },
    createCase: async input => { calls.push(['create', input]); return caseId; },
  };
  return { source, calls };
}

test('admin resolves every exact participant before one atomic create', async () => {
  const { source, calls } = fixture();
  const result = await submitCase(form({
    clientEmails: 'first@example.com\nSECOND@example.com',
    staffEmails: 'lawyer@example.com\nassistant@example.com',
  }), origin, origin, source);
  assert.equal(result, `/cases/${caseId}`);
  assert.deepEqual(calls.slice(0, 4), [
    ['find', 'first@example.com', 'client'], ['find', 'SECOND@example.com', 'client'],
    ['find', 'lawyer@example.com', 'staff'], ['find', 'assistant@example.com', 'staff'],
  ]);
  assert.deepEqual(calls[4], ['create', {
    reference: 'CASE-2026-001', title: 'Contract review', description: 'Visible summary',
    clientIds: ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002'],
    staffIds: ['00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000004'],
  }]);
});

test('foreign origins and non-admin access stop before participant lookup or write', async () => {
  const foreign = fixture();
  assert.equal(await submitCase(form(), 'https://foreign.example', origin, foreign.source), '/cases/new?error=create');
  assert.deepEqual(foreign.calls, []);

  for (const role of ['client', 'staff'] as const) {
    const denied = fixture();
    denied.source.access = async () => ({ state: 'eligible', userId: 'user-id', role });
    assert.equal(await submitCase(form(), origin, origin, denied.source), '/cases');
    assert.deepEqual(denied.calls, []);
  }
});

test('unknown or duplicate fields, malformed values, duplicate emails and limits fail before access', async t => {
  const invalid: [string, () => FormData][] = [
    ['unknown field', () => { const data = form(); data.set('role', 'admin'); return data; }],
    ['duplicate field', () => { const data = form(); data.append('title', 'Other'); return data; }],
    ['malformed email', () => form({ clientEmails: 'not-an-email' })],
    ['duplicate email', () => form({ clientEmails: 'Same@example.com\nsame@example.com' })],
    ['missing client', () => form({ clientEmails: '  \n' })],
    ['long reference', () => form({ reference: 'R'.repeat(81) })],
    ['long title', () => form({ title: 'T'.repeat(201) })],
    ['long description', () => form({ description: 'D'.repeat(10001) })],
    ['too many clients', () => form({ clientEmails: Array.from({ length: 101 }, (_, i) => `c${i}@example.com`).join('\n') })],
    ['too many staff', () => form({ staffEmails: Array.from({ length: 101 }, (_, i) => `s${i}@example.com`).join('\n') })],
  ];
  for (const [name, make] of invalid) await t.test(name, async () => {
    const denied = fixture();
    let accessed = false;
    denied.source.access = async () => { accessed = true; return { state: 'eligible', userId: 'admin-id', role: 'admin' }; };
    assert.equal(await submitCase(make(), origin, origin, denied.source), '/cases/new?error=create');
    assert.equal(accessed, false);
    assert.deepEqual(denied.calls, []);
  });
});

test('every lookup row must have the requested exact email, role and UUID before create', async t => {
  const badRows: [string, unknown][] = [
    ['missing', []],
    ['invalid UUID', [{ id: 'not-a-uuid', email: 'client@example.com', role: 'client' }]],
    ['different email', [{ id: caseId, email: 'other@example.com', role: 'client' }]],
    ['different role', [{ id: caseId, email: 'client@example.com', role: 'staff' }]],
    ['multiple rows', [
      { id: caseId, email: 'client@example.com', role: 'client' },
      { id: '22222222-2222-4222-8222-222222222222', email: 'client@example.com', role: 'client' },
    ]],
  ];
  for (const [name, row] of badRows) await t.test(name, async () => {
    const denied = fixture();
    denied.source.findParticipant = async () => row;
    assert.equal(await submitCase(form(), origin, origin, denied.source), '/cases/new?error=create');
    assert.equal(denied.calls.some(call => Array.isArray(call) && call[0] === 'create'), false);
  });
});

test('provider and database failures remain generic', async () => {
  for (const operation of ['find', 'create'] as const) {
    const denied = fixture();
    denied.source[operation === 'find' ? 'findParticipant' : 'createCase'] = async () => {
      throw new Error('SYNTHETIC_DATABASE_SECRET');
    };
    const result = await submitCase(form(), origin, origin, denied.source);
    assert.equal(result, '/cases/new?error=create');
    assert.doesNotMatch(result, /database|secret/i);
  }
});
